import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { setAuditActor, logAudit } from '@/lib/audit-log';
import { bootstrapPin, createSalt, hashPin, verifyPin, secureGet, secureSet } from '@/lib/local-auth';

export type UserRole = 'REFEREE' | 'SUPERVISOR' | 'ADMIN';

const ROLE_KEY = 'wab-tkd-active-role-v1';
const PIN_KEY = 'wab-tkd-role-pins-v1';
const SECURE_PIN_KEY = 'wab-tkd-role-pins-secure-v1';
const USER_KEY_SECURE = 'wab-tkd-users-secure-v1';

type RolePinRecord = { pinHash: string; pinSalt: string };
type RolePins = Partial<Record<UserRole, RolePinRecord>>;

async function loadPins(): Promise<RolePins> {
  try {
    const secure = await secureGet(SECURE_PIN_KEY);
    if (secure) {
      const parsed = JSON.parse(secure);
      if (parsed && typeof parsed === 'object') return parsed;
    }
    const legacy = JSON.parse(localStorage.getItem(PIN_KEY) || '{}');
    if (legacy && typeof legacy === 'object' && Object.keys(legacy).length) {
      await secureSet(SECURE_PIN_KEY, JSON.stringify(legacy));
      localStorage.removeItem(PIN_KEY);
      return legacy;
    }
  } catch {}
  return {};
}

async function ensureRolePin(role: UserRole) {
  const pins = await loadPins();
  if (pins[role]?.pinHash && pins[role]?.pinSalt) return pins[role]!;
  const salt = createSalt();
  const pinHash = await hashPin(bootstrapPin(role), salt);
  const next = { ...pins, [role]: { pinHash, pinSalt: salt } };
  await secureSet(SECURE_PIN_KEY, JSON.stringify(next));
  return next[role]!;
}

interface AccessContextValue {
  role: UserRole;
  isReferee: boolean;
  isSupervisor: boolean;
  isAdmin: boolean;
  canOperate: boolean;
  canManageTournament: boolean;
  canManageSystem: boolean;
  canRestore: boolean;
  canFinalize: boolean;
  canEditFinal: boolean;
  canExport: boolean;
  switchRole: (role: UserRole, pin: string) => Promise<boolean>;
  setRole: (role: UserRole) => void;
  getRoleLabel: (role?: UserRole) => string;
  userName: string;
  isAuthenticated: boolean;
  login: (name: string, role: UserRole, pin: string) => Promise<boolean>;
  logout: () => void;
  lock: () => void;
  lastActivity: number;
  touchActivity: () => void;
}

const AccessControlContext = createContext<AccessContextValue | null>(null);
const USER_KEY = 'wab-tkd-auth-user-v1';
const LAST_ACTIVITY_KEY = 'wab-tkd-last-activity-v1';
const AUTO_LOCK_MS = 30 * 60 * 1000;

async function loadUsersSecure() {
  try {
    const secure = await secureGet(USER_KEY_SECURE);
    if (secure) { const parsed = JSON.parse(secure); if (Array.isArray(parsed)) return parsed; }
    const legacy = JSON.parse(localStorage.getItem('wab-tkd-users-v1') || '[]');
    if (Array.isArray(legacy) && legacy.length) {
      await secureSet(USER_KEY_SECURE, JSON.stringify(legacy));
      localStorage.removeItem('wab-tkd-users-v1');
      return legacy;
    }
  } catch {}
  return [];
}
async function saveUsersSecure(users: unknown[]) {
  await secureSet(USER_KEY_SECURE, JSON.stringify(users));
}

export function AccessControlProvider({ children }: { children: React.ReactNode }) {
  const [role, setRoleState] = useState<UserRole>(() => {
    const saved = localStorage.getItem(ROLE_KEY) as UserRole | null;
    return saved === 'ADMIN' || saved === 'SUPERVISOR' || saved === 'REFEREE' ? saved : 'REFEREE';
  });
  const [userName, setUserName] = useState(() => localStorage.getItem(USER_KEY) || '');
  // Authentication is intentionally session-only. A plaintext localStorage flag
  // must never be sufficient to bypass the PIN after an app restart/reload.
  const [isAuthenticated, setAuthenticated] = useState(false);
  const [lastActivity, setLastActivity] = useState(() => Number(localStorage.getItem(LAST_ACTIVITY_KEY) || Date.now()));

  useEffect(() => { localStorage.setItem(ROLE_KEY, role); }, [role]);
  const touchActivity = useCallback(() => { const now = Date.now(); setLastActivity(now); localStorage.setItem(LAST_ACTIVITY_KEY, String(now)); }, []);
  useEffect(() => {
    if (!isAuthenticated) return;
    const handler = () => touchActivity();
    window.addEventListener('pointerdown', handler); window.addEventListener('keydown', handler);
    const timer = window.setInterval(() => {
      const last = Number(localStorage.getItem(LAST_ACTIVITY_KEY) || Date.now());
      if (Date.now() - last >= AUTO_LOCK_MS) { setAuthenticated(false); logAudit('auto_lock', `Auto-locked session for ${userName || 'operator'}`); }
    }, 30000);
    return () => { window.removeEventListener('pointerdown', handler); window.removeEventListener('keydown', handler); window.clearInterval(timer); };
  }, [isAuthenticated, touchActivity, userName]);

  const login = useCallback(async (name: string, target: UserRole, pin: string) => {
    if (!name.trim() || !pin) return false;
    let valid = false;
    try {
      const users = await loadUsersSecure();
      if (Array.isArray(users) && users.length) {
        const account = users.find((u: any) => u.name?.toLowerCase() === name.trim().toLowerCase() && u.role === target && u.active !== false);
        if (account?.pinHash && account?.pinSalt) valid = await verifyPin(pin, account.pinSalt, account.pinHash);
        else if (account?.pin) {
          // One-time migration of legacy plaintext local accounts.
          valid = account.pin === pin;
          if (valid) {
            const salt = createSalt();
            const pinHash = await hashPin(pin, salt);
            const migrated = users.map((u: any) => u.id === account.id ? { ...u, pinHash, pinSalt: salt, pin: undefined } : u);
            await saveUsersSecure(migrated);
          }
        }
      } else {
        const record = await ensureRolePin(target);
        valid = await verifyPin(pin, record.pinSalt, record.pinHash);
      }
    } catch {}
    if (!valid) return false;
    setRoleState(target); setUserName(name.trim()); setAuthenticated(true);
    localStorage.setItem(USER_KEY, name.trim()); touchActivity(); setAuditActor(name.trim());
    logAudit('login', `${target} login`);
    return true;
  }, [touchActivity]);
  const logout = useCallback(() => { logAudit('logout', `${role} logout`); setAuthenticated(false); localStorage.removeItem(USER_KEY); setUserName(''); }, [role]);
  const lock = useCallback(() => { logAudit('manual_lock', `${role} session locked`); setAuthenticated(false); }, [role]);

  const switchRole = useCallback(async (target: UserRole, pin: string) => {
    if (!isAuthenticated) return false;
    const record = await ensureRolePin(target);
    if (!await verifyPin(pin, record.pinSalt, record.pinHash)) return false;
    setRoleState(target); setAuditActor(userName || 'operator'); touchActivity(); logAudit('role_switch', `Switched to ${target}`);
    return true;
  }, [isAuthenticated, touchActivity, userName]);

  const setRole = useCallback((target: UserRole) => setRoleState(target), []);

  const value = useMemo<AccessContextValue>(() => ({
    role,
    isReferee: true,
    isSupervisor: role === 'SUPERVISOR' || role === 'ADMIN',
    isAdmin: role === 'ADMIN',
    canOperate: true,
    canManageTournament: role !== 'REFEREE',
    canManageSystem: role === 'ADMIN',
    canRestore: role !== 'REFEREE',
    canFinalize: role !== 'REFEREE',
    canEditFinal: role === 'ADMIN',
    canExport: true,
    switchRole,
    setRole,
    getRoleLabel: (r = role) => r === 'ADMIN' ? 'ADMIN' : r === 'SUPERVISOR' ? 'SUPERVISOR' : 'REFEREE',
    userName, isAuthenticated, login, logout, lock, lastActivity, touchActivity,
  }), [role, switchRole, setRole, userName, isAuthenticated, login, logout, lock, lastActivity, touchActivity]);

  return <AccessControlContext.Provider value={value}>{children}</AccessControlContext.Provider>;
}

export function useAccessControl() {
  const ctx = useContext(AccessControlContext);
  if (!ctx) throw new Error('useAccessControl must be used inside AccessControlProvider');
  return ctx;
}

export function hasRouteAccess(role: UserRole, path: string) {
  if (path === '/admin') return role === 'ADMIN';
  if (path === '/tournament' || path === '/club-points' || path === '/control-room' || path === '/tournament-control' || path === '/tournament-intelligence' || path === '/tournament-operations' || path === '/tournament-finalization' || path === '/final-command' || path === '/tournament-dashboard' || path === '/qa-test-center') return role !== 'REFEREE';
  return true;
}
