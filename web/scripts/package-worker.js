#!/usr/bin/env node
/**
 * Script to package the EvoNash worker for Windows distribution
 * Creates a zip file with all necessary files, excluding development files
 */

const fs = require('fs');
const path = require('path');
const archiver = require('archiver');

// Resolve worker directory - try multiple possible locations
function findWorkerDir() {
  // Try relative to script location (local development)
  const relativePath = path.join(__dirname, '../../worker');
  if (fs.existsSync(relativePath)) {
    return relativePath;
  }
  
  // Try relative to current working directory (Vercel build - if cwd is web/)
  const cwdPath = path.join(process.cwd(), '../worker');
  if (fs.existsSync(cwdPath)) {
    return cwdPath;
  }
  
  // Try from repo root (if cwd is already at repo root)
  const repoRootPath = path.join(process.cwd(), 'worker');
  if (fs.existsSync(repoRootPath)) {
    return repoRootPath;
  }
  
  throw new Error(`Worker directory not found. Tried: ${relativePath}, ${cwdPath}, ${repoRootPath}`);
}

const WORKER_DIR = findWorkerDir();
const OUTPUT_DIR = process.env.EVONASH_DIST_DIR || path.join(process.cwd(), 'public');
const ZIP_NAME = 'evonash-worker-windows.zip';

// Files and directories to include
const INCLUDES = [
  'run_worker.py',
  'requirements.txt',
  'install.bat',
  'install_service.bat',
  'start_worker.bat',
  'nssm.exe',
  'nssm.pdb',
  'config/',
  'src/',
];

// Patterns to exclude from src/
const EXCLUDE_PATTERNS = [
  /\.cpp$/,
  /\.h$/,
  /\.sln$/,
  /\.vcproj$/,
  /\.rc$/,
  /\.ico$/,
  /\.mc$/,
  /\.cmd$/,
  /\.gitattributes$/,
  /^account\./,
  /^console\./,
  /^env\./,
  /^event\./,
  /^gui\./,
  /^hook\./,
  /^imports\./,
  /^io\./,
  /^nssm\./,
  /^process\./,
  /^registry\./,
  /^service\./,
  /^settings\./,
  /^utf8\./,
  /^main\.py$/, // Not needed for worker
  /^version\./,
  /^messages\./,
  /^resource\./,
];

// Directories to exclude
const EXCLUDE_DIRS = [
  'win32',
  'win64',
  'data',
  '__pycache__',
  '.git',
  'node_modules',
];

function shouldExclude(filePath, relativePath) {
  // Check exclude patterns
  const fileName = path.basename(filePath);
  if (EXCLUDE_PATTERNS.some(pattern => pattern.test(fileName))) {
    return true;
  }
  
  // Check exclude directories
  const parts = relativePath.split(path.sep);
  if (EXCLUDE_DIRS.some(dir => parts.includes(dir))) {
    return true;
  }
  
  // Only include Python files in src/
  if (relativePath.startsWith('src/') && !relativePath.endsWith('.py') && !relativePath.endsWith('__init__.py')) {
    return true;
  }
  
  return false;
}

function copyFile(src, dest) {
  const destDir = path.dirname(dest);
  if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
  }
  fs.copyFileSync(src, dest);
}

function copyDirectory(src, dest, basePath = '') {
  if (!fs.existsSync(src)) {
    console.warn(`Warning: ${src} does not exist`);
    return;
  }
  
  const entries = fs.readdirSync(src, { withFileTypes: true });
  
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    const relativePath = path.join(basePath, entry.name).replace(/\\/g, '/');
    
    if (shouldExclude(srcPath, relativePath)) {
      continue;
    }
    
    if (entry.isDirectory()) {
      copyDirectory(srcPath, destPath, relativePath);
    } else {
      copyFile(srcPath, destPath);
    }
  }
}

async function packageWorker() {
  console.log('Packaging EvoNash Worker for Windows...\n');
  console.log(`Worker directory: ${WORKER_DIR}`);
  console.log(`Output directory: ${OUTPUT_DIR}`);
  
  // Verify worker directory exists
  if (!fs.existsSync(WORKER_DIR)) {
    throw new Error(`Worker directory does not exist: ${WORKER_DIR}`);
  }
  
  // Create output directory (public folder for Next.js static files)
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    console.log(`Created output directory: ${OUTPUT_DIR}`);
  }
  
  const tempDir = path.join(OUTPUT_DIR, 'worker-package');
  if (fs.existsSync(tempDir)) {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
  fs.mkdirSync(tempDir, { recursive: true });
  
  console.log('Copying files...');
  
  // Copy individual files
  for (const item of INCLUDES) {
    const srcPath = path.join(WORKER_DIR, item);
    const destPath = path.join(tempDir, item);
    
    if (fs.existsSync(srcPath)) {
      const stat = fs.statSync(srcPath);
      if (stat.isDirectory()) {
        copyDirectory(srcPath, destPath, item);
      } else {
        copyFile(srcPath, destPath);
      }
    } else {
      console.warn(`Warning: ${item} not found`);
    }
  }
  
  // Create logs directory
  const logsDir = path.join(tempDir, 'logs');
  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
    // Create .gitkeep to preserve directory
    fs.writeFileSync(path.join(logsDir, '.gitkeep'), '');
  }
  
  // Create data directory
  const dataDir = path.join(tempDir, 'data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
    fs.writeFileSync(path.join(dataDir, '.gitkeep'), '');
  }
  
  console.log('Creating zip file...');
  
  // Create zip using archiver (cross-platform)
  const zipPath = path.join(OUTPUT_DIR, ZIP_NAME);
  
  await new Promise((resolve, reject) => {
    const output = fs.createWriteStream(zipPath);
    const archive = archiver('zip', {
      zlib: { level: 9 } // Maximum compression
    });
    
    output.on('close', () => {
      const sizeMB = (archive.pointer() / 1024 / 1024).toFixed(2);
      console.log(`\n✓ Successfully created ${zipPath}`);
      console.log(`  Size: ${sizeMB} MB`);
      resolve();
    });
    
    archive.on('error', (err) => {
      console.error('Error creating zip file:', err);
      reject(err);
    });
    
    archive.pipe(output);
    
    // Add all files from temp directory
    archive.directory(tempDir, false);
    
    archive.finalize();
  });
  
  // Cleanup temp directory
  fs.rmSync(tempDir, { recursive: true, force: true });
  
  console.log('\n✓ Worker package ready!');
}

if (require.main === module) {
  packageWorker().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

module.exports = { packageWorker };
