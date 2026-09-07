import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';

const files = ['package.json', 'bun.lock', 'README.md', 'config/mats.example.json'];
const manifest = {
  createdAt: new Date().toISOString(),
  version: 'WAB-TKD-v41-RELEASE-CANDIDATE',
  files: files.filter(fs.existsSync).map(file => ({
    file,
    sha256: crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')
  }))
};
fs.mkdirSync('release-readiness', { recursive: true });
fs.writeFileSync('release-readiness/backup-manifest.json', JSON.stringify(manifest, null, 2));
console.log('Backup manifest created.');
