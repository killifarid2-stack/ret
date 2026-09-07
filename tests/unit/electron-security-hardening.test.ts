import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
const root = process.cwd();

describe('Electron production hardening contracts', () => {
  it('uses sandboxed, isolated renderer windows and validates IPC senders', () => {
    const main = fs.readFileSync(path.join(root, 'electron/main.cjs'), 'utf8');
    expect(main).toContain('contextIsolation: true');
    expect(main).toContain('nodeIntegration: false');
    expect(main).toContain('sandbox: true');
    expect(main).toContain('isTrustedRenderer');
    expect(main).toContain('safeStorage.isEncryptionAvailable');
    expect(main).toContain("secure-storage:get");
    expect(main).toContain('installContentSecurityPolicy');
  });
  it('enables ASAR integrity and Electron fuses in the builder config', () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
    expect(pkg.build.asar.disableIntegrity).toBe(false);
    expect(pkg.build.electronFuses.enableEmbeddedAsarIntegrityValidation).toBe(true);
    expect(pkg.build.electronFuses.onlyLoadAppFromAsar).toBe(true);
    expect(pkg.build.electronFuses.runAsNode).toBe(false);
  });
  it('contains no runtime Google Fonts dependency', () => {
    const files = [
      'src/components/player-call/exact-player-call-fragment.ts',
      'src/index.css',
      'src/main.tsx',
    ];
    for (const file of files) expect(fs.readFileSync(path.join(root, file), 'utf8')).not.toMatch(/fonts\.googleapis\.com|fonts\.gstatic\.com/);
  });
});
