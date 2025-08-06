import fs from 'fs';
import path from 'path';

async function globalTeardown() {
  console.log('🧹 Starting global test teardown...');
  
  try {
    // Clean up temporary test files
    const tempFiles = [
      './tests/fixtures/temp-data.json',
      './tests/fixtures/test-uploads',
    ];
    
    tempFiles.forEach(file => {
      if (fs.existsSync(file)) {
        if (fs.lstatSync(file).isDirectory()) {
          fs.rmSync(file, { recursive: true, force: true });
        } else {
          fs.unlinkSync(file);
        }
        console.log(`🗑️  Cleaned up: ${file}`);
      }
    });
    
    // Archive test results if in CI
    if (process.env.CI) {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const archiveDir = `test-results/archive-${timestamp}`;
      
      if (fs.existsSync('test-results')) {
        fs.renameSync('test-results', archiveDir);
        console.log(`📦 Archived test results to: ${archiveDir}`);
      }
    }
    
    console.log('✅ Global test teardown completed');
  } catch (error) {
    console.error('❌ Error during global teardown:', error);
  }
}

export default globalTeardown;