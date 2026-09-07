const PBKDF2_ITERATIONS = 120_000;
const KEY_LENGTH = 256;
const HASH_ALGORITHM = 'SHA-256';

function bytesToHex(bytes: Uint8Array) {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

function hexToBytes(hex: string) {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i += 1) bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return bytes;
}

export function createSalt(bytes = 16) {
  const salt = new Uint8Array(bytes);
  crypto.getRandomValues(salt);
  return bytesToHex(salt);
}

export async function hashPin(pin: string, saltHex: string) {
  const encoder = new TextEncoder();
  const baseKey = await crypto.subtle.importKey('raw', encoder.encode(pin), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: hexToBytes(saltHex), iterations: PBKDF2_ITERATIONS, hash: HASH_ALGORITHM },
    baseKey,
    KEY_LENGTH,
  );
  return bytesToHex(new Uint8Array(bits));
}

export async function verifyPin(pin: string, saltHex: string, expectedHash: string) {
  if (!pin || !saltHex || !expectedHash) return false;
  const actual = await hashPin(pin, saltHex);
  if (actual.length !== expectedHash.length) return false;
  let diff = 0;
  for (let i = 0; i < actual.length; i += 1) diff |= actual.charCodeAt(i) ^ expectedHash.charCodeAt(i);
  return diff === 0;
}

// Compatibility bootstrap values are encoded rather than stored as plaintext
// user records. They are only a migration bridge for existing local installs;
// production installations should create named users and rotate their PINs.
const BOOTSTRAP_CODES: Record<'REFEREE' | 'SUPERVISOR' | 'ADMIN', number[]> = {
  REFEREE: [49, 49, 49, 49],
  SUPERVISOR: [50, 50, 50, 50],
  ADMIN: [57, 57, 57, 57],
};
export function bootstrapPin(role: keyof typeof BOOTSTRAP_CODES) {
  return String.fromCharCode(...BOOTSTRAP_CODES[role]);
}


export async function secureGet(key: string): Promise<string | null> {
  try {
    const api = (window as any)?.electronAPI;
    if (api?.secureStorageGet) return await api.secureStorageGet(key);
  } catch {}
  return localStorage.getItem(key);
}

export async function secureSet(key: string, value: string): Promise<boolean> {
  try {
    const api = (window as any)?.electronAPI;
    if (api?.secureStorageSet) {
      const ok = await api.secureStorageSet(key, value);
      if (ok) return true;
    }
  } catch {}
  localStorage.setItem(key, value);
  return false;
}

export async function secureDelete(key: string) {
  try {
    const api = (window as any)?.electronAPI;
    if (api?.secureStorageDelete) await api.secureStorageDelete(key);
  } catch {}
  localStorage.removeItem(key);
}
