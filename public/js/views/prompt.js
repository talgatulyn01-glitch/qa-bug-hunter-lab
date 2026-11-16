// Submission part 1: initial vs improved prompt, what makes a prompt good,
// and the mistakes found in the AI's answers while building this app.
import { h, mount, copyText } from '../ui.js';

// Paste the share link of the AI chat here (Claude: Share → Copy link).
export const CHAT_LINK = '';

export const INITIAL_PROMPT = `Please create an application that can solve the most complicated problem you have faced during the training. It should have more than 5 modules, sections and a functional part with complicated business logic.
Please don't forget to use Prompt rules and techniques.
Submission Requirements:
1) Link to chat with any AI tool and you need to explain why your prompt is better than initial one, what are features of good prompt and which mistakes did you find in AI answers.
2. Functional website should be opened by the link and should be visible to your mentor (think about what AI tools will help you to implement that). Please note that application should have functionalities. Links should be clickable and functions should work. It should not be only an simple html page.
ask me questions to complete this task`;

export const IMPROVED_PROMPT = `# Role
You are a senior full-stack engineer and QA mentor. You build small but production-like
training tools and you explain your design decisions.

# Context
I am studying to become an automation QA engineer. Module 1 of my course was manual
testing of websites. The hardest part for me was:
  1) finding bugs systematically,
  2) choosing the correct severity,
  3) writing a bug report that follows our team standard.
Attached course materials (use them as the single source of truth, do not invent rules):
  - Checklists: Text Field, Button, Checkbox, Menu (PDF)
  - Test Data Generation templates (PDF)
  - Definition of severity: 5 levels, Table 2 criteria, rules for changing severity (PDF)
  - Our Jira bug template (fields table) and the report-writing standard (below)

# Task
Build a web application, "QA Bug Hunter Lab", where a trainee practices exactly these three skills.

# Required modules (at least 6)
1. Sandbox web shop with ~20 deliberately planted defects, each mapped to a checklist item
   and to a written requirement (BR1..BRn) so it can be cited in "Expected result".
2. Test runs: execute the checklists against a component (Pass / Fail / Blocked / N/A).
3. Severity wizard: Table 2 criteria + project context + the documented raise/lower rules.
4. Bug report builder in our Jira layout with a live quality check of every standard rule.
5. Tracker of submitted reports (tester side only: no developer or manager roles).
6. Dashboard: found planted defects, report quality, severity accuracy, leaderboard.
7. Knowledge base with the course material and a boundary-value generator.

# Business rules (must be enforced on the server, not only in the UI)
- A report with any error-level rule violation cannot be submitted.
- The tester sets Severity; Priority stays "Major" (it is set by the PM, outside this app).
- Only the tester who submitted a report can edit it; an edit must pass the same quality check,
  and the history shows the quality score before and after. Other testers can read and comment.
- Severity is locked in the editor: it changes by one level and only for a documented reason;
  "to attract the PM's attention" is rejected.
- A test run cannot be completed while a check is "Not run" or a failed check has no linked bug;
  Blocked must name the blocking defect; N/A needs a reason.
- A submitted report is matched to a planted defect; its severity is graded against the reference.

# Report standard (encode each line as a checkable rule)
Summary: "Module: what happens [when]", one module, no CAPS emphasis, no task numbers,
no severity words, the symptom not the cause. Precondition: a state, not an action ...
Steps: numbered, start with opening the app, concrete data, "clear the console" if a console
error is cited. Actual: only observed facts with numbers, reproduction boundaries, full stack
trace, no claims about unseen code. Expected: cite BRn, no numbers out of thin air.
Note: only when another defect blocks the check.

# Technical constraints
- Node.js + Express API as a Vercel serverless function, Postgres on Neon (DATABASE_URL),
  plain HTML/CSS/JS front end without a build step.
- Works without a database too (in-memory fallback) so the link never shows a blank page.
- No real XSS or SQL injection: simulate them safely inside the sandbox.
- Shared business logic is used by both the browser (live feedback) and the server (enforcement).

# Acceptance criteria
- The mentor opens one link, enters a name, and every button works.
- Unit tests cover the linter, severity engine, workflow, matcher; an API smoke test passes.
- All pages are checked in a real browser before delivery.

# Process
Ask me clarifying questions first (domain, deployment, repository). Then plan, build module by
module, verify, and tell me exactly what I must do myself (GitHub access, Neon, Vercel).

# Output
A GitHub repository ready for "Import to Vercel", a README with setup steps, and a page that
compares this prompt with my initial one.`;

const COMPARISON = [
  ['Goal', '"The most complicated problem you have faced": the AI cannot know which problem, so it guessed generic business apps (inventory, booking).', 'Names the real problem: finding bugs, choosing severity, writing reports in manual testing.'],
  ['Context', 'None about the learner, the course or the materials.', 'Role, learner situation and the attached course documents as the source of truth.'],
  ['Scope', '"More than 5 modules": which ones is left open.', 'Seven named modules with the purpose of each.'],
  ['Business logic', '"Complicated business logic" with no rules.', 'Concrete, testable rules (permissions, workflow, run completion, report validation).'],
  ['Constraints', 'Hosting and stack are left to chance ("think about what AI tools…").', 'Stack, hosting, database, no-build front end, safe simulation of security bugs.'],
  ['Quality bar', 'None.', 'Acceptance criteria: one working link, tests, browser verification.'],
  ['Examples', 'None.', 'The Jira template and the report standard act as examples of the expected format.'],
  ['Process', '"Ask me questions": good, but with no hint of what is unknown.', 'Clarify first, then plan → build → verify → hand-off list.'],
  ['Output', 'Implicit.', 'Explicit deliverables: repo, README, comparison page.'],
];

const FEATURES = [
  ['Role', 'Tell the model who it should act as; it sets vocabulary and the level of detail.'],
  ['Context', 'Who you are, why you need it, what already exists. The model cannot read your mind.'],
  ['Specific task', 'One clear goal, broken into named parts instead of "something complicated".'],
  ['Source material', 'Attach documents and say they are the single source of truth, which reduces invented rules.'],
  ['Constraints', 'Technology, limits, what must NOT be done (e.g. no real XSS).'],
  ['Examples', 'Show the expected format (a template, a good and a bad example), i.e. few-shot.'],
  ['Acceptance criteria', 'How you will judge the result: testable, observable statements.'],
  ['Output format', 'Exactly what to deliver and in which form.'],
  ['Process', 'Ask clarifying questions first, then work step by step and verify.'],
  ['Iteration', 'Review the answer, point out mistakes precisely and refine the prompt.'],
];

const MISTAKES = [
  ['Misread the task', 'In the first answer the AI offered generic domains (order management, booking, project management). It took "the problem you faced during training" to mean a business app, without asking what the training was about.', 'Put the real context in the prompt; prefer an open question when the answer cannot be guessed.'],
  ['Repeated questions', 'The AI asked for the domain three times with closed multiple-choice options, while the user had already said "I will describe it". This cost two extra rounds.', 'When the user says they will describe something, wait for the description instead of offering options again.'],
  ['Over-promising', 'The AI offered to "push code and trigger a live deployment" itself. In reality it needed the user to install the Claude GitHub App on the new repo before any push was possible, and the Vercel import still has to be done in the user\'s account.', 'Check tool permissions before promising; list the steps the human must do.'],
  ['Unreliable PDF extraction', 'Text extracted from the "Definition of severity" PDF lost the table borders: 11 Critical criteria could easily be read as Major. The AI rendered the page as an image and verified the table before encoding it.', 'Verify extracted data against the original, especially tables.'],
  ['Bugs in its own code', 'While building, the AI wrote a success dialog whose links navigated away but left the dialog open, and a boundary-value function with confusing deduplication logic (caught on review). Browser testing then showed that the score rings never filled (CSS custom properties cannot be set with Object.assign on element.style) and that chart panels were misaligned by a margin rule.', 'Never accept generated code without review, tests and a look at the real page; ask for verification as part of the prompt.'],
  ['Side effects of a "small" change', 'Adding auto-assignment on "Start progress" silently broke the demo-data seeding (a later step tried to assign the same person again), which took the whole API down. The automated tests caught it immediately.', 'Re-run the full test suite after every change, however small.'],
  ['Scope creep', 'The AI added a Developer / Lead role-play workflow (start progress, resolve, verify, close) that was never asked for. The task was the tester\'s skills only, so the user had it removed.', 'State the scope and the user role in the prompt; review the AI\'s plan before it builds.'],
  ['Unexplained jargon', 'Asking a follow-up question, the AI used the Jira term "reporter" without explaining it, and the user had to ask what it meant.', 'Ask the AI to use plain words, or to define a term the first time it appears.'],
  ['Wrong details in demo data', 'A demo bug report written by the AI said the "Basket" item was the fourth menu item; it is the third. It was noticed when the report was rewritten.', 'Check generated examples against the real application, just like any other bug report.'],
  ['Keyword matching too greedy', 'The planted-defect matcher linked the demo report "button name is Create acount (one c missing)" to the "button is hidden" defect, because the word "missing" matched. It was spotted on a screenshot, fixed, and covered by a regression test.', 'Look at real outputs, not only at passing tests; turn every found bug into a test.'],
  ['Test that lied', 'An automated browser check reported the sandbox sign-up as broken. The cause was the test reading the message before the server answered, not the app. The AI investigated before "fixing" working code.', 'When a test fails, find out whether the product or the test is wrong.'],
  ['Silent assumptions', 'The severity document does not map Severity to Priority. A naive answer equates them. The app keeps them separate (Priority stays with the PM, outside the app) and marks its own "lab policy" rules as such.', 'Ask the AI to label anything that is its own assumption rather than from the source.'],
];

export async function renderPrompt(view) {
  mount(view,
    h('div.page-head', {}, h('div', {},
      h('div.eyebrow', {}, 'Submission · part 1'),
      h('h1', {}, 'Prompt engineering report'),
      h('p', {}, 'How the initial prompt was improved, what makes a prompt good, and which mistakes were found in the AI\'s answers while this application was built.'))),
    h('div.prose', {},
      h('div.panel', {},
        h('h2', { style: { marginTop: 0 } }, 'AI chat'),
        CHAT_LINK ? h('p', {}, 'The whole conversation with Claude that produced this app: ', h('a', { href: CHAT_LINK, target: '_blank', rel: 'noopener' }, CHAT_LINK))
          : h('p', {}, 'The full conversation with Claude (Anthropic) that produced this application. The link is added in ', h('code', {}, 'public/js/views/prompt.js'), ' → ', h('code', {}, 'CHAT_LINK'), '.'),
        h('p', {}, 'How the work went: the initial prompt → the AI asked clarifying questions → I provided the course materials (checklists, severity definition, Jira template, report standard) → the AI built and verified the application module by module.')),

      h('h2', {}, '1. Initial prompt'),
      h('div.prompt-box', {}, INITIAL_PROMPT),

      h('h2', {}, '2. Improved prompt'),
      h('p', {}, 'Written after the clarifying round, using role, context, source material, explicit modules, business rules, constraints, acceptance criteria and output format.'),
      h('div.actions', { style: { justifyContent: 'flex-start' } }, h('button', { type: 'button', onclick: () => copyText(IMPROVED_PROMPT) }, 'Copy improved prompt')),
      h('div.prompt-box', {}, IMPROVED_PROMPT),

      h('h2', {}, '3. Why the improved prompt is better'),
      h('div.panel', { style: { padding: 0, overflowX: 'auto' } }, h('table.cmp', {},
        h('thead', {}, h('tr', {}, h('th', {}, 'Aspect'), h('th', {}, 'Initial prompt'), h('th', {}, 'Improved prompt'))),
        h('tbody', {}, COMPARISON.map(([a, b, c]) => h('tr', {}, h('td', {}, h('b', {}, a)), h('td', {}, b), h('td', {}, c)))))),
      h('p', {}, 'The initial prompt describes the form of the result ("more than 5 modules", "complicated logic") but not its content, so the AI has to guess. The improved prompt removes the guessing: every requirement is concrete enough to be checked, and the source documents stop the model from inventing rules.'),

      h('h2', {}, '4. Features of a good prompt'),
      h('div.panel', { style: { padding: 0 } }, h('table', {}, h('tbody', {}, FEATURES.map(([a, b]) => h('tr', {}, h('td', {}, h('b', {}, a)), h('td', {}, b)))))),

      h('h2', {}, '5. Mistakes found in the AI answers'),
      h('div.panel', { style: { padding: 0, overflowX: 'auto' } }, h('table', {},
        h('thead', {}, h('tr', {}, h('th', {}, 'Mistake'), h('th', {}, 'What happened'), h('th', {}, 'Lesson'))),
        h('tbody', {}, MISTAKES.map(([a, b, c]) => h('tr', {}, h('td', {}, h('b', {}, a)), h('td', {}, b), h('td', {}, c)))))),

      h('h2', {}, '6. Which AI tools made the website possible'),
      h('ul', {},
        h('li', {}, h('b', {}, 'Claude'), ': requirements analysis, code, tests, browser verification, documentation.'),
        h('li', {}, h('b', {}, 'GitHub'), ': source code repository.'),
        h('li', {}, h('b', {}, 'Vercel'), ': hosting; the API runs as a serverless function and every push redeploys.'),
        h('li', {}, h('b', {}, 'Neon'), ': serverless Postgres, so bugs, runs and comments persist for the mentor.'))));
}
