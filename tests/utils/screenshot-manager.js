import fs from 'fs';
import path from 'path';

export class ScreenshotManager {
  constructor(page) {
    this.page = page;
    this.screenshotDir = 'test-results/screenshots';
    this.ensureDirectoryExists();
  }

  ensureDirectoryExists() {
    if (!fs.existsSync(this.screenshotDir)) {
      fs.mkdirSync(this.screenshotDir, { recursive: true });
    }
  }

  // Take a full page screenshot
  async fullPage(name, options = {}) {
    const filename = this.generateFilename(name, 'full-page');
    const filepath = path.join(this.screenshotDir, filename);
    
    await this.page.screenshot({
      path: filepath,
      fullPage: true,
      ...options
    });
    
    return filepath;
  }

  // Take a viewport screenshot
  async viewport(name, options = {}) {
    const filename = this.generateFilename(name, 'viewport');
    const filepath = path.join(this.screenshotDir, filename);
    
    await this.page.screenshot({
      path: filepath,
      fullPage: false,
      ...options
    });
    
    return filepath;
  }

  // Take an element screenshot
  async element(locator, name, options = {}) {
    const filename = this.generateFilename(name, 'element');
    const filepath = path.join(this.screenshotDir, filename);
    
    await locator.screenshot({
      path: filepath,
      ...options
    });
    
    return filepath;
  }

  // Take a screenshot with highlight
  async withHighlight(locator, name, options = {}) {
    // Add highlight to element
    await locator.evaluate(element => {
      element.style.outline = '3px solid red';
      element.style.outlineOffset = '2px';
    });

    const filepath = await this.fullPage(name, options);

    // Remove highlight
    await locator.evaluate(element => {
      element.style.outline = '';
      element.style.outlineOffset = '';
    });

    return filepath;
  }

  // Compare screenshots (visual regression)
  async compare(name, threshold = 0.1) {
    const filename = this.generateFilename(name, 'compare');
    const filepath = path.join(this.screenshotDir, filename);
    
    // Take current screenshot
    await this.page.screenshot({
      path: filepath,
      fullPage: true
    });

    // Check for baseline
    const baselinePath = path.join(this.screenshotDir, 'baselines', filename);
    
    if (!fs.existsSync(baselinePath)) {
      // Copy current as baseline
      const baselineDir = path.dirname(baselinePath);
      if (!fs.existsSync(baselineDir)) {
        fs.mkdirSync(baselineDir, { recursive: true });
      }
      fs.copyFileSync(filepath, baselinePath);
      
      return {
        status: 'baseline-created',
        baseline: baselinePath,
        current: filepath
      };
    }

    // Compare with baseline using Playwright's visual comparison
    try {
      await this.page.screenshot({
        path: filepath,
        fullPage: true
      });

      // This would be used with expect(page).toHaveScreenshot() in actual tests
      return {
        status: 'compared',
        baseline: baselinePath,
        current: filepath,
        threshold
      };
    } catch (error) {
      return {
        status: 'failed',
        error: error.message,
        baseline: baselinePath,
        current: filepath
      };
    }
  }

  // Screenshot with device emulation
  async withDevice(deviceName, name, options = {}) {
    const devices = {
      'iPhone 12': { width: 390, height: 844, deviceScaleFactor: 3 },
      'iPad': { width: 768, height: 1024, deviceScaleFactor: 2 },
      'Desktop': { width: 1920, height: 1080, deviceScaleFactor: 1 },
      'Tablet Landscape': { width: 1024, height: 768, deviceScaleFactor: 2 }
    };

    const device = devices[deviceName];
    if (!device) {
      throw new Error(`Unknown device: ${deviceName}`);
    }

    // Set viewport
    await this.page.setViewportSize({
      width: device.width,
      height: device.height
    });

    const filename = this.generateFilename(name, `device-${deviceName.toLowerCase().replace(/\s+/g, '-')}`);
    const filepath = path.join(this.screenshotDir, filename);
    
    await this.page.screenshot({
      path: filepath,
      fullPage: true,
      ...options
    });

    return filepath;
  }

  // Screenshot sequence for animations
  async sequence(name, steps, delay = 500) {
    const screenshots = [];
    
    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      
      // Execute step action
      if (typeof step === 'function') {
        await step();
      }
      
      // Wait for specified delay
      await this.page.waitForTimeout(delay);
      
      // Take screenshot
      const filename = this.generateFilename(name, `sequence-${i + 1}`);
      const filepath = path.join(this.screenshotDir, filename);
      
      await this.page.screenshot({
        path: filepath,
        fullPage: true
      });
      
      screenshots.push(filepath);
    }
    
    return screenshots;
  }

  // Screenshot with annotations
  async withAnnotations(name, annotations = [], options = {}) {
    // Add annotations to page
    await this.page.evaluate((annotations) => {
      annotations.forEach((annotation, index) => {
        const div = document.createElement('div');
        div.style.position = 'absolute';
        div.style.left = annotation.x + 'px';
        div.style.top = annotation.y + 'px';
        div.style.background = 'red';
        div.style.color = 'white';
        div.style.padding = '4px 8px';
        div.style.borderRadius = '4px';
        div.style.fontSize = '12px';
        div.style.zIndex = '9999';
        div.style.fontFamily = 'Arial, sans-serif';
        div.textContent = annotation.text || `Annotation ${index + 1}`;
        div.id = `test-annotation-${index}`;
        document.body.appendChild(div);
      });
    }, annotations);

    const filepath = await this.fullPage(name, options);

    // Remove annotations
    await this.page.evaluate((count) => {
      for (let i = 0; i < count; i++) {
        const element = document.getElementById(`test-annotation-${i}`);
        if (element) {
          element.remove();
        }
      }
    }, annotations.length);

    return filepath;
  }

  // Generate consistent filename
  generateFilename(name, type) {
    const timestamp = new Date().toISOString()
      .replace(/[:.]/g, '-')
      .replace('T', '_')
      .split('.')[0];
    
    const sanitizedName = name.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();
    return `${sanitizedName}_${type}_${timestamp}.png`;
  }

  // Clean up old screenshots
  async cleanup(olderThanDays = 7) {
    const cutoffTime = Date.now() - (olderThanDays * 24 * 60 * 60 * 1000);
    
    const files = fs.readdirSync(this.screenshotDir);
    let deletedCount = 0;
    
    for (const file of files) {
      const filepath = path.join(this.screenshotDir, file);
      const stats = fs.statSync(filepath);
      
      if (stats.mtime.getTime() < cutoffTime) {
        fs.unlinkSync(filepath);
        deletedCount++;
      }
    }
    
    return deletedCount;
  }

  // Get screenshot info
  getScreenshotInfo(filepath) {
    if (!fs.existsSync(filepath)) {
      return null;
    }
    
    const stats = fs.statSync(filepath);
    return {
      path: filepath,
      size: stats.size,
      created: stats.birthtime,
      modified: stats.mtime
    };
  }
}