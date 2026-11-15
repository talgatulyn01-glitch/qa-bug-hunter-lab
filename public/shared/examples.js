// Teaching examples for the report builder. Submitting an example does not
// count as finding a planted defect (checked on the server by summary).
export const BAD_EXAMPLE = {
  summary: 'CRITICAL!!! Search doesn\'t work TC-5',
  component: 'Search', affectsVersion: 'LiteShop 1.0', environment: 'Chrome', severity: 'Critical', errorType: 'Functional',
  precondition: 'Open the site',
  steps: ['Enter some text in search', 'Press Enter'],
  actual: 'Error. The code has a bug in the SQL query.',
  expected: 'It should work properly',
  note: 'Please fix asap',
};

export const GOOD_EXAMPLE = {
  summary: 'Search: product list is replaced by an error when the query contains a single quote',
  component: 'Search', affectsVersion: 'LiteShop 1.0', severity: 'Critical', errorType: 'Security',
  precondition: '',
  steps: [
    'Open the LiteShop sandbox (/sandbox/#/catalog)',
    'Open DevTools, switch to the Console tab and clear the console',
    'Enter "1\'" in the "Search" field',
    'Click "Search"',
    'Repeat steps 3-4 with "Mug" and compare the results',
  ],
  actual: 'The product list is replaced by "Something went wrong. Try again later." The console shows:\nError: SearchService: 500 Internal Server Error, syntax error at or near "\'%\'"\n    at SearchService.handle (sandbox.js:118:13)\n    at async runSearch (sandbox.js:131:5)\nWith "Mug" the search returns 1 product without errors. Reproduced 3/3 times for any query with an odd number of quotes, in Chrome 131 and Firefox 133.',
  expected: 'The quote is treated as plain text: the list shows "No products found" and no error occurs (BR8).',
  note: '',
};

export const EXAMPLE_SUMMARIES = [BAD_EXAMPLE.summary, GOOD_EXAMPLE.summary];
