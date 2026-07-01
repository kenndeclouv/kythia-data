import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = __dirname;
const tauriConfPath = path.join(rootDir, 'src-tauri', 'tauri.conf.json');

// Get version from tauri.conf.json
const tauriConf = JSON.parse(fs.readFileSync(tauriConfPath, 'utf8'));
const version = tauriConf.version;

const releaseDir = path.join(rootDir, 'src-tauri', 'target', 'release');
const bundleDir = path.join(releaseDir, 'bundle');
const msiDir = path.join(bundleDir, 'msi');
const outDir = path.join(rootDir, 'releases');

// Create releases directory if it doesn't exist
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

// 1. Rename and move MSI
const msiOldName = `Kythia Data_${version}_x64_en-US.msi`;
const msiNewName = `Kythia.Data_${version}_x64_Installer.msi`;
const msiOldPath = path.join(msiDir, msiOldName);
const msiNewPath = path.join(outDir, msiNewName);

if (fs.existsSync(msiOldPath)) {
  fs.copyFileSync(msiOldPath, msiNewPath);
  console.log(`✅ Copied MSI to: releases/${msiNewName}`);
} else {
  console.log(`⚠️ Could not find MSI at ${msiOldPath}`);
}

// 2. Rename and move raw EXE as Portable
const exeOldName = `kythia-data.exe`;
const exeNewName = `Kythia.Data_${version}_x64_Portable.exe`;
const exeOldPath = path.join(releaseDir, exeOldName);
const exeNewPath = path.join(outDir, exeNewName);

if (fs.existsSync(exeOldPath)) {
  fs.copyFileSync(exeOldPath, exeNewPath);
  console.log(`✅ Copied Portable EXE to: releases/${exeNewName}`);
} else {
  console.log(`⚠️ Could not find raw EXE at ${exeOldPath}`);
}

console.log('🎉 Done organizing build files!');
