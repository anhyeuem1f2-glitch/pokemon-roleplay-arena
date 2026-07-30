import fs from 'node:fs/promises';
import path from 'node:path';
import { writeJson } from './utils.mjs';

export const EMULATION_PROFILES = [
  {
    id: 'desktop-chrome',
    name: 'Desktop · Chrome 1440 × 900',
    browserChannel: 'chrome',
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
    mobile: false,
    hasTouch: false
  },
  {
    id: 'desktop-edge',
    name: 'Desktop · Edge 1440 × 900',
    browserChannel: 'edge',
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
    mobile: false,
    hasTouch: false
  },
  {
    id: 'laptop-chrome',
    name: 'Laptop · Chrome 1366 × 768',
    browserChannel: 'chrome',
    viewport: { width: 1366, height: 768 },
    deviceScaleFactor: 1,
    mobile: false,
    hasTouch: false
  },
  {
    id: 'tablet-chrome',
    name: 'Tablet · Chrome 768 × 1024',
    browserChannel: 'chrome',
    viewport: { width: 768, height: 1024 },
    deviceScaleFactor: 2,
    mobile: true,
    hasTouch: true,
    userAgent: 'Mozilla/5.0 (Linux; Android 13; Pixel C) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'
  },
  {
    id: 'mobile-android',
    name: 'Mobile Android · Chrome 390 × 844',
    browserChannel: 'chrome',
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    mobile: true,
    hasTouch: true,
    userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36'
  },
  {
    id: 'mobile-ios',
    name: 'Mobile iOS · Web viewport 393 × 852',
    browserChannel: 'chrome',
    viewport: { width: 393, height: 852 },
    deviceScaleFactor: 3,
    mobile: true,
    hasTouch: true,
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1'
  }
];

export function getEmulationProfile(id) {
  const profile = EMULATION_PROFILES.find((item) => item.id === id);
  if (!profile) throw new Error(`Unknown emulation profile: ${id}`);
  return structuredClone(profile);
}

export function buildMatrixCombinations(agents, emulationIds, limit = 32, targetUrls = [null]) {
  if (!Array.isArray(agents) || !agents.length) throw new Error('Add at least one API/model configuration.');
  if (!Array.isArray(emulationIds) || !emulationIds.length) throw new Error('Select at least one browser emulation profile.');
  const emulations = [...new Set(emulationIds.map(String))].map(getEmulationProfile);
  const targets = [...new Set((targetUrls?.length ? targetUrls : [null]).map((value) => value == null ? null : String(value)))];
  const combinations = agents.flatMap((agent, agentIndex) => emulations.flatMap((emulation, emulationIndex) => targets.map((targetUrl, targetIndex) => ({
    agent,
    agentIndex,
    emulation,
    emulationIndex,
    targetUrl,
    targetIndex
  }))));
  if (combinations.length > limit) throw new Error(`The matrix is limited to ${limit} runs.`);
  return combinations;
}

function issueFingerprint(issue) {
  return String(issue.fingerprint || `${issue.category}|${issue.title}|${issue.target || ''}`).toLowerCase();
}

export function aggregateMatrixIssues(runs) {
  const grouped = new Map();
  for (const run of runs) {
    for (const issue of run.issues || []) {
      const fingerprint = issueFingerprint(issue);
      if (!grouped.has(fingerprint)) {
        grouped.set(fingerprint, {
          ...issue,
          screenshot: undefined,
          observedIn: []
        });
      }
      const aggregate = grouped.get(fingerprint);
      aggregate.confidence = Math.max(Number(aggregate.confidence || 0), Number(issue.confidence || 0));
      aggregate.observedIn.push({
        runId: run.id,
        label: run.label,
        providerId: run.config.providerId,
        model: run.config.model,
        targetUrl: run.config.targetUrl,
        emulation: run.config.emulation?.name || run.config.emulation?.id || 'Custom',
        screenshot: issue.screenshot ? path.relative(run.matrixDir || path.dirname(run.dir), issue.screenshot).replaceAll('\\', '/') : null
      });
    }
  }
  return [...grouped.values()];
}

export async function writeMatrixReport(matrix) {
  const uniqueIssues = aggregateMatrixIssues(matrix.runs);
  const summaries = matrix.runs.map((run) => ({
    id: run.id,
    label: run.label,
    status: run.status,
    error: run.error || null,
    providerId: run.config.providerId,
    model: run.config.model,
    targetUrl: run.config.targetUrl,
    emulation: run.config.emulation,
    completedSteps: run.steps.length,
    issueCount: run.issues.length,
    reportReady: Boolean(run.reportReady),
    directory: path.relative(matrix.dir, run.dir).replaceAll('\\', '/')
  }));
  const json = {
    schemaVersion: 1,
    id: matrix.id,
    status: matrix.status,
    targetUrl: matrix.targetUrl,
    targetUrls: matrix.targetUrls,
    appProfile: matrix.appProfile,
    mission: matrix.mission,
    startedAt: matrix.startedAt,
    finishedAt: matrix.finishedAt,
    concurrency: matrix.concurrency,
    peakActive: matrix.peakActive,
    summary: {
      totalRuns: matrix.runs.length,
      completedRuns: matrix.runs.filter((run) => run.status === 'completed').length,
      failedRuns: matrix.runs.filter((run) => run.status === 'failed').length,
      uniqueIssues: uniqueIssues.length,
      issueOccurrences: matrix.runs.reduce((sum, run) => sum + run.issues.length, 0)
    },
    runs: summaries,
    issues: uniqueIssues
  };
  await writeJson(path.join(matrix.dir, 'matrix-report.json'), json);

  const rows = summaries.map((run) => `| ${run.label} | ${run.status} | ${run.completedSteps} | ${run.issueCount} | ${run.reportReady ? `[báo cáo](./${run.directory}/report.md)` : '—'} |`).join('\n');
  const issues = uniqueIssues.length ? uniqueIssues.map((issue, index) => {
    const seen = issue.observedIn.map((item) => `  - ${item.label}${item.screenshot ? ` · [ảnh](./${item.screenshot})` : ''}`).join('\n');
    return `### ${index + 1}. [${String(issue.severity || 'medium').toUpperCase()}] ${issue.title}\n\n- **Loại:** ${issue.category || 'functional'}\n- **Mô tả:** ${issue.description || '—'}\n- **Xuất hiện trong:**\n${seen}`;
  }).join('\n\n') : 'Không phát hiện lỗi trong phạm vi matrix này.';

  const markdown = `# Báo cáo kiểm thử song song\n\n## Tổng quan\n\n- **Mã matrix:** ${matrix.id}\n- **Trạng thái:** ${matrix.status}\n- **Profile ứng dụng:** ${matrix.appProfile?.name || 'Web game thông thường'}\n- **URL instance:** ${(matrix.targetUrls || [matrix.targetUrl]).join(', ')}\n- **Tổ hợp:** ${matrix.runs.length}\n- **Giới hạn song song:** ${matrix.concurrency}\n- **Mức song song thực tế cao nhất:** ${matrix.peakActive}\n- **Lỗi duy nhất:** ${uniqueIssues.length}\n\n## Kết quả từng tổ hợp\n\n| API / model × môi trường | Trạng thái | Bước | Lỗi | Chi tiết |\n|---|---|---:|---:|---|\n${rows}\n\n## Lỗi đã gộp\n\n${issues}\n\n## Cấu trúc bằng chứng\n\nMỗi tổ hợp nằm trong một thư mục con, chứa báo cáo Markdown/JSON, browser trace và toàn bộ screenshot của riêng lượt chạy đó.\n`;
  await fs.writeFile(path.join(matrix.dir, 'matrix-report.md'), markdown, 'utf8');
  return json;
}
