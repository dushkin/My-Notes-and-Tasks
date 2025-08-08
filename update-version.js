#!/usr/bin/env node

import fs from 'fs';
import path from 'path';

const VERSION = process.env.npm_package_version || '14.14.0';

console.log(`🔄 Updating cache-busting version to: ${VERSION}`);

// Files to update
const files = [
  {
    path: './src/main.jsx',
    search: /const version = '[^']+'/,
    replace: `const version = '${VERSION}'`
  },
  {
    path: './index.html',
    search: /src="(\/[^"?]+)(\?v=[^"]*)?"/g,
    replace: `src="$1?v=${VERSION}"`
  },
  {
    path: './public/sw.js',
    search: /: '[\d.]+'/,
    replace: `: '${VERSION}'`
  }
];

files.forEach(({ path: filePath, search, replace }) => {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    
    if (typeof replace === 'function') {
      content = content.replace(search, replace);
    } else {
      content = content.replace(search, replace);
    }
    
    fs.writeFileSync(filePath, content);
    console.log(`✅ Updated: ${filePath}`);
  } catch (error) {
    console.error(`❌ Error updating ${filePath}:`, error.message);
  }
});

console.log('🎉 Version update complete!');