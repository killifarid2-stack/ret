import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { createPortal } from 'react-dom';
import { Home, Settings, Gavel, Monitor, Users, Trophy, Globe, ShieldAlert, Radio, MapPin, GitBranch, Activity, BarChart3, Menu, ChevronDown, Swords, LayoutDashboard, ListChecks, ClipboardList, Settings2, Save } from 'lucide-react';
import { useI18n } from '@/lib/i18n';
import { useMatch } from '@/context/MatchContext';
import { getMatControlMode } from '@/lib/mat-status';
import { useAccessControl } from '@/context/AccessControlContext';
import ConnectionBadge from './ConnectionBadge';
import appIconUrl from '@/assets/app-icon.png';
import RoleSwitcher from './RoleSwitcher';
import BroadcastControl from './BroadcastControl';
import PublicDisplayControl from './PublicDisplayControl';

const HOME_ITEMS = [
  { path: '/operator', label: 'مباراة فردية', en: 'Individual Match', icon: Swords },
  { path: '/operator', label: 'الحكم الرئيسي', en: 'Operator', icon: Gavel },
  { path: '/scoreboard', label: 'شاشة الجمهور', en: 'Audience', icon: Monitor },
  { path: '/judge', label: 'الحكام', en: 'Judge', icon: Users },
  { path: '/tournament', label: 'البطولة', en: 'Tournament', icon: Trophy },
  { path: '/admin', label: 'الإدارة', en: 'Admin', icon: Settings },
  { path: '/', label: 'Par Équipe', en: 'Par Équipe', icon: Swords, state: { openParEquipe: true, scrollTo: 'par-equipe-archive' } },
] as const;

const OTHER_ITEMS = [
  { path: '/club-points', label: 'ترتيب الأندية', en: 'Club Ranking', icon: ShieldAlert },
  { path: '/control-room', label: 'غرفة التحكم', en: 'Control Room', icon: Radio },
  { path: '/tournament-control', label: 'مركز الشجرة', en: 'Bracket Control', icon: GitBranch },
  { path: '/tournament-intelligence', label: 'ذكاء البطولة', en: 'Tournament Intelligence', icon: Activity },
  { path: '/tournament-dashboard', label: 'إحصائيات البطولة', en: 'Tournament Dashboard', icon: BarChart3 },
  { path: '/award-screen', label: 'شاشات الجوائز', en: 'Award Animation Screens', icon: Trophy },
  { path: '/tournament-wall', label: 'شاشة البطولة', en: 'Tournament Wall', icon: Radio },
  { path: '/results-wall', label: 'شاشة النتائج', en: 'Results Wall', icon: Trophy },
  { path: '/tournament-operations', label: 'عمليات البطولة', en: 'Tournament Operations', icon: LayoutDashboard },
  { path: '/tournament-finalization', label: 'إنهاء البطولة', en: 'Tournament Finalization', icon: ListChecks },
  { path: '/final-command', label: 'مركز الأوامر النهائي', en: 'Final Command Center', icon: ClipboardList },
  { path: '/qa-test-center', label: 'مركز الاختبار', en: 'QA / Test Center', icon: Activity },
  { path: '/install', label: 'التثبيت', en: 'Install', icon: Settings2 },
] as const;

export default function TopNav() {
  const navigate = useNavigate();
  const location = useLocation();
  const { lang, setLang } = useI18n();
  const { state } = useMatch();
  const { role } = useAccessControl();
  const showControlRoom = getMatControlMode() === 'control_room';
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPos, setMenuPos] = useState({ left: 8, top: 48 });
  const menuRef = useRef<HTMLDivElement>(null);
  const navRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const updatePosition = () => {
      const r = menuRef.current?.getBoundingClientRect();
      if (!r) return;
      const width = Math.min(320, Math.max(240, window.innerWidth - 20));
      const menuMaxHeight = Math.min(Math.round(window.innerHeight * 0.72), 680);
      const left = Math.min(Math.max(10, r.left), Math.max(10, window.innerWidth - width - 10));
      const below = r.bottom + 6;
      const above = r.top - menuMaxHeight - 6;
      const top = below + menuMaxHeight <= window.innerHeight - 8
        ? below
        : Math.max(8, above);
      setMenuPos({ left, top });
    };
    const onClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (menuRef.current && !menuRef.current.contains(target) && !(target as HTMLElement)?.closest?.('[data-wab-top-menu]')) setMenuOpen(false);
    };
    updatePosition();
    window.addEventListener('resize', updatePosition);
    document.addEventListener('mousedown', onClickOutside);
    navRef.current?.addEventListener('scroll', updatePosition, { passive: true });
    return () => {
      window.removeEventListener('resize', updatePosition);
      document.removeEventListener('mousedown', onClickOutside);
      navRef.current?.removeEventListener('scroll', updatePosition);
    };
  }, [menuOpen]);

  const go = (path: string, state?: any) => {
    setMenuOpen(false);
    navigate(path, state ? { state } : undefined);
  };

  const direct = HOME_ITEMS.filter(item => !(item.path === '/admin' && role !== 'ADMIN'));
  const extras = OTHER_ITEMS.filter(item => item.path !== '/control-room' || showControlRoom || role !== 'REFEREE');

  return (
    <nav
      ref={navRef}
      className="wab-top-nav-scroll w-full flex items-center gap-1.5 px-2 py-2 overflow-x-auto overflow-y-visible whitespace-nowrap"
      onWheel={(e) => {
        // Desktop users can move the complete top command bar left/right with
        // the mouse wheel. This keeps the right-side controls reachable on
        // smaller windows instead of clipping them permanently.
        if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
          e.preventDefault();
          navRef.current?.scrollBy({ left: e.deltaY, behavior: 'auto' });
        }
      }}
      aria-label={lang === 'ar' ? 'شريط التنقل القابل للتحريك' : 'Horizontally scrollable navigation'}
    >
      <button onClick={() => go('/')} className="app-no-drag flex items-center gap-1.5 pe-2 shrink-0 group" title="WAB-TKD">
        <img src={appIconUrl} alt="WAB-TKD" className="w-7 h-7 rounded-md shrink-0" style={{ boxShadow: '0 0 12px hsl(45 93% 58% / 0.4)' }} />
        <span className="font-display font-black text-[10px] sm:text-xs tracking-wider brand-metal-text">WAB-TKD</span>
      </button>
      <button onClick={() => go('/')} className={`app-no-drag flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold shrink-0 transition-colors ${location.pathname === '/' ? 'bg-[hsl(var(--primary))]/20 text-[hsl(var(--primary))]' : 'bg-[hsl(var(--secondary))]/70 text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]'}`} title={lang === 'ar' ? 'الرئيسية' : 'Home'}>
        <Home size={13} /><span className="hidden lg:inline">{lang === 'ar' ? 'الرئيسية' : 'Home'}</span>
      </button>
      {direct.map((item, index) => {
        const Icon = item.icon;
        const itemState = (item as any).state as any;
        const active = location.pathname === item.path && (!itemState || location.state?.scrollTo === itemState.scrollTo || location.state?.openParEquipe === itemState.openParEquipe);
        return <button key={`${item.path}-${index}`} onClick={() => go(item.path, itemState)} className={`app-no-drag flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold shrink-0 transition-colors ${active ? 'bg-[hsl(var(--primary))]/20 text-[hsl(var(--primary))]' : 'bg-[hsl(var(--secondary))]/55 text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] hover:bg-[hsl(var(--secondary))]'}`} title={lang === 'ar' ? item.label : item.en}>
          <Icon size={12} /><span>{lang === 'ar' ? item.label : item.en}</span>
        </button>;
      })}
      <button
        onClick={() => {
          // SAVE is context-aware: on Tournament it persists the complete
          // tournament/category using TournamentManager's new multi-weight
          // save path; on Operator it keeps the official SAVE MATCH flow.
          if (location.pathname === '/tournament') {
            window.dispatchEvent(new CustomEvent('wab-save-tournament'));
          } else if (location.pathname === '/' && (location.state as any)?.openParEquipe) {
            // Par Équipe HOME has its own tournament archive. SAVE here must
            // save the complete team tournament/setup, never SAVE MATCH.
            window.dispatchEvent(new CustomEvent('wab-save-parequipe-tournament'));
          } else if (location.pathname === '/operator') {
            window.dispatchEvent(new CustomEvent('wab-save-match'));
          } else {
            window.dispatchEvent(new CustomEvent('wab-save-context'));
          }
        }}
        className="app-no-drag flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-black shrink-0 border border-[hsl(var(--gold))]/45 bg-[hsl(var(--gold))]/12 text-[hsl(var(--gold))] hover:bg-[hsl(var(--gold))]/20 shadow-[0_0_16px_rgba(242,193,78,.10)] transition-all"
        title={location.pathname === '/tournament' ? (lang === 'ar' ? 'حفظ البطولة والفئة' : 'Save Tournament / Category') : (lang === 'ar' ? 'حفظ' : 'Save')}
      >
        <Save size={12} /><span>SAVE</span>
      </button>
      <div className="app-no-drag relative shrink-0" ref={menuRef}>
        <button onClick={() => setMenuOpen(v => !v)} className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold shrink-0 transition-colors ${menuOpen ? 'bg-[hsl(var(--primary))]/20 text-[hsl(var(--primary))]' : 'bg-[hsl(var(--secondary))]/70 text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]'}`} aria-expanded={menuOpen} title={lang === 'ar' ? 'باقي النوافذ' : 'Other windows'}>
          <Menu size={13} /><span>{lang === 'ar' ? 'القائمة' : 'MENU'}</span><ChevronDown size={12} className={menuOpen ? 'rotate-180' : ''} />
        </button>
        {menuOpen && createPortal(
          <div data-wab-top-menu className="fixed z-[100000] w-[min(320px,calc(100vw-20px))] max-h-[72vh] overflow-y-auto overscroll-contain rounded-xl border border-white/10 bg-[#0a0c12] p-1.5 shadow-[0_24px_70px_rgba(0,0,0,.65)]" style={{ left: menuPos.left, top: menuPos.top }}>
            {extras.map(item => { const Icon = item.icon; const active = location.pathname === item.path; return <button key={item.path} onClick={() => go(item.path)} className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-xs font-semibold text-start transition-colors ${active ? 'bg-[hsl(var(--primary))]/20 text-[hsl(var(--primary))]' : 'text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] hover:bg-white/5'}`}><Icon size={14} /><span>{lang === 'ar' ? item.label : item.en}</span></button>; })}
          </div>, document.body
        )}
      </div>
      {state.matNumber ? <span className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[hsl(var(--gold))]/15 text-[hsl(var(--gold))] text-xs font-bold shrink-0"><MapPin size={12} /> {lang === 'ar' ? 'بساط' : 'MAT'} {String(state.matNumber).padStart(2, '0')}</span> : null}
      <div className="app-no-drag ms-auto flex items-center gap-1.5 shrink-0"><PublicDisplayControl /><BroadcastControl /><RoleSwitcher /><ConnectionBadge compact /><button onClick={() => setLang(lang === 'en' ? 'ar' : 'en')} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[hsl(var(--gold))]/10 text-[hsl(var(--gold))] text-xs font-semibold shrink-0"><Globe size={12} />{lang === 'en' ? 'العربية' : 'EN'}</button></div>
    </nav>
  );
}
