const { generateName, findButton, waitForTextInput } = require('../utils/helpers');

/**
 * Page object encapsulating operations on a tree editing UI.  Methods
 * on this class perform high‑level actions such as creating,
 * deleting, copying and cutting nodes, undoing and redoing edits,
 * expanding/collapsing branches and exporting/importing the tree
 * state.  Consumers of this class should not need to know the
 * underlying selectors or keyboard shortcuts used to accomplish
 * these tasks.
 */
class TreePage {
  /**
   * Construct a new TreePage bound to a Playwright page.
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
  }

  /**
   * Navigate to the application's root and wait for network
   * quiescence.  Should be called at the beginning of each test.
   */
  async goto() {
    await this.page.goto('/');
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Create a new node.  If no name is supplied, one will be
   * generated automatically.  Returns the locator for the newly
   * created node.
   * @param {string} [name]
   */
  async addNode(name = generateName('Node')) {
    const addBtn = await findButton(this.page, [/new item/i, /new node/i, /add item/i, /add node/i, /create/i, /\+\s*node/i]);
    if (!addBtn) throw new Error('Add/New button not found');
    await addBtn.click();
    const input = await waitForTextInput(this.page);
    if (input) {
      await input.fill(name);
      await input.press('Enter').catch(() => {});
    } else {
      // Fallback: attempt to rename the last tree item.
      const count = await this.page.getByRole('treeitem').count().catch(() => 0);
      if (count > 0) {
        const last = this.page.getByRole('treeitem').nth(count - 1);
        await last.dblclick().catch(() => {});
        const editor = await waitForTextInput(this.page);
        if (editor) {
          await editor.fill(name);
          await editor.press('Enter').catch(() => {});
        }
      }
    }
    await this.page.waitForTimeout(200);
    const locator = this.page.getByRole('treeitem', { name });
    return locator;
  }

  /**
   * Delete the node with the given name.  Attempts keyboard deletion
   * first and falls back to a Delete/Remove button if necessary.
   * @param {string} name
   */
  async deleteNode(name) {
    const node = this.page.getByRole('treeitem', { name });
    await node.click();
    const initial = await this.page.getByRole('treeitem').count().catch(() => 0);
    await this.page.keyboard.press('Delete');
    await this.page.waitForTimeout(200);
    let final = await this.page.getByRole('treeitem').count().catch(() => 0);
    if (final === initial) {
      const delBtn = await findButton(this.page, [/delete/i, /remove/i, /trash/i]);
      if (delBtn) {
        await delBtn.click();
        await this.page.waitForTimeout(200);
        final = await this.page.getByRole('treeitem').count().catch(() => 0);
      }
    }
    return final;
  }

  /**
   * Copy and paste the node identified by name.  Returns when the
   * duplicate appears.  This will duplicate the node under the same
   * parent.
   * @param {string} name
   */
  async copyNode(name) {
    const node = this.page.getByRole('treeitem', { name });
    await node.click();
    const before = await this.page.getByRole('treeitem').count().catch(() => 0);
    await this.page.keyboard.press('Control+C');
    await this.page.keyboard.press('Control+V');
    await this.page.waitForTimeout(300);
    let after = await this.page.getByRole('treeitem').count().catch(() => 0);
    if (after === before) {
      const copyBtn = await findButton(this.page, [/copy/i, /duplicate/i]);
      const pasteBtn = await findButton(this.page, [/paste/i]);
      if (copyBtn && pasteBtn) {
        await copyBtn.click();
        await pasteBtn.click();
        await this.page.waitForTimeout(300);
        after = await this.page.getByRole('treeitem').count().catch(() => 0);
      }
    }
    return after;
  }

  /**
   * Cut and paste the node.  Attempts keyboard shortcuts first
   * followed by buttons.  Returns when the operation completes.
   * @param {string} name
   */
  async cutNode(name) {
    const node = this.page.getByRole('treeitem', { name });
    await node.click();
    const before = await this.page.getByRole('treeitem').count();
    await this.page.keyboard.press('Control+X');
    await this.page.keyboard.press('Control+V');
    await this.page.waitForTimeout(300);
    let after = await this.page.getByRole('treeitem').count();
    if (after !== before) {
      const cutBtn = await findButton(this.page, [/cut/i]);
      const pasteBtn = await findButton(this.page, [/paste/i]);
      if (cutBtn && pasteBtn) {
        await cutBtn.click();
        await pasteBtn.click();
        await this.page.waitForTimeout(300);
        after = await this.page.getByRole('treeitem').count();
      }
    }
    return after;
  }

  /**
   * Undo the last operation.  On Mac, Control maps to Command
   * automatically.
   */
  async undo() {
    await this.page.keyboard.press('Control+Z');
    await this.page.waitForTimeout(200);
  }

  /**
   * Redo the last undone operation.  Tries Ctrl+Shift+Z then Ctrl+Y.
   */
  async redo() {
    await this.page.keyboard.press('Control+Shift+Z');
    await this.page.waitForTimeout(200);
    // Optionally try Ctrl+Y if nothing changed (the caller should
    // verify externally).
  }

  /**
   * Expand or collapse a parent node by toggling its disclosure control.
   * The toggle is identified by aria-label/title attributes containing
   * “collapse” or “expand”.  When a toggle is not present, falls back
   * to double clicking the node.  The action parameter should be
   * either 'expand' or 'collapse'.
   * @param {string} name
   * @param {'expand'|'collapse'} action
   */
  async toggleNode(name, action) {
    const parent = this.page.getByRole('treeitem', { name });
    const toggle = parent.locator(
      'button[aria-label*="collapse" i], button[title*="collapse" i], button[aria-label*="expand" i], button[title*="expand" i]'
    ).first();
    const hasToggle = (await toggle.count()) > 0;
    if (hasToggle) {
      await toggle.click();
    } else {
      await parent.dblclick();
    }
    await this.page.waitForTimeout(200);
  }

  /**
   * Export the current tree to a file.  Returns the downloaded file
   * path.
   */
  async exportTree() {
    const exportBtn = await findButton(this.page, [/export/i, /save/i, /download/i]);
    if (!exportBtn) throw new Error('Export button not found');
    const [download] = await Promise.all([
      this.page.waitForEvent('download', { timeout: 5000 }),
      exportBtn.click(),
    ]);
    const path = await download.path();
    return path;
  }

  /**
   * Import a tree from the given file path.  Assumes a file chooser
   * appears when the import button is clicked.
   * @param {string} filePath
   */
  async importTree(filePath) {
    const importBtn = await findButton(this.page, [/import/i, /load/i, /upload/i]);
    if (!importBtn) throw new Error('Import button not found');
    const [fileChooser] = await Promise.all([
      this.page.waitForEvent('filechooser'),
      importBtn.click(),
    ]);
    await fileChooser.setFiles(filePath);
    await this.page.waitForTimeout(500);
    const count = await this.page.getByRole('treeitem').count().catch(() => 0);
    return count;
  }
}

module.exports = { TreePage };