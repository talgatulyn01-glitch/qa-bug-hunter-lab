// Severity engine: turns the tester's answers into a severity level using
// Table 2 (criteria), the project context, and the "Rules for changing
// the severity levels of defects". Pure function: same input -> same output,
// shared by the browser wizard and the API.
import {
  SEVERITY_LEVELS, SEVERITY_CRITERIA, LOWER_REASONS, RAISE_REASONS,
  FORBIDDEN_REASONS, PROJECT_CONTEXTS,
} from './catalog.js';

const CRIT = Object.fromEntries(SEVERITY_CRITERIA.map(c => [c.id, c]));
const idx = level => SEVERITY_LEVELS.indexOf(level);
const lvl = i => SEVERITY_LEVELS[Math.max(0, Math.min(SEVERITY_LEVELS.length - 1, i))];

/**
 * @param {object} input
 * @param {string[]} input.criteria  ids from SEVERITY_CRITERIA
 * @param {string[]} [input.raise]   ids from RAISE_REASONS
 * @param {string[]} [input.lower]   ids from LOWER_REASONS
 * @param {string[]} [input.forbidden] ids from FORBIDDEN_REASONS
 * @param {string}   [input.context] id from PROJECT_CONTEXTS
 * @returns {{severity:string|null, base:string|null, trace:object[], warnings:string[], errors:string[]}}
 */
export function evaluateSeverity(input = {}) {
  const criteria = (input.criteria || []).filter(id => CRIT[id]);
  const raise = (input.raise || []).filter(id => RAISE_REASONS.some(r => r.id === id));
  const lower = (input.lower || []).filter(id => LOWER_REASONS.some(r => r.id === id));
  const forbidden = (input.forbidden || []).filter(id => FORBIDDEN_REASONS.some(r => r.id === id));
  const context = PROJECT_CONTEXTS.some(c => c.id === input.context) ? input.context : 'standard';
  const trace = [];
  const warnings = [];
  const errors = [];

  if (forbidden.length) {
    errors.push('A tester has no right to raise severity to attract the project manager\'s attention. Use the test report or talk to the manager instead.');
  }
  if (!criteria.length) {
    errors.push('Select at least one criterion from Table 2 that describes the defect.');
    return { severity: null, base: null, trace, warnings, errors };
  }

  // 1. Base level = the most severe matched criterion.
  const matched = criteria.map(id => CRIT[id]);
  let current = Math.min(...matched.map(c => idx(c.level)));
  const base = lvl(current);
  trace.push({ step: 'Table 2', level: base, why: `Most severe matched criterion: ${matched.filter(c => idx(c.level) === current).map(c => c.id).join(', ')}` });
  const levelsHit = new Set(matched.map(c => c.level));
  if (levelsHit.size > 1) {
    warnings.push(`Criteria from ${levelsHit.size} levels were selected (${[...levelsHit].join(', ')}). The most severe one wins; make sure the less severe ones are not just side effects.`);
  }

  const isEnhancement = current === idx('Enhancement');
  const isGui = matched.every(c => c.gui);          // pure appearance defect
  const isTextual = matched.some(c => c.textual);
  const isCrash = matched.some(c => c.crash);

  // 2. Project context (agreed with the customer / project phase).
  if (!isEnhancement) {
    const before = current;
    if (context === 'appearance' && isGui) current = Math.max(0, current - 1);
    if (context === 'crash-only' && !isCrash) current = idx('Minor');
    if (context === 'early' && isGui) current = Math.max(current, idx('Minor'));
    if (context === 'release' && isTextual) current = Math.min(current, idx('Average'));
    if (current !== before) {
      const ctx = PROJECT_CONTEXTS.find(c => c.id === context);
      trace.push({ step: 'Project context', level: lvl(current), why: `${ctx.name}: ${ctx.text}` });
    }
  }

  // 3. Rules for changing severity: at most one level up or down.
  if (isEnhancement && (raise.length || lower.length)) {
    warnings.push('Enhancement is a recommendation, not a defect: raise / lower rules do not apply.');
  } else {
    const validRaise = raise.filter(id => {
      const r = RAISE_REASONS.find(x => x.id === id);
      if (r.guiOnly && !matched.some(c => c.gui)) {
        warnings.push(`${id} applies only to GUI defects, and none of the selected criteria is a GUI one. Ignored.`);
        return false;
      }
      return true;
    });
    const up = validRaise.length > 0;
    const down = lower.length > 0;
    if (up && down) {
      trace.push({ step: 'Change rules', level: lvl(current), why: `Raise (${validRaise.join(', ')}) and lower (${lower.join(', ')}) reasons cancel each other out.` });
    } else if (up) {
      if (current === 0) warnings.push('Already Critical: cannot be raised further.');
      else {
        current -= 1;
        trace.push({ step: 'Raised one level', level: lvl(current), why: validRaise.map(id => RAISE_REASONS.find(r => r.id === id).text).join(' ') });
      }
    } else if (down) {
      if (current >= idx('Minor')) warnings.push('A defect cannot be lowered below Minor: Enhancement is not a defect level.');
      else {
        current += 1;
        trace.push({ step: 'Lowered one level', level: lvl(current), why: lower.map(id => LOWER_REASONS.find(r => r.id === id).text).join(' ') });
      }
    }
    if (validRaise.length + lower.length > 1) {
      warnings.push('Several change reasons were selected, but severity moves by one level at most.');
    }
  }

  return { severity: lvl(current), base, trace, warnings, errors };
}

// Compare a tester's severity with a reference one.
export function severityDistance(a, b) {
  if (idx(a) < 0 || idx(b) < 0) return null;
  return Math.abs(idx(a) - idx(b));
}

// Validate a severity change on an existing bug (tester should not change
// severity except for the documented reasons).
export function validateSeverityChange({ from, to, reasonId }) {
  if (from === to) return { ok: false, error: 'Severity is unchanged.' };
  if (idx(to) < 0) return { ok: false, error: `Unknown severity "${to}".` };
  if (FORBIDDEN_REASONS.some(r => r.id === reasonId)) {
    return { ok: false, error: 'Raising severity to attract the project manager\'s attention is not allowed.' };
  }
  const raising = idx(to) < idx(from);
  const pool = raising ? RAISE_REASONS : LOWER_REASONS;
  const reason = pool.find(r => r.id === reasonId);
  if (!reason) {
    return { ok: false, error: `To ${raising ? 'raise' : 'lower'} severity pick one of: ${pool.map(r => r.id).join(', ')}.` };
  }
  if (Math.abs(idx(to) - idx(from)) > 1) {
    return { ok: false, error: 'A documented reason allows changing severity by one level only.' };
  }
  if (to === 'Enhancement' && from !== 'Enhancement') {
    return { ok: false, error: 'A defect cannot be lowered to Enhancement.' };
  }
  return { ok: true, reason: reason.text };
}
