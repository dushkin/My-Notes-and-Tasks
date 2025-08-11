#!/usr/bin/env node
/**
 * Sync Android versionName/versionCode from package.json version.
 * Usage:
 *   1) Put this file at scripts/sync-version.js
 *   2) Add to package.json:
 *        "scripts": {
 *          "version": "node scripts/sync-version.js"
 *        }
 *   3) Bump with:  npm version 14.15.6   (or patch/minor/major)
 *   4) Build Android: the banner will show the same version as package.json.
 */
import fs from 'fs';
import path from 'path';

const ROOT = process.cwd();
const pkgPath = path.join(ROOT, 'package.json');
if (!fs.existsSync(pkgPath)) {
  console.error('❌ package.json not found at project root.');
  process.exit(1);
}
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
const version = (pkg.version || '').trim();
if (!/^\d+\.\d+\.\d+$/.test(version)) {
  console.error(`❌ package.json version "${version}" is not semver (x.y.z).`);
  process.exit(1);
}

// Compute versionCode from semver: major*10000 + minor*100 + patch
const [maj, min, pat] = version.split('.').map(n => parseInt(n, 10));
let desiredCode = maj * 10000 + min * 100 + pat;

// Find Gradle file (Groovy or Kotlin DSL)
const gradleGroovy = path.join(ROOT, 'android', 'app', 'build.gradle');
const gradleKts    = path.join(ROOT, 'android', 'app', 'build.gradle.kts');
const gradlePath = fs.existsSync(gradleGroovy) ? gradleGroovy : (fs.existsSync(gradleKts) ? gradleKts : null);
if (!gradlePath) {
  console.error('❌ Could not find android/app/build.gradle or build.gradle.kts');
  process.exit(1);
}

let gradle = fs.readFileSync(gradlePath, 'utf8');

// Extract current versionCode (best-effort)
const codeRegexGroovy = /versionCode\s+(\d+)/;
const codeRegexKts    = /versionCode\s*=\s*(\d+)/;
const nameRegexGroovy = /versionName\s+"([^"]+)"/;
const nameRegexKts    = /versionName\s*=\s*"([^"]+)"/;

const isKts = gradlePath.endsWith('.kts');
const codeRe = isKts ? codeRegexKts : codeRegexGroovy;
const nameRe = isKts ? nameRegexKts : nameRegexGroovy;

let currentCode = null;
let mCode = gradle.match(codeRe);
if (mCode) currentCode = parseInt(mCode[1], 10);

// Ensure monotonic versionCode to avoid "can't install older build"
if (currentCode !== null && desiredCode <= currentCode) {
  console.warn(`⚠️ Computed versionCode ${desiredCode} is <= current ${currentCode}. Bumping to ${currentCode + 1} to preserve installability.`);
  desiredCode = currentCode + 1;
}

// Replace or insert in defaultConfig block
function ensureInDefaultConfig(src, keyLine, re, newLine) {
  if (re.test(src)) {
    return src.replace(re, newLine);
  }
  // Insert into defaultConfig { ... }
  const defCfgStart = src.search(/defaultConfig\s*\{/);
  if (defCfgStart === -1) {
    console.error('❌ Could not find defaultConfig { } block in Gradle file.');
    process.exit(1);
  }
  const insertPos = src.indexOf('\n', defCfgStart) + 1;
  return src.slice(0, insertPos) + '        ' + keyLine + '\n' + src.slice(insertPos);
}

if (isKts) {
  gradle = ensureInDefaultConfig(gradle, `versionName = "${version}"`, nameRegexKts, `versionName = "${version}"`);
  gradle = ensureInDefaultConfig(gradle, `versionCode = ${desiredCode}`, codeRegexKts, `versionCode = ${desiredCode}`);
} else {
  gradle = ensureInDefaultConfig(gradle, `versionName "${version}"`, nameRegexGroovy, `versionName "${version}"`);
  gradle = ensureInDefaultConfig(gradle, `versionCode ${desiredCode}`, codeRegexGroovy, `versionCode ${desiredCode}`);
}

fs.writeFileSync(gradlePath, gradle);
console.log(`✅ Synced Android versionName="${version}", versionCode=${desiredCode} in ${path.relative(ROOT, gradlePath)}`);