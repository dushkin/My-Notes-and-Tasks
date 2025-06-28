export class TreePage {
  /** @param {import('@playwright/test').Page} page */
  constructor(page) {
    this.page = page;
    this.treeContainer = page.locator('#tree-navigation-area');
  }

  async goto() {
    if (!this.page.url().includes('/app')) {
      await this.page.goto('http://localhost:5173/app', { waitUntil: 'load' });
    }
    
    // Wait for the tree navigation area to be attached with fallback selectors
    const treeSelectors = [
      '#tree-navigation-area',
      '[data-testid="tree-navigation"]',
      '.tree-navigation',
      'nav[aria-label*="tree"]',
      'aside[aria-label*="navigation"]',
      '[role="navigation"]',
      'nav',
      'aside',
      '.sidebar',
      '[data-testid="sidebar"]'
    ];
    
    let treeFound = false;
    for (const selector of treeSelectors) {
      try {
        const element = this.page.locator(selector);
        await element.waitFor({ state: 'attached', timeout: 3000 });
        console.log(`[TreePage] Tree container found with selector: ${selector}`);
        // Update the tree container reference if we found it with a different selector
        if (selector !== '#tree-navigation-area') {
          this.treeContainer = element;
        }
        treeFound = true;
        break;
      } catch (e) {
        console.log(`[TreePage] Tree selector "${selector}" not found, trying next...`);
      }
    }
    
    if (!treeFound) {
      console.log('[TreePage] No tree container found, checking page state...');
      await this.debugCurrentState();
      
      // Try to wait a bit longer for the app to load
      console.log('[TreePage] Waiting additional time for app to load...');
      await this.page.waitForTimeout(2000);
      
      // Try one more time with a broader search
      const fallbackSelectors = [
        'body',
        'main',
        '[class*="tree"]',
        '[class*="nav"]',
        '[class*="sidebar"]'
      ];
      
      for (const selector of fallbackSelectors) {
        try {
          const element = this.page.locator(selector);
          if (await element.count() > 0) {
            console.log(`[TreePage] Using fallback container: ${selector}`);
            this.treeContainer = element;
            treeFound = true;
            break;
          }
        } catch (e) {
          console.log(`[TreePage] Fallback selector "${selector}" failed`);
        }
      }
      
      if (!treeFound) {
        throw new Error('Could not find tree navigation area with any selector');
      }
    }
  }

  async addRootFolderViaContextMenu(label) {
    console.log(`[TreePage] Adding root folder via context menu: "${label}"`);
    
    // Right-click on the tree area
    await this.treeContainer.click({ button: 'right' });
    console.log('[TreePage] Right-clicked on tree container');
    
    // Wait for ANY context menu to appear (fallback selectors)
    const contextMenuSelectors = [
      '[role="menu"]',
      '.context-menu',
      '.fixed.z-50:has-text("Add Root Folder")',
      'div:has-text("Add Root Folder"):visible',
      '[aria-label*="Tree context menu"]'
    ];
    
    let contextMenu = null;
    for (const selector of contextMenuSelectors) {
      try {
        contextMenu = this.page.locator(selector);
        await contextMenu.waitFor({ state: 'visible', timeout: 3000 });
        console.log(`[TreePage] Context menu found with selector: ${selector}`);
        break;
      } catch (e) {
        console.log(`[TreePage] Selector "${selector}" not found, trying next...`);
      }
    }
    
    if (!contextMenu) {
      // Take screenshot for debugging
      await this.page.screenshot({ path: `debug-no-context-menu-${Date.now()}.png` });
      throw new Error('Could not find context menu with any selector');
    }
    
    // Click "Add Root Folder" - try multiple selectors
    const addFolderSelectors = [
      '[role="menuitem"]:has-text("Add Root Folder")',
      'button:has-text("Add Root Folder")',
      ':text("Add Root Folder")'
    ];
    
    let addFolderItem = null;
    for (const selector of addFolderSelectors) {
      try {
        addFolderItem = contextMenu.locator(selector);
        if (await addFolderItem.isVisible({ timeout: 1000 })) {
          console.log(`[TreePage] Found "Add Root Folder" with selector: ${selector}`);
          break;
        }
      } catch (e) {
        console.log(`[TreePage] "Add Root Folder" selector "${selector}" not found`);
      }
    }
    
    if (!addFolderItem) {
      await this.page.screenshot({ path: `debug-no-add-folder-item-${Date.now()}.png` });
      throw new Error('Could not find "Add Root Folder" menu item');
    }
    
    await addFolderItem.click();
    console.log('[TreePage] Clicked "Add Root Folder" menu item');
    
    await this._completeAddDialog(label);
  }

  async addRootFolderViaToolbar(label) {
    console.log(`[TreePage] Adding root folder via toolbar: "${label}"`);
    
    // Find and click the "More actions" button (the three dots)
    const moreActionsSelectors = [
      'button[title="More actions"]',
      'button:has([class*="EllipsisVertical"])',
      'button:has-text("⋮")',
      '[aria-label*="More"]',
      'button[aria-label*="more"]',
      'button[data-testid*="more"]'
    ];
    
    let moreActionsButton = null;
    for (const selector of moreActionsSelectors) {
      try {
        moreActionsButton = this.page.locator(selector);
        if (await moreActionsButton.isVisible({ timeout: 1000 })) {
          console.log(`[TreePage] Found more actions button with: ${selector}`);
          break;
        }
      } catch (e) {
        console.log(`[TreePage] More actions selector "${selector}" not found`);
      }
    }
    
    if (!moreActionsButton) {
      await this.page.screenshot({ path: `debug-no-more-actions-${Date.now()}.png` });
      throw new Error('Could not find "More actions" button');
    }
    
    await moreActionsButton.click();
    console.log('[TreePage] Clicked "More actions" button');
    
    // Wait for dropdown menu
    const dropdownSelectors = [
      '[role="menu"]',
      '.absolute.top-full:has-text("Add Root Folder")',
      'div:has-text("Add Root Folder"):visible'
    ];
    
    let dropdown = null;
    for (const selector of dropdownSelectors) {
      try {
        dropdown = this.page.locator(selector);
        await dropdown.waitFor({ state: 'visible', timeout: 3000 });
        console.log(`[TreePage] Dropdown found with: ${selector}`);
        break;
      } catch (e) {
        console.log(`[TreePage] Dropdown selector "${selector}" not found`);
      }
    }
    
    if (!dropdown) {
      await this.page.screenshot({ path: `debug-no-dropdown-${Date.now()}.png` });
      throw new Error('Could not find dropdown menu');
    }
    
    // Click "Add Root Folder"
    const addFolderItem = dropdown.locator(':text("Add Root Folder")');
    await addFolderItem.click();
    console.log('[TreePage] Clicked "Add Root Folder" in dropdown');
    
    await this._completeAddDialog(label);
  }

  async addRootFolderViaMobile(label) {
    console.log(`[TreePage] Adding root folder via mobile menu: "${label}"`);
    
    // On mobile, there might be a hamburger menu or different navigation
    // Try to find mobile-specific menu triggers
    const mobileMenuSelectors = [
      'button[aria-label*="menu"]',
      'button[aria-label*="Menu"]',
      'button:has([class*="hamburger"])',
      'button:has([class*="Bars"])',
      '.mobile-menu-trigger',
      '[data-testid="mobile-menu"]',
      'button[data-testid="sidebar-toggle"]'
    ];
    
    let mobileMenuButton = null;
    for (const selector of mobileMenuSelectors) {
      try {
        mobileMenuButton = this.page.locator(selector);
        if (await mobileMenuButton.isVisible({ timeout: 1000 })) {
          console.log(`[TreePage] Found mobile menu button with: ${selector}`);
          break;
        }
      } catch (e) {
        console.log(`[TreePage] Mobile menu selector "${selector}" not found`);
      }
    }
    
    if (mobileMenuButton) {
      await mobileMenuButton.click();
      console.log('[TreePage] Clicked mobile menu button');
      
      // Wait for mobile menu to open and sidebar to appear
      await this.page.waitForTimeout(1000);
      
      // Try to find the tree container again after opening mobile menu
      const mobileSidebarSelectors = [
        '[data-testid="mobile-sidebar"]',
        '.mobile-sidebar',
        '.sidebar',
        '[class*="sidebar"]'
      ];
      
      for (const selector of mobileSidebarSelectors) {
        try {
          const element = this.page.locator(selector);
          if (await element.isVisible({ timeout: 2000 })) {
            console.log(`[TreePage] Mobile sidebar found with: ${selector}`);
            this.treeContainer = element;
            break;
          }
        } catch (e) {
          console.log(`[TreePage] Mobile sidebar selector "${selector}" not found`);
        }
      }
    }
    
    // Try the same approaches as desktop, but with mobile-specific considerations
    try {
      // First try context menu approach
      await this.addRootFolderViaContextMenu(label);
    } catch (contextError) {
      console.log('[TreePage] Context menu approach failed on mobile, trying toolbar approach...');
      try {
        await this.addRootFolderViaToolbar(label);
      } catch (toolbarError) {
        console.log('[TreePage] Toolbar approach also failed on mobile, trying mobile-specific approach...');
        
        // Look for mobile-specific "Add" buttons
        const mobileAddSelectors = [
          'button:has-text("Add"):visible',
          '[aria-label*="Add"]:visible',
          '.mobile-add-button',
          'button[data-testid*="add"]:visible',
          'button[data-testid="add-folder"]:visible'
        ];
        
        let mobileAddButton = null;
        for (const selector of mobileAddSelectors) {
          try {
            mobileAddButton = this.page.locator(selector);
            if (await mobileAddButton.isVisible({ timeout: 1000 })) {
              console.log(`[TreePage] Found mobile add button with: ${selector}`);
              await mobileAddButton.click();
              break;
            }
          } catch (e) {
            console.log(`[TreePage] Mobile add selector "${selector}" not found`);
          }
        }
        
        if (!mobileAddButton) {
          await this.page.screenshot({ path: `debug-mobile-no-add-button-${Date.now()}.png` });
          throw new Error('Could not find any way to add folder on mobile');
        }
        
        await this._completeAddDialog(label);
      }
    }
  }

  async _completeAddDialog(label) {
    console.log(`[TreePage] Completing add dialog with label: "${label}"`);
    
    // Wait for ANY dialog/modal to appear - try multiple selectors
    const dialogSelectors = [
      '[role="dialog"]',
      '.fixed.inset-0:has(input)',
      '.modal:visible',
      'div:has-text("Add"):has(input):visible',
      '.bg-white.dark\\:bg-zinc-800:has(input)',
      '[data-testid="add-folder-dialog"]'
    ];
    
    let dialog = null;
    for (const selector of dialogSelectors) {
      try {
        dialog = this.page.locator(selector);
        await dialog.waitFor({ state: 'visible', timeout: 5000 });
        console.log(`[TreePage] Dialog found with selector: ${selector}`);
        break;
      } catch (e) {
        console.log(`[TreePage] Dialog selector "${selector}" not found`);
      }
    }
    
    if (!dialog) {
      console.log('[TreePage] No dialog found, checking if menu is still open...');
      
      // Check if context menu is still visible
      const menuStillVisible = await this.page.locator('[role="menu"], .context-menu').isVisible().catch(() => false);
      if (menuStillVisible) {
        console.log('[TreePage] Context menu is still visible - click may not have worked');
      }
      
      await this.page.screenshot({ path: `debug-no-dialog-${Date.now()}.png` });
      throw new Error('Add dialog did not appear after clicking menu item');
    }
    
    // Find input field
    const inputSelectors = [
      'input[type="text"]',
      'input[placeholder*="name"]',
      'input[placeholder*="folder"]',
      'input:visible',
      '[data-testid="folder-name-input"]'
    ];
    
    let nameInput = null;
    for (const selector of inputSelectors) {
      try {
        nameInput = dialog.locator(selector).first();
        if (await nameInput.isVisible({ timeout: 1000 })) {
          console.log(`[TreePage] Input found with: ${selector}`);
          break;
        }
      } catch (e) {
        console.log(`[TreePage] Input selector "${selector}" not found`);
      }
    }
    
    if (!nameInput) {
      await this.page.screenshot({ path: `debug-no-input-${Date.now()}.png` });
      throw new Error('Could not find input field in dialog');
    }
    
    // Clear and type the label
    await nameInput.clear();
    await nameInput.fill(label);
    console.log(`[TreePage] Filled input with: "${label}"`);
    
    // Find and click Add button
    const addButtonSelectors = [
      'button:has-text("Add")',
      'button[type="submit"]',
      '.bg-blue-600:has-text("Add")',
      'button:visible:has-text("Add")',
      '[data-testid="add-button"]'
    ];
    
    let addButton = null;
    for (const selector of addButtonSelectors) {
      try {
        addButton = dialog.locator(selector).first();
        if (await addButton.isVisible({ timeout: 1000 })) {
          console.log(`[TreePage] Add button found with: ${selector}`);
          break;
        }
      } catch (e) {
        console.log(`[TreePage] Add button selector "${selector}" not found`);
      }
    }
    
    if (!addButton) {
      await this.page.screenshot({ path: `debug-no-add-button-${Date.now()}.png` });
      throw new Error('Could not find Add button');
    }
    
    await addButton.click();
    console.log('[TreePage] Clicked Add button');
    
    // Wait for dialog to close OR success message OR folder to appear
    const waitPromises = [
      // Wait for modal overlay to disappear
      this.page.locator('.fixed.inset-0.bg-black.bg-opacity-50').waitFor({ state: 'detached', timeout: 10000 }),
      // Wait for success message
      this.page.locator('.text-green-600, .text-green-500').waitFor({ state: 'visible', timeout: 10000 }),
      // Wait for folder to appear in tree
      this.page.locator(`li:has-text("${label}")`).waitFor({ state: 'visible', timeout: 10000 })
    ];
    
    try {
      await Promise.race(waitPromises);
      console.log('[TreePage] Form submission completed successfully');
    } catch (error) {
      // Check for error messages
      const errorMessage = await this.page.locator('[role="alert"], .text-red-600, .text-red-500').textContent().catch(() => null);
      if (errorMessage) {
        console.error(`[TreePage] Error message: ${errorMessage}`);
        throw new Error(`Form submission failed: ${errorMessage}`);
      }
      
      await this.page.screenshot({ path: `debug-form-submission-failed-${Date.now()}.png` });
      throw new Error('Form submission did not complete within timeout');
    }
  }

  async waitForFolderToAppear(folderName) {
    console.log(`[TreePage] Waiting for folder to appear: "${folderName}"`);
    const folderLocator = this.page.locator(`li:has-text("${folderName}")`);
    await folderLocator.waitFor({ state: 'visible', timeout: 10000 });
    console.log(`[TreePage] Folder "${folderName}" appeared in tree`);
    return folderLocator;
  }

  async debugCurrentState() {
    console.log('=== TREE PAGE DEBUG INFO ===');
    console.log('Current URL:', this.page.url());
    console.log('Viewport size:', await this.page.viewportSize());
    
    // Check what elements are actually present
    const bodyText = await this.page.locator('body').textContent();
    console.log('Page contains text:', bodyText.substring(0, 200) + '...');
    
    // Check for common tree-related elements
    const commonSelectors = [
      '#tree-navigation-area',
      '[data-testid="tree-navigation"]',
      '.tree-navigation',
      'nav',
      'aside',
      '[role="navigation"]',
      '.sidebar',
      '[data-testid="sidebar"]'
    ];
    
    for (const selector of commonSelectors) {
      const exists = await this.page.locator(selector).count();
      console.log(`Elements matching "${selector}": ${exists}`);
    }
    
    // Take screenshot
    await this.page.screenshot({ path: `debug-tree-state-${Date.now()}.png` });
    console.log('=== END DEBUG INFO ===');
  }
}