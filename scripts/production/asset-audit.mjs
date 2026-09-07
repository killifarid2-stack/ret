import fs from 'node:fs';
import path from 'node:path';

const roots = ['src/assets', 'public', 'src'];
const external = [];
const missingLocal = [];
const remoteRuntimeRefs = [];

function walk(dir) {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (['node_modules', '.git', 'dist'].includes(entry.name)) continue;
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(p);
    else if (/\.(asset\.json|json|tsx?|jsx?|css|md)$/i.test(entry.name)) inspect(p);
  }
}

function inspect(file) {
  const text = fs.readFileSync(file, 'utf8');
  if (/__l5e\/assets-v1|https?:\/\//i.test(text) && /asset\.json|assets-v1/i.test(text)) {
    external.push(file);
  }
  if (/fonts\.googleapis\.com|fonts\.gstatic\.com/i.test(text)) remoteRuntimeRefs.push(file);
}

for (const root of roots) walk(root);

const requiredDirs = ['src/assets', 'src/assets/flags'];
for (const d of requiredDirs) if (!fs.existsSync(d)) missingLocal.push(d);

console.log(`ASSET AUDIT: external asset references = ${external.length}`);
if (external.length) external.slice(0, 30).forEach(x => console.log(`  EXTERNAL: ${x}`));
console.log(`ASSET AUDIT: remote font/runtime references = ${remoteRuntimeRefs.length}`);
if (remoteRuntimeRefs.length) remoteRuntimeRefs.slice(0, 30).forEach(x => console.log(`  REMOTE: ${x}`));
console.log(`ASSET AUDIT: missing required local directories = ${missingLocal.length}`);
if (missingLocal.length) missingLocal.forEach(x => console.log(`  MISSING: ${x}`));

if (external.length || remoteRuntimeRefs.length) {
  console.log('ASSET AUDIT: REVIEW REQUIRED — external visual/runtime references remain.');
} else {
  console.log('ASSET AUDIT: LOCAL REFERENCES OK');
}
