const { generateName, findButton, waitForTextInput } = require('../utils/helpers');

/**
 * Page object for a combined notes and tasks application.  Exposes
 * methods for creating, editing, and cancelling edits of notes and
 * tasks.  Each method is designed to work with a variety of UI
 * implementations by searching for accessible labels and using
 * graceful fallbacks.
 */
class NoteTaskPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
  }

  /** Navigate to the application root and wait for network idle. */
  async goto() {
    await this.page.goto('/');
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Create a new note with the given title and body.  If not
   * provided, a unique title will be generated and the body will be
   * derived from it.  Returns the locator of the newly created note.
   * @param {string} [title]
   * @param {string} [body]
   */
  async createNote(title, body) {
    const noteTitle = title || generateName('Note');
    const noteBody = body || `Body of ${noteTitle}`;
    const addButton = await findButton(this.page, [/add note/i, /new note/i, /create note/i]);
    if (!addButton) throw new Error('Add Note button not found');
    await addButton.click();
    const input = await waitForTextInput(this.page);
    if (input) {
      await input.fill(noteTitle);
      const textarea = this.page.locator('textarea').nth(0);
      if (await textarea.count()) await textarea.fill(noteBody);
      await input.press('Enter').catch(() => {});
      const saveBtn = await findButton(this.page, [/save/i, /add/i, /create/i]);
      if (saveBtn) await saveBtn.click();
    }
    await this.page.waitForTimeout(200);
    const locator = this.page.getByRole('listitem', { name: new RegExp(noteTitle, 'i') });
    return locator;
  }

  /**
   * Create a new task.  If title/description are omitted they will be
   * generated automatically.  Returns the locator for the new task.
   * @param {string} [title]
   * @param {string} [description]
   */
  async createTask(title, description) {
    const taskTitle = title || generateName('Task');
    const taskDesc = description || `Description of ${taskTitle}`;
    const addButton = await findButton(this.page, [/add task/i, /new task/i, /create task/i]);
    if (!addButton) throw new Error('Add Task button not found');
    await addButton.click();
    const input = await waitForTextInput(this.page);
    if (input) {
      await input.fill(taskTitle);
      const textarea = this.page.locator('textarea').nth(0);
      if (await textarea.count()) await textarea.fill(taskDesc);
      await input.press('Enter').catch(() => {});
      const saveBtn = await findButton(this.page, [/save/i, /add/i, /create/i]);
      if (saveBtn) await saveBtn.click();
    }
    await this.page.waitForTimeout(200);
    const locator = this.page.getByRole('listitem', { name: new RegExp(taskTitle, 'i') });
    return locator;
  }

  /**
   * Internal helper to start editing a list item by name.  Tries to
   * locate an Edit button within the item first, otherwise double
   * clicks the item itself.
   * @param {string} name
   */
  async _startEdit(name) {
    const item = this.page.getByRole('listitem', { name: new RegExp(name, 'i') });
    const editBtn = await findButton(item, [/edit/i, /modify/i]);
    if (editBtn) {
      await editBtn.click();
    } else {
      await item.dblclick();
    }
    await this.page.waitForTimeout(100);
  }

  /**
   * Edit a note’s title and body.  You may pass only the fields you
   * wish to modify; omitted fields will remain unchanged.  Returns
   * the locator for the updated note.
   * @param {string} originalTitle
   * @param {string} [newTitle]
   * @param {string} [newBody]
   */
  async editNote(originalTitle, newTitle, newBody) {
    await this._startEdit(originalTitle);
    const input = await waitForTextInput(this.page);
    if (input) {
      if (newTitle) {
        await input.fill(newTitle);
      }
      const textarea = this.page.locator('textarea').nth(0);
      if (await textarea.count() && newBody) {
        await textarea.fill(newBody);
      }
    }
    // Save changes.
    const saveBtn = await findButton(this.page, [/save/i, /done/i, /update/i]);
    if (saveBtn) {
      await saveBtn.click();
    } else if (input) {
      await input.press('Enter').catch(() => {});
    }
    const updatedTitle = newTitle || originalTitle;
    await this.page.waitForTimeout(200);
    return this.page.getByRole('listitem', { name: new RegExp(updatedTitle, 'i') });
  }

  /**
   * Edit a task’s title and description.  Operates like editNote.
   * @param {string} originalTitle
   * @param {string} [newTitle]
   * @param {string} [newDescription]
   */
  async editTask(originalTitle, newTitle, newDescription) {
    await this._startEdit(originalTitle);
    const input = await waitForTextInput(this.page);
    if (input) {
      if (newTitle) await input.fill(newTitle);
      const textarea = this.page.locator('textarea').nth(0);
      if (await textarea.count() && newDescription) {
        await textarea.fill(newDescription);
      }
    }
    const saveBtn = await findButton(this.page, [/save/i, /done/i, /update/i]);
    if (saveBtn) {
      await saveBtn.click();
    } else if (input) {
      await input.press('Enter').catch(() => {});
    }
    const updatedTitle = newTitle || originalTitle;
    await this.page.waitForTimeout(200);
    return this.page.getByRole('listitem', { name: new RegExp(updatedTitle, 'i') });
  }

  /**
   * Cancel an edit in progress.  Changes made in the edit UI are
   * discarded.  Accepts the original title and optional temporary
   * values used during editing.  Returns when cancellation is
   * complete.
   * @param {string} originalTitle
   */
  async cancelEdit(originalTitle) {
    // Attempt to click a Cancel/Discard button.
    const cancelBtn = await findButton(this.page, [/cancel/i, /discard/i]);
    if (cancelBtn) {
      await cancelBtn.click();
    } else {
      // Fallback: hit Escape to exit editing mode.
      await this.page.keyboard.press('Escape');
    }
    await this.page.waitForTimeout(200);
    // Ensure the original list item is visible again.
    await expect(
      this.page.getByRole('listitem', { name: new RegExp(originalTitle, 'i') })
    ).toBeVisible();
  }
}

module.exports = { NoteTaskPage };