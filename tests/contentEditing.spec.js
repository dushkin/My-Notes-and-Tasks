const { test } = require('./fixtures');
const { expect } = require('@playwright/test');
const { generateName, waitForTextInput } = require('./utils/helpers');

/*
 * End‑to‑end tests for editing the content of notes and tasks using
 * the page object model.  The `notes` fixture from fixtures.js
 * provides a NoteTaskPage instance and automatically navigates to the
 * application for each test.  By centralising interactions in the
 * POM, the tests become concise and robust against UI changes.
 */

test.describe('Content editing operations with POM', () => {
  test('editing a note updates its title and body', async ({ notes, page }) => {
    const originalTitle = generateName('Note');
    const originalBody = `Body of ${originalTitle}`;
    await notes.createNote(originalTitle, originalBody);
    // Verify creation
    let noteItem = page.getByRole('listitem', { name: new RegExp(originalTitle, 'i') });
    await expect(noteItem).toBeVisible();
    const updatedTitle = `${originalTitle}-edited`;
    const updatedBody = `${originalBody} (updated)`;
    await notes.editNote(originalTitle, updatedTitle, updatedBody);
    // Verify update
    noteItem = page.getByRole('listitem', { name: new RegExp(updatedTitle, 'i') });
    await expect(noteItem).toBeVisible();
    await noteItem.click();
    await expect(page.getByText(new RegExp(updatedBody, 'i'))).toBeVisible();
  });

  test('editing a task updates its details', async ({ notes, page }) => {
    const originalTask = generateName('Task');
    const originalDesc = `Description of ${originalTask}`;
    await notes.createTask(originalTask, originalDesc);
    let taskItem = page.getByRole('listitem', { name: new RegExp(originalTask, 'i') });
    await expect(taskItem).toBeVisible();
    const updatedTitle = `${originalTask}-updated`;
    const updatedDesc = `${originalDesc} (edited)`;
    await notes.editTask(originalTask, updatedTitle, updatedDesc);
    taskItem = page.getByRole('listitem', { name: new RegExp(updatedTitle, 'i') });
    await expect(taskItem).toBeVisible();
    await taskItem.click();
    await expect(page.getByText(new RegExp(updatedDesc, 'i'))).toBeVisible();
  });

  test('cancelling an edit leaves the original content unchanged', async ({ notes, page }) => {
    const title = generateName('Cancel');
    const body = `Body of ${title}`;
    await notes.createNote(title, body);
    let noteItem = page.getByRole('listitem', { name: new RegExp(title, 'i') });
    await expect(noteItem).toBeVisible();
    // Start editing using the page object’s internal method
    await notes._startEdit(title);
    // Modify the title and body without saving
    const newTitle = `${title}-temp`;
    const newBody = `${body} (temp)`;
    const input = await waitForTextInput(page);
    if (input) {
      await input.fill(newTitle);
      const textarea = page.locator('textarea').nth(0);
      if (await textarea.count()) await textarea.fill(newBody);
    }
    // Cancel changes via POM
    await notes.cancelEdit(title);
    // Verify original content remains
    await expect(page.getByRole('listitem', { name: new RegExp(`^${title}$`, 'i') })).toBeVisible();
    noteItem = page.getByRole('listitem', { name: new RegExp(title, 'i') });
    await noteItem.click();
    await expect(page.getByText(new RegExp(body, 'i'))).toBeVisible();
  });

  test('edited content persists after page reload', async ({ notes, page }) => {
    const title = generateName('Persist');
    const body = `Initial body for ${title}`;
    await notes.createNote(title, body);
    const updatedBody = `${body} (edited)`;
    // Edit just the body; leave the title unchanged
    await notes.editNote(title, undefined, updatedBody);
    await page.reload();
    await page.waitForLoadState('networkidle');
    const reloadedNote = page.getByRole('listitem', { name: new RegExp(title, 'i') });
    await expect(reloadedNote).toBeVisible();
    await reloadedNote.click();
    await expect(page.getByText(new RegExp(updatedBody, 'i'))).toBeVisible();
  });
});