const { request } = require('@playwright/test');

const TEST_USERS = [
  { email: 'test@e2e.com', password: 'password123' },
  { email: 'admin@e2e.com', password: 'password123' },
  { email: 'user@e2e.com', password: 'password123' }
];

async function globalSetup() {
  console.log('🚀 Starting global test setup...');
  
  // Create API context
  const apiContext = await request.newContext({
    baseURL: 'http://localhost:5001',
    extraHTTPHeaders: {
      'Content-Type': 'application/json'
    }
  });

  try {
    // Wait for backend to be ready
    console.log('⏳ Waiting for backend...');
    let backendReady = false;
    for (let i = 0; i < 30; i++) {
      try {
        // Try any endpoint to see if backend is responding
        const response = await apiContext.post('/api/auth/register', {
          data: { email: 'test-connectivity@e2e.com', password: 'test' },
          timeout: 2000
        });
        // Any response (even error) means backend is running
        backendReady = true;
        break;
      } catch (error) {
        if (i < 29) {
          console.log(`⏳ Backend not ready, attempt ${i + 1}/30...`);
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
    }

    if (!backendReady) {
      console.error('❌ Backend not ready after 30 seconds');
      console.error('Make sure your backend is running on http://localhost:5001');
      throw new Error('Backend not ready after 30 seconds');
    }

    console.log('✅ Backend is ready');

    // Create test users
    let createdCount = 0;
    let existingCount = 0;
    
    for (const user of TEST_USERS) {
      try {
        console.log(`👤 Creating user: ${user.email}`);
        
        const response = await apiContext.post('/api/auth/register', {
          data: {
            email: user.email,
            password: user.password
          }
        });

        if (response.ok()) {
          console.log(`✅ Created: ${user.email}`);
          createdCount++;
        } else {
          const error = await response.json();
          if (error.error && error.error.toLowerCase().includes('already exists')) {
            console.log(`ℹ️  Already exists: ${user.email}`);
            existingCount++;
          } else {
            console.warn(`⚠️  Failed to create ${user.email}:`, error.error);
          }
        }
      } catch (error) {
        console.warn(`⚠️  Error creating ${user.email}:`, error.message);
      }
    }

    console.log(`🎉 Global setup complete!`);
    console.log(`📊 Users created: ${createdCount}, already existed: ${existingCount}`);
    
    // Store test user info for cleanup
    global.__TEST_USERS__ = TEST_USERS;

  } catch (error) {
    console.error('❌ Global setup failed:', error.message);
    throw error;
  } finally {
    await apiContext.dispose();
  }
}

module.exports = globalSetup;