/**
 * Shared helper functions for Playwright tests.
 * These helpers encapsulate common operations such as generating
 * unique names for items, finding buttons by candidate labels and
 * waiting for editable text inputs to appear.  Abstracting these
 * patterns out of individual tests and page objects makes the
 * overall suite more maintainable and encourages reuse.
 */

// Generate a relatively unique identifier by combining a prefix with
// the current timestamp and a random integer.  Prefixes should be
// descriptive of what is being created (e.g. 'Node', 'Note', 'Task').
function generateName(prefix = 'Item') {
  return `${prefix}-${Date.now().toString(36)}-${Math.floor(Math.random() * 1000)}`;
}

// Given a Playwright page and an array of candidate names (either
// strings or regular expressions), return the first button locator
// matching any of those names.  If none are found, returns null.
async function findButton(page, candidates) {
  for (const name of candidates) {
    const button = page.getByRole('button', { name });
    if (await button.count()) {
      return button;
    }
  }
  return null;
}

// Wait for the first visible text input or textarea to become
// available.  Many UIs place a text input into edit mode; this
// helper gives them up to one second to appear.  Returns a
// locator or undefined if nothing appears.
async function waitForTextInput(page) {
  try {
    const input = page.locator('input[type="text"], textarea');
    await input.first().waitFor({ state: 'visible', timeout: 1000 });
    return input.first();
  } catch (err) {
    return undefined;
  }
}

module.exports = {
  generateName,
  findButton,
  waitForTextInput,
};