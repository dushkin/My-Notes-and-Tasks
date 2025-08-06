import fs from 'fs';
import path from 'path';

/**
 * Custom Playwright reporter for enhanced test reporting
 */
export default class CustomReporter {
  constructor(options = {}) {
    this.options = {
      outputDir: options.outputDir || 'test-results/custom-reports',
      includeScreenshots: options.includeScreenshots !== false,
      includeVideos: options.includeVideos !== false,
      includeLogs: options.includeLogs !== false,
      generateSummary: options.generateSummary !== false,
      ...options
    };
    
    this.testResults = [];
    this.suiteResults = [];
    this.startTime = Date.now();
    this.endTime = null;
    
    // Ensure output directory exists
    if (!fs.existsSync(this.options.outputDir)) {
      fs.mkdirSync(this.options.outputDir, { recursive: true });
    }
  }

  onBegin(config, suite) {
    this.startTime = Date.now();
    console.log(`🚀 Starting test suite with ${suite.allTests().length} tests`);
    console.log(`📊 Running on ${config.projects.length} project(s): ${config.projects.map(p => p.name).join(', ')}`);
    
    this.suiteConfig = {
      totalTests: suite.allTests().length,
      projects: config.projects.map(p => ({
        name: p.name,
        testDir: p.testDir,
        timeout: p.timeout
      })),
      workers: config.workers,
      reporter: config.reporter
    };
  }

  onTestBegin(test, result) {
    const testInfo = {
      id: this.generateTestId(test),
      title: test.title,
      file: test.location.file,
      line: test.location.line,
      project: test.parent.project()?.name || 'default',
      startTime: Date.now(),
      retry: result.retry
    };
    
    this.testResults.push({
      ...testInfo,
      status: 'running',
      duration: null,
      errors: [],
      attachments: [],
      endTime: null
    });
    
    if (this.options.verbose) {
      console.log(`▶️  Starting: ${test.title} (${testInfo.project})`);
    }
  }

  onTestEnd(test, result) {
    const testId = this.generateTestId(test);
    const testResult = this.testResults.find(r => r.id === testId);
    
    if (testResult) {
      testResult.status = result.status;
      testResult.duration = result.duration;
      testResult.endTime = Date.now();
      testResult.errors = result.errors.map(error => ({
        message: error.message,
        stack: error.stack,
        location: error.location
      }));
      
      // Collect attachments
      testResult.attachments = result.attachments.map(attachment => ({
        name: attachment.name,
        contentType: attachment.contentType,
        path: attachment.path,
        body: attachment.body ? attachment.body.toString('base64') : null
      }));
      
      // Log result
      const statusIcon = this.getStatusIcon(result.status);
      const durationMs = result.duration || 0;
      
      console.log(
        `${statusIcon} ${test.title} (${durationMs}ms) - ${testResult.project}${
          result.retry > 0 ? ` (retry ${result.retry})` : ''
        }`
      );
      
      if (result.status === 'failed' && result.errors.length > 0) {
        console.log(`   💥 ${result.errors[0].message}`);
      }
    }
  }

  onStepBegin(test, result, step) {
    if (this.options.includeSteps) {
      console.log(`    🔹 ${step.title}`);
    }
  }

  onStepEnd(test, result, step) {
    if (this.options.includeSteps && step.error) {
      console.log(`    ❌ ${step.title} - ${step.error.message}`);
    }
  }

  onError(error) {
    console.error('🚨 Global error:', error.message);
    this.globalErrors = this.globalErrors || [];
    this.globalErrors.push({
      message: error.message,
      stack: error.stack,
      timestamp: Date.now()
    });
  }

  async onEnd(result) {
    this.endTime = Date.now();
    const duration = this.endTime - this.startTime;
    
    console.log('\n📊 Test Run Summary:');
    console.log(`   Duration: ${this.formatDuration(duration)}`);
    console.log(`   Total: ${this.testResults.length}`);
    console.log(`   ✅ Passed: ${this.testResults.filter(t => t.status === 'passed').length}`);
    console.log(`   ❌ Failed: ${this.testResults.filter(t => t.status === 'failed').length}`);
    console.log(`   ⏭️  Skipped: ${this.testResults.filter(t => t.status === 'skipped').length}`);
    console.log(`   ⏸️  Timedout: ${this.testResults.filter(t => t.status === 'timedout').length}`);
    
    // Generate reports
    await this.generateReports(result);
    
    console.log(`\n📁 Reports generated in: ${this.options.outputDir}`);
  }

  async generateReports(result) {
    const reportData = {
      summary: this.generateSummary(result),
      config: this.suiteConfig,
      tests: this.testResults,
      errors: this.globalErrors || [],
      timestamp: new Date().toISOString(),
      duration: this.endTime - this.startTime
    };

    // Generate JSON report
    await this.generateJsonReport(reportData);
    
    // Generate HTML report if requested
    if (this.options.generateHtml) {
      await this.generateHtmlReport(reportData);
    }
    
    // Generate CSV report if requested
    if (this.options.generateCsv) {
      await this.generateCsvReport(reportData);
    }
    
    // Generate test summary
    if (this.options.generateSummary) {
      await this.generateSummaryReport(reportData);
    }
  }

  generateSummary(result) {
    const tests = this.testResults;
    const passed = tests.filter(t => t.status === 'passed').length;
    const failed = tests.filter(t => t.status === 'failed').length;
    const skipped = tests.filter(t => t.status === 'skipped').length;
    const timedout = tests.filter(t => t.status === 'timedout').length;
    
    const averageDuration = tests.length > 0 
      ? tests.reduce((sum, t) => sum + (t.duration || 0), 0) / tests.length 
      : 0;
    
    const slowestTest = tests.reduce((slowest, test) => 
      (test.duration || 0) > (slowest?.duration || 0) ? test : slowest, null);
    
    const fastestTest = tests.reduce((fastest, test) => 
      (test.duration || 0) < (fastest?.duration || Infinity) ? test : fastest, null);

    return {
      total: tests.length,
      passed,
      failed,
      skipped,
      timedout,
      passRate: tests.length > 0 ? (passed / tests.length * 100).toFixed(2) : 0,
      duration: this.endTime - this.startTime,
      averageDuration: Math.round(averageDuration),
      slowestTest: slowestTest ? {
        title: slowestTest.title,
        duration: slowestTest.duration,
        file: slowestTest.file
      } : null,
      fastestTest: fastestTest ? {
        title: fastestTest.title,
        duration: fastestTest.duration,
        file: fastestTest.file
      } : null,
      projectBreakdown: this.getProjectBreakdown(),
      failureReasons: this.getFailureReasons()
    };
  }

  getProjectBreakdown() {
    const breakdown = {};
    
    this.testResults.forEach(test => {
      if (!breakdown[test.project]) {
        breakdown[test.project] = { total: 0, passed: 0, failed: 0, skipped: 0, timedout: 0 };
      }
      
      breakdown[test.project].total++;
      breakdown[test.project][test.status]++;
    });
    
    return breakdown;
  }

  getFailureReasons() {
    const reasons = {};
    
    this.testResults
      .filter(test => test.status === 'failed')
      .forEach(test => {
        test.errors.forEach(error => {
          const reason = this.categorizeError(error.message);
          reasons[reason] = (reasons[reason] || 0) + 1;
        });
      });
    
    return reasons;
  }

  categorizeError(message) {
    if (message.includes('Timeout')) return 'Timeout';
    if (message.includes('expect')) return 'Assertion Failed';
    if (message.includes('locator')) return 'Element Not Found';
    if (message.includes('network')) return 'Network Error';
    if (message.includes('navigation')) return 'Navigation Error';
    return 'Other';
  }

  async generateJsonReport(reportData) {
    const filePath = path.join(this.options.outputDir, 'custom-report.json');
    fs.writeFileSync(filePath, JSON.stringify(reportData, null, 2));
  }

  async generateHtmlReport(reportData) {
    const html = this.generateHtmlContent(reportData);
    const filePath = path.join(this.options.outputDir, 'custom-report.html');
    fs.writeFileSync(filePath, html);
  }

  generateHtmlContent(reportData) {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Test Report - ${reportData.timestamp}</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; margin: 0; padding: 20px; background: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; background: white; border-radius: 8px; padding: 20px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .header { border-bottom: 1px solid #eee; padding-bottom: 20px; margin-bottom: 20px; }
        .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-bottom: 30px; }
        .stat-card { background: #f8f9fa; padding: 15px; border-radius: 6px; text-align: center; }
        .stat-number { font-size: 2em; font-weight: bold; margin-bottom: 5px; }
        .stat-label { color: #666; font-size: 0.9em; }
        .passed { color: #28a745; }
        .failed { color: #dc3545; }
        .skipped { color: #ffc107; }
        .test-list { margin-top: 20px; }
        .test-item { padding: 10px; border-left: 4px solid #ddd; margin-bottom: 10px; background: #f9f9f9; }
        .test-item.passed { border-left-color: #28a745; }
        .test-item.failed { border-left-color: #dc3545; }
        .test-item.skipped { border-left-color: #ffc107; }
        .test-title { font-weight: bold; margin-bottom: 5px; }
        .test-meta { font-size: 0.9em; color: #666; }
        .error-message { background: #fff5f5; border: 1px solid #fed7d7; padding: 10px; margin-top: 10px; border-radius: 4px; font-family: monospace; font-size: 0.9em; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Test Report</h1>
            <p>Generated: ${reportData.timestamp}</p>
            <p>Duration: ${this.formatDuration(reportData.duration)}</p>
        </div>
        
        <div class="summary">
            <div class="stat-card">
                <div class="stat-number">${reportData.summary.total}</div>
                <div class="stat-label">Total Tests</div>
            </div>
            <div class="stat-card">
                <div class="stat-number passed">${reportData.summary.passed}</div>
                <div class="stat-label">Passed</div>
            </div>
            <div class="stat-card">
                <div class="stat-number failed">${reportData.summary.failed}</div>
                <div class="stat-label">Failed</div>
            </div>
            <div class="stat-card">
                <div class="stat-number skipped">${reportData.summary.skipped}</div>
                <div class="stat-label">Skipped</div>
            </div>
            <div class="stat-card">
                <div class="stat-number">${reportData.summary.passRate}%</div>
                <div class="stat-label">Pass Rate</div>
            </div>
        </div>
        
        <div class="test-list">
            <h2>Test Results</h2>
            ${reportData.tests.map(test => `
                <div class="test-item ${test.status}">
                    <div class="test-title">${test.title}</div>
                    <div class="test-meta">
                        ${test.file} • ${test.project} • ${this.formatDuration(test.duration || 0)}
                        ${test.retry > 0 ? ` • Retry ${test.retry}` : ''}
                    </div>
                    ${test.errors.length > 0 ? `
                        <div class="error-message">
                            ${test.errors.map(error => error.message).join('<br>')}
                        </div>
                    ` : ''}
                </div>
            `).join('')}
        </div>
    </div>
</body>
</html>`;
  }

  async generateCsvReport(reportData) {
    const headers = ['Title', 'Status', 'Duration', 'Project', 'File', 'Retry', 'Error'];
    const rows = reportData.tests.map(test => [
      test.title,
      test.status,
      test.duration || 0,
      test.project,
      test.file,
      test.retry,
      test.errors.length > 0 ? test.errors[0].message : ''
    ]);
    
    const csv = [headers, ...rows].map(row => 
      row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')
    ).join('\n');
    
    const filePath = path.join(this.options.outputDir, 'test-results.csv');
    fs.writeFileSync(filePath, csv);
  }

  async generateSummaryReport(reportData) {
    const summary = `
TEST RUN SUMMARY
================

Execution Time: ${reportData.timestamp}
Total Duration: ${this.formatDuration(reportData.duration)}

RESULTS:
- Total Tests: ${reportData.summary.total}
- Passed: ${reportData.summary.passed} (${reportData.summary.passRate}%)
- Failed: ${reportData.summary.failed}
- Skipped: ${reportData.summary.skipped}
- Timed Out: ${reportData.summary.timedout}

PERFORMANCE:
- Average Test Duration: ${this.formatDuration(reportData.summary.averageDuration)}
- Slowest Test: ${reportData.summary.slowestTest?.title || 'N/A'} (${this.formatDuration(reportData.summary.slowestTest?.duration || 0)})
- Fastest Test: ${reportData.summary.fastestTest?.title || 'N/A'} (${this.formatDuration(reportData.summary.fastestTest?.duration || 0)})

PROJECT BREAKDOWN:
${Object.entries(reportData.summary.projectBreakdown).map(([project, stats]) => 
  `- ${project}: ${stats.passed}/${stats.total} passed (${((stats.passed / stats.total) * 100).toFixed(1)}%)`
).join('\n')}

${reportData.summary.failed > 0 ? `
FAILURE REASONS:
${Object.entries(reportData.summary.failureReasons).map(([reason, count]) => 
  `- ${reason}: ${count}`
).join('\n')}
` : ''}

${reportData.errors.length > 0 ? `
GLOBAL ERRORS:
${reportData.errors.map(error => `- ${error.message}`).join('\n')}
` : ''}
`;
    
    const filePath = path.join(this.options.outputDir, 'summary.txt');
    fs.writeFileSync(filePath, summary);
  }

  generateTestId(test) {
    return `${test.location.file}:${test.location.line}:${test.title}`;
  }

  getStatusIcon(status) {
    const icons = {
      passed: '✅',
      failed: '❌',
      skipped: '⏭️',
      timedout: '⏰',
      interrupted: '🛑'
    };
    return icons[status] || '❓';
  }

  formatDuration(ms) {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;
  }
}