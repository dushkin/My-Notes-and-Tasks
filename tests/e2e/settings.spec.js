import { test, expect } from './fixtures/base.js';

test.describe('Settings', () => {
  test('should open settings dialog', async ({ authenticatedPage }) => {
    await authenticatedPage.click('[title="Settings"]');
    
    await expect(authenticatedPage.locator('h2')).toContainText('Settings');
    await expect(authenticatedPage.locator('[data-item-id="settings-search-input"]')).toBeVisible();
  });

  test('should search settings', async ({ authenticatedPage }) => {
    await authenticatedPage.click('[title="Settings"]');
    
    await authenticatedPage.fill('[data-item-id="settings-search-input"]', 'theme');
    
    await expect(authenticatedPage.locator('text=Theme')).toBeVisible();
    await expect(authenticatedPage.locator('text=Auto-Expand')).not.toBeVisible();
  });

  test('should change theme setting', async ({ authenticatedPage }) => {
    await authenticatedPage.click('[title="Settings"]');
    
    // Change theme to dark
    await authenticatedPage.selectOption('[data-item-id="setting-theme-select"]', 'dark');
    
    // Close settings
    await authenticatedPage.click('[data-item-id="settings-close-button-footer"]');
    
    // Should apply dark theme
    await expect(authenticatedPage.locator('html.dark')).toBeVisible();
  });

  test('should toggle auto-expand setting', async ({ authenticatedPage }) => {
    await authenticatedPage.click('[title="Settings"]');
    
    const checkbox = authenticatedPage.locator('[data-item-id="setting-autoexpand-checkbox"]');
    const initialState = await checkbox.isChecked();
    
    await checkbox.click();
    
    // Should toggle the setting
    await expect(checkbox).toBeChecked({ checked: !initialState });
  });

  test('should configure editor font settings', async ({ authenticatedPage }) => {
    await authenticatedPage.click('[title="Settings"]');
    
    // Change font family
    await authenticatedPage.selectOption('[data-item-id="setting-fontfamily-select"]', 'Georgia');
    
    // Change font size
    await authenticatedPage.selectOption('[data-item-id="setting-fontsize-select"]', '4');
    
    await authenticatedPage.click('[data-item-id="settings-close-button-footer"]');
    
    // Settings should be applied (would need to verify in editor)
  });

  test('should configure export format', async ({ authenticatedPage }) => {
    await authenticatedPage.click('[title="Settings"]');
    
    // Change default export format to PDF
    await authenticatedPage.click('[data-item-id="setting-exportformat-pdf"]');
    
    await authenticatedPage.click('[data-item-id="settings-close-button-footer"]');
    
    // Verify setting is saved by reopening
    await authenticatedPage.click('[title="Settings"]');
    await expect(authenticatedPage.locator('[data-item-id="setting-exportformat-pdf"]')).toBeChecked();
  });

  test('should reset settings', async ({ authenticatedPage }) => {
    await authenticatedPage.click('[title="Settings"]');
    
    // Change a setting first
    await authenticatedPage.selectOption('[data-item-id="setting-theme-select"]', 'dark');
    
    // Reset settings
    authenticatedPage.on('dialog', dialog => {
      expect(dialog.message()).toContain('Reset all settings');
      dialog.accept();
    });
    
    await authenticatedPage.click('[data-item-id="setting-resetsettings-button"]');
    
    // Should reset to default (system theme)
    await expect(authenticatedPage.locator('[data-item-id="setting-theme-select"]')).toHaveValue('system');
  });

  test('should configure auto-export', async ({ authenticatedPage }) => {
    await authenticatedPage.click('[title="Settings"]');
    
    // Enable auto-export
    await authenticatedPage.click('[data-item-id="setting-autoexportenabled-checkbox"]');
    
    // Set interval
    await authenticatedPage.fill('[data-item-id="setting-autoexportinterval-input"]', '15');
    
    await authenticatedPage.click('[data-item-id="settings-close-button-footer"]');
    
    // Should show auto-export notification
    await expect(authenticatedPage.locator('text=Auto-export active')).toBeVisible();
  });
});
