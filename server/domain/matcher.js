// Matches a submitted report to a planted defect and grades the severity.
import { PLANTED } from './planted.js';
import { severityDistance } from '../../public/shared/severity.js';

export function reportText(r) {
  return [r.summary, ...(r.steps || []), r.actual, r.expected].join('\n').toLowerCase();
}

/** Returns { planted, score } or null. */
export function matchPlanted(report) {
  const text = reportText(report);
  let best = null;
  for (const p of PLANTED) {
    if (!p.components.includes(report.component)) continue;
    if (p.not && p.not.test(text)) continue;
    if (!p.must.every(rx => rx.test(text))) continue;
    const hits = p.groups.filter(rx => rx.test(text)).length;
    if (hits < p.min) continue;
    const score = p.must.length * 2 + hits + (p.components[0] === report.component ? 1 : 0);
    if (!best || score > best.score) best = { planted: p, score };
  }
  return best;
}

/** exact | accepted | off — how close the tester's severity is to the reference. */
export function gradeSeverity(planted, severity) {
  if (severity === planted.severity) return { verdict: 'exact', distance: 0 };
  if (planted.accepted.includes(severity)) return { verdict: 'accepted', distance: severityDistance(severity, planted.severity) };
  return { verdict: 'off', distance: severityDistance(severity, planted.severity) };
}
