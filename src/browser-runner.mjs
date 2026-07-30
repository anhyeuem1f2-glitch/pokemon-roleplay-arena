import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ChromeController } from './cdp.mjs';
import { requestAgentDecision, validateDecision } from './providers.mjs';
import { ensureDir, normalizeUrl, publicError, redactObject, redactSensitiveText, sleep } from './utils.mjs';
import { writeReport } from './report.mjs';

const ROOT_DIR = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

function browserCandidates(channel = 'auto') {
  const entries = [
    { path: process.env.AIQA_CHROMIUM_PATH, channel: 'auto' },
    { path: process.env.CHROME_PATH, channel: 'chrome' },
    { path: '/usr/bin/chromium', channel: 'chrome' },
    { path: '/usr/bin/chromium-browser', channel: 'chrome' },
    { path: '/usr/bin/google-chrome', channel: 'chrome' },
    { path: '/usr/bin/google-chrome-stable', channel: 'chrome' },
    { path: process.env.PROGRAMFILES && path.join(process.env.PROGRAMFILES, 'Google/Chrome/Application/chrome.exe'), channel: 'chrome' },
    { path: process.env['PROGRAMFILES(X86)'] && path.join(process.env['PROGRAMFILES(X86)'], 'Google/Chrome/Application/chrome.exe'), channel: 'chrome' },
    { path: process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, 'Google/Chrome/Application/chrome.exe'), channel: 'chrome' },
    { path: process.env.PROGRAMFILES && path.join(process.env.PROGRAMFILES, 'Microsoft/Edge/Application/msedge.exe'), channel: 'edge' },
    { path: process.env['PROGRAMFILES(X86)'] && path.join(process.env['PROGRAMFILES(X86)'], 'Microsoft/Edge/Application/msedge.exe'), channel: 'edge' }
  ].filter((entry) => entry.path);
  const filtered = channel === 'auto' ? entries : entries.filter((entry) => entry.channel === channel || entry.channel === 'auto');
  return [...new Map(filtered.map((entry) => [entry.path, entry])).values()].map((entry) => entry.path);
}

function findBrowserExecutable(channel = 'auto') {
  return browserCandidates(channel).find((candidate) => fs.existsSync(candidate));
}

function issueFingerprint(issue) {
  return `${issue.category}|${issue.title}|${issue.target || ''}`.toLowerCase();
}

function reproductionFromSteps(steps, currentStep) {
  return steps
    .filter((s) => s.step <= currentStep && s.action?.type && s.action.type !== 'wait')
    .slice(-8)
    .map((s) => `${s.action.type}${s.action.target ? ` ${s.action.target}` : ''}${s.action.value !== null && s.action.value !== undefined ? ` = ${s.action.value}` : ''}`);
}

function secretValues(run) {
  return [run.config.apiKey, ...Object.values(run.config.targetSecrets || {})].filter(Boolean);
}

function safeText(run, value) {
  return redactSensitiveText(value, secretValues(run));
}

function addIssue(run, raw, context) {
  if (!raw?.title) return;
  const issue = {
    title: safeText(run, raw.title).slice(0, 180),
    severity: raw.severity || 'medium',
    category: raw.category || 'functional',
    description: safeText(run, raw.description || '').slice(0, 4000),
    expected: safeText(run, raw.expected || '').slice(0, 2000),
    actual: safeText(run, raw.actual || '').slice(0, 2000),
    target: raw.target || null,
    confidence: Number.isFinite(Number(raw.confidence)) ? Number(raw.confidence) : 0.7,
    source: raw.source || 'ai',
    firstSeenStep: context.step,
    url: context.url,
    screenshot: context.screenshot,
    reproduction: reproductionFromSteps(run.steps, context.step)
  };
  const fingerprint = issueFingerprint(issue);
  const normalize = (value) => String(value || '').toLowerCase().replace(/\s+/g, ' ').trim();
  const description = normalize(issue.description || issue.actual);
  const existing = run.issues.find((x) => {
    if (x.fingerprint === fingerprint) return true;
    if (x.category !== issue.category) return false;
    if (x.target && issue.target && x.target !== issue.target) return false;
    const prior = normalize(x.description || x.actual);
    return description && prior && (description === prior || description.includes(prior) || prior.includes(description));
  });
  if (existing) {
    existing.lastSeenStep = context.step;
    existing.occurrences += 1;
    existing.confidence = Math.max(existing.confidence, issue.confidence);
    if (!existing.source.split('+').includes(issue.source)) existing.source += `+${issue.source}`;
    return;
  }
  run.issues.push({ ...issue, fingerprint, lastSeenStep: context.step, occurrences: 1 });
  run.emit('issue', issue);
}

const SNAPSHOT_EXPRESSION = `(async () => {
  const visible = (el) => {
    const style = getComputedStyle(el);
    const rect = el.getBoundingClientRect();
    return style.visibility !== 'hidden' && style.display !== 'none' && Number(style.opacity) > 0 && rect.width > 0 && rect.height > 0;
  };
  const labelFor = (el) => {
    const aria = el.getAttribute('aria-label') || el.getAttribute('title');
    if (aria) return aria.trim();
    const labelledBy = el.getAttribute('aria-labelledby');
    if (labelledBy) {
      const text = labelledBy.split(/\\s+/).map((id) => document.getElementById(id)?.innerText || '').join(' ').trim();
      if (text) return text;
    }
    if (el.id) {
      const label = document.querySelector('label[for="' + CSS.escape(el.id) + '"]');
      if (label?.innerText) return label.innerText.trim();
    }
    const wrapping = el.closest('label');
    if (wrapping?.innerText) return wrapping.innerText.trim();
    return (el.innerText || el.textContent || el.getAttribute('placeholder') || el.getAttribute('alt') || '').trim().replace(/\\s+/g, ' ').slice(0, 180);
  };
  const roleFor = (el) => {
    if (el.getAttribute('role')) return el.getAttribute('role');
    const tag = el.tagName.toLowerCase();
    if (tag === 'a') return 'link';
    if (tag === 'button') return 'button';
    if (tag === 'select') return 'combobox';
    if (tag === 'textarea') return 'textbox';
    if (tag === 'input') {
      const type = (el.getAttribute('type') || 'text').toLowerCase();
      if (['button', 'submit', 'reset'].includes(type)) return 'button';
      if (type === 'checkbox') return 'checkbox';
      if (type === 'radio') return 'radio';
      if (type === 'range') return 'slider';
      return 'textbox';
    }
    return tag;
  };
  const isSensitive = (el) => {
    const haystack = [el.type, el.id, el.name, el.autocomplete, el.placeholder, el.getAttribute('aria-label'), labelFor(el)].filter(Boolean).join(' ');
    return String(el.type || '').toLowerCase() === 'password' || /api.?key|access.?token|secret|authorization|bearer|password|mật khẩu|khoá api|khóa api/i.test(haystack);
  };

  window.__aiqaCounter = window.__aiqaCounter || 1;
  const selector = 'a[href],button,input,textarea,select,[role="button"],[role="link"],[role="textbox"],[contenteditable="true"],[tabindex]:not([tabindex="-1"])';
  const elements = [...document.querySelectorAll(selector)].filter(visible).slice(0, 250).map((el) => {
    if (!el.dataset.aiqaId) el.dataset.aiqaId = 'e' + window.__aiqaCounter++;
    const rect = el.getBoundingClientRect();
    const sensitive = isSensitive(el);
    return {
      id: el.dataset.aiqaId,
      role: roleFor(el),
      name: labelFor(el),
      value: sensitive ? '[REDACTED]' : ('value' in el ? String(el.value || '').slice(0, 300) : ''),
      sensitive,
      disabled: Boolean(el.disabled || el.getAttribute('aria-disabled') === 'true'),
      rect: { x: Math.round(rect.x), y: Math.round(rect.y), width: Math.round(rect.width), height: Math.round(rect.height) }
    };
  });

  const heuristics = [];
  const add = (value) => heuristics.push(value);
  const root = document.documentElement;
  const body = document.body;
  const viewportWidth = window.visualViewport?.width || innerWidth;
  const viewportHeight = window.visualViewport?.height || innerHeight;
  const furthestRight = Math.max(0, ...[...(body?.querySelectorAll('*') || [])].slice(0, 600).filter(visible).map((el) => el.getBoundingClientRect().right + (window.visualViewport?.offsetLeft || 0)));
  const measuredWidth = Math.max(root.scrollWidth, body?.scrollWidth || 0, Math.ceil(furthestRight));
  if (measuredWidth > viewportWidth + 4) add({
    title: 'Horizontal page overflow', severity: 'medium', category: 'visual', target: null, confidence: 0.96,
    description: 'Measured content width ' + measuredWidth + 'px exceeds viewport ' + Math.round(viewportWidth) + 'px.',
    expected: 'The page should fit the selected viewport without unintended horizontal scrolling.',
    actual: Math.round(measuredWidth - viewportWidth) + 'px of horizontal overflow was measured.'
  });
  if (!root.getAttribute('lang')) add({
    title: 'Document language is not declared', severity: 'low', category: 'accessibility', target: null, confidence: 1,
    description: 'The <html> element has no lang attribute.', expected: 'Declare the primary document language.', actual: 'No lang attribute is present.'
  });

  const ids = [...document.querySelectorAll('[id]')].map((el) => el.id).filter(Boolean);
  const duplicate = [...new Set(ids.filter((id, i) => ids.indexOf(id) !== i))].slice(0, 10);
  if (duplicate.length) add({
    title: 'Duplicate element IDs', severity: 'medium', category: 'accessibility', target: null, confidence: 1,
    description: 'Duplicate IDs: ' + duplicate.join(', '), expected: 'HTML IDs should be unique.', actual: 'Multiple elements share the same ID.'
  });

  for (const item of elements) {
    const el = document.querySelector('[data-aiqa-id="' + CSS.escape(item.id) + '"]');
    if (!el) continue;
    if (!item.name && ['button', 'link', 'textbox', 'checkbox', 'radio', 'combobox'].includes(item.role)) add({
      title: 'Interactive control has no accessible name', severity: 'high', category: 'accessibility', target: item.id, confidence: 0.98,
      description: item.role + ' ' + item.id + ' has no visible or programmatic name.', expected: 'Every interactive control should have an understandable accessible name.', actual: 'Accessible name is empty.'
    });
    if ((item.rect.width < 24 || item.rect.height < 24) && ['button', 'link', 'checkbox', 'radio'].includes(item.role)) add({
      title: 'Interactive target is very small', severity: 'low', category: 'accessibility', target: item.id, confidence: 0.88,
      description: item.id + ' measures ' + item.rect.width + 'x' + item.rect.height + 'px.', expected: 'Interactive targets should be large enough to activate reliably.', actual: 'At least one dimension is under 24px.'
    });
    const style = getComputedStyle(el);
    const clippedX = el.scrollWidth > el.clientWidth + 2 && ['hidden', 'clip'].includes(style.overflowX || style.overflow);
    const clippedY = el.scrollHeight > el.clientHeight + 2 && ['hidden', 'clip'].includes(style.overflowY || style.overflow);
    if (clippedX || clippedY) add({
      title: 'Content appears clipped', severity: 'medium', category: 'visual', target: item.id, confidence: 0.82,
      description: item.id + ' has scroll size ' + el.scrollWidth + 'x' + el.scrollHeight + ' but client size ' + el.clientWidth + 'x' + el.clientHeight + ' with clipped overflow.',
      expected: 'Important text and controls should remain fully visible.', actual: 'The element content exceeds its visible box.'
    });
  }

  for (const el of [...document.querySelectorAll('p,div,span,li,h1,h2,h3,label')].filter(visible).slice(0, 300)) {
    const style = getComputedStyle(el);
    const clippedX = el.scrollWidth > el.clientWidth + 3 && ['hidden', 'clip'].includes(style.overflowX || style.overflow);
    const clippedY = el.scrollHeight > el.clientHeight + 3 && ['hidden', 'clip'].includes(style.overflowY || style.overflow);
    if (clippedX || clippedY) {
      const sample = (el.innerText || el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 120);
      add({
        title: 'Text content appears clipped', severity: 'medium', category: 'visual', target: null, confidence: 0.9,
        description: '<' + el.tagName.toLowerCase() + '> content exceeds its visible box: ' + sample,
        expected: 'Important instructions and labels should be fully readable.', actual: 'The browser reports hidden overflow while content is larger than the box.'
      });
      break;
    }
  }

  let storage = { localStorage: null, sessionStorage: null, indexedDB: [] };
  try {
    const describe = (store) => ({ keys: Object.keys(store).slice(0, 80), entries: store.length, totalChars: Object.keys(store).reduce((sum, key) => sum + key.length + String(store.getItem(key) || '').length, 0) });
    storage.localStorage = describe(localStorage);
    storage.sessionStorage = describe(sessionStorage);
    if (indexedDB.databases) storage.indexedDB = (await indexedDB.databases()).map((db) => ({ name: db.name || '', version: db.version || 0 })).slice(0, 30);
  } catch {}
  const busySelector = '[aria-busy="true"],[data-loading="true"],[data-streaming="true"],.loading,.streaming,.typing-indicator';
  const liveText = [...document.querySelectorAll('[aria-live], [role="status"], [role="log"]')].filter(visible).map((el) => (el.innerText || el.textContent || '').trim()).filter(Boolean).join('\\n').slice(-1500);

  return {
    url: location.href,
    title: document.title,
    visibleText: (document.body?.innerText || '').replace(/\\n{3,}/g, '\\n\\n').slice(0, 14000),
    elements,
    sensitiveRects: elements.filter((item) => item.sensitive).map((item) => item.rect),
    storage,
    roleplay: { busyIndicators: document.querySelectorAll(busySelector).length, liveText },
    surfaces: [...document.querySelectorAll('canvas,iframe,svg')].filter(visible).slice(0, 30).map((el) => {
      const r = el.getBoundingClientRect();
      return { tag: el.tagName.toLowerCase(), title: el.getAttribute('title') || el.getAttribute('aria-label') || '', rect: { x: Math.round(r.x - (window.visualViewport?.offsetLeft || 0)), y: Math.round(r.y - (window.visualViewport?.offsetTop || 0)), width: Math.round(r.width), height: Math.round(r.height) } };
    }),
    viewport: { width: Math.round(viewportWidth), height: Math.round(viewportHeight), scrollWidth: measuredWidth, scrollHeight: Math.max(root.scrollHeight, body?.scrollHeight || 0) },
    scroll: { x: Math.round(scrollX), y: Math.round(scrollY) },
    heuristics: heuristics.slice(0, 50)
  };
})()`;

async function collectSnapshot(controller, signalState, secrets = []) {
  const pageData = await controller.evaluate(SNAPSHOT_EXPRESSION);
  for (const element of pageData.elements || []) {
    if (controller.sensitiveTargetIds.has(element.id)) {
      element.sensitive = true;
      element.value = '[REDACTED]';
    }
  }
  pageData.sensitiveRects = (pageData.elements || []).filter((element) => element.sensitive).map((element) => element.rect);
  const recent = controller.trace.slice(signalState.cursor);
  signalState.cursor = controller.trace.length;
  const runtimeSignals = { consoleErrors: [], pageErrors: [], networkErrors: [] };
  for (const event of recent) {
    if (event.type === 'console' && event.data.level === 'error') runtimeSignals.consoleErrors.push({ text: event.data.text, at: event.at });
    if (event.type === 'exception') runtimeSignals.pageErrors.push({ text: event.data.text, at: event.at });
    if (event.type === 'network-response' && Number(event.data.status) >= 400) runtimeSignals.networkErrors.push({ method: 'GET', url: event.data.url, status: event.data.status, at: event.at });
    if (event.type === 'network-failed' && !event.data.canceled) runtimeSignals.networkErrors.push({ method: event.data.method || 'GET', url: event.data.url || '', error: event.data.error, at: event.at });
  }
  return redactObject({ ...pageData, runtimeSignals }, secrets);
}

function parseCoordinates(value, expectedCount) {
  const numbers = String(value ?? '').match(/-?\d+(?:\.\d+)?/g)?.map(Number) || [];
  if (numbers.length < expectedCount || numbers.slice(0, expectedCount).some((n) => !Number.isFinite(n))) {
    throw new Error(`Expected ${expectedCount} numeric coordinates, received: ${value}`);
  }
  return numbers.slice(0, expectedCount);
}

async function executeAction(controller, action, initialOrigin, config) {
  switch (action.type) {
    case 'click':
      if (!action.target) throw new Error('click requires target');
      await controller.click(action.target);
      return `Clicked ${action.target}`;
    case 'click_point': {
      const [x, y] = parseCoordinates(action.value ?? action.target, 2);
      await controller.clickPoint(x, y);
      return `Clicked point ${Math.round(x)},${Math.round(y)}`;
    }
    case 'drag_point': {
      const [x1, y1, x2, y2] = parseCoordinates(action.value ?? action.target, 4);
      await controller.dragPoint(x1, y1, x2, y2);
      return `Dragged ${Math.round(x1)},${Math.round(y1)} to ${Math.round(x2)},${Math.round(y2)}`;
    }
    case 'fill':
      if (!action.target) throw new Error('fill requires target');
      await controller.fill(action.target, action.value);
      return `Filled ${action.target}`;
    case 'fill_secret': {
      if (!action.target) throw new Error('fill_secret requires target');
      const secretName = String(action.value || '');
      const secret = config.targetSecrets?.[secretName];
      if (!secret) throw new Error(`Secret reference is unavailable: ${secretName}`);
      controller.sensitiveTargetIds.add(action.target);
      await controller.fill(action.target, secret);
      return `Filled secret ${secretName} into ${action.target}`;
    }
    case 'select':
      if (!action.target) throw new Error('select requires target');
      await controller.select(action.target, action.value);
      return `Selected ${action.value} in ${action.target}`;
    case 'press':
      await controller.press(action.target, action.value || 'Enter');
      return `Pressed ${action.value || 'Enter'}${action.target ? ` on ${action.target}` : ''}`;
    case 'scroll': {
      const delta = Math.max(-2000, Math.min(2000, Number(action.value) || 600));
      await controller.evaluate(`window.scrollBy({ top: ${delta}, behavior: 'instant' })`);
      return `Scrolled ${delta}px`;
    }
    case 'wait': {
      const ms = Math.max(250, Math.min(5000, Number(action.value) || 1000));
      await sleep(ms);
      return `Waited ${ms}ms`;
    }
    case 'wait_until_idle': {
      const configuredMs = Math.max(5000, Math.min(300_000, Number(config.responseTimeoutMs) || 120_000));
      const requestedMs = Math.max(5000, Math.min(configuredMs, (Number(action.value) || configuredMs / 1000) * 1000));
      const idle = await controller.waitForPageIdle(requestedMs);
      if (!idle.idle) throw new Error(`Roleplay response did not become idle within ${Math.round(requestedMs / 1000)}s`);
      return `Page became idle after ${Math.round(idle.elapsedMs / 100) / 10}s`;
    }
    case 'goto': {
      const current = await controller.evaluate('location.href');
      const next = new URL(String(action.value || ''), current);
      if (!['http:', 'https:'].includes(next.protocol) || next.origin !== initialOrigin) throw new Error('goto is restricted to the initial target origin');
      await controller.navigate(next.toString());
      return `Navigated to ${next}`;
    }
    case 'reload':
      await controller.reload();
      return 'Reloaded the page';
    case 'back':
      await controller.goBack();
      return 'Navigated back';
    case 'finish':
      return 'Agent finished';
    default:
      throw new Error(`Unsupported action: ${action.type}`);
  }
}

export async function runBrowserAgent(run) {
  const browserChannel = run.config.emulation?.browserChannel || 'auto';
  const executablePath = findBrowserExecutable(browserChannel);
  if (!executablePath) throw new Error(`Không tìm thấy trình duyệt cho kênh ${browserChannel}. Hãy cài Chrome/Edge hoặc đặt biến AIQA_CHROMIUM_PATH tới file thực thi.`);
  const targetUrl = normalizeUrl(run.config.targetUrl);
  const isBuiltInDemo = targetUrl === 'aiqa://demo';
  const initialOrigin = isBuiltInDemo ? 'aiqa://demo' : new URL(targetUrl).origin;
  await ensureDir(run.dir);
  run.status = 'starting';
  run.emit('status', { status: run.status, message: `Launching browser: ${executablePath}` });

  const traceEvents = [];
  const secrets = secretValues(run);
  const controller = new ChromeController({
    executablePath,
    viewport: run.config.viewport,
    emulation: run.config.emulation,
    headless: run.config.headless !== false,
    trace: traceEvents
  });
  const signalState = { cursor: 0 };
  let finalStatus = 'completed';
  run.tracePath = path.join(run.dir, 'browser-trace.json');

  try {
    await controller.launch();
    if (isBuiltInDemo) {
      const rawDemoHtml = await fsp.readFile(path.join(ROOT_DIR, 'demo', 'buggy-game.html'), 'utf8');
      const demoHtml = rawDemoHtml.replace("fetch('/demo/missing-resource.json');", "fetch('http://127.0.0.1:9/missing-resource.json').catch(() => {});");
      await controller.evaluate(`document.open(); document.write(${JSON.stringify(demoHtml)}); document.close();`);
    } else {
      await controller.navigate(targetUrl);
    }
    await sleep(700);
    run.status = 'running';
    run.emit('status', { status: run.status, message: 'AI is exploring the product.' });

    for (let step = 1; step <= run.config.maxSteps && !run.cancelled; step += 1) {
      const screenshot = path.join(run.dir, `step-${String(step).padStart(3, '0')}.jpg`);
      const snapshot = await collectSnapshot(controller, signalState, secrets);
      const displayedSecretRects = await controller.findSecretRects(secrets);
      const screenshotBuffer = await controller.screenshot(screenshot, 62, [...(snapshot.sensitiveRects || []), ...displayedSecretRects]);
      const screenshotDataUrl = `data:image/jpeg;base64,${screenshotBuffer.toString('base64')}`;
      if (isBuiltInDemo) snapshot.url = targetUrl;
      const contextInfo = { step, url: snapshot.url, screenshot };

      for (const heuristic of snapshot.heuristics) addIssue(run, { ...heuristic, source: 'heuristic' }, contextInfo);
      for (const error of snapshot.runtimeSignals.pageErrors) addIssue(run, {
        title: 'Uncaught page error', severity: 'critical', category: 'runtime', source: 'runtime', confidence: 1,
        description: error.text, expected: 'The page should complete the player flow without uncaught exceptions.', actual: error.text
      }, contextInfo);
      for (const error of snapshot.runtimeSignals.consoleErrors) addIssue(run, {
        title: 'Console error', severity: 'high', category: 'runtime', source: 'runtime', confidence: 0.98,
        description: error.text, expected: 'The tested flow should not emit error-level console messages.', actual: error.text
      }, contextInfo);
      for (const error of snapshot.runtimeSignals.networkErrors) addIssue(run, {
        title: `Network request failed${error.status ? ` (${error.status})` : ''}`,
        severity: error.status >= 500 ? 'high' : 'medium', category: 'network', source: 'runtime', confidence: 0.99,
        description: `${error.method} ${error.url}`, expected: 'Resources required by the tested flow should load successfully.', actual: String(error.status || error.error)
      }, contextInfo);

      run.emit('screenshot', { step, url: snapshot.url, path: path.basename(screenshot) });
      run.emit('step', { step, phase: 'thinking', url: snapshot.url, elements: snapshot.elements.length });

      let decision;
      try {
        decision = redactObject(validateDecision(await requestAgentDecision({
          providerId: run.config.providerId,
          baseUrl: run.config.baseUrl,
          apiKey: run.config.apiKey,
          model: run.config.model,
          snapshot,
          screenshotDataUrl,
          mission: run.config.mission,
          history: run.steps,
          targetProfile: run.config.appProfile,
          secretNames: Object.keys(run.config.targetSecrets || {})
        })), secrets);
      } catch (error) {
        const failedStep = {
          step, url: snapshot.url, screenshot, observation: '', reasoningSummary: '',
          action: { type: 'finish', target: null, value: null }, result: `Model error: ${safeText(run, publicError(error))}`, issues: []
        };
        run.steps.push(failedStep);
        addIssue(run, {
          title: 'AI model call failed', severity: 'critical', category: 'runtime', source: 'orchestrator', confidence: 1,
          description: safeText(run, publicError(error)), expected: 'The selected model should return one valid QA action.', actual: safeText(run, publicError(error))
        }, contextInfo);
        run.emit('step', { step, phase: 'error', result: failedStep.result });
        break;
      }

      for (const issue of decision.issues) addIssue(run, { ...issue, source: 'ai' }, contextInfo);
      let result;
      try {
        result = await executeAction(controller, decision.action, initialOrigin, run.config);
        if (decision.action.type !== 'finish') await sleep(450);
      } catch (error) {
        result = `Action failed: ${safeText(run, publicError(error))}`;
        addIssue(run, {
          title: 'Agent action could not be executed', severity: 'medium', category: 'functional', source: 'orchestrator', confidence: 0.9,
          description: result, expected: 'The selected visible control should accept the proposed user action.', actual: result, target: decision.action.target
        }, contextInfo);
      }

      const stepRecord = {
        step,
        url: snapshot.url,
        screenshot,
        observation: decision.observation,
        reasoningSummary: decision.reasoning_summary,
        action: decision.action,
        result,
        pageText: snapshot.visibleText.slice(0, 3000),
        issues: decision.issues
      };
      run.steps.push(stepRecord);
      traceEvents.push({ at: new Date().toISOString(), type: 'agent-step', data: { ...stepRecord, screenshot: path.basename(screenshot) } });
      run.emit('step', { step, phase: 'completed', ...stepRecord, screenshot: path.basename(screenshot) });
      if (decision.done || decision.action.type === 'finish') break;
    }

    run.finalUrl = isBuiltInDemo ? targetUrl : await controller.evaluate('location.href').catch(() => targetUrl);
    finalStatus = run.cancelled ? 'cancelled' : 'completed';
    run.status = 'finalizing';
  } catch (error) {
    finalStatus = 'failed';
    run.status = 'finalizing';
    run.error = safeText(run, publicError(error));
  } finally {
    run.finishedAt = new Date().toISOString();
    await fsp.writeFile(run.tracePath, JSON.stringify(redactObject(traceEvents, secrets), null, 2), 'utf8').catch(() => {});
    await controller.close().catch(() => {});
    run.status = finalStatus;
    try {
      await writeReport(run);
      run.reportReady = true;
    } catch (error) {
      run.status = 'failed';
      run.error = `Report generation failed: ${publicError(error)}`;
    }
    run.config.apiKey = '';
    run.config.targetSecrets = {};
    run.emit('status', { status: run.status, message: run.error || `Finished with ${run.issues.length} unique issues.` });
  }
}
