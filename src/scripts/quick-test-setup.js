// Quick script to create test user via API

const https = require('http');

async function createTestUser() {
  const userData = JSON.stringify({
    email: 'test@example.com',
    password: 'password123'
  });

  const options = {
    hostname: 'localhost',
    port: 5001,
    path: '/api/auth/register',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(userData)
    }
  };

  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          if (res.statusCode === 201) {
            console.log('✅ Test user created successfully');
            resolve({ success: true, data: response });
          } else if (res.statusCode === 400 && response.error && response.error.includes('already exists')) {
            console.log('ℹ️  Test user already exists (OK)');
            resolve({ success: true, data: response });
          } else {
            console.error('❌ Failed to create test user:', response);
            resolve({ success: false, error: response });
          }
        } catch (e) {
          console.error('❌ Failed to parse response:', data);
          reject(e);
        }
      });
    });

    req.on('error', (err) => {
      console.error('❌ Request failed:', err.message);
      reject(err);
    });

    req.write(userData);
    req.end();
  });
}

// Check if backend is running
async function checkBackend() {
  const options = {
    hostname: 'localhost',
    port: 5001,
    path: '/api/auth/register',
    method: 'OPTIONS'
  };

  return new Promise((resolve) => {
    const req = https.request(options, (res) => {
      resolve(true);
    });
    
    req.on('error', () => {
      resolve(false);
    });
    
    req.setTimeout(2000, () => {
      req.destroy();
      resolve(false);
    });
    
    req.end();
  });
}

async function main() {
  console.log('🚀 Setting up test user...');
  
  // Check if backend is running
  const backendRunning = await checkBackend();
  if (!backendRunning) {
    console.error('❌ Backend is not running on localhost:5001');
    console.log('💡 Please start your backend server first');
    process.exit(1);
  }
  
  console.log('✅ Backend is running');
  
  // Create test user
  try {
    await createTestUser();
    console.log('\n🎉 Test setup complete!');
    console.log('📧 Email: test@example.com');
    console.log('🔑 Password: password123');
    console.log('\n▶️  Now run: npx playwright test auth-final.spec.js');
  } catch (error) {
    console.error('❌ Setup failed:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { createTestUser, checkBackend };