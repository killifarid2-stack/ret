import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const main = read('electron/main.cjs');
const pkg = JSON.parse(read('package.json'));
const checks = [
  ['sandbox', main.includes('sandbox: true')],
  ['contextIsolation', main.includes('contextIsolation: true')],
  ['nodeIntegration disabled', main.includes('nodeIntegration: false')],
  ['secure storage bridge', main.includes("secure-storage:get") && main.includes('safeStorage.isEncryptionAvailable')],
  ['IPC sender validation', main.includes('isTrustedRenderer(event)') || main.includes('requireTrustedRenderer(event)')],
  ['CSP', main.includes("Content-Security-Policy")],
  ['ASAR integrity', pkg.build?.asar?.disableIntegrity === false],
  ['ASAR integrity fuse', pkg.build?.electronFuses?.enableEmbeddedAsarIntegrityValidation === true],
  ['onlyLoadAppFromAsar fuse', pkg.build?.electronFuses?.onlyLoadAppFromAsar === true],
  ['runAsNode fuse disabled', pkg.build?.electronFuses?.runAsNode === false],
  ['nodeOptions fuse disabled', pkg.build?.electronFuses?.enableNodeOptionsEnvironmentVariable === false],
  ['node CLI inspect fuse disabled', pkg.build?.electronFuses?.enableNodeCliInspectArguments === false],
  ['Google Fonts removed', !read('src/components/player-call/exact-player-call-fragment.ts').includes('fonts.googleapis.com')],
];
let failed = 0;
for (const [name, ok] of checks) { console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`); if (!ok) failed++; }
if (failed) process.exit(1);
console.log('Electron production hardening audit: PASS');
