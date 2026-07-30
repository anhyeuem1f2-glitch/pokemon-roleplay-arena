import fs from 'node:fs/promises';
import path from 'node:path';
import { writeJson } from './utils.mjs';

const severityRank = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };

function mdEscape(value) {
  return String(value ?? '').replace(/\|/g, '\\|').replace(/\r?\n/g, '<br>');
}

function relativeEvidence(issue) {
  return issue.screenshot ? `./${path.basename(issue.screenshot)}` : '';
}

export async function writeReport(run) {
  const sortedIssues = [...run.issues].sort((a, b) =>
    (severityRank[a.severity] ?? 9) - (severityRank[b.severity] ?? 9) || a.firstSeenStep - b.firstSeenStep
  );
  const counts = Object.fromEntries(['critical', 'high', 'medium', 'low', 'info'].map((s) => [s, sortedIssues.filter((i) => i.severity === s).length]));
  const jsonReport = {
    schemaVersion: 1,
    id: run.id,
    status: run.status,
    startedAt: run.startedAt,
    finishedAt: run.finishedAt,
    targetUrl: run.config.targetUrl,
    finalUrl: run.finalUrl,
    mission: run.config.mission,
    provider: run.config.providerId,
    model: run.config.model,
    appProfile: run.config.appProfile?.id || 'generic',
    viewport: run.config.viewport,
    emulation: run.config.emulation || null,
    maxSteps: run.config.maxSteps,
    completedSteps: run.steps.length,
    summary: { totalIssues: sortedIssues.length, bySeverity: counts },
    issues: sortedIssues.map((issue) => ({ ...issue, screenshot: issue.screenshot ? path.basename(issue.screenshot) : null })),
    steps: run.steps.map((step) => ({ ...step, screenshot: step.screenshot ? path.basename(step.screenshot) : null })),
    artifacts: {
      trace: run.tracePath ? path.basename(run.tracePath) : null,
      screenshots: run.steps.map((s) => s.screenshot).filter(Boolean).map((s) => path.basename(s))
    }
  };

  await writeJson(path.join(run.dir, 'report.json'), jsonReport);

  const issueSections = sortedIssues.length
    ? sortedIssues.map((issue, index) => `### ${index + 1}. [${issue.severity.toUpperCase()}] ${issue.title}

- **Loại:** ${issue.category}
- **Nguồn phát hiện:** ${issue.source}
- **Độ tin cậy:** ${Math.round((issue.confidence ?? 0.5) * 100)}%
- **Trang:** ${issue.url}
- **Bước đầu tiên:** ${issue.firstSeenStep}
- **Phần tử:** ${issue.target || 'Không xác định'}
- **Mô tả:** ${issue.description || '—'}
- **Mong đợi:** ${issue.expected || '—'}
- **Thực tế:** ${issue.actual || '—'}
${issue.reproduction?.length ? `- **Cách tái hiện:**\n${issue.reproduction.map((x, i) => `  ${i + 1}. ${x}`).join('\n')}` : ''}
${relativeEvidence(issue) ? `- **Ảnh bằng chứng:** [${path.basename(issue.screenshot)}](${relativeEvidence(issue)})` : ''}
`).join('\n')
    : 'Không phát hiện lỗi nào trong phạm vi lượt chạy này.';

  const stepsTable = run.steps.length
    ? `| Bước | URL | Hành động | Kết quả | Ảnh |\n|---:|---|---|---|---|\n${run.steps.map((s) => `| ${s.step} | ${mdEscape(s.url)} | ${mdEscape(`${s.action?.type || 'observe'} ${s.action?.target || ''} ${s.action?.value ?? ''}`)} | ${mdEscape(s.result)} | ${s.screenshot ? `[ảnh](${`./${path.basename(s.screenshot)}`})` : '—'} |`).join('\n')}`
    : 'Không có bước nào được ghi.';

  const markdown = `# Báo cáo AI kiểm thử web game

## Tổng quan

- **Mã lượt chạy:** ${run.id}
- **Trạng thái:** ${run.status}
- **Bắt đầu:** ${run.startedAt}
- **Kết thúc:** ${run.finishedAt || '—'}
- **URL mục tiêu:** ${run.config.targetUrl}
- **URL cuối:** ${run.finalUrl || '—'}
- **Nhà cung cấp / model:** ${run.config.providerId} / ${run.config.model}
- **Profile ứng dụng:** ${run.config.appProfile?.name || 'Web game thông thường'}
- **Môi trường:** ${run.config.emulation?.name || `${run.config.viewport.width} × ${run.config.viewport.height}`}
- **Nhiệm vụ:** ${run.config.mission}
- **Số bước:** ${run.steps.length}/${run.config.maxSteps}
- **Tổng lỗi:** ${sortedIssues.length} (Critical ${counts.critical}, High ${counts.high}, Medium ${counts.medium}, Low ${counts.low}, Info ${counts.info})

> Báo cáo kết hợp tín hiệu xác định (console, network, DOM/CSS) và đánh giá của model từ ảnh chụp + trạng thái trang. Các phát hiện thị giác có thể cần người kiểm tra xác nhận trước khi sửa.

## Danh sách lỗi

${issueSections}

## Nhật ký trải nghiệm

${stepsTable}

## Tệp bằng chứng

- \`report.json\`: dữ liệu có cấu trúc để tích hợp CI hoặc hệ thống quản lý lỗi.
- \`browser-trace.json\`: nhật ký Chrome DevTools Protocol gồm network, console, exception và hành động AI.
- \`step-*.jpg\`: ảnh chụp dùng làm bằng chứng tại từng bước.
`;

  await fs.writeFile(path.join(run.dir, 'report.md'), markdown, 'utf8');
  return jsonReport;
}
