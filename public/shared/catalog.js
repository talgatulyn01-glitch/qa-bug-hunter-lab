// Course knowledge encoded as data: severity levels and criteria, rules for
// changing severity, element checklists and test-data templates.
// Source: "Definition of severity", "Text Field", "Button", "Checkbox",
// "Menu" and "Test Data Generation" training materials.

export const PROJECT = { name: 'Training Center', key: 'TC' };

export const COMPONENTS = ['Menu', 'Catalog', 'Search', 'Cart', 'Checkout', 'Sign up', 'Profile', 'Reviews'];
export const VERSIONS = ['LiteShop 1.0', 'LiteShop 1.1'];
export const ERROR_TYPES = ['Functional', 'GUI', 'Usability', 'Validation', 'Security', 'Performance'];
export const PRIORITIES = ['Blocker', 'Critical', 'Major', 'Minor', 'Trivial'];
export const DEFAULT_PRIORITY = 'Major';

// Table 1 - Severity levels (index 0 = most severe)
export const SEVERITY_LEVELS = ['Critical', 'Major', 'Average', 'Minor', 'Enhancement'];
export const SEVERITY_DEFINITIONS = {
  Critical: 'The defect completely blocks the application. It is impossible to continue testing in the presence of such a defect.',
  Major: 'The defect partially blocks the operation of the application / one or more parts of the functionality. Continuing testing is impossible or limited.',
  Average: 'The defect disrupts the normal operation of one or more functions but does not prevent further testing. Also: a serious, obvious defect in the user interface.',
  Minor: 'Minor functional bug or GUI defect. The fix slightly improves behavior. Testing is carried out according to the scenario without changes.',
  Enhancement: 'A recommendation that does not require changes. Testing is carried out according to the scenario without changes.',
};

// Table 2 - Criteria for determining criticality level.
// Flags drive the context rules: gui = appearance defect, text = wording/typo,
// crash = the app "falls"/is not operational.
export const SEVERITY_CRITERIA = [
  { id: 'C1', level: 'Critical', crash: true, text: 'Testing cannot be continued; the project is not operational.' },
  { id: 'C2', level: 'Critical', crash: true, text: 'Cannot log in with a correct user / the main entry point is blocked.' },
  { id: 'C3', level: 'Critical', crash: true, text: 'Installation does not complete, the application cannot be installed, or it does not work after an update.' },
  { id: 'C4', level: 'Critical', text: 'Application features are not available or blocked; important parts of the system are out of order.' },
  { id: 'C5', level: 'Critical', text: 'The main task of the application or its main part cannot be completed, and the defect cannot be neutralized.' },
  { id: 'C6', level: 'Critical', text: 'The defect resulted in data loss.' },
  { id: 'C7', level: 'Critical', text: "The issue seriously affects the customer's systems, damages their reputation, or breaks the confidentiality of information." },
  { id: 'C8', level: 'Critical', text: 'The product licensing mechanism is not working.' },

  { id: 'M1', level: 'Major', text: 'Normal operation of a part of the application is broken; a workaround exists but is not sufficiently tested and reliable.' },
  { id: 'M2', level: 'Major', text: 'The reason is unclear, but the failure always reproduces and blocks part of the functionality.' },
  { id: 'M3', level: 'Major', text: 'Entering certain values in a field disables the function.' },
  { id: 'M4', level: 'Major', text: 'Only part of the data is saved, and this affects the operation of other modules.' },
  { id: 'M5', level: 'Major', text: 'The system ignores some data, and this affects the main functions.' },
  { id: 'M6', level: 'Major', text: 'Calculation results are incorrect (significantly different).' },
  { id: 'M7', level: 'Major', text: 'A function is not executed correctly / not fully performed, and this affects the user experience.' },

  { id: 'A1', level: 'Average', text: 'The function is broken, but there are proven ways to neutralize the defect; it does not block the application.' },
  { id: 'A2', level: 'Average', text: 'The behavior of the function only partially corresponds to the scenario.' },
  { id: 'A3', level: 'Average', text: 'Data-entry validation is not performed or gives incorrect results, or the entered data type does not meet the requirements.' },
  { id: 'A4', level: 'Average', text: 'The navigation mechanism does not work properly.' },
  { id: 'A5', level: 'Average', gui: true, text: 'Serious, obvious defect in the user interface / usability defect that seriously affects the user experience.' },
  { id: 'A6', level: 'Average', gui: true, text: 'The number of fields on the form does not meet the requirements.' },

  { id: 'N1', level: 'Minor', gui: true, text: 'Typos, vague wording, or limited scope for error messages.', textual: true },
  { id: 'N2', level: 'Minor', gui: true, text: 'Names of buttons, fields, forms, tables or windows differ from the script or differ between similar cases.', textual: true },
  { id: 'N3', level: 'Minor', text: 'The field length is not limited or does not meet the requirements, and no error message is issued.' },
  { id: 'N4', level: 'Minor', gui: true, text: 'The displayed data format differs from the requirements, but the meaning is still clear.' },
  { id: 'N5', level: 'Minor', text: 'No confirmation, error or informational message is issued.' },
  { id: 'N6', level: 'Minor', gui: true, text: 'Incorrect column order, or a tab does not meet the requirements.' },
  { id: 'N7', level: 'Minor', text: 'Field validation does not meet the requirements (minor deviation, little effect on operation).' },
  { id: 'N8', level: 'Minor', gui: true, text: 'Minor GUI defect: the function has little or no effect on operation.' },

  { id: 'E1', level: 'Enhancement', text: 'A recommendation for quality improvement or a minor functionality suggestion.' },
];

// "Rules for changing the severity levels of defects"
export const LOWER_REASONS = [
  { id: 'L1', text: 'Found only on a rarely used operating system / environment.' },
  { id: 'L2', text: 'Difficult to reproduce, or reproduced only once without a clear path.' },
  { id: 'L3', text: 'Found in a part of the application rarely used by users.' },
];
export const RAISE_REASONS = [
  { id: 'R1', guiOnly: true, text: 'The GUI defect is obvious and easy to detect (e.g. a spelling error in a well-visible place), or may be perceived as an insult.' },
  { id: 'R2', text: 'Found in a frequently used and very important part of the application.' },
  { id: 'R3', text: 'Potentially can seriously affect the user experience.' },
];
// Explicitly forbidden by the standard.
export const FORBIDDEN_REASONS = [
  { id: 'X1', text: 'I want the project manager to pay attention to this defect.' },
];

// Project context: the standard allows the levels to be redefined by agreement
// with the customer or by project phase.
export const PROJECT_CONTEXTS = [
  { id: 'standard', name: 'Standard rules', text: 'Severity is defined by Table 2 only.' },
  { id: 'appearance', name: 'Appearance is the customer\'s main priority', text: 'GUI defects are raised one level.' },
  { id: 'crash-only', name: 'Only crashes are serious', text: 'Every defect is Minor except the ones where the application falls / is not operational.' },
  { id: 'early', name: 'Early development phase', text: 'Appearance defects are recorded only as Minor.' },
  { id: 'release', name: 'Final version testing', text: 'A wording error on a page is assessed as serious (at least Average).' },
];

// ---- Checklists (from the element pages) --------------------------------
export const CHECKLISTS = [
  {
    id: 'TF', name: 'Text Field', items: [
      { id: 'TF-1.1', section: 'Functionality', title: 'The field allows entering characters', expected: 'A new value can be entered; previously entered values can be edited.' },
      { id: 'TF-1.2', section: 'Functionality', title: 'Valid number of characters (boundaries)', expected: 'Min-1 and Max+1 show a validation message; Min, Min+1, Max-1, Max are accepted and saved. Copy-paste follows the same limits.' },
      { id: 'TF-1.3', section: 'Functionality', title: 'Different data formats', expected: 'Letters of different languages, capitals, lower case, numbers, negative and fractional values (dot / comma) are handled according to requirements.' },
      { id: 'TF-1.4', section: 'Functionality', title: 'Tags and scripts input', expected: 'Tags are displayed as they were entered; scripts are not processed or executed.' },
      { id: 'TF-1.5', section: 'Functionality', title: 'SQL injections', expected: 'Attempts to interfere with back-end SQL queries do not cause errors or change behavior; data is displayed as entered.' },
      { id: 'TF-1.6', section: 'Functionality', title: 'Special characters', expected: 'Special and non-keyboard characters are displayed as entered.' },
      { id: 'TF-1.7', section: 'Functionality', title: 'Cursor positioning', expected: 'The cursor is placed in the first input field when the form opens.' },
      { id: 'TF-1.8', section: 'Functionality', title: 'Text distributed by lines (textarea)', expected: 'Enter moves to a new line, long lines wrap, a scroll bar appears when needed.' },
      { id: 'TF-1.9', section: 'Functionality', title: 'Copy-paste (Ctrl+C / Ctrl+V)', expected: 'Copy and paste work; prohibited characters cannot be pasted.' },
      { id: 'TF-2.1', section: 'Validation', title: 'Form cannot be submitted with empty required fields', expected: 'A validation message appears; the control button is disabled; the invalid value does not disappear.' },
      { id: 'TF-2.2', section: 'Validation', title: 'Uniqueness of data', expected: 'Duplicates (login, email, phone) are rejected according to requirements.' },
      { id: 'TF-3.1', section: 'Spaces usage', title: 'Spaces-only value is treated as empty', expected: 'A validation message says the field is empty.' },
      { id: 'TF-3.2', section: 'Spaces usage', title: 'Leading / trailing spaces are truncated', expected: 'Text is saved and displayed without leading and trailing spaces (except password).' },
      { id: 'TF-3.3', section: 'Spaces usage', title: 'Spaces inside the text are kept', expected: 'Saved text keeps inner spaces (email shows a validation message).' },
      { id: 'TF-4.1', section: 'Tabulation', title: 'Tab moves between fields', expected: 'Tab moves focus left-to-right, top-to-bottom through active elements.' },
      { id: 'TF-4.2', section: 'Tabulation', title: 'Tab skips disabled fields', expected: 'Disabled elements are skipped; focus never lands on them.' },
      { id: 'TF-5.1', section: 'GUI', title: 'The field has a name', expected: 'The name has no errors, is logical and unified with other fields.' },
      { id: 'TF-5.2', section: 'GUI', title: 'Fields and names are aligned', expected: 'Fields and labels aligned; equal widths and indents.' },
      { id: 'TF-5.3', section: 'GUI', title: 'Text stays within field borders', expected: 'Long text does not overflow; all text can be navigated.' },
      { id: 'TF-5.4', section: 'GUI', title: 'Field design is unified', expected: 'Colors, fonts and sizes are unified.' },
      { id: 'TF-5.5', section: 'GUI', title: 'Required fields are marked', expected: 'Required fields are marked with a symbol, e.g. *.' },
    ],
  },
  {
    id: 'BTN', name: 'Button', items: [
      { id: 'BTN-1.1', section: 'Functionality', title: 'Clicking a button', expected: 'Invokes the associated action; the entire button area is clickable, not just its name.' },
      { id: 'BTN-1.2', section: 'Functionality', title: 'Clicking quickly several times', expected: 'The same action is not invoked several times.' },
      { id: 'BTN-1.3', section: 'Functionality', title: 'Disabled when the action is unavailable', expected: 'The button does not disappear; it is disabled (not clickable and visually inactive).' },
      { id: 'BTN-1.4', section: 'Functionality', title: 'Clicking the space between close buttons', expected: 'No action is invoked.' },
      { id: 'BTN-1.5', section: 'Functionality', title: 'Clicking the space around the button', expected: 'No action is invoked.' },
      { id: 'BTN-2.1', section: 'GUI', title: 'Button has a name', expected: 'No grammatical errors; logical and related to the action; unified with other buttons.' },
      { id: 'BTN-2.2', section: 'GUI', title: 'Click and hover effect', expected: 'The button UI changes on click and on hover (unless requirements say otherwise).' },
      { id: 'BTN-2.3', section: 'GUI', title: 'Tooltip and cursor', expected: 'Tooltip has no errors and matches the name; the cursor turns into a hand.' },
      { id: 'BTN-2.4', section: 'GUI', title: 'Design is unified', expected: 'Colors, fonts, size and alignment are unified with the application.' },
    ],
  },
  {
    id: 'CB', name: 'Checkbox', items: [
      { id: 'CB-1.1', section: 'Functionality', title: 'Select / unselect', expected: 'Every checkbox can be selected, unselected and selected again; unselecting one does not unselect the others.' },
      { id: 'CB-1.2', section: 'Functionality', title: '"Select all" checkbox', expected: 'Present when there are many checkboxes; selects / unselects all, including after manual changes.' },
      { id: 'CB-1.3', section: 'Functionality', title: 'State kept between pages', expected: 'Moving to the next page and back does not reset selected checkboxes.' },
      { id: 'CB-1.4', section: 'Functionality', title: 'No sorting by a checkbox-only column', expected: 'A column with only checkboxes is not sortable.' },
      { id: 'CB-1.5', section: 'Functionality', title: 'Label click / click outside', expected: 'Clicking the label toggles the checkbox; clicking outside does not.' },
      { id: 'CB-2.1', section: 'GUI', title: 'Design is unified', expected: 'Colors, fonts, sizes unified.' },
      { id: 'CB-2.2', section: 'GUI', title: 'Checkboxes and names aligned', expected: 'Checkboxes aligned with their names and with each other.' },
      { id: 'CB-2.3', section: 'GUI', title: 'Disabled checkboxes displayed correctly', expected: 'Disabled state is visually clear.' },
    ],
  },
  {
    id: 'MN', name: 'Menu', items: [
      { id: 'MN-1.1', section: 'Functionality', title: 'Menu option invokes the corresponding action', expected: 'Each option opens the corresponding page.' },
      { id: 'MN-1.2', section: 'Functionality', title: 'Hotkeys (if applicable)', expected: 'Hotkeys work as specified.' },
      { id: 'MN-2.1', section: 'GUI', title: 'Tab highlighting', expected: 'The current tab is visually different and not clickable; tabs highlight on hover.' },
      { id: 'MN-2.2', section: 'GUI', title: 'Cursor changes on menu options', expected: 'The cursor changes when hovering a menu option.' },
      { id: 'MN-2.3', section: 'GUI', title: 'Click effect', expected: 'A click effect is shown if the design has one.' },
      { id: 'MN-2.4', section: 'GUI', title: 'Names and UI unified on all pages', expected: 'Option names and look are identical on all pages with the same menu.' },
    ],
  },
];

export const CHECK_BY_ID = Object.fromEntries(CHECKLISTS.flatMap(c => c.items.map(i => [i.id, { ...i, checklist: c.name }])));

// ---- Test data templates ------------------------------------------------
export const TEST_DATA = [
  { group: 'Special characters', values: ['~`!@#$%^&*\'()_+=-\\|</>{.}[,]";:?'] },
  { group: 'Non-keyboard characters', values: ['£¥€§©®µ¶¼±αβΔΦ', '†«»áàâäå', '&#8482; &#170;'] },
  { group: 'HTML tags', values: ['<span style="color:red;">Red text</span>', '<i>Italics</i>', "<script>alert('hello world')</script>"] },
  { group: 'JavaScript', values: ["alert('hello world')", 'alert(document.cookie)'] },
  { group: 'SQL injection', values: ["'", "1'", "' OR '1'='1'; --", '1"-- "'] },
  { group: 'Spaces', values: ['     ', '  Anna  ', 'Anna   Smith'] },
  { group: 'Numbers & formats', values: ['-5', '0', '2.5', '2,5', '123.123.123,00', '99', '100'] },
];

// Boundary-value strings for a text field with [min, max] length.
export function boundaryValues(min, max, char = 'a') {
  min = Math.max(0, Math.floor(Number(min)));
  max = Math.floor(Number(max));
  if (!Number.isFinite(min) || !Number.isFinite(max) || max < min) return [];
  const c = String(char || 'a').charAt(0) || 'a';
  const cases = [
    ['Min-1', min - 1, 'invalid'], ['Min', min, 'valid'], ['Min+1', min + 1, 'valid'],
    ['Max-1', max - 1, 'valid'], ['Max', max, 'valid'], ['Max+1', max + 1, 'invalid'],
  ];
  // Drop impossible lengths and valid cases that collapse onto each other (e.g. min = max).
  const seen = new Set();
  return cases
    .filter(([, len, kind]) => {
      if (len < 0 || len > 5000) return false;
      if (kind === 'valid' && (len < min || len > max)) return false;
      if (seen.has(len)) return false;
      seen.add(len);
      return true;
    })
    .map(([label, len, kind]) => ({ label, length: len, kind, value: c.repeat(len) }));
}
