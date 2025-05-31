// tests/global-teardown.cjs
// Playwright global teardown with domain-based cleanup

const { request } = require('@playwright/test');

async function globalTeardown() {
  console.log('🧹 Starting global test cleanup...');

  // Create API context
  const apiContext = await request.newContext({
    baseURL: 'http://localhost:5001',
    extraHTTPHeaders: {
      'Content-Type': 'application/json'
    }
  });

  try {
    let cleanedCount = 0;
    
    // Use the domain-based cleanup endpoint
    try {
      console.log('🗑️  Attempting domain-based test cleanup...');
      console.log('📡 Making DELETE request to: http://localhost:5001/api/auth/test-cleanup');
      
      const cleanupResponse = await apiContext.delete('/api/auth/test-cleanup');
      
      console.log(`📋 Cleanup response status: ${cleanupResponse.status()}`);
      
      if (cleanupResponse.ok()) {
        const result = await cleanupResponse.json();
        console.log('📦 Cleanup response data:', result);
        console.log(`✅ Domain-based cleanup successful: ${result.deletedUsers || 0} users deleted`);
        cleanedCount = result.deletedUsers || 0;
      } else {
        const errorText = await cleanupResponse.text();
        console.log(`❌ Cleanup endpoint returned ${cleanupResponse.status()}: ${errorText}`);
        throw new Error(`Cleanup endpoint returned ${cleanupResponse.status()}`);
      }
    } catch (error) {
      console.log(`⚠️  Domain-based cleanup failed: ${error.message}`);
      console.log('ℹ️  This is expected if the cleanup endpoint is not implemented');
    }

    if (cleanedCount > 0) {
      console.log(`🎉 Cleanup complete! Removed ${cleanedCount} test users from e2e.com domain`);
    } else {
      console.log('ℹ️  No test users were cleaned up');
      console.log('💡 All @e2e.com users will be cleaned up by the backend endpoint');
    }

  } catch (error) {
    console.error('❌ Global cleanup failed:', error.message);
    // Don't throw error in teardown - we don't want to fail tests due to cleanup issues
  } finally {
    await apiContext.dispose();
  }
}

module.exports = globalTeardown;