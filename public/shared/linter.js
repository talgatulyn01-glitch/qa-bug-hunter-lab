// Bug report linter. Each rule comes from the team's report standard:
// Summary -> fields -> Description (Precondition, Steps to reproduce,
// Actual result, Expected result, Note).
// Levels: error (blocks submission), warning (lowers the score), tip (advice).
import { COMPONENTS, SEVERITY_LEVELS, ERROR_TYPES } from './catalog.js';
import { REQUIREMENTS, REQ_BY_ID } from './requirements.js';

const ACRONYMS = new Set(['API', 'URL', 'UI', 'UX', 'SQL', 'HTML', 'CSS', 'JS', 'ID', 'OS', 'PDF', 'HTTP', 'HTTPS', 'JSON', 'XSS', 'CSV', 'OK', 'PIN', 'FAQ', 'SMS', 'VAT', 'USD', 'EUR', 'KZT', 'XML', 'DOM', 'GUI', 'iOS', 'CTA']);
const SEVERITY_WORDS = /\b(critical|major|minor|blocker|severe|severity|trivial|urgent|important|enhancement|high priority|low priority|showstopper|asap)\b/i;
const CAUSE_WORDS = /\b(because|due to|caused by|as a result of|in the code|the code|the developer|null pointer|race condition|not implemented|forgot|off-by-one)\b/i;
const VAGUE_SYMPTOM = /\b(doesn'?t work|does not work|not working|is broken|broken|some issue|an issue|a problem|has a bug|bug with|problem with|issue with)\b/i;
const TASK_NUMBER = /\b[A-Z][A-Z0-9]+-\d+\b|#\d+/;
const IMPERATIVE = /^\s*(\d+[.)]\s*)?(log ?in|sign (in|up)|register|open|click|go|navigate|create|add|enter|type|fill|select|press|make|set|launch|visit|delete|remove|buy|place|put|choose)\b/i;
const OPEN_APP = /^\s*(open|navigate to|go to|launch|visit)\b/i;
const INPUT_VERB = /\b(enter|type|input|fill(?: in)?|paste|set the value)\b/i;
const VAGUE_DATA = /\b(some|any|valid data|invalid data|random|something|correct data|incorrect data|etc\.?)\b/i;
const CODE_CLAIM = /\b(in the code|the code|source code|hard-?coded|the developer|developers? forgot|the function|the method|the variable|a variable|the loop|off-by-one|the database (stores|saves|contains|has))\b/i;
const MEASURABLE = /\b(total|price|sum|amount|count|number of|length|characters?|seconds?|items?|orders?|discount|quantity|times)\b/i;
const BOUNDARY = /reproduc|every time|always|\b\d+\s*(\/|of|out of)\s*\d+\b|only (when|if|for|in|on|with)|also (in|on|for|with)|for (all|any|every|values|quantit)|in (chrome|firefox|safari|edge)|regardless|any (browser|value|product)|each time/i;
const CONSOLE = /\b(console|devtools|dev tools)\b/i;
const ERROR_LINE = /\b\w*(Error|Exception)\b|Uncaught|\b[45]\d\d\b/;
const STACK_LINE = /(^|\n)\s*at\s+\S+|\bat\s+[\w.$<>]+\s*\(/;
const NOTE_KEY = /\b[A-Z][A-Z0-9]+-\d+\b/;

const words = s => (s || '').toLowerCase().match(/[a-zа-яё0-9]+/gi) || [];
function similarity(a, b) {
  const A = new Set(words(a)); const B = new Set(words(b));
  if (!A.size || !B.size) return 0;
  let inter = 0; A.forEach(w => { if (B.has(w)) inter++; });
  return inter / (A.size + B.size - inter);
}
const numbersIn = s => (String(s || '').replace(/\bBR\s?-?\d+\b/gi, ' ').replace(/\b[A-Z][A-Z0-9]+-\d+\b/g, ' ').match(/\d+(?:[.,]\d+)?/g) || []);

export function lintReport(r = {}) {
  const issues = [];
  const add = (level, field, id, message, hint) => issues.push({ level, field, id, message, hint });
  const steps = (r.steps || []).map(s => String(s || '').trim()).filter(Boolean);
  const stepsText = steps.join('\n');
  const summary = String(r.summary || '').trim();
  const pre = String(r.precondition || '').trim();
  const actual = String(r.actual || '').trim();
  const expected = String(r.expected || '').trim();
  const note = String(r.note || '').trim();

  // ---- Fields ----------------------------------------------------------
  if (!r.component) add('error', 'component', 'F1', 'Component is required.');
  else if (!COMPONENTS.includes(r.component)) add('error', 'component', 'F1', `Unknown component "${r.component}".`, `Use one of: ${COMPONENTS.join(', ')}.`);
  if (!r.affectsVersion) add('error', 'affectsVersion', 'F2', 'Affects Version/s is required.');
  if (!/OS:\s*\S+/i.test(r.environment || '') || !/Browser:\s*\S+/i.test(r.environment || '')) {
    add('error', 'environment', 'F3', 'Environment must name the OS and the browser.', 'Format: "OS: Windows 11 Browser: Chrome 131".');
  }
  if (!SEVERITY_LEVELS.includes(r.severity)) add('error', 'severity', 'F4', 'Severity is required.', 'Use the Severity wizard if unsure.');
  if (!ERROR_TYPES.includes(r.errorType)) add('error', 'errorType', 'F5', 'Error Type is required.');
  if (r.suggestedSeverity && r.severity && r.suggestedSeverity !== r.severity) {
    add('warning', 'severity', 'F6', `Severity "${r.severity}" differs from the criteria-based result "${r.suggestedSeverity}".`, 'Re-check Table 2 or apply a documented raise/lower reason.');
  }
  if (r.errorType === 'GUI' && ['Critical', 'Major'].includes(r.severity)) {
    add('warning', 'severity', 'F7', 'A GUI defect is rarely Critical or Major.', 'Table 2: a serious, obvious UI defect is Average; typos and naming are Minor.');
  }
  if (r.errorType === 'Security' && ['Minor', 'Enhancement'].includes(r.severity)) {
    add('warning', 'severity', 'F8', 'A security defect that exposes information is usually Critical (breaks confidentiality).');
  }

  // ---- Summary: "Module: what happens [when]" --------------------------
  if (!summary) add('error', 'summary', 'S0', 'Summary is required.');
  else {
    const m = summary.match(/^([^:]{1,40}):\s*(.+)$/);
    if (!m) add('error', 'summary', 'S1', 'Summary must follow "Module: what happens [when]".', 'Example: "Cart: total ignores the bulk discount when quantity is 10".');
    else {
      const [, prefix, symptom] = m;
      if (/[,/&+]|\band\b|>/.test(prefix)) add('error', 'summary', 'S2', 'Exactly one module is allowed in the prefix.', `"${prefix}" looks like several modules.`);
      else if (!COMPONENTS.some(c => c.toLowerCase() === prefix.trim().toLowerCase())) {
        add('warning', 'summary', 'S2', `"${prefix.trim()}" is not a known module.`, `Use one of: ${COMPONENTS.join(', ')}.`);
      } else if (r.component && prefix.trim().toLowerCase() !== r.component.toLowerCase()) {
        add('warning', 'summary', 'S2', `Summary module "${prefix.trim()}" differs from Component "${r.component}".`);
      }
      if (/^[^:]{1,40}:/.test(symptom)) add('error', 'summary', 'S2', 'Only one "Module:" prefix is allowed.');
      if (words(symptom).length < 3) add('error', 'summary', 'S3', 'Describe what happens: the symptom is too short.');
      if (VAGUE_SYMPTOM.test(symptom)) add('warning', 'summary', 'S7', 'Describe the observable symptom instead of "doesn\'t work / issue / problem".');
      if (!/\b(when|after|if|on|while|for|with|before|during)\b/i.test(symptom)) add('tip', 'summary', 'S8', 'Add the [when] part if the defect appears only under a condition.');
    }
    const caps = (summary.match(/\b[A-Za-z]{2,}\b/g) || []).filter(w => w === w.toUpperCase() && !ACRONYMS.has(w) && (w.length >= 3 || w === 'NO'));
    if (caps.length) add('error', 'summary', 'S4', `No capital letters for emphasis: ${[...new Set(caps)].join(', ')}.`);
    if (TASK_NUMBER.test(summary)) add('error', 'summary', 'S5', 'No task numbers in the summary.');
    if (SEVERITY_WORDS.test(summary)) add('error', 'summary', 'S6', `No severity words in the summary ("${summary.match(SEVERITY_WORDS)[0]}"). Severity has its own field.`);
    if (CAUSE_WORDS.test(summary)) add('warning', 'summary', 'S9', 'Describe the observed symptom, not the assumed cause.', `Found: "${summary.match(CAUSE_WORDS)[0]}".`);
    if (summary.length > 120) add('warning', 'summary', 'S10', `Summary is ${summary.length} characters; keep it under 120.`);
  }

  // ---- Precondition ----------------------------------------------------
  if (pre) {
    if (/^(none|n\/a|no|-|—)\.?$/i.test(pre)) add('warning', 'precondition', 'P0', 'Leave Precondition empty instead of writing "None".');
    else {
      pre.split(/\n+/).forEach(line => {
        if (IMPERATIVE.test(line)) add('error', 'precondition', 'P1', `Precondition must be a state, not an action: "${line.trim()}".`, 'Write "User is logged in", not "Log in".');
      });
      if (r.component === 'Sign up' && /\b(logged in|signed in|registered|signed up|has an account)\b/i.test(pre)) {
        add('error', 'precondition', 'P2', 'The entry point itself is under test, so there should be no precondition about being registered / logged in.');
      }
      const multi = /\b(two|three|several|\d+)\s+(users|products|accounts|items|orders)\b|\n\s*\d+[.)]/i.test(pre);
      if (multi && !/precondition/i.test(stepsText)) add('warning', 'steps', 'P3', 'Steps should refer to the precondition objects.', 'e.g. "the second user from the preconditions".');
    }
  }

  // ---- Steps to reproduce ----------------------------------------------
  if (!steps.length) add('error', 'steps', 'T0', 'Steps to reproduce are required.');
  else {
    if (!OPEN_APP.test(steps[0])) add('error', 'steps', 'T1', 'Steps must start with opening the application.', 'Step 1: "Open https://…/sandbox/".');
    else if (!/https?:\/\/|\/|liteshop|sandbox/i.test(steps[0]) && !COMPONENTS.some(c => steps[0].toLowerCase().includes(c.toLowerCase()))) {
      add('warning', 'steps', 'T1', 'Step 1 should say what exactly to open (URL or page).');
    }
    steps.forEach((s, i) => {
      if (INPUT_VERB.test(s) && !/["'«“‘]|\d/.test(s)) add('error', 'steps', 'T2', `Step ${i + 1}: put concrete test data in the step.`, 'e.g. Enter "Anna" in the "Name" field.');
      if (VAGUE_DATA.test(s)) add('warning', 'steps', 'T3', `Step ${i + 1}: vague data ("${s.match(VAGUE_DATA)[0]}").`);
      if (/\bshould\b/i.test(s)) add('warning', 'steps', 'T4', `Step ${i + 1}: steps describe actions; expectations go to Expected result.`);
      if (s.length > 200) add('warning', 'steps', 'T5', `Step ${i + 1} is too long; split it.`);
      if (/\bthen\b/i.test(s)) add('tip', 'steps', 'T6', `Step ${i + 1}: one action per step reads better.`);
    });
    if (CONSOLE.test(actual + ' ' + note) && !/clear (the )?console/i.test(stepsText)) {
      add('error', 'steps', 'T7', 'You refer to the console: add a step "Clear the console" before the action.');
    }
    if (!/\b(compare|repeat|same steps|another|other (product|user|browser|page|category))\b/i.test(stepsText)) {
      add('tip', 'steps', 'T8', 'Consider a comparison step that proves the defect is local (e.g. repeat with another product).');
    }
  }

  // ---- Actual result -----------------------------------------------------
  if (!actual) add('error', 'actual', 'A0', 'Actual result is required.');
  else {
    if (actual.length < 25 || /^(it )?(doesn'?t work|not working|broken|error|wrong|fails?)\.?$/i.test(actual)) {
      add('error', 'actual', 'A1', 'Actual result is too vague: describe exactly what you observed.');
    }
    if (CODE_CLAIM.test(actual)) add('error', 'actual', 'A2', `Don't make claims about code you haven't seen ("${actual.match(CODE_CLAIM)[0]}").`, 'Write "the values are consistent with X" instead.');
    if (MEASURABLE.test(actual) && !/\d/.test(actual)) add('warning', 'actual', 'A3', 'Add the measured numbers (totals, counts, lengths, seconds).');
    if (!BOUNDARY.test(actual)) add('warning', 'actual', 'A4', 'State the reproduction boundaries.', 'e.g. "Reproduced 3/3 times in Chrome and Firefox; not reproduced for quantity 9".');
    if (CONSOLE.test(actual) && !(ERROR_LINE.test(actual) && STACK_LINE.test(actual))) {
      add('error', 'actual', 'A5', 'Console error mentioned: paste the full error text and stack trace.');
    }
    if (expected && similarity(actual, expected) > 0.8) add('error', 'actual', 'A6', 'Actual and Expected results are almost identical.');
  }

  // ---- Expected result ---------------------------------------------------
  if (!expected) add('error', 'expected', 'E0', 'Expected result is required.');
  else {
    if (expected.length < 15 || /^(it )?(should )?(work|works|be fixed)( correctly| properly| fine)?\.?$/i.test(expected)) {
      add('error', 'expected', 'E1', 'Expected result is too vague: describe the required behavior.');
    }
    const cited = [...expected.matchAll(/\bBR\s?-?(\d+)\b/gi)].map(m => 'BR' + m[1]);
    cited.filter(id => !REQ_BY_ID[id]).forEach(id => add('error', 'expected', 'E2', `${id} does not exist in the requirements.`));
    const valid = cited.filter(id => REQ_BY_ID[id]);
    const relevant = REQUIREMENTS.filter(q => q.component === r.component).map(q => q.id);
    if (!cited.length && relevant.length) add('warning', 'expected', 'E3', 'Reference the requirement (BRn) the behavior comes from.', `Requirements for ${r.component}: ${relevant.join(', ')}.`);
    const backing = valid.map(id => REQ_BY_ID[id].text).join(' ') + ' ' + stepsText + ' ' + actual;
    const backed = new Set(numbersIn(backing).map(n => n.replace(',', '.')));
    const loose = numbersIn(expected).filter(n => !backed.has(n.replace(',', '.')));
    if (loose.length) add('warning', 'expected', 'E4', `Number(s) ${[...new Set(loose)].join(', ')} are not backed by a cited requirement or by the steps.`, 'If no requirement sets the limit, describe the consequence instead of inventing a number.');
  }

  // ---- Note --------------------------------------------------------------
  if (note && !(NOTE_KEY.test(note) && /block/i.test(note))) {
    add('error', 'note', 'N1', 'Note is only for the case when another defect blocks the check: name it (e.g. "Blocked by TC-12").');
  }

  const errors = issues.filter(i => i.level === 'error').length;
  const warnings = issues.filter(i => i.level === 'warning').length;
  const score = Math.max(0, 100 - errors * 12 - warnings * 5);
  const grade = score >= 90 ? 'A' : score >= 75 ? 'B' : score >= 60 ? 'C' : score >= 40 ? 'D' : 'F';
  return { issues, errors, warnings, tips: issues.length - errors - warnings, score, grade, canSubmit: errors === 0 };
}
