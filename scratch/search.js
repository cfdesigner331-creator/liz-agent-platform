const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, '..', 'src');

function searchDir(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      searchDir(fullPath);
    } else if (stat.isFile()) {
      const content = fs.readFileSync(fullPath, 'utf8');
      const lines = content.split('\n');
      lines.forEach((line, idx) => {
        if (line.toLowerCase().includes('liz')) {
          console.log(`${path.relative(srcDir, fullPath)}:${idx + 1}: ${line.trim()}`);
        }
      });
    }
  }
}

console.log('Searching for "liz" in src/...');
searchDir(srcDir);
console.log('Search complete.');
