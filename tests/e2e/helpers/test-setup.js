// Helper functions for setting up test data

const { request } = require('@playwright/test');

/**
 * Creates a test user via the API
 * @param {string} email - User email
 * @param {string} password - User password
 * @returns {Promise<Object>} API response
 */
async function createTestUser(email, password) {
  const apiContext = await request.newContext({
    baseURL: 'http://localhost:5001',
    extraHTTPHeaders: {
      'Content-Type': 'application/json'
    }
  });

  try {
    const response = await apiContext.post('/api/auth/register', {
      data: { email, password }
    });
    
    const responseData = await response.json();
    
    if (response.ok()) {
      console.log(`✓ Test user created: ${email}`);
      return { success: true, data: responseData };
    } else {
      // If user already exists, that's ok for tests
      if (responseData.error && responseData.error.includes('already exists')) {
        console.log(`- Test user already exists: ${email}`);
        return { success: true, data: { message: 'User already exists' } };
      }
      console.error(`Failed to create test user ${email}:`, responseData);
      return { success: false, error: responseData };
    }
  } catch (error) {
    console.error(`Error creating test user ${email}:`, error.message);
    return { success: false, error: error.message };
  } finally {
    await apiContext.dispose();
  }
}

/**
 * Logs in a user and returns the tokens
 * @param {string} email - User email
 * @param {string} password - User password
 * @returns {Promise<Object>} Login response with tokens
 */
async function loginUser(email, password) {
  const apiContext = await request.newContext({
    baseURL: 'http://localhost:5001',
    extraHTTPHeaders: {
      'Content-Type': 'application/json'
    }
  });

  try {
    const response = await apiContext.post('/api/auth/login', {
      data: { email, password }
    });
    
    const responseData = await response.json();
    
    if (response.ok()) {
      return { success: true, data: responseData };
    } else {
      return { success: false, error: responseData };
    }
  } catch (error) {
    return { success: false, error: error.message };
  } finally {
    await apiContext.dispose();
  }
}

/**
 * Sets up standard test users
 * @returns {Promise<Object>} Object containing test user credentials
 */
async function setupTestUsers() {
  const testUsers = {
    standard: { email: 'test@example.com', password: 'password123' },
    admin: { email: 'admin@example.com', password: 'admin123' },
    user: { email: 'user@example.com', password: 'password123' }
  };

  console.log('Setting up test users...');
  
  for (const [key, user] of Object.entries(testUsers)) {
    await createTestUser(user.email, user.password);
  }
  
  console.log('✅ Test users setup complete');
  return testUsers;
}

/**
 * Cleans up test data (optional - use with caution)
 */
async function cleanupTestData() {
  // This would require additional API endpoints to delete users
  // For now, we'll just log that cleanup was requested
  console.log('Test cleanup requested (not implemented)');
}

/**
 * Waits for the backend to be ready
 * @param {number} maxAttempts - Maximum number of attempts
 * @param {number} delay - Delay between attempts in ms
 * @returns {Promise<boolean>} True if backend is ready
 */
async function waitForBackend(maxAttempts = 10, delay = 1000) {
  const apiContext = await request.newContext({
    baseURL: 'http://localhost:5001'
  });

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const response = await apiContext.get('/api/health');
      if (response.ok()) {
        console.log('✅ Backend is ready');
        await apiContext.dispose();
        return true;
      }
    } catch (error) {
      // Backend not ready yet
    }
    
    if (attempt < maxAttempts) {
      console.log(`⏳ Waiting for backend... (attempt ${attempt}/${maxAttempts})`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  await apiContext.dispose();
  console.error('❌ Backend not ready after maximum attempts');
  return false;
}

module.exports = {
  createTestUser,
  loginUser,
  setupTestUsers,
  cleanupTestData,
  waitForBackend
};