import { BasePage } from './base-page.js';

export class FabPage extends BasePage {
  constructor(page) {
    super(page);
  }

  // FAB selectors
  get desktopFab() {
    return this.page.locator('.fab-container.fab-inline .fab-main');
  }

  get mobileFab() {
    return this.page.locator('.fab-container').filter({ hasClass: /fixed/ }).locator('.fab-main');
  }

  get fabMain() {
    return this.page.locator('.fab-container .fab-main');
  }

  get fabMenu() {
    return this.page.locator('.fab-menu');
  }

  get fabMenuItems() {
    return this.page.locator('.fab-menu .fab-menu-item');
  }

  get fabBackdrop() {
    return this.page.locator('.fab-backdrop');
  }

  // Menu item selectors
  get rootFolderOption() {
    return this.fabMenuItems.filter({ hasText: 'Root Folder' });
  }

  get subfolderOption() {
    return this.fabMenuItems.filter({ hasText: 'Subfolder' });
  }

  get noteOption() {
    return this.fabMenuItems.filter({ hasText: 'Note' });
  }

  get taskOption() {
    return this.fabMenuItems.filter({ hasText: 'Task' });
  }

  // Actions
  async clickFab() {
    await this.fabMain.click();
    await this.waitForMenuToOpen();
  }

  async tapFab() {
    await this.fabMain.tap();
    await this.waitForMenuToOpen();
  }

  async waitForMenuToOpen() {
    await this.fabMenu.waitFor({ state: 'visible', timeout: 1000 });
    await this.page.waitForTimeout(200); // Wait for animation
  }

  async waitForMenuToClose() {
    await this.fabMenu.waitFor({ state: 'hidden', timeout: 1000 });
  }

  async clickMenuOption(optionName) {
    const option = this.fabMenuItems.filter({ hasText: optionName });
    await option.click();
    await this.waitForMenuToClose();
  }

  async tapMenuOption(optionName) {
    const option = this.fabMenuItems.filter({ hasText: optionName });
    await option.tap();
    await this.waitForMenuToClose();
  }

  async closeMenuByClickingOutside() {
    await this.page.click('body', { position: { x: 100, y: 100 } });
    await this.waitForMenuToClose();
  }

  async closeMenuByEscape() {
    await this.page.keyboard.press('Escape');
    await this.waitForMenuToClose();
  }

  async createRootFolderViaMab(folderName) {
    await this.clickFab();
    await this.clickMenuOption('Root Folder');
    await this.fillFolderForm(folderName);
    await this.submitForm();
  }

  async createSubfolderViaFab(folderName) {
    await this.clickFab();
    await this.clickMenuOption('Subfolder');
    await this.fillFolderForm(folderName);
    await this.submitForm();
  }

  async createNoteViaFab(noteTitle) {
    await this.clickFab();
    await this.clickMenuOption('Note');
    await this.fillNoteForm(noteTitle);
    await this.submitForm();
  }

  async createTaskViaFab(taskTitle) {
    await this.clickFab();
    await this.clickMenuOption('Task');
    await this.fillTaskForm(taskTitle);
    await this.submitForm();
  }

  // Form helpers
  async fillFolderForm(name) {
    const nameInput = this.page.locator('input[placeholder*="folder name"], input[placeholder*="name"]').first();
    await nameInput.fill(name);
  }

  async fillNoteForm(title) {
    const titleInput = this.page.locator('input[placeholder*="note"], input[placeholder*="title"]').first();
    await titleInput.fill(title);
  }

  async fillTaskForm(title) {
    const titleInput = this.page.locator('input[placeholder*="task"], input[placeholder*="title"]').first();
    await titleInput.fill(title);
  }

  async submitForm() {
    const createButton = this.page.locator('button').filter({ hasText: /create|add|save/i }).first();
    await createButton.click();
    await this.page.waitForTimeout(1000); // Wait for creation
  }

  async cancelForm() {
    const cancelButton = this.page.locator('button').filter({ hasText: /cancel/i }).first();
    await cancelButton.click();
  }

  // Validation helpers
  async expectFabVisible() {
    await this.expectVisible(this.fabMain);
  }

  async expectFabHidden() {
    await this.expectHidden(this.fabMain);
  }

  async expectMenuOpen() {
    await this.expectVisible(this.fabMenu);
  }

  async expectMenuClosed() {
    await this.expectHidden(this.fabMenu);
  }

  async expectMenuItemCount(count) {
    await this.fabMenuItems.first().waitFor({ state: 'visible', timeout: 5000 });
    const actualCount = await this.fabMenuItems.count();
    if (actualCount !== count) {
      throw new Error(`Expected ${count} menu items but found ${actualCount}`);
    }
  }

  async expectMenuItemVisible(itemText) {
    const item = this.fabMenuItems.filter({ hasText: itemText });
    await this.expectVisible(item);
  }

  async expectMenuItemHidden(itemText) {
    const item = this.fabMenuItems.filter({ hasText: itemText });
    await this.expectHidden(item);
  }

  async expectDesktopFabInTreePanel() {
    await this.expectVisible(this.desktopFab);
    await this.expectHidden(this.mobileFab);
  }

  async expectMobileFabFixed() {
    await this.expectVisible(this.mobileFab);
    await this.expectHidden(this.desktopFab);
  }

  async expectFabDisabled() {
    const isDisabled = await this.fabMain.isDisabled();
    if (!isDisabled) {
      throw new Error('Expected FAB to be disabled but it was enabled');
    }
  }

  async expectFabEnabled() {
    const isDisabled = await this.fabMain.isDisabled();
    if (isDisabled) {
      throw new Error('Expected FAB to be enabled but it was disabled');
    }
  }

  // Context helpers
  async clearTreeSelection() {
    await this.page.evaluate(() => {
      document.querySelectorAll('.tree-item.selected, [data-selected="true"]').forEach(item => {
        item.classList.remove('selected');
        item.removeAttribute('data-selected');
      });
    });
    await this.page.waitForTimeout(300);
  }

  async selectTreeItem(itemText) {
    const item = this.page.locator('[data-item-id*="item-"]').filter({ hasText: itemText });
    await item.click();
    await this.page.waitForTimeout(500); // Wait for selection to register
  }

  async getFabPosition() {
    const fabBox = await this.fabMain.boundingBox();
    return fabBox;
  }

  async getMenuPosition() {
    const menuBox = await this.fabMenu.boundingBox();
    return menuBox;
  }

  async getMenuZIndex() {
    const zIndex = await this.fabMenu.evaluate(el => window.getComputedStyle(el).zIndex);
    return parseInt(zIndex);
  }

  // Keyboard navigation
  async navigateToFabWithKeyboard() {
    // Keep pressing Tab until we reach the FAB
    for (let i = 0; i < 20; i++) {
      const focusedElement = await this.page.locator(':focus').textContent().catch(() => '');
      if (focusedElement && (focusedElement.includes('Create') || focusedElement.includes('Add'))) {
        return true;
      }
      await this.page.keyboard.press('Tab');
      await this.page.waitForTimeout(100);
    }
    return false;
  }

  async activateFabWithKeyboard() {
    await this.page.keyboard.press('Enter');
    await this.waitForMenuToOpen();
  }

  async navigateMenuWithKeyboard(direction = 'down') {
    const key = direction === 'down' ? 'ArrowDown' : 'ArrowUp';
    await this.page.keyboard.press(key);
    await this.page.waitForTimeout(100);
  }

  async selectMenuItemWithKeyboard() {
    await this.page.keyboard.press('Enter');
    await this.waitForMenuToClose();
  }

  // Performance testing
  async measureFabOpenTime() {
    const startTime = Date.now();
    await this.clickFab();
    const endTime = Date.now();
    return endTime - startTime;
  }

  async measureMenuItemClickTime(optionName) {
    const startTime = Date.now();
    await this.clickMenuOption(optionName);
    
    // Wait for dialog to appear (indicates completion)
    await this.page.locator('[data-testid="add-dialog"], .add-dialog').waitFor({ 
      state: 'visible', 
      timeout: 5000 
    });
    
    const endTime = Date.now();
    return endTime - startTime;
  }

  // Accessibility helpers
  async expectFabHasCorrectAria() {
    const ariaLabel = await this.fabMain.getAttribute('aria-label');
    const ariaExpanded = await this.fabMain.getAttribute('aria-expanded');
    const ariaHaspopup = await this.fabMain.getAttribute('aria-haspopup');

    if (!ariaLabel || !ariaLabel.includes('Create')) {
      throw new Error(`Expected FAB aria-label to contain 'Create' but got '${ariaLabel}'`);
    }
    
    if (ariaExpanded === null) {
      throw new Error('Expected FAB to have aria-expanded attribute');
    }
    
    if (ariaHaspopup !== 'menu') {
      throw new Error(`Expected FAB aria-haspopup to be 'menu' but got '${ariaHaspopup}'`);
    }
  }

  async expectMenuHasCorrectAria() {
    const role = await this.fabMenu.getAttribute('role');
    const ariaLabel = await this.fabMenu.getAttribute('aria-label');

    if (role !== 'menu') {
      throw new Error(`Expected menu role to be 'menu' but got '${role}'`);
    }
    
    if (!ariaLabel) {
      throw new Error('Expected menu to have aria-label');
    }
  }

  async expectMenuItemsHaveCorrectAria() {
    const items = this.fabMenuItems;
    const count = await items.count();
    
    for (let i = 0; i < count; i++) {
      const item = items.nth(i);
      const role = await item.getAttribute('role');
      const title = await item.getAttribute('title');
      
      if (role !== 'menuitem') {
        throw new Error(`Expected menu item ${i} role to be 'menuitem' but got '${role}'`);
      }
      
      if (!title) {
        throw new Error(`Expected menu item ${i} to have title attribute`);
      }
    }
  }

  // Visual regression helpers
  async screenshotFab(name) {
    await this.fabMain.screenshot({ path: `test-results/screenshots/fab-${name}.png` });
  }

  async screenshotMenu(name) {
    await this.fabMenu.screenshot({ path: `test-results/screenshots/menu-${name}.png` });
  }

  async screenshotFabAndMenu(name) {
    const fabContainer = this.page.locator('.fab-container').first();
    await fabContainer.screenshot({ 
      path: `test-results/screenshots/fab-menu-${name}.png`,
      animations: 'disabled'
    });
  }
}