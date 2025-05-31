// tests/global-teardown.cjs
// Playwright global teardown with better debugging

const { request } = require('@playwright/test');

async function globalTeardown() {
  console.log('🧹 Starting global test cleanup...');

  // Get test users from global setup
  const testUsers = global.__TEST_USERS__ || [
    { email: 'test@example.com', password: 'password123' },
    { email: 'admin@example.com', password: 'admin123' },
    { email: 'user@example.com', password: 'password123' } // Fixed password length
  ];

  // Create API context
  const apiContext = await request.newContext({
    baseURL: 'http://localhost:5001',
    extraHTTPHeaders: {
      'Content-Type': 'application/json'
    }
  });

  try {
    let cleanedCount = 0;

    // Try to use the test cleanup endpoint
    try {
      console.log('🗑️  Attempting bulk test cleanup...');
      console.log('📡 Making DELETE request to: http://localhost:5001/api/auth/test-cleanup');

      const cleanupResponse = await apiContext.delete('/api/auth/test-cleanup');

      console.log(`📋 Cleanup response status: ${cleanupResponse.status()}`);

      if (cleanupResponse.ok()) {
        const result = await cleanupResponse.json();
        console.log('📦 Cleanup response data:', result);
        console.log(`✅ Bulk cleanup successful: ${result.deletedUsers || 0} users deleted`);
        cleanedCount = result.deletedUsers || 0;
      } else {
        const errorText = await cleanupResponse.text();
        console.log(`❌ Cleanup endpoint returned ${cleanupResponse.status()}: ${errorText}`);
        throw new Error(`Cleanup endpoint returned ${cleanupResponse.status()}`);
      }
    } catch (error) {
      console.log(`⚠️  Bulk cleanup failed: ${error.message}`);

      // Fallback to individual user cleanup
      console.log('🗑️  Trying individual user cleanup...');

      for (const user of testUsers) {
        try {
          console.log(`🔐 Attempting login for cleanup: ${user.email}`);

          // First, login to get a token (needed for delete operations)
          const loginResponse = await apiContext.post('/api/auth/login', {
            data: {
              email: user.email,
              password: user.password
            }
          });

          console.log(`📋 Login response status for ${user.email}: ${loginResponse.status()}`);

          if (loginResponse.ok()) {
            const loginData = await loginResponse.json();
            console.log(`✅ Login successful for ${user.email}`);

            // Try to delete the user account
            const deleteResponse = await apiContext.delete('/api/auth/account', {
              headers: {
                'Authorization': `Bearer ${loginData.accessToken}`
              }
            });

            console.log(`📋 Delete response status for ${user.email}: ${deleteResponse.status()}`);

            if (deleteResponse.ok()) {
              console.log(`✅ Deleted: ${user.email}`);
              cleanedCount++;
            } else {
              const deleteError = await deleteResponse.text();
              console.log(`❌ Could not delete ${user.email}: ${deleteError}`);
            }
          } else {
            const loginError = await loginResponse.text();
            console.log(`❌ Could not login as ${user.email}: ${loginError}`);
          }

        } catch (error) {
          console.log(`❌ Cleanup failed for ${user.email}: ${error.message}`);
        }
      }
    }

    if (cleanedCount > 0) {
      console.log(`🎉 Cleanup complete! Removed ${cleanedCount} test users`);
    } else {
      console.log('⚠️  No test users were cleaned up');
      console.log('💡 Check if your backend is running and endpoints are accessible');
    }

  } catch (error) {
    console.error('❌ Global cleanup failed:', error.message);
    // Don't throw error in teardown - we don't want to fail tests due to cleanup issues
  } finally {
    await apiContext.dispose();
  }
}

module.exports = globalTeardown;