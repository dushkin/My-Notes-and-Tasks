import fs from 'fs';
import path from 'path';

export class TestLogger {
  constructor() {
    this.testName = '';
    this.logs = [];
    this.startTime = Date.now();
  }

  setTestName(name) {
    this.testName = name;
    this.info(`Starting test: ${name}`);
  }

  info(message, data = null) {
    this._log('INFO', message, data);
  }

  warn(message, data = null) {
    this._log('WARN', message, data);
  }

  error(message, data = null) {
    this._log('ERROR', message, data);
  }

  debug(message, data = null) {
    if (process.env.DEBUG) {
      this._log('DEBUG', message, data);
    }
  }

  step(stepName, action) {
    return async (...args) => {
      this.info(`Step: ${stepName}`);
      const stepStart = Date.now();
      
      try {
        const result = await action(...args);
        const duration = Date.now() - stepStart;
        this.info(`Step completed: ${stepName} (${duration}ms)`);
        return result;
      } catch (error) {
        const duration = Date.now() - stepStart;
        this.error(`Step failed: ${stepName} (${duration}ms)`, error);
        throw error;
      }
    };
  }

  timing(label) {
    const start = Date.now();
    return {
      end: () => {
        const duration = Date.now() - start;
        this.info(`Timing: ${label} - ${duration}ms`);
        return duration;
      }
    };
  }

  _log(level, message, data = null) {
    const timestamp = new Date().toISOString();
    const duration = Date.now() - this.startTime;
    
    const logEntry = {
      timestamp,
      level,
      test: this.testName,
      message,
      duration,
      data: data ? JSON.stringify(data, null, 2) : null
    };

    this.logs.push(logEntry);

    // Console output
    const color = {
      INFO: '\x1b[36m',  // Cyan
      WARN: '\x1b[33m',  // Yellow
      ERROR: '\x1b[31m', // Red
      DEBUG: '\x1b[90m', // Gray
    }[level] || '\x1b[0m';

    const reset = '\x1b[0m';
    
    console.log(
      `${color}[${level}]${reset} ${timestamp} ${this.testName ? `[${this.testName}]` : ''} ${message}${
        data ? `\n${JSON.stringify(data, null, 2)}` : ''
      }`
    );
  }

  async saveToFile() {
    if (this.logs.length === 0) return;

    const logsDir = 'test-results/logs';
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }

    const filename = `${this.testName.replace(/[^a-zA-Z0-9]/g, '-')}-${Date.now()}.json`;
    const filepath = path.join(logsDir, filename);

    const logData = {
      testName: this.testName,
      startTime: new Date(this.startTime).toISOString(),
      endTime: new Date().toISOString(),
      duration: Date.now() - this.startTime,
      logs: this.logs
    };

    fs.writeFileSync(filepath, JSON.stringify(logData, null, 2));
    this.info(`Logs saved to: ${filepath}`);
  }

  getSummary() {
    const errorLogs = this.logs.filter(log => log.level === 'ERROR');
    const warnLogs = this.logs.filter(log => log.level === 'WARN');
    
    return {
      totalLogs: this.logs.length,
      errors: errorLogs.length,
      warnings: warnLogs.length,
      duration: Date.now() - this.startTime,
      testName: this.testName
    };
  }

  clear() {
    this.logs = [];
    this.startTime = Date.now();
  }
}