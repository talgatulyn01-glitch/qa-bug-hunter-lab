// Business requirements (BRn) for the LiteShop sandbox.
// Testers cite these in "Expected result"; the report linter checks that
// cited BRs exist and that numbers in Expected are traceable to them.

export const REQUIREMENTS = [
  { id: 'BR1', component: 'Menu', text: 'The menu item of the current page is highlighted and is not clickable.' },
  { id: 'BR2', component: 'Menu', text: 'Menu item names are identical on all pages: Home, Catalog, Cart, Orders, Profile, Reviews, Sign up.' },
  { id: 'BR3', component: 'Menu', text: 'Each menu item opens the page with the same name.' },
  { id: 'BR4', component: 'Catalog', text: 'Several categories can be selected in the filter at the same time; unselecting one category keeps the others selected.' },
  { id: 'BR5', component: 'Catalog', text: 'Clicking a category label selects or unselects its checkbox.' },
  { id: 'BR6', component: 'Catalog', text: 'The catalog shows 4 products per page. Selected filters are kept when the user moves between pages.' },
  { id: 'BR7', component: 'Catalog', text: 'The "Select all" checkbox selects all categories, including after some categories were unselected manually.' },
  { id: 'BR8', component: 'Search', text: 'Search returns products whose name contains the query. Any characters are allowed and are treated as plain text. Internal products are never shown to customers.' },
  { id: 'BR9', component: 'Cart', text: 'A bulk discount of 10% is applied to a cart line when its quantity is 10 or more.' },
  { id: 'BR10', component: 'Cart', text: 'Quantity accepts whole numbers from 1 to 99. Other values are rejected with a validation message.' },
  { id: 'BR11', component: 'Catalog', text: 'The whole area of the "Add to cart" button is clickable.' },
  { id: 'BR12', component: 'Checkout', text: 'One checkout creates exactly one order, regardless of how many times the "Place order" button is clicked.' },
  { id: 'BR13', component: 'Sign up', text: 'Name is required, 2 to 30 characters. A name of spaces only is not allowed. Leading and trailing spaces are removed on save.' },
  { id: 'BR14', component: 'Sign up', text: 'Email is required and must be unique; the uniqueness check is case-insensitive.' },
  { id: 'BR15', component: 'Sign up', text: 'Phone is required. All required fields are marked with *.' },
  { id: 'BR16', component: 'Sign up', text: 'The "Create account" button is visible at all times and is disabled until the Terms checkbox is checked.' },
  { id: 'BR17', component: 'Sign up', text: 'The Promo code field is disabled (feature not available yet) and is skipped by the Tab key.' },
  { id: 'BR18', component: 'Profile', text: 'All profile fields (name, phone, city) are saved. The saved city is used as the delivery city at checkout.' },
  { id: 'BR19', component: 'Reviews', text: 'Review text is displayed exactly as it was entered; HTML tags are shown as text and scripts are never executed.' },
  { id: 'BR20', component: 'Reviews', text: 'Author name is 2 to 30 characters; leading and trailing spaces are removed on save.' },
];

export const REQ_BY_ID = Object.fromEntries(REQUIREMENTS.map(r => [r.id, r]));
