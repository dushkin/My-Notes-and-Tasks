import { BasePage } from './base-page.js';

export class DashboardPage extends BasePage {
  constructor(page) {
    super(page);
  }

  // Main navigation selectors
  get userMenu() {
    return this.page.locator('[data-testid="user-menu"], .user-menu');
  }

  get settingsButton() {
    return this.page.locator('[data-testid="settings-button"], .settings-button');
  }

  get logoutButton() {
    return this.page.locator('[data-testid="logout-button"], .logout-button');
  }

  get searchButton() {
    return this.page.locator('[data-testid="search-button"], .search-button');
  }

  get addButton() {
    return this.page.locator('[data-testid="add-button"], .add-button');
  }

  // Tree/sidebar selectors
  get treeContainer() {
    return this.page.locator('[data-testid="tree-container"], .tree-container');
  }

  get treeItems() {
    return this.page.locator('[data-testid="tree-item"], .tree-item');
  }

  get folders() {
    return this.page.locator('[data-testid="folder-item"], .folder-item');
  }

  get tasks() {
    return this.page.locator('[data-testid="task-item"], .task-item');
  }

  get notes() {
    return this.page.locator('[data-testid="note-item"], .note-item');
  }

  // Content editor selectors
  get contentEditor() {
    return this.page.locator('[data-testid="content-editor"], .content-editor');
  }

  get editorTitle() {
    return this.page.locator('[data-testid="editor-title"], .editor-title');
  }

  get editorContent() {
    return this.page.locator('[data-testid="editor-content"], .tiptap, .editor-content');
  }

  get saveButton() {
    return this.page.locator('[data-testid="save-button"], .save-button');
  }

  // Search panel selectors
  get searchPanel() {
    return this.page.locator('[data-testid="search-panel"], .search-panel');
  }

  get searchInput() {
    return this.page.locator('[data-testid="search-input"], .search-input');
  }

  get searchResults() {
    return this.page.locator('[data-testid="search-results"], .search-results');
  }

  // Dialog selectors
  get addDialog() {
    return this.page.locator('[data-testid="add-dialog"], .add-dialog');
  }

  get settingsDialog() {
    return this.page.locator('[data-testid="settings-dialog"], .settings-dialog');
  }

  // Actions
  async goto() {
    await super.goto('/');
    await this.waitForDashboardLoad();
  }

  async waitForDashboardLoad() {
    await this.expectVisible(this.treeContainer);
    await this.expectVisible(this.contentEditor);
    await this.waitForSpinnerToDisappear();
  }

  // Tree/Navigation actions
  async clickTreeItem(itemName) {
    const item = this.treeItems.filter({ hasText: itemName });
    await this.clickAndWait(item);
  }

  async createFolder(name, parentFolder = null) {
    await this.addButton.click();
    await this.waitForModal();
    
    const folderButton = this.addDialog.locator('[data-testid="create-folder"], .create-folder');
    await folderButton.click();
    
    const nameInput = this.addDialog.locator('[data-testid="folder-name"], input[name="name"]');
    await nameInput.fill(name);
    
    if (parentFolder) {
      const parentSelect = this.addDialog.locator('[data-testid="parent-folder"], select[name="parent"]');
      await parentSelect.selectOption(parentFolder);
    }
    
    const createButton = this.addDialog.locator('[data-testid="create-button"], .create-button');
    await this.clickAndWait(createButton);
    
    await this.addDialog.waitFor({ state: 'hidden' });
  }

  async createTask(title, options = {}) {
    await this.addButton.click();
    await this.waitForModal();
    
    const taskButton = this.addDialog.locator('[data-testid="create-task"], .create-task');
    await taskButton.click();
    
    const titleInput = this.addDialog.locator('[data-testid="task-title"], input[name="title"]');
    await titleInput.fill(title);
    
    if (options.description) {
      const descInput = this.addDialog.locator('[data-testid="task-description"], textarea[name="description"]');
      await descInput.fill(options.description);
    }
    
    if (options.priority) {
      const prioritySelect = this.addDialog.locator('[data-testid="task-priority"], select[name="priority"]');
      await prioritySelect.selectOption(options.priority);
    }
    
    if (options.dueDate) {
      const dueDateInput = this.addDialog.locator('[data-testid="task-due-date"], input[name="dueDate"]');
      await dueDateInput.fill(options.dueDate);
    }
    
    const createButton = this.addDialog.locator('[data-testid="create-button"], .create-button');
    await this.clickAndWait(createButton);
    
    await this.addDialog.waitFor({ state: 'hidden' });
  }

  async createNote(title, content = '') {
    await this.addButton.click();
    await this.waitForModal();
    
    const noteButton = this.addDialog.locator('[data-testid="create-note"], .create-note');
    await noteButton.click();
    
    const titleInput = this.addDialog.locator('[data-testid="note-title"], input[name="title"]');
    await titleInput.fill(title);
    
    const createButton = this.addDialog.locator('[data-testid="create-button"], .create-button');
    await this.clickAndWait(createButton);
    
    await this.addDialog.waitFor({ state: 'hidden' });
    
    if (content) {
      await this.editContent(content);
    }
  }

  async deleteItem(itemName) {
    const item = this.treeItems.filter({ hasText: itemName });
    await item.click({ button: 'right' }); // Right-click for context menu
    
    const deleteOption = this.page.locator('[data-testid="delete-option"], .delete-option');
    await deleteOption.click();
    
    await this.confirmAction();
  }

  async renameItem(oldName, newName) {
    const item = this.treeItems.filter({ hasText: oldName });
    await item.click({ button: 'right' });
    
    const renameOption = this.page.locator('[data-testid="rename-option"], .rename-option');
    await renameOption.click();
    
    const nameInput = this.page.locator('[data-testid="rename-input"], .rename-input');
    await nameInput.fill(newName);
    await nameInput.press('Enter');
  }

  // Editor actions
  async editContent(content) {
    await this.contentEditor.waitFor({ state: 'visible' });
    
    // Clear existing content
    await this.editorContent.click();
    await this.page.keyboard.press('Control+a');
    
    // Add new content
    if (typeof content === 'string') {
      await this.editorContent.fill(content);
    } else {
      // Handle rich text content
      await this.editorContent.click();
      await this.page.keyboard.type(content.text || '');
      
      if (content.formatting) {
        // Apply formatting like bold, italic, etc.
        for (const format of content.formatting) {
          await this.applyFormatting(format);
        }
      }
    }
    
    await this.saveContent();
  }

  async saveContent() {
    await this.saveButton.click();
    await this.waitForSpinnerToDisappear();
  }

  async applyFormatting(format) {
    const formatButtons = {
      bold: '[data-testid="bold-button"], .bold-button',
      italic: '[data-testid="italic-button"], .italic-button',
      underline: '[data-testid="underline-button"], .underline-button',
      bulletList: '[data-testid="bullet-list-button"], .bullet-list-button',
      numberedList: '[data-testid="numbered-list-button"], .numbered-list-button'
    };
    
    const button = this.page.locator(formatButtons[format]);
    if (await button.isVisible()) {
      await button.click();
    }
  }

  // Search actions
  async openSearch() {
    await this.searchButton.click();
    await this.expectVisible(this.searchPanel);
  }

  async search(query) {
    await this.openSearch();
    await this.searchInput.fill(query);
    await this.searchInput.press('Enter');
    await this.waitForSpinnerToDisappear();
  }

  async closeSearch() {
    const closeButton = this.searchPanel.locator('[data-testid="close-search"], .close-button');
    await closeButton.click();
    await this.searchPanel.waitFor({ state: 'hidden' });
  }

  // Settings actions
  async openSettings() {
    await this.userMenu.click();
    await this.settingsButton.click();
    await this.waitForModal();
  }

  async changeTheme(theme) {
    await this.openSettings();
    const themeSelect = this.settingsDialog.locator('[data-testid="theme-select"], select[name="theme"]');
    await themeSelect.selectOption(theme);
    
    const saveButton = this.settingsDialog.locator('[data-testid="save-settings"], .save-button');
    await saveButton.click();
    
    await this.settingsDialog.waitFor({ state: 'hidden' });
  }

  async logout() {
    await this.userMenu.click();
    await this.logoutButton.click();
    
    // Wait for redirect to login page
    await this.page.waitForURL(/\/login/, { timeout: 10000 });
  }

  // Validation helpers
  async expectItemInTree(itemName) {
    const item = this.treeItems.filter({ hasText: itemName });
    await this.expectVisible(item);
  }

  async expectItemNotInTree(itemName) {
    const item = this.treeItems.filter({ hasText: itemName });
    await this.expectHidden(item);
  }

  async expectEditorContent(expectedContent) {
    await this.editorContent.waitFor({ state: 'visible' });
    const actualContent = await this.editorContent.textContent();
    if (!actualContent.includes(expectedContent)) {
      throw new Error(`Expected editor content to contain "${expectedContent}" but got "${actualContent}"`);
    }
  }

  async expectSearchResults(expectedCount) {
    const results = this.searchResults.locator('.search-result-item');
    await results.first().waitFor({ state: 'visible', timeout: 5000 });
    const actualCount = await results.count();
    
    if (actualCount !== expectedCount) {
      throw new Error(`Expected ${expectedCount} search results but got ${actualCount}`);
    }
  }

  // Data helpers
  async getTreeStructure() {
    await this.treeContainer.waitFor({ state: 'visible' });
    
    return await this.page.evaluate(() => {
      const treeItems = document.querySelectorAll('[data-testid="tree-item"], .tree-item');
      const structure = [];
      
      treeItems.forEach(item => {
        structure.push({
          name: item.textContent.trim(),
          type: item.classList.contains('folder') ? 'folder' : 
                item.classList.contains('task') ? 'task' : 'note',
          level: parseInt(item.style.paddingLeft) || 0
        });
      });
      
      return structure;
    });
  }

  async getCurrentItemCount() {
    return {
      folders: await this.folders.count(),
      tasks: await this.tasks.count(),
      notes: await this.notes.count(),
      total: await this.treeItems.count()
    };
  }

  // Keyboard shortcuts
  async useKeyboardShortcut(shortcut) {
    const shortcuts = {
      'new-task': 'Control+t',
      'new-note': 'Control+n',
      'new-folder': 'Control+Shift+n',
      'search': 'Control+f',
      'save': 'Control+s',
      'settings': 'Control+comma'
    };
    
    if (shortcuts[shortcut]) {
      await this.page.keyboard.press(shortcuts[shortcut]);
    }
  }

  // Mobile-specific actions
  async openMobileMenu() {
    const menuButton = this.page.locator('[data-testid="mobile-menu"], .mobile-menu-button');
    await menuButton.click();
  }

  async swipeToOpenSidebar() {
    await this.swipeRight();
    await this.expectVisible(this.treeContainer);
  }

  async swipeToCloseSidebar() {
    await this.swipeLeft();
    await this.expectHidden(this.treeContainer);
  }
}