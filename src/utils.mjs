import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export function createId(prefix = 'run') {
  const stamp = new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14);
  return `${prefix}-${stamp}-${crypto.randomBytes(3).toString('hex')}`;
}

export function safeJsonParse(text) {
  if (typeof text !== 'string') return text;
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch {}

  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) {
    try { return JSON.parse(fenced[1].trim()); } catch {}
  }

  const first = trimmed.indexOf('{');
  const last = trimmed.lastIndexOf('}');
  if (first !== -1 && last > first) {
    try { return JSON.parse(trimmed.slice(first, last + 1)); } catch {}
  }
  throw new Error('Model did not return valid JSON.');
}

export function clampNumber(value, min, max, fallback) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
}

export async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

export async function writeJson(file, data) {
  await ensureDir(path.dirname(file));
  await fs.writeFile(file, JSON.stringify(data, null, 2), 'utf8');
}

export function sanitizeFilename(name) {
  return String(name || 'file')
    .normalize('NFKD')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 100) || 'file';
}

export function publicError(error) {
  if (!error) return 'Unknown error';
  return error instanceof Error ? error.message : String(error);
}

export function redactSecrets(value, secrets = []) {
  let text = typeof value === 'string' ? value : JSON.stringify(value);
  for (const secret of secrets.filter(Boolean)) {
    text = text.split(secret).join('[REDACTED]');
  }
  return text;
}

export function redactSensitiveText(value, secrets = []) {
  let text = redactSecrets(String(value ?? ''), secrets);
  const patterns = [
    [/\bsk-[a-zA-Z0-9_-]{8,}\b/g, '[REDACTED]'],
    [/\bAIza[a-zA-Z0-9_-]{20,}\b/g, '[REDACTED]'],
    [/\bBearer\s+[a-zA-Z0-9._~+\/-]{12,}\b/gi, 'Bearer [REDACTED]'],
    [/((?:api[_ -]?key|access[_ -]?token|secret|authorization)\s*[:=]\s*["']?)[^\s,"'}]{8,}/gi, '$1[REDACTED]']
  ];
  for (const [pattern, replacement] of patterns) text = text.replace(pattern, replacement);
  return text;
}

export function redactObject(value, secrets = []) {
  if (typeof value === 'string') return redactSensitiveText(value, secrets);
  if (Array.isArray(value)) return value.map((item) => redactObject(item, secrets));
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [redactSensitiveText(key, secrets), redactObject(item, secrets)]));
  }
  return value ?? null;
}

export function normalizeUrl(input) {
  const raw = String(input || '').trim();
  if (!raw) throw new Error('Target URL is required.');
  if (raw === 'aiqa://demo') return raw;
  const candidate = /^[a-zA-Z][a-zA-Z\d+.-]*:/.test(raw) ? raw : `http://${raw}`;
  const url = new URL(candidate);
  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error('Only http:// and https:// targets are supported.');
  }
  return url.toString();
}
