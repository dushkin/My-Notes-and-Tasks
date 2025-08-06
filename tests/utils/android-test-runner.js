#!/usr/bin/env node

/**
 * Android Test Runner
 * Comprehensive test runner for Android-specific testing
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

class AndroidTestRunner {
  constructor() {
    this.testResults = {
      android: { passed: 0, failed: 0, skipped: 0 },
      capacitor: { passed: 0, failed: 0, skipped: 0 },
      visual: { passed: 0, failed: 0, skipped: 0 },
      performance: { passed: 0, failed: 0, skipped: 0 },
      accessibility: { passed: 0, failed: 0, skipped: 0 }
    };
  }

  async runAndroidTests() {
    console.log('🤖 Starting Android App Test Suite...\n');

    const testSuites = [
      {
        name: 'Android Core Features',
        command: 'npm run test:e2e:android',
        category: 'android'
      },
      {
        name: 'Capacitor Integration',
        command: 'npm run test:e2e:capacitor',
        category: 'capacitor'
      },
      {
        name: 'Visual Regression (Android)',
        command: 'npx playwright test tests/e2e/capacitor-visual.spec.js --project=android-webview',
        category: 'visual'
      },
      {
        name: 'Performance Tests',
        command: 'npx playwright test tests/e2e/capacitor-performance.spec.js --project=android-webview',
        category: 'performance'
      },
      {
        name: 'Android Accessibility',
        command: 'npx playwright test tests/a11y/android-accessibility.spec.js --project=android-webview',
        category: 'accessibility'
      }
    ];

    for (const suite of testSuites) {
      await this.runTestSuite(suite);
    }

    this.generateReport();
  }

  async runTestSuite(suite) {
    console.log(`\n📱 Running: ${suite.name}`);
    console.log(`Command: ${suite.command}\n`);

    try {
      const output = execSync(suite.command, { 
        encoding: 'utf8',
        stdio: 'pipe'
      });
      
      console.log(output);
      
      // Parse results (simplified - adjust based on your output format)
      const passed = (output.match(/✓/g) || []).length;
      const failed = (output.match(/✗|×/g) || []).length;
      const skipped = (output.match(/○|-/g) || []).length;
      
      this.testResults[suite.category] = { passed, failed, skipped };
      
      console.log(`✅ ${suite.name} completed successfully`);
      
    } catch (error) {
      console.error(`❌ ${suite.name} failed:`);
      console.error(error.stdout || error.message);
      
      this.testResults[suite.category].failed += 1;
    }
  }

  generateReport() {
    console.log('\n' + '='.repeat(60));
    console.log('📊 ANDROID TEST RESULTS SUMMARY');
    console.log('='.repeat(60));

    let totalPassed = 0;
    let totalFailed = 0;
    let totalSkipped = 0;

    Object.entries(this.testResults).forEach(([category, results]) => {
      console.log(`\n${this.getCategoryIcon(category)} ${category.toUpperCase()}`);
      console.log(`  ✅ Passed: ${results.passed}`);
      console.log(`  ❌ Failed: ${results.failed}`);
      console.log(`  ⏭️  Skipped: ${results.skipped}`);

      totalPassed += results.passed;
      totalFailed += results.failed;
      totalSkipped += results.skipped;
    });

    console.log('\n' + '-'.repeat(40));
    console.log(`📈 TOTALS:`);
    console.log(`  ✅ Total Passed: ${totalPassed}`);
    console.log(`  ❌ Total Failed: ${totalFailed}`);
    console.log(`  ⏭️  Total Skipped: ${totalSkipped}`);

    const successRate = totalPassed / (totalPassed + totalFailed) * 100;
    console.log(`  📊 Success Rate: ${successRate.toFixed(1)}%`);

    console.log('\n' + '='.repeat(60));

    if (totalFailed === 0) {
      console.log('🎉 All Android tests passed! Your app is ready for mobile deployment.');
    } else {
      console.log('⚠️  Some tests failed. Please review the failures before deploying to Android.');
      process.exit(1);
    }

    this.generateJSONReport(totalPassed, totalFailed, totalSkipped);
  }

  getCategoryIcon(category) {
    const icons = {
      android: '🤖',
      capacitor: '⚡',
      visual: '📸',
      performance: '⚡',
      accessibility: '♿'
    };
    return icons[category] || '📱';
  }

  generateJSONReport(totalPassed, totalFailed, totalSkipped) {
    const report = {
      timestamp: new Date().toISOString(),
      summary: {
        total: totalPassed + totalFailed + totalSkipped,
        passed: totalPassed,
        failed: totalFailed,
        skipped: totalSkipped,
        successRate: totalPassed / (totalPassed + totalFailed) * 100
      },
      categories: this.testResults,
      recommendations: this.generateRecommendations()
    };

    const reportPath = path.join(process.cwd(), 'test-results', 'android-test-report.json');
    
    // Ensure directory exists
    const dir = path.dirname(reportPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`\n📄 Detailed report saved to: ${reportPath}`);
  }

  generateRecommendations() {
    const recommendations = [];

    if (this.testResults.performance.failed > 0) {
      recommendations.push('Consider optimizing app performance for mobile devices');
    }

    if (this.testResults.accessibility.failed > 0) {
      recommendations.push('Review accessibility issues to ensure app is usable by all users');
    }

    if (this.testResults.visual.failed > 0) {
      recommendations.push('Check visual regression failures - UI may have changed');
    }

    if (this.testResults.android.failed > 0) {
      recommendations.push('Review Android-specific functionality failures');
    }

    if (recommendations.length === 0) {
      recommendations.push('All tests passed! Consider adding more edge case tests.');
    }

    return recommendations;
  }

  static async run() {
    const runner = new AndroidTestRunner();
    await runner.runAndroidTests();
  }
}

// CLI usage
if (process.argv[2] === 'run') {
  AndroidTestRunner.run().catch(error => {
    console.error('❌ Test runner failed:', error);
    process.exit(1);
  });
}

export default AndroidTestRunner;