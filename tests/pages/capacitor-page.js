/**
 * Capacitor-specific page object model
 * Handles Android/iOS specific interactions and behaviors
 */
export class CapacitorPage {
  constructor(page) {
    this.page = page;
  }

  /**
   * Simulate Android back button press
   */
  async pressAndroidBackButton() {
    await this.page.keyboard.press('Escape');
  }

  /**
   * Simulate app going to background
   */
  async pauseApp() {
    await this.page.evaluate(() => {
      document.dispatchEvent(new Event('pause'));
    });
  }

  /**
   * Simulate app coming to foreground
   */
  async resumeApp() {
    await this.page.evaluate(() => {
      document.dispatchEvent(new Event('resume'));
    });
  }

  /**
   * Toggle network connectivity
   */
  async setOffline(offline = true) {
    await this.page.context().setOffline(offline);
    
    // Dispatch network events
    const event = offline ? 'offline' : 'online';
    await this.page.evaluate((eventName) => {
      window.dispatchEvent(new Event(eventName));
    }, event);
  }

  /**
   * Simulate screen orientation change
   */
  async rotateToLandscape() {
    const viewport = this.page.viewportSize();
    await this.page.setViewportSize({ 
      width: Math.max(viewport.width, viewport.height), 
      height: Math.min(viewport.width, viewport.height) 
    });
  }

  async rotateToPortrait() {
    const viewport = this.page.viewportSize();
    await this.page.setViewportSize({ 
      width: Math.min(viewport.width, viewport.height), 
      height: Math.max(viewport.width, viewport.height) 
    });
  }

  /**
   * Simulate virtual keyboard showing (reduces viewport height)
   */
  async showVirtualKeyboard() {
    const viewport = this.page.viewportSize();
    await this.page.setViewportSize({
      width: viewport.width,
      height: Math.floor(viewport.height * 0.6) // Reduce height by ~40%
    });
  }

  /**
   * Hide virtual keyboard (restore full viewport)
   */
  async hideVirtualKeyboard() {
    // Get the original device viewport if available
    const currentViewport = this.page.viewportSize();
    await this.page.setViewportSize({
      width: currentViewport.width,
      height: currentViewport.width > 400 ? 851 : 745 // Restore based on device
    });
  }

  /**
   * Check if running in Capacitor environment
   */
  async isCapacitorEnvironment() {
    return await this.page.evaluate(() => {
      return !!(window.Capacitor && window.Capacitor.isNativePlatform?.());
    });
  }

  /**
   * Get Capacitor platform info
   */
  async getCapacitorPlatform() {
    return await this.page.evaluate(() => {
      if (window.Capacitor) {
        return {
          platform: window.Capacitor.getPlatform?.(),
          isNative: window.Capacitor.isNativePlatform?.(),
          plugins: Object.keys(window.Capacitor.Plugins || {})
        };
      }
      return null;
    });
  }

  /**
   * Simulate swipe gesture
   */
  async swipeLeft(element, distance = 100) {
    const box = await element.boundingBox();
    if (box) {
      await this.page.mouse.move(box.x + box.width - 10, box.y + box.height / 2);
      await this.page.mouse.down();
      await this.page.mouse.move(box.x + 10, box.y + box.height / 2);
      await this.page.mouse.up();
    }
  }

  async swipeRight(element, distance = 100) {
    const box = await element.boundingBox();
    if (box) {
      await this.page.mouse.move(box.x + 10, box.y + box.height / 2);
      await this.page.mouse.down();
      await this.page.mouse.move(box.x + box.width - 10, box.y + box.height / 2);
      await this.page.mouse.up();
    }
  }

  /**
   * Check touch target accessibility (minimum 44px)
   */
  async validateTouchTargets(selector) {
    const elements = this.page.locator(selector);
    const count = await elements.count();
    const issues = [];

    for (let i = 0; i < count; i++) {
      const element = elements.nth(i);
      if (await element.isVisible()) {
        const box = await element.boundingBox();
        if (box && (box.width < 44 || box.height < 44)) {
          const text = await element.textContent();
          issues.push({
            element: text || `Element ${i}`,
            width: box.width,
            height: box.height
          });
        }
      }
    }

    return issues;
  }

  /**
   * Simulate memory pressure
   */
  async simulateMemoryPressure() {
    await this.page.evaluate(() => {
      // Dispatch low memory warning
      if (window.Capacitor?.Plugins?.App) {
        document.dispatchEvent(new CustomEvent('appMemoryWarning'));
      }
    });
  }

  /**
   * Test app recovery from crash simulation
   */
  async simulateAppRestart() {
    // Save current URL
    const currentUrl = this.page.url();
    
    // Simulate app restart by reloading
    await this.page.reload();
    
    // Navigate back to where we were
    if (currentUrl !== this.page.url()) {
      await this.page.goto(currentUrl);
    }
  }

  /**
   * Check if app handles status bar properly
   */
  async checkStatusBarHandling() {
    return await this.page.evaluate(() => {
      // Check if status bar plugins are available
      return !!(window.Capacitor?.Plugins?.StatusBar);
    });
  }

  /**
   * Simulate device-specific behaviors
   */
  async simulateAndroidBehaviors() {
    // Test Android-specific gestures and behaviors
    await this.pressAndroidBackButton();
    await this.page.waitForTimeout(100);
    
    // Test app lifecycle
    await this.pauseApp();
    await this.page.waitForTimeout(100);
    await this.resumeApp();
  }

  /**
   * Wait for Capacitor to be ready
   */
  async waitForCapacitorReady() {
    await this.page.waitForFunction(() => {
      return window.Capacitor !== undefined;
    }, { timeout: 5000 });
  }
}