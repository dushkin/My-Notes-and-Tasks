import fs from 'fs';
import path from 'path';

export class TestDataManager {
  constructor() {
    this.createdData = new Set();
    this.tempFiles = new Set();
    this.apiCleanupTasks = [];
  }

  // Generate test user data
  generateUserData(overrides = {}) {
    const timestamp = Date.now();
    const userData = {
      email: `test-user-${timestamp}@example.com`,
      username: `testuser${timestamp}`,
      password: 'TestPassword123!',
      firstName: 'Test',
      lastName: 'User',
      ...overrides
    };

    // Track for cleanup
    this.createdData.add({ type: 'user', data: userData });
    return userData;
  }

  // Generate test task data
  generateTaskData(overrides = {}) {
    const timestamp = Date.now();
    const taskData = {
      title: `Test Task ${timestamp}`,
      description: `Test task description created at ${new Date().toISOString()}`,
      priority: 'medium',
      status: 'pending',
      dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // Tomorrow
      tags: ['test', 'automation'],
      ...overrides
    };

    this.createdData.add({ type: 'task', data: taskData });
    return taskData;
  }

  // Generate test note data
  generateNoteData(overrides = {}) {
    const timestamp = Date.now();
    const noteData = {
      title: `Test Note ${timestamp}`,
      content: `<p>Test note content created at ${new Date().toISOString()}</p>`,
      folder: 'test-folder',
      tags: ['test', 'note'],
      ...overrides
    };

    this.createdData.add({ type: 'note', data: noteData });
    return noteData;
  }

  // Create test file
  createTestFile(filename, content = 'Test file content') {
    const testDir = 'tests/fixtures/temp';
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }

    const filepath = path.join(testDir, filename);
    fs.writeFileSync(filepath, content);
    this.tempFiles.add(filepath);
    
    return filepath;
  }

  // Create test image
  createTestImage(filename = 'test-image.png') {
    // Create a simple 1x1 PNG image (base64 encoded)
    const pngBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    const buffer = Buffer.from(pngBase64, 'base64');
    
    const testDir = 'tests/fixtures/temp';
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }

    const filepath = path.join(testDir, filename);
    fs.writeFileSync(filepath, buffer);
    this.tempFiles.add(filepath);
    
    return filepath;
  }

  // Load test fixtures
  loadFixture(fixtureName) {
    const fixturePath = path.join('tests/fixtures', `${fixtureName}.json`);
    
    if (!fs.existsSync(fixturePath)) {
      throw new Error(`Fixture not found: ${fixturePath}`);
    }
    
    return JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
  }

  // Save test data as fixture
  saveFixture(fixtureName, data) {
    const fixturesDir = 'tests/fixtures';
    if (!fs.existsSync(fixturesDir)) {
      fs.mkdirSync(fixturesDir, { recursive: true });
    }

    const fixturePath = path.join(fixturesDir, `${fixtureName}.json`);
    fs.writeFileSync(fixturePath, JSON.stringify(data, null, 2));
    this.tempFiles.add(fixturePath);
    
    return fixturePath;
  }

  // API cleanup utilities
  addApiCleanupTask(cleanupFn) {
    this.apiCleanupTasks.push(cleanupFn);
  }

  // Cleanup all test data
  async cleanup() {
    // Clean up temporary files
    for (const filepath of this.tempFiles) {
      try {
        if (fs.existsSync(filepath)) {
          fs.unlinkSync(filepath);
        }
      } catch (error) {
        console.warn(`Failed to cleanup file: ${filepath}`, error);
      }
    }

    // Execute API cleanup tasks
    for (const cleanupTask of this.apiCleanupTasks) {
      try {
        await cleanupTask();
      } catch (error) {
        console.warn('API cleanup task failed:', error);
      }
    }

    // Clear tracking sets
    this.createdData.clear();
    this.tempFiles.clear();
    this.apiCleanupTasks = [];
  }

  // Get test environment variables
  getEnvironmentData() {
    return {
      baseUrl: process.env.BASE_URL || 'http://localhost:5173',
      apiBaseUrl: process.env.API_BASE_URL || 'http://localhost:3000',
      testUserEmail: process.env.TEST_USER_EMAIL || 'test@example.com',
      testUserPassword: process.env.TEST_USER_PASSWORD || 'testpassword',
      environment: process.env.NODE_ENV || 'test',
      ci: process.env.CI === 'true',
      debug: process.env.DEBUG === 'true',
    };
  }

  // Database seeding utilities
  async seedDatabase(seedData) {
    // This would typically make API calls to seed test data
    const environment = this.getEnvironmentData();
    
    if (environment.environment === 'production') {
      throw new Error('Database seeding is not allowed in production');
    }

    // Example implementation - adjust based on your API
    const seedResults = [];
    
    for (const [dataType, items] of Object.entries(seedData)) {
      for (const item of items) {
        // Add cleanup task for each seeded item
        this.addApiCleanupTask(async () => {
          // Implement cleanup logic based on your API
          console.log(`Cleaning up ${dataType}:`, item.id);
        });
        
        seedResults.push({ type: dataType, item });
      }
    }
    
    return seedResults;
  }

  // Performance test data generators
  generateLargeDataset(type, count = 100) {
    const dataset = [];
    
    for (let i = 0; i < count; i++) {
      switch (type) {
        case 'tasks':
          dataset.push(this.generateTaskData({ title: `Bulk Task ${i + 1}` }));
          break;
        case 'notes':
          dataset.push(this.generateNoteData({ title: `Bulk Note ${i + 1}` }));
          break;
        default:
          throw new Error(`Unknown dataset type: ${type}`);
      }
    }
    
    return dataset;
  }
}