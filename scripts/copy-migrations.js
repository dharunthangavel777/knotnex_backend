const fs = require('fs');
const path = require('path');

const srcDir = path.resolve(__dirname, '../src/db/migrations');
const destDir = path.resolve(__dirname, '../dist/db/migrations');

if (fs.existsSync(srcDir)) {
  fs.mkdirSync(destDir, { recursive: true });
  const files = fs.readdirSync(srcDir);
  for (const file of files) {
    const srcFile = path.join(srcDir, file);
    const destFile = path.join(destDir, file);
    fs.copyFileSync(srcFile, destFile);
  }
  console.log(`[build] Successfully copied ${files.length} migration file(s) to ${destDir}`);
} else {
  console.warn(`[build] Warning: Migration directory not found at ${srcDir}`);
}
