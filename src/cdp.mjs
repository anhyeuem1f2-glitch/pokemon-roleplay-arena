import fs from 'node:fs';
import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import { spawn } from 'node:child_process';
import { sleep, publicError } from './utils.mjs';

async function findFreePort() {
  return await new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      server.close(() => resolve(address.port));
    });
  });
}

async function waitForJson(url, timeoutMs = 15_000) {
  const started = Date.now();
  let lastError;
  while (Date.now() - started < timeoutMs) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(1500) });
      if (response.ok) return await response.json();
      lastError = new Error(`HTTP ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    await sleep(120);
  }
  throw new Error(`Chrome DevTools endpoint did not start: ${publicError(lastError)}`);
}

export class CdpSession {
  constructor(webSocketUrl) {
    this.webSocketUrl = webSocketUrl;
    this.ws = null;
    this.nextId = 1;
    this.pending = new Map();
    this.listeners = new Map();
  }

  async connect() {
    this.ws = new WebSocket(this.webSocketUrl);
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Timed out connecting to Chrome DevTools.')), 10_000);
      this.ws.addEventListener('open', () => { clearTimeout(timer); resolve(); }, { once: true });
      this.ws.addEventListener('error', () => { clearTimeout(timer); reject(new Error('Cannot connect to Chrome DevTools WebSocket.')); }, { once: true });
    });
    this.ws.addEventListener('message', (event) => this.#onMessage(event.data));
    this.ws.addEventListener('close', () => {
      for (const { reject } of this.pending.values()) reject(new Error('Chrome DevTools connection closed.'));
      this.pending.clear();
    });
  }

  #onMessage(raw) {
    let message;
    try { message = JSON.parse(String(raw)); } catch { return; }
    if (message.id) {
      const pending = this.pending.get(message.id);
      if (!pending) return;
      this.pending.delete(message.id);
      clearTimeout(pending.timer);
      if (message.error) pending.reject(new Error(message.error.message || 'CDP error'));
      else pending.resolve(message.result || {});
      return;
    }
    if (message.method) {
      for (const listener of this.listeners.get(message.method) || []) {
        try { listener(message.params || {}); } catch {}
      }
    }
  }

  on(method, listener) {
    if (!this.listeners.has(method)) this.listeners.set(method, new Set());
    this.listeners.get(method).add(listener);
    return () => this.listeners.get(method)?.delete(listener);
  }

  waitFor(method, timeoutMs = 15_000) {
    return new Promise((resolve, reject) => {
      const off = this.on(method, (params) => { clearTimeout(timer); off(); resolve(params); });
      const timer = setTimeout(() => { off(); reject(new Error(`Timed out waiting for ${method}`)); }, timeoutMs);
    });
  }

  send(method, params = {}, timeoutMs = 30_000) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) throw new Error('CDP session is not connected.');
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`CDP command timed out: ${method}`));
      }, timeoutMs);
      this.pending.set(id, { resolve, reject, timer });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  async evaluate(expression, { awaitPromise = true } = {}) {
    const result = await this.send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise,
      userGesture: true
    });
    if (result.exceptionDetails) {
      throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text || 'Page evaluation failed.');
    }
    return result.result?.value;
  }

  close() {
    try { this.ws?.close(); } catch {}
  }
}

export class ChromeController {
  constructor({ executablePath, viewport, emulation = {}, headless = true, trace = [] }) {
    this.executablePath = executablePath;
    this.viewport = viewport;
    this.emulation = emulation;
    this.headless = headless;
    this.trace = trace;
    this.process = null;
    this.profileDir = null;
    this.port = null;
    this.session = null;
    this.requestMap = new Map();
    this.inflightRequests = new Map();
    this.sensitiveTargetIds = new Set();
  }

  async launch() {
    this.port = await findFreePort();
    this.profileDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'aiqa-chrome-'));
    const args = [
      `--remote-debugging-port=${this.port}`,
      `--user-data-dir=${this.profileDir}`,
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-background-networking',
      '--disable-component-update',
      '--disable-sync',
      '--disable-extensions',
      '--disable-popup-blocking',
      '--disable-features=Translate,MediaRouter,OptimizationHints',
      '--ignore-certificate-errors',
      '--no-sandbox',
      '--disable-dev-shm-usage',
      `--window-size=${this.viewport.width},${this.viewport.height}`,
      'about:blank'
    ];
    if (this.headless) args.unshift('--headless=new');
    this.process = spawn(this.executablePath, args, { stdio: ['ignore', 'ignore', 'pipe'] });
    let stderr = '';
    this.process.stderr.on('data', (chunk) => { stderr += String(chunk); if (stderr.length > 20_000) stderr = stderr.slice(-20_000); });
    this.process.once('exit', (code) => {
      if (code && !this.session) this.launchError = `Chrome exited with code ${code}: ${stderr.slice(-1000)}`;
    });

    const listUrl = `http://127.0.0.1:${this.port}/json/list`;
    const targets = await waitForJson(listUrl);
    const pageTarget = targets.find((target) => target.type === 'page');
    if (!pageTarget?.webSocketDebuggerUrl) throw new Error(this.launchError || 'No Chrome page target was created.');
    this.session = new CdpSession(pageTarget.webSocketDebuggerUrl);
    await this.session.connect();
    await Promise.all([
      this.session.send('Page.enable'),
      this.session.send('Runtime.enable'),
      this.session.send('Network.enable'),
      this.session.send('Log.enable'),
      this.session.send('DOM.enable')
    ]);
    await this.session.send('Emulation.setDeviceMetricsOverride', {
      width: this.viewport.width,
      height: this.viewport.height,
      deviceScaleFactor: Number(this.emulation.deviceScaleFactor || 1),
      mobile: this.emulation.mobile ?? this.viewport.width <= 500
    });
    await this.session.send('Emulation.setTouchEmulationEnabled', {
      enabled: Boolean(this.emulation.hasTouch),
      maxTouchPoints: this.emulation.hasTouch ? 5 : 1
    });
    if (this.emulation.userAgent) {
      await this.session.send('Network.setUserAgentOverride', {
        userAgent: this.emulation.userAgent,
        platform: this.emulation.mobile ? 'Android' : ''
      });
    }
    this.#wireTrace();
    return this;
  }

  #wireTrace() {
    const record = (type, data) => this.trace.push({ at: new Date().toISOString(), type, data });
    this.session.on('Network.requestWillBeSent', (event) => {
      this.requestMap.set(event.requestId, { method: event.request.method, url: event.request.url });
      if (!String(event.request.url || '').startsWith('data:')) this.inflightRequests.set(event.requestId, Date.now());
      record('network-request', { method: event.request.method, url: event.request.url });
    });
    this.session.on('Network.responseReceived', (event) => record('network-response', { url: event.response.url, status: event.response.status, mimeType: event.response.mimeType }));
    this.session.on('Network.loadingFinished', (event) => this.inflightRequests.delete(event.requestId));
    this.session.on('Network.loadingFailed', (event) => {
      this.inflightRequests.delete(event.requestId);
      record('network-failed', { ...(this.requestMap.get(event.requestId) || {}), error: event.errorText, canceled: event.canceled });
    });
    this.session.on('Runtime.consoleAPICalled', (event) => record('console', { level: event.type, text: (event.args || []).map((arg) => arg.value ?? arg.description ?? '').join(' ') }));
    this.session.on('Runtime.exceptionThrown', (event) => record('exception', { text: event.exceptionDetails?.exception?.description || event.exceptionDetails?.text }));
    this.session.on('Log.entryAdded', (event) => record('log', event.entry));
  }

  async navigate(url) {
    const loaded = this.session.waitFor('Page.loadEventFired', 30_000).catch(() => null);
    const result = await this.session.send('Page.navigate', { url }, 30_000);
    if (result.errorText) throw new Error(result.errorText);
    await loaded;
  }

  async reload() {
    const loaded = this.session.waitFor('Page.loadEventFired', 30_000).catch(() => null);
    await this.session.send('Page.reload', { ignoreCache: false }, 30_000);
    await loaded;
  }

  async goBack() {
    const history = await this.session.send('Page.getNavigationHistory');
    const previous = history.entries?.[history.currentIndex - 1];
    if (!previous) throw new Error('No previous history entry.');
    const loaded = this.session.waitFor('Page.loadEventFired', 30_000).catch(() => null);
    await this.session.send('Page.navigateToHistoryEntry', { entryId: previous.id });
    await loaded;
  }

  async evaluate(expression, options) {
    return this.session.evaluate(expression, options);
  }

  async screenshot(file, quality = 62, masks = []) {
    if (masks.length) {
      await this.evaluate(`(() => {
        document.getElementById('__aiqa_secret_masks__')?.remove();
        const root = document.createElement('div');
        root.id = '__aiqa_secret_masks__';
        root.setAttribute('aria-hidden', 'true');
        root.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:2147483647';
        for (const rect of ${JSON.stringify(masks.slice(0, 50))}) {
          const mask = document.createElement('div');
          mask.textContent = 'REDACTED';
          mask.style.cssText = 'position:fixed;background:#111;color:#fff;border:1px solid #ff6b7a;display:grid;place-items:center;font:700 10px sans-serif;overflow:hidden';
          mask.style.left = Math.max(0, rect.x) + 'px';
          mask.style.top = Math.max(0, rect.y) + 'px';
          mask.style.width = Math.max(8, rect.width) + 'px';
          mask.style.height = Math.max(8, rect.height) + 'px';
          root.append(mask);
        }
        document.documentElement.append(root);
      })()`);
    }
    try {
      const result = await this.session.send('Page.captureScreenshot', { format: 'jpeg', quality, fromSurface: true, captureBeyondViewport: false }, 30_000);
      const buffer = Buffer.from(result.data, 'base64');
      await fsp.writeFile(file, buffer);
      return buffer;
    } finally {
      if (masks.length) await this.evaluate(`document.getElementById('__aiqa_secret_masks__')?.remove()`).catch(() => {});
    }
  }

  async findSecretRects(secrets = []) {
    if (!secrets.length) return [];
    return await this.evaluate(`(() => {
      const secrets = ${JSON.stringify(secrets.filter(Boolean))};
      const rects = [];
      const candidates = [...document.querySelectorAll('input,textarea,select,code,pre,p,span,div')].slice(0, 2500);
      for (const el of candidates) {
        const value = 'value' in el ? String(el.value || '') : '';
        const text = el.children.length ? '' : String(el.textContent || '');
        if (!secrets.some((secret) => value.includes(secret) || text.includes(secret))) continue;
        const rect = el.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) rects.push({ x: Math.round(rect.x), y: Math.round(rect.y), width: Math.round(rect.width), height: Math.round(rect.height) });
      }
      return rects.slice(0, 50);
    })()`).catch(() => []);
  }

  async waitForPageIdle(timeoutMs = 120_000, quietMs = 1500) {
    const started = Date.now();
    let lastSignature = '';
    let stableSince = Date.now();
    while (Date.now() - started < timeoutMs) {
      const state = await this.evaluate(`(() => {
        const busySelector = '[aria-busy="true"],[data-loading="true"],[data-streaming="true"],.loading,.streaming,.typing-indicator';
        const visible = (el) => {
          const style = getComputedStyle(el);
          const rect = el.getBoundingClientRect();
          return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0;
        };
        const text = (document.body?.innerText || '').slice(-4000);
        return { signature: text.length + ':' + text.slice(-800), busy: document.querySelectorAll(busySelector).length };
      })()`).catch(() => ({ signature: '', busy: 1 }));
      if (state.signature !== lastSignature) {
        lastSignature = state.signature;
        stableSince = Date.now();
      }
      const stableFor = Date.now() - stableSince;
      const activeNetwork = [...this.inflightRequests.values()].filter((at) => Date.now() - at < timeoutMs).length;
      if (state.busy === 0 && stableFor >= quietMs && (activeNetwork === 0 || stableFor >= quietMs * 3)) {
        return { idle: true, elapsedMs: Date.now() - started, activeNetwork };
      }
      await sleep(250);
    }
    return { idle: false, elapsedMs: Date.now() - started, activeNetwork: this.inflightRequests.size };
  }

  async elementPoint(targetId) {
    return await this.evaluate(`(() => {
      const el = document.querySelector('[data-aiqa-id="${String(targetId).replace(/["\\]/g, '\\$&')}"]');
      if (!el) throw new Error('Target element not found');
      el.scrollIntoView({ block: 'center', inline: 'center', behavior: 'instant' });
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height) throw new Error('Target element is not visible');
      const vv = window.visualViewport;
      return {
        x: r.left + r.width / 2 - (vv?.offsetLeft || 0),
        y: r.top + r.height / 2 - (vv?.offsetTop || 0)
      };
    })()`);
  }

  async click(targetId) {
    const point = await this.elementPoint(targetId);
    await this.session.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: point.x, y: point.y });
    await this.session.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: point.x, y: point.y, button: 'left', buttons: 1, clickCount: 1 });
    await this.session.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: point.x, y: point.y, button: 'left', buttons: 0, clickCount: 1 });
  }

  async clickPoint(x, y) {
    await this.session.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y });
    await this.session.send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', buttons: 1, clickCount: 1 });
    await this.session.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', buttons: 0, clickCount: 1 });
  }

  async dragPoint(x1, y1, x2, y2) {
    await this.session.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: x1, y: y1 });
    await this.session.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: x1, y: y1, button: 'left', buttons: 1, clickCount: 1 });
    const segments = 8;
    for (let i = 1; i <= segments; i += 1) {
      const x = x1 + (x2 - x1) * (i / segments);
      const y = y1 + (y2 - y1) * (i / segments);
      await this.session.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y, button: 'left', buttons: 1 });
    }
    await this.session.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: x2, y: y2, button: 'left', buttons: 0, clickCount: 1 });
  }

  async fill(targetId, value) {
    await this.click(targetId);
    await this.evaluate(`(() => {
      const el = document.querySelector('[data-aiqa-id="${String(targetId).replace(/["\\]/g, '\\$&')}"]');
      if (!el) throw new Error('Target element not found');
      el.focus();
      if (typeof el.select === 'function') el.select();
    })()`);
    await this.session.send('Input.insertText', { text: String(value ?? '') });
  }

  async select(targetId, value) {
    await this.evaluate(`(() => {
      const el = document.querySelector('[data-aiqa-id="${String(targetId).replace(/["\\]/g, '\\$&')}"]');
      if (!el) throw new Error('Target element not found');
      const wanted = ${JSON.stringify(String(value ?? ''))};
      const option = [...el.options].find(o => o.value === wanted || o.text === wanted);
      if (!option) throw new Error('Option not found: ' + wanted);
      el.value = option.value;
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    })()`);
  }

  async press(targetId, key) {
    if (targetId) await this.click(targetId);
    const value = String(key || 'Enter');
    const codeMap = { Enter: 'Enter', Tab: 'Tab', Escape: 'Escape', ArrowDown: 'ArrowDown', ArrowUp: 'ArrowUp', ArrowLeft: 'ArrowLeft', ArrowRight: 'ArrowRight', Space: 'Space' };
    const code = codeMap[value] || (value.length === 1 ? `Key${value.toUpperCase()}` : value);
    await this.session.send('Input.dispatchKeyEvent', { type: 'keyDown', key: value, code });
    await this.session.send('Input.dispatchKeyEvent', { type: 'keyUp', key: value, code });
  }

  async close() {
    this.session?.close();
    if (this.process && !this.process.killed) {
      this.process.kill('SIGTERM');
      await sleep(250);
      if (!this.process.killed) this.process.kill('SIGKILL');
    }
    if (this.profileDir && fs.existsSync(this.profileDir)) await fsp.rm(this.profileDir, { recursive: true, force: true }).catch(() => {});
  }
}
