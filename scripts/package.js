#!/usr/bin/env node

import { execSync } from 'child_process';
import { existsSync, rmSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';
import os from 'os';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

// Check for required files
const requiredFiles = [
  'main.js',
  'preload.cjs',
  'renderer/index.html',
  'package.json',
];

console.log('🔍 Checking required files...');
const missingFiles = requiredFiles.filter(
  (file) => !existsSync(path.join(projectRoot, file))
);

if (missingFiles.length > 0) {
  console.error(`❌ Missing required files: ${missingFiles.join(', ')}`);
  process.exit(1);
}
console.log('✅ All required files found\n');

// Clean dist directory
const distDir = path.join(projectRoot, 'dist');
if (existsSync(distDir)) {
  console.log('🧹 Cleaning dist directory...');
  rmSync(distDir, { recursive: true, force: true });
  console.log('✅ Dist directory cleaned\n');
}

// Get platform-specific build command
const platform = os.platform();
const args = process.argv.slice(2);

let buildCommand = 'electron-builder';

// If no platform specified, build for current platform
if (!args.some(arg => ['--mac', '--win', '--linux', '--all'].includes(arg))) {
  const platformMap = {
    darwin: '--mac',
    win32: '--win',
    linux: '--linux',
  };
  const platformFlag = platformMap[platform] || '--linux';
  buildCommand += ` ${platformFlag}`;
}

// Add any additional arguments
if (args.length > 0) {
  buildCommand += ` ${args.join(' ')}`;
}

console.log(`🚀 Building Electron app...`);
console.log(`📦 Command: ${buildCommand}\n`);

try {
  execSync(buildCommand, {
    stdio: 'inherit',
    cwd: projectRoot,
    env: {
      ...process.env,
      NODE_ENV: 'production',
    },
  });

  console.log('\n✅ Build completed successfully!');
  console.log(`📁 Output: ${distDir}`);
} catch (error) {
  console.error('\n❌ Build failed!');
  process.exit(1);
}

