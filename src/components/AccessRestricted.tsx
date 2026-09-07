import React, { useState } from 'react';
import { KeyRound, Lock, ShieldAlert, Home } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAccessControl, UserRole } from '@/context/AccessControlContext';

const ROLE_LABEL: Record<UserRole, string> = {
  REFEREE: 'REFEREE',
  SUPERVISOR: 'SUPERVISOR',
  ADMIN: 'ADMIN',
};

// Shown in place of a protected route (Admin, Tournament, …) when the
// current role can't open it, instead of silently bouncing the operator
// to /operator (see ProtectedRoute in App.tsx). Lets them unlock the right
// role with a PIN right here — the page they asked for renders as soon as
// access is granted, no extra navigation involved.
export default function AccessRestricted({ path }: { path: string }) {
  const { role, isAuthenticated, userName, login, switchRole } = useAccessControl();
  const navigate = useNavigate();
  const required: UserRole = path === '/admin' ? 'ADMIN' : 'SUPERVISOR';
  const [name, setName] = useState(userName);
  const [target, setTarget] = useState<UserRole>(required);
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');

  const submit = async () => {
    const ok = isAuthenticated ? await switchRole(target, pin) : await login(name, target, pin);
    if (!ok) { setError(isAuthenticated ? 'رقم سري غير صحيح / Invalid PIN' : 'اسم أو رقم سري غير صحيح / Invalid name or PIN'); return; }
    setError('');
    setPin('');
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'hsl(var(--background, 222 47% 6%))' }}>
      <div className="w-full max-w-sm rounded-2xl border-2 p-6" style={{ borderColor: '#f2c14e', background: 'linear-gradient(160deg,#131318,#08080a)', boxShadow: '0 0 60px rgba(242,193,78,.2)' }}>
        <div className="flex items-center gap-2 mb-3" style={{ color: '#f2c14e' }}>
          <ShieldAlert size={20} />
          <span className="font-display font-black tracking-wide text-sm uppercase">
            وصول مقيّد — Access Restricted
          </span>
        </div>
        <p className="text-white/60 text-xs mb-4 leading-relaxed">
          هذه الصفحة تتطلب صلاحية {ROLE_LABEL[required]}{required === 'SUPERVISOR' ? ' أو ADMIN' : ''}. أنت حاليًا {ROLE_LABEL[role]}.
          <br />
          This page requires {ROLE_LABEL[required]}{required === 'SUPERVISOR' ? ' or ADMIN' : ''} access. You're currently {ROLE_LABEL[role]}.
        </p>

        {!isAuthenticated && (
          <div className="mb-3">
            <label className="text-xs font-semibold text-muted-foreground">USER NAME</label>
            <input autoFocus value={name} onChange={(e) => setName(e.target.value)}
              className="w-full mt-1 rounded-lg bg-secondary border border-border px-3 py-2 outline-none"
              placeholder="Main Referee" />
          </div>
        )}

        <div className="space-y-2 mb-4">
          {(['SUPERVISOR', 'ADMIN'] as UserRole[]).filter((r) => required === 'ADMIN' ? r === 'ADMIN' : true).map((r) => (
            <button key={r} type="button" onClick={() => setTarget(r)}
              className={`w-full text-left rounded-xl border p-3 ${target === r ? 'border-[hsl(var(--gold))] bg-[hsl(var(--gold))]/10' : 'border-border bg-secondary/40'}`}>
              <div className="font-bold text-sm">{r}</div>
            </button>
          ))}
        </div>

        <label className="text-xs font-semibold text-muted-foreground">PIN</label>
        <div className="flex gap-2 mt-1">
          <div className="flex-1 flex items-center gap-2 rounded-lg bg-secondary border border-border px-3">
            <KeyRound size={14} />
            <input value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 8))}
              onKeyDown={(e) => e.key === 'Enter' && submit()}
              type="password" inputMode="numeric" className="w-full bg-transparent py-2 outline-none" placeholder="PIN" />
          </div>
          <button type="button" onClick={submit} className="px-4 rounded-lg bg-[hsl(var(--gold))] text-black font-black text-xs">
            UNLOCK
          </button>
        </div>
        {error && <p className="mt-2 text-xs text-red-400">{error}</p>}

        <button type="button" onClick={() => navigate('/')}
          className="mt-4 w-full flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-bold border border-white/15 text-white/70">
          <Home size={13} /> العودة للرئيسية / Back to Home
        </button>
      </div>
    </div>
  );
}
