/**
 * Slack reporter for Playwright test results
 * Sends test results to a Slack channel via webhook
 */
export default class SlackReporter {
  constructor(options = {}) {
    this.options = {
      webhookUrl: options.webhookUrl || process.env.SLACK_WEBHOOK_URL,
      channel: options.channel || '#test-results',
      username: options.username || 'Playwright Bot',
      icon: options.icon || ':robot_face:',
      onlyOnFailure: options.onlyOnFailure || false,
      includePassedTests: options.includePassedTests || false,
      maxFailedTests: options.maxFailedTests || 10,
      ...options
    };
    
    this.testResults = [];
    this.startTime = Date.now();
  }

  onBegin(config, suite) {
    this.startTime = Date.now();
    this.totalTests = suite.allTests().length;
    this.config = config;
  }

  onTestEnd(test, result) {
    this.testResults.push({
      title: test.title,
      status: result.status,
      duration: result.duration,
      file: test.location.file,
      project: test.parent.project()?.name || 'default',
      retry: result.retry,
      errors: result.errors.map(error => ({
        message: error.message,
        stack: error.stack
      }))
    });
  }

  async onEnd(result) {
    if (!this.options.webhookUrl) {
      console.warn('⚠️  Slack webhook URL not configured, skipping Slack notification');
      return;
    }

    const summary = this.generateSummary();
    
    // Skip notification if only failures are requested and there are no failures
    if (this.options.onlyOnFailure && summary.failed === 0) {
      return;
    }

    try {
      await this.sendSlackMessage(summary);
      console.log('✅ Slack notification sent successfully');
    } catch (error) {
      console.error('❌ Failed to send Slack notification:', error.message);
    }
  }

  generateSummary() {
    const passed = this.testResults.filter(t => t.status === 'passed').length;
    const failed = this.testResults.filter(t => t.status === 'failed').length;
    const skipped = this.testResults.filter(t => t.status === 'skipped').length;
    const timedout = this.testResults.filter(t => t.status === 'timedout').length;
    
    const duration = Date.now() - this.startTime;
    const passRate = this.totalTests > 0 ? ((passed / this.totalTests) * 100).toFixed(1) : 0;

    return {
      total: this.totalTests,
      passed,
      failed,
      skipped,
      timedout,
      duration,
      passRate,
      failedTests: this.testResults
        .filter(t => t.status === 'failed')
        .slice(0, this.options.maxFailedTests)
    };
  }

  async sendSlackMessage(summary) {
    const color = summary.failed > 0 ? 'danger' : 'good';
    const status = summary.failed > 0 ? 'FAILED' : 'PASSED';
    
    const message = {
      channel: this.options.channel,
      username: this.options.username,
      icon_emoji: this.options.icon,
      attachments: [
        {
          color: color,
          title: `🎭 Playwright Test Results - ${status}`,
          fields: [
            {
              title: 'Summary',
              value: this.formatSummary(summary),
              short: true
            },
            {
              title: 'Duration',
              value: this.formatDuration(summary.duration),
              short: true
            }
          ],
          footer: 'Playwright Test Runner',
          ts: Math.floor(Date.now() / 1000)
        }
      ]
    };

    // Add failed tests details if any
    if (summary.failed > 0) {
      const failedTestsText = summary.failedTests
        .map(test => `• \`${test.title}\` (${test.project})${test.retry > 0 ? ` [Retry ${test.retry}]` : ''}`)
        .join('\n');

      message.attachments.push({
        color: 'danger',
        title: `❌ Failed Tests (${summary.failed})`,
        text: failedTestsText,
        mrkdwn_in: ['text']
      });

      // Add error details for first few failed tests
      const testsWithErrors = summary.failedTests
        .filter(test => test.errors.length > 0)
        .slice(0, 3);

      if (testsWithErrors.length > 0) {
        message.attachments.push({
          color: 'danger',
          title: '🔍 Error Details',
          fields: testsWithErrors.map(test => ({
            title: test.title,
            value: `\`\`\`${test.errors[0].message}\`\`\``,
            short: false
          }))
        });
      }
    }

    // Add passed tests if requested
    if (this.options.includePassedTests && summary.passed > 0) {
      const passedTests = this.testResults
        .filter(t => t.status === 'passed')
        .slice(0, 5)
        .map(test => `• \`${test.title}\` (${this.formatDuration(test.duration)})`)
        .join('\n');

      message.attachments.push({
        color: 'good',
        title: `✅ Passed Tests Sample (${summary.passed} total)`,
        text: passedTests,
        mrkdwn_in: ['text']
      });
    }

    // Send to Slack
    const response = await fetch(this.options.webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(message)
    });

    if (!response.ok) {
      throw new Error(`Slack API responded with ${response.status}: ${response.statusText}`);
    }
  }

  formatSummary(summary) {
    return `✅ ${summary.passed} passed\n❌ ${summary.failed} failed\n⏭️ ${summary.skipped} skipped\n📊 ${summary.passRate}% pass rate`;
  }

  formatDuration(ms) {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;
  }
}