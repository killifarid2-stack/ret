import React, { useEffect, useRef, useState } from 'react';
import { KeyRound, ShieldCheck, X, LogOut, Lock, Eye, EyeOff, CheckCircle2, UserRound, ChevronRight, Radio, Activity, Clock3 } from 'lucide-react';
import { useAccessControl, UserRole } from '@/context/AccessControlContext';
import { toast } from 'sonner';
import appIconUrl from '@/assets/app-icon.png';

const roles: { value: UserRole; label: string; short: string; desc: string; accent: string }[] = [
  { value: 'REFEREE', label: 'REFEREE', short: 'LIVE CONTROL', desc: 'Scoring, calls and live match control', accent: 'blue' },
  { value: 'SUPERVISOR', label: 'SUPERVISOR', short: 'TOURNAMENT', desc: 'Tournament, recovery and finalization', accent: 'purple' },
  { value: 'ADMIN', label: 'ADMIN', short: 'SYSTEM', desc: 'Full system and configuration access', accent: 'gold' },
];

export default function RoleSwitcher() {
  const { role, userName, isAuthenticated, login, logout, lock, switchRole } = useAccessControl();
  const [open, setOpen] = useState(false);
  const [target, setTarget] = useState<UserRole>(role);
  const [pin, setPin] = useState('');
  const [name, setName] = useState(userName);
  const [mode, setMode] = useState<'login'|'role'>('login');

  const submit = async () => {
    if (mode === 'login') {
      if (await login(name, target, pin)) { toast.success(`Signed in as ${target}`); setPin(''); setOpen(false); }
      else toast.error('Invalid user name or PIN');
    } else {
      if (await switchRole(target, pin)) { toast.success(`${target} access enabled`); setPin(''); setOpen(false); }
      else toast.error('Invalid role PIN');
    }
  };

  const openLogin = () => { setMode('login'); setTarget('REFEREE'); setPin(''); setOpen(true); };
  const openRole = () => { setMode('role'); setTarget(role); setPin(''); setOpen(true); };

  if (!isAuthenticated) return <>
    <button onClick={openLogin} className="login-trigger" title="Open secure operator login">
      <ShieldCheck size={13}/><span>LOGIN</span><span className="login-trigger-dot" />
    </button>
    {open && <AuthModal name={name} setName={setName} target={target} setTarget={setTarget} pin={pin} setPin={setPin} onSubmit={submit} onClose={() => setOpen(false)} mode="login" />}
  </>;

  return <>
    <div className="flex items-center gap-1">
      <button onClick={openRole} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[hsl(var(--gold))]/10 text-[hsl(var(--gold))] text-xs font-bold shrink-0" title="Change operator role"><ShieldCheck size={12}/> {role} · {userName}</button>
      <button onClick={() => lock()} className="p-1.5 rounded-lg bg-white/5 text-muted-foreground hover:text-white" title="Lock session"><Lock size={12}/></button>
      <button onClick={() => { logout(); toast.success('Logged out'); }} className="p-1.5 rounded-lg bg-white/5 text-muted-foreground hover:text-red-300" title="Logout"><LogOut size={12}/></button>
    </div>
    {open && <AuthModal name={name} setName={setName} target={target} setTarget={setTarget} pin={pin} setPin={setPin} onSubmit={submit} onClose={() => setOpen(false)} mode={mode} />}
  </>;
}

function AuthModal({ name, setName, target, setTarget, pin, setPin, onSubmit, onClose, mode }: any) {
  const [showPin, setShowPin] = useState(false);
  const [now, setNow] = useState(new Date());
  const pinRef = useRef<HTMLInputElement>(null);
  useEffect(() => { const id = window.setInterval(() => setNow(new Date()), 1000); return () => window.clearInterval(id); }, []);
  useEffect(() => { window.setTimeout(() => (mode === 'login' ? document.querySelector<HTMLInputElement>('[data-login-name]') : pinRef.current)?.focus(), 80); }, [mode]);

  const selected = roles.find(r => r.value === target) || roles[0];
  const digits = ['1','2','3','4','5','6','7','8','9','0'];
  const addDigit = (d: string) => setPin((pin + d).slice(0, 8));
  const clearPin = () => setPin('');

  return <div className="login-modal-backdrop" role="dialog" aria-modal="true" aria-label={mode === 'login' ? 'Operator Login' : 'Change Role'}>
    <div className="login-modal-shell">
      <button className="login-modal-close" onClick={onClose} aria-label="Close"><X size={18}/></button>

      <div className="login-hero">
        <div className="login-orbit login-orbit-a" />
        <div className="login-orbit login-orbit-b" />
        <div className="login-brand-mark"><img src={appIconUrl} alt="WAB-TKD" /></div>
        <div className="login-brand-copy">
          <div className="login-kicker"><Radio size={11}/> WAB-TKD COMMAND SYSTEM</div>
          <h2>{mode === 'login' ? 'OPERATOR LOGIN' : 'CHANGE ROLE'}</h2>
          <p>{mode === 'login' ? 'Secure access to tournament operations' : 'Re-authenticate to change operator permissions'}</p>
        </div>
        <div className="login-live-badge"><span /> SYSTEM READY</div>
      </div>

      <div className="login-content">
        <div className="login-status-strip">
          <span><Activity size={12}/> SECURE SESSION</span>
          <span><Clock3 size={12}/> {now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
        </div>

        {mode === 'login' && <div className="login-field-block">
          <label>OPERATOR NAME</label>
          <div className="login-input-wrap"><UserRound size={16}/><input data-login-name autoComplete="off" value={name} onChange={e=>setName(e.target.value)} onKeyDown={e=>e.key==='Enter'&&pinRef.current?.focus()} placeholder="Main Referee" /></div>
        </div>}

        <div className="login-section-title"><span>SELECT ACCESS LEVEL</span><small>STEP 1</small></div>
        <div className="login-role-grid">
          {roles.map((r: any) => <button key={r.value} onClick={() => setTarget(r.value)} className={`login-role-card ${target === r.value ? 'is-selected' : ''} login-role-${r.accent}`}>
            <div className="login-role-top"><span className="login-role-radio">{target === r.value ? <CheckCircle2 size={15}/> : <span />}</span><strong>{r.label}</strong><ChevronRight size={14}/></div>
            <span className="login-role-short">{r.short}</span><span className="login-role-desc">{r.desc}</span>
          </button>)}
        </div>

        <div className="login-section-title"><span>SECURITY PIN</span><small>STEP 2</small></div>
        <div className="login-pin-row">
          <div className="login-pin-input"><KeyRound size={16}/><input ref={pinRef} value={pin} onChange={e=>setPin(e.target.value.replace(/\D/g,'').slice(0,8))} onKeyDown={e=>e.key==='Enter'&&onSubmit()} type={showPin ? 'text' : 'password'} inputMode="numeric" maxLength={8} placeholder="Enter PIN" autoComplete="off" /><button onClick={()=>setShowPin(v=>!v)} type="button" aria-label={showPin ? 'Hide PIN' : 'Show PIN'}>{showPin ? <EyeOff size={15}/> : <Eye size={15}/>}</button></div>
          <button onClick={onSubmit} className="login-submit"><span>{mode === 'login' ? 'ENTER SYSTEM' : 'UNLOCK ROLE'}</span><ChevronRight size={17}/></button>
        </div>
        <div className="login-keypad">
          {digits.map(d => <button key={d} onClick={()=>addDigit(d)}>{d}</button>)}
          <button onClick={clearPin} className="login-keypad-clear">CLEAR</button>
        </div>

        <div className="login-footer"><span><CheckCircle2 size={12}/> Selected: <b>{selected.label}</b></span><span>LOCAL AUTHENTICATION</span></div>
      </div>
    </div>
  </div>;
}
