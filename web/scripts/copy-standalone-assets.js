/**
 * Post-build script to copy static assets to standalone directory
 * 
 * Next.js standalone builds don't include static assets by default.
 * This script copies them after the build completes.
 */

const fs = require('fs');
const path = require('path');

const webDir = path.join(__dirname, '..');
const standaloneDir = path.join(webDir, '.next', 'standalone');
const standaloneWebDir = path.join(standaloneDir, 'web');

// Check if standalone build exists
if (!fs.existsSync(standaloneDir)) {
  console.log('No standalone build found, skipping asset copy.');
  process.exit(0);
}

// Determine the correct standalone path (could be at root or in /web subdirectory)
let targetDir = standaloneDir;
if (fs.existsSync(standaloneWebDir)) {
  targetDir = standaloneWebDir;
}

console.log('Copying static assets to standalone directory...');

// Create .next directory in standalone if it doesn't exist
const standaloneNextDir = path.join(targetDir, '.next');
if (!fs.existsSync(standaloneNextDir)) {
  fs.mkdirSync(standaloneNextDir, { recursive: true });
}

// Copy .next/static to standalone/.next/static
const staticSrc = path.join(webDir, '.next', 'static');
const staticDest = path.join(standaloneNextDir, 'static');

if (fs.existsSync(staticSrc)) {
  copyRecursive(staticSrc, staticDest);
  console.log('✓ Copied .next/static');
} else {
  console.log('⚠ No .next/static directory found');
}

// Copy public to standalone/public
const publicSrc = path.join(webDir, 'public');
const publicDest = path.join(targetDir, 'public');

if (fs.existsSync(publicSrc)) {
  copyRecursive(publicSrc, publicDest);
  console.log('✓ Copied public directory');
} else {
  console.log('⚠ No public directory found');
}

console.log('✓ Standalone assets ready!');

/**
 * Recursively copy a directory
 */
function copyRecursive(src, dest) {
  // Remove existing destination
  if (fs.existsSync(dest)) {
    fs.rmSync(dest, { recursive: true, force: true });
  }
  
  // Create destination directory
  fs.mkdirSync(dest, { recursive: true });
  
  // Copy contents
  const entries = fs.readdirSync(src, { withFileTypes: true });
  
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    
    if (entry.isDirectory()) {
      copyRecursive(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}
