/**
 * Shared fixtures for Playwright tests that utilise the page object model (POM).
 *
 * This file defines extended test fixtures that automatically provide
 * instances of page objects for the tree editing and content editing
 * interfaces.  Each fixture will navigate to the application root
 * before yielding, ensuring a consistent starting state for every
 * test.  Import these fixtures in your spec files instead of
 * '@playwright/test' directly to gain access to the `tree` and
 * `notes` objects.
 */

const { test: base } = require('@playwright/test');
const { TreePage } = require('./pages/TreePage');
const { NoteTaskPage } = require('./pages/NoteTaskPage');

/**
 * Extend Playwright's built‑in fixtures with our own page objects.
 *
 * The `tree` fixture constructs a TreePage and calls its goto()
 * method so that the page is ready for interaction when the test
 * begins.  Similarly, the `notes` fixture constructs a NoteTaskPage
 * and navigates to the root.  Both fixtures depend only on
 * Playwright's `page` fixture and will be recreated for every test,
 * providing isolation between test cases.
 */
const test = base.extend({
  /**
   * Tree editing page object.  Use this in tests that operate on
   * tree structures.  The page will already be navigated to '/'.
   *
   * @param {{ page: import('@playwright/test').Page }}
   * @param {Function} use
   */
  tree: async ({ page }, use) => {
    const tree = new TreePage(page);
    await tree.goto();
    await use(tree);
  },
  /**
   * Notes and tasks editing page object.  Use this fixture to
   * interact with note/task interfaces.  Navigation to '/' is
   * performed before yielding.
   *
   * @param {{ page: import('@playwright/test').Page }}
   * @param {Function} use
   */
  notes: async ({ page }, use) => {
    const notes = new NoteTaskPage(page);
    await notes.goto();
    await use(notes);
  },
});

module.exports = { test };