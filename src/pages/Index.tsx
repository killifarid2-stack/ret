import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Gavel, Monitor, Users, Trophy, Settings, Globe, Swords, UserPlus, Plus, Trash2, Camera, Link as LinkIcon, CalendarDays, MapPin, Save } from 'lucide-react';
import { useI18n } from '@/lib/i18n';
import { useMatch } from '@/context/MatchContext';
import { MatchConfig, DEFAULT_CONFIG } from '@/types/tkd';
import { supabase } from '@/integrations/supabase/client';
import { loadAllLocalTournaments, saveTournamentLocal } from '@/lib/tournament-local';
import { AGE_GROUPS, GENDERS, getWeightCategories } from '@/lib/tkd-data';
import { buildParEquipeArchiveTeams, upsertParEquipeTournamentArchive } from '@/lib/par-equipe-tournament-archive';
import { isParEquipeMatch, saveParEquipeMatch, saveParEquipeSafeSnapshot } from '@/lib/par-equipe-save';
import appIconUrl from '@/assets/app-icon.png';
import CountryPicker from '@/components/CountryPicker';
import ParEquipeTournamentArchive from '@/components/ParEquipeTournamentArchive';
import { toast } from 'sonner';

interface TeamPlayer {
  id: string;
  name: string;
  nationality: string;
  maxRounds: number;
  playedRounds: number;
  photo?: string;
  playerNumber?: number;
  seedNumber?: number;
  weight?: number;
  isReserve?: boolean;
}

interface Team {
  id?: string;
  name: string;
  players: TeamPlayer[];
  photo?: string;
  clubPhoto?: string;
  club?: string;
  country?: string;
}

const NavCard = ({ icon: Icon, title, description, onClick, color }: { 
  icon: any; title: string; description: string; onClick: () => void; color: string 
}) => (
  <button onClick={onClick}
    className="panel p-5 text-center hover:border-[hsl(var(--primary))]/30 transition-all group active:scale-[0.98] flex flex-col items-center">
    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-3 ${color}`}>
      <Icon size={26} />
    </div>
    <h3 className="font-display text-sm font-bold text-[hsl(var(--foreground))] group-hover:text-[hsl(var(--primary))] transition-colors">{title}</h3>
    <p className="text-[11px] text-[hsl(var(--muted-foreground))] mt-1">{description}</p>
  </button>
);

export default function Index() {
  const navigate = useNavigate();
  const location = useLocation();
  const { lang, setLang, t } = useI18n();
  const { state, dispatch } = useMatch();
  const [view, setView] = useState<'home' | 'parequipe'>('home');

  // Nav-bar shortcut: TopNav's "Par Équipe" button navigates here with
  // { scrollTo: 'par-equipe-archive' } in router state so the operator
  // lands straight on the archive section below instead of having to
  // scroll through the whole Home page to find it every time.
  useEffect(() => {
    const navState = (location.state as { scrollTo?: string; openParEquipe?: boolean } | null);
    if (navState?.openParEquipe) setView('parequipe');
    const target = navState?.scrollTo;
    if (!target) return;
    const el = document.getElementById(target);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    // Keep the router state while Par Équipe is open so the global TopNav
    // can correctly route SAVE to the Par Équipe tournament-save action.
    // It is harmless if this state remains until the next navigation.
  }, [location.state]);

  // Fix (reported bug): opening ADMIN or TOURNAMENT from HOME used to land
  // straight inside a Par Équipe match setup whenever the last thing worked
  // on anywhere in the app (a previous test match, a recovered session,
  // etc.) had left the single shared match state in team mode — because
  // AdminPanel/TournamentManager just render whatever `state.config`
  // currently is, they never forced a mode choice of their own. HOME's
  // Admin/Tournament cards are meant to be a fresh, mode-neutral entry
  // point (the dedicated "Par Équipe" card already exists for the
  // team-mode flow), so only these two cards reset competitionMode back to
  // the default before navigating. This never touches an in-progress Par
  // Équipe match reached any other way (Par Équipe card, Saved Matches
  // restore, recovery) and never fires unless competitionMode is actually
  // stuck on 'par_equipe'.
  const goToFreshAdminOrTournament = (path: '/admin' | '/tournament') => {
    if (state.config?.competitionMode === 'par_equipe') {
      dispatch({ type: 'UPDATE_CONFIG', config: { competitionMode: DEFAULT_CONFIG.competitionMode } });
    }
    navigate(path);
  };

  // --- Par Équipe setup draft, auto-saved to localStorage ------------------
  // Previously nothing here was persisted until the operator actually
  // pressed "Start Match" — everything typed (rosters, photos, team/club
  // names, country) lived only in this component's in-memory React state.
  // A crash, an accidental refresh, or just closing the app mid-setup lost
  // it all, with no way back except re-entering every player by hand. Every
  // change below is now mirrored to localStorage, and restored on mount, so
  // the setup screen always reopens exactly where it was left.
  const DRAFT_KEY = 'tkd-parequipe-draft';
  type ParEquipeDraft = {
    teamMode: 'rotation' | 'substitution'; teams: Team[]; teamRules: Partial<MatchConfig>;
    teamCompetitionName: string; teamMatchNumber: string; tournamentId?: string; ageGroup?: string; gender?: 'male'|'female'; weightCategory?: string; eventDate?: string; eventLocation?: string;
  };
  const loadDraft = (): Partial<ParEquipeDraft> => {
    try { return JSON.parse(localStorage.getItem(DRAFT_KEY) || '{}'); } catch { return {}; }
  };
  const draft = loadDraft();

  const [teamMode, setTeamMode] = useState<'rotation' | 'substitution'>(draft.teamMode || 'rotation');
  const [teams, setTeams] = useState<Team[]>(draft.teams?.length ? draft.teams : [{ name: 'Team A', players: [] }, { name: 'Team B', players: [] }]);
  // Par équipe Competition Rules — the same set of rules the Tournament
  // screen lets you configure per-competition, available here too since a
  // team match may need its own timing/round count, and unlike an
  // individual match, teams may want the round to keep going even if one
  // athlete piles up warnings or a big point gap opens up (score belongs to
  // the whole team over several players) — so those two rules stay
  // independently toggleable.
  const [showTeamRules, setShowTeamRules] = useState(false);
  const [teamRules, setTeamRules] = useState<Partial<MatchConfig>>(draft.teamRules || {});
  const [lastTeamPointGap, setLastTeamPointGap] = useState(DEFAULT_CONFIG.pointGap);
  const [lastTeamGamjeomLimit, setLastTeamGamjeomLimit] = useState(DEFAULT_CONFIG.gamjeomLimit);
  // Optional — grouping several team matches under the same competition name
  // (and giving each a match number) is what makes the match strip at the
  // top of the Operator screen show them together.
  const [teamCompetitionName, setTeamCompetitionName] = useState(draft.teamCompetitionName || '');
  const [teamMatchNumber, setTeamMatchNumber] = useState(draft.teamMatchNumber || '');
  const [teamTournamentId, setTeamTournamentId] = useState(draft.tournamentId || '');
  const [teamAgeGroup,setTeamAgeGroup]=useState(draft.ageGroup||'senior');
  const [teamGender,setTeamGender]=useState<'male'|'female'>(draft.gender||'male');
  const [teamWeightCategory,setTeamWeightCategory]=useState(draft.weightCategory||getWeightCategories(draft.ageGroup||'senior',draft.gender||'male')[0]||'');
  const [teamEventDate,setTeamEventDate]=useState(draft.eventDate||'');
  const [teamEventLocation,setTeamEventLocation]=useState(draft.eventLocation||'');

  useEffect(()=>{const list=getWeightCategories(teamAgeGroup,teamGender);if(!list.includes(teamWeightCategory))setTeamWeightCategory(list[0]||'');},[teamAgeGroup,teamGender]);

  // Debounced auto-save of the whole draft on any change — cheap (small
  // JSON blob, localStorage only) and means there's never more than a
  // fraction of a second of unsaved typing to lose.
  useEffect(() => {
    const id = setTimeout(() => {
      try {
        localStorage.setItem(DRAFT_KEY, JSON.stringify({teamMode,teams,teamRules,teamCompetitionName,teamMatchNumber,tournamentId:teamTournamentId,ageGroup:teamAgeGroup,gender:teamGender,weightCategory:teamWeightCategory,eventDate:teamEventDate,eventLocation:teamEventLocation} as ParEquipeDraft));
      } catch { /* storage full/unavailable — non-fatal, just no draft this time */ }
    }, 300);
    return () => clearTimeout(id);
  }, [teamMode, teams, teamRules, teamCompetitionName, teamMatchNumber, teamTournamentId, teamAgeGroup, teamGender, teamWeightCategory, teamEventDate, teamEventLocation]);

  // Explicit SAVE from the top navigation while the Par Équipe screen is open.
  // This is tournament-level persistence (teams + full roster + category/rules),
  // not the individual-match SAVE flow used by Operator/Main Referee.
  useEffect(() => {
    if (view !== 'parequipe') return;
    const onSaveParEquipeTournament = () => {
      const tournamentName = teamCompetitionName.trim() || `${teams[0]?.name || 'Team A'} vs ${teams[1]?.name || 'Team B'}`;
      const tournamentId = teamTournamentId || `local-par-${crypto.randomUUID()}`;
      if (!teamTournamentId) setTeamTournamentId(tournamentId);
      const teamData = teams.slice(0, 2).map((team, index) => ({
        id: team.id || `team-${index + 1}`,
        name: team.name || `Team ${index + 1}`,
        teamLogo: team.photo,
        clubLogo: team.clubPhoto,
        club: team.club,
        country: team.country,
      }));
      const archiveTeams = buildParEquipeArchiveTeams({
        teams: teams.slice(0, 2).map((team, index) => ({
          id: teamData[index].id,
          name: teamData[index].name,
          photo: team.photo,
          clubPhoto: team.clubPhoto,
          club: team.club,
          country: team.country,
          players: team.players || [],
        })),
      });
      const matchId = teamMatchNumber.trim() ? `direct-${teamMatchNumber.trim()}` : `setup-${tournamentId}`;
      const archiveMatch = {
        id: matchId,
        matchNumber: teamMatchNumber.trim() ? Number(teamMatchNumber.trim()) : undefined,
        round: 1,
        team1: teamData[0]?.name,
        team2: teamData[1]?.name,
        status: 'READY',
        weightCategory: teamWeightCategory || undefined,
        ageGroup: teamAgeGroup,
        gender: teamGender,
        tournamentId,
      };
      upsertParEquipeTournamentArchive({
        id: tournamentId,
        tournamentName,
        ageGroup: teamAgeGroup,
        gender: teamGender,
        weightCategory: teamWeightCategory,
        eventDate: teamEventDate || undefined,
        eventLocation: teamEventLocation || undefined,
        division: (teamRules as any).division,
        format: 'par_equipe',
        playMode: teamMode,
        teams: archiveTeams,
        matches: [archiveMatch],
      });

      // Also make the team tournament visible to the normal Tournament
      // archive without changing the Individual save path.
      saveTournamentLocal({
        id: tournamentId,
        name: tournamentName,
        gender: teamGender,
        weight_category: teamWeightCategory,
        age_group: teamAgeGroup,
        format: 'par_equipe',
        bracket_data: {
          mode: 'par_equipe',
          rules: teamRules,
          eventDate: teamEventDate,
          eventLocation: teamEventLocation,
          teamRosters: Object.fromEntries(teams.slice(0, 2).map((team, index) => [
            teamData[index]?.id || team.id,
            (team.players || []).map(player => ({
              name: player.name, nationality: player.nationality, photo: player.photo,
              playerNumber: player.playerNumber, seedNumber: player.seedNumber,
              rounds: player.maxRounds,
            })),
          ])),
          teamPlayMode: teamMode,
        },
        players: teamData.map(team => ({
          id: team.id, name: team.name, nationality: team.country || '',
          club: team.club || '', photo: team.teamLogo, clubLogo: team.clubLogo,
          teamLogo: team.teamLogo,
        })),
        created_at: new Date().toISOString(),
      });

      try {
        localStorage.setItem(DRAFT_KEY, JSON.stringify({
          teamMode, teams, teamRules, teamCompetitionName: tournamentName, teamMatchNumber, tournamentId,
          ageGroup: teamAgeGroup, gender: teamGender, weightCategory: teamWeightCategory,
          eventDate: teamEventDate, eventLocation: teamEventLocation,
        } as ParEquipeDraft));
      } catch {}
      toast.success(lang === 'ar' ? `✓ تم حفظ بطولة Par Équipe: ${tournamentName}` : `✓ Par Équipe tournament saved: ${tournamentName}`);
    };
    window.addEventListener('wab-save-parequipe-tournament', onSaveParEquipeTournament);
    return () => window.removeEventListener('wab-save-parequipe-tournament', onSaveParEquipeTournament);
  }, [view, teamCompetitionName, teams, teamRules, teamMatchNumber, teamTournamentId, teamAgeGroup, teamGender, teamWeightCategory, teamEventDate, teamEventLocation, teamMode, lang]);

  /** Explicit reset for when the operator genuinely wants a clean slate
   *  instead of resuming the last draft (e.g. starting a completely new
   *  pair of teams after a finished match). */
  const clearParEquipeDraft = () => {
    if (!confirm('مسح كل معلومات إعداد بار إيكيب الحالية والبدء من جديد؟')) return;
    localStorage.removeItem(DRAFT_KEY);
    setTeams([{ name: 'Team A', players: [] }, { name: 'Team B', players: [] }]);
    setTeamMode('rotation');
    setTeamRules({});
    setTeamCompetitionName('');
    setTeamMatchNumber('');
    setTeamTournamentId('');
    setTeamAgeGroup('senior'); setTeamGender('male'); setTeamWeightCategory(getWeightCategories('senior','male')[0]||''); setTeamEventDate(''); setTeamEventLocation('');
  };

  // Picking a saved tournament pulls in ITS Competition Rules directly —
  // same rules object the Tournament screen edits and saves — instead of
  // re-entering them by hand.
  const [savedTournaments, setSavedTournaments] = useState<{ id: string; name: string; rules: Partial<MatchConfig> }[]>([]);
  const [selectedTournamentId, setSelectedTournamentId] = useState('');

  useEffect(() => {
    (async () => {
      const localList = loadAllLocalTournaments().map(t => ({ id: t.id, name: t.name, rules: t.bracket_data?.rules ?? {} }));
      let cloudList: { id: string; name: string; rules: Partial<MatchConfig> }[] = [];
      try {
        const { data, error } = await supabase.from('tournaments').select('id, name, bracket_data');
        if (!error && data) cloudList = data.map((t: any) => ({ id: t.id, name: t.name, rules: t.bracket_data?.rules ?? {} }));
      } catch { /* offline/unconfigured — local list still works */ }
      const merged = [...cloudList, ...localList.filter(l => !cloudList.some(c => c.id === l.id))];
      setSavedTournaments(merged);
    })();
  }, []);
  const [newPlayerName, setNewPlayerName] = useState('');
  const [newPlayerNat, setNewPlayerNat] = useState('');
  const [newPlayerPhoto, setNewPlayerPhoto] = useState('');
  const [newPlayerNumber, setNewPlayerNumber] = useState('');
  const [newPlayerSeed, setNewPlayerSeed] = useState('');
  const [newPlayerWeight, setNewPlayerWeight] = useState('');
  const [newPlayerReserve, setNewPlayerReserve] = useState(false);
  const [activeTeam, setActiveTeam] = useState(0);

  const addTeamPlayer = () => {
    if (!newPlayerName.trim()) return;
    const player: TeamPlayer = {
      id: crypto.randomUUID(), name: newPlayerName.trim(), nationality: newPlayerNat.trim(), maxRounds: 1, playedRounds: 0, photo: newPlayerPhoto || undefined,
      playerNumber: newPlayerNumber.trim() ? Number(newPlayerNumber.trim()) : undefined,
      seedNumber: newPlayerSeed.trim() ? Number(newPlayerSeed.trim()) : undefined,
      weight: newPlayerWeight.trim() ? Number(newPlayerWeight.trim()) : undefined,
      isReserve: newPlayerReserve,
    };
    setTeams(prev => prev.map((t, i) => i === activeTeam ? { ...t, players: [...t.players, player] } : t));
    setNewPlayerName(''); setNewPlayerNat(''); setNewPlayerPhoto(''); setNewPlayerNumber(''); setNewPlayerSeed(''); setNewPlayerWeight(''); setNewPlayerReserve(false);
  };

  const addTeam = () => {
    setTeams(prev => [...prev, { name: `Team ${String.fromCharCode(65 + prev.length)}`, players: [] }]);
  };

  const startParEquipe = () => {
    try {
    // Previously this could be triggered with two blank teams (no name, no
    // players) and it would still navigate straight to the live operator
    // screen with nothing to call/substitute/score against. Block it here
    // with a clear message instead of letting an empty match go "live".
    const missing: string[] = [];
    if (!teams[0]?.name?.trim()) missing.push('اسم الفريق الأول');
    if (!teams[1]?.name?.trim()) missing.push('اسم الفريق الثاني');
    if (!teams[0]?.players.length) missing.push(`لائحة لاعبي ${teams[0]?.name || 'الفريق الأول'} (فارغة)`);
    if (!teams[1]?.players.length) missing.push(`لائحة لاعبي ${teams[1]?.name || 'الفريق الثاني'} (فارغة)`);
    if (missing.length > 0) {
      toast.error('ما تقدرش تبدئي مباراة بار إيكيب هكذا', {
        description: `خاصك: ${missing.join(' • ')}`,
      });
      return;
    }
    const rosterFormat = teamRules.parEquipeRosterFormat ?? DEFAULT_CONFIG.parEquipeRosterFormat;
    if (rosterFormat !== 'custom') {
      const requiredActive = rosterFormat === '4+1' ? 4 : 5;
      for (const team of teams.slice(0, 2)) {
        const active = team.players.filter(p => !p.isReserve);
        const reserves = team.players.filter(p => p.isReserve);
        if (active.length !== requiredActive || reserves.length > 1) {
          toast.error('صيغة فريق بار إيكيب غير مكتملة', { description: `${team.name}: المطلوب ${requiredActive} لاعبين أساسيين + احتياط واحد كحد أقصى.` });
          return;
        }
      }
    }
    if (teamRules.parEquipeWeightLimitEnabled) {
      const limit = Number(teamRules.parEquipeWeightLimit ?? 0);
      if (limit > 0) {
        for (const team of teams.slice(0, 2)) {
          const active = team.players.filter(p => !p.isReserve);
          const missingWeight = active.filter(p => !(typeof p.weight === 'number' && p.weight > 0));
          const total = active.reduce((sum, p) => sum + (p.weight || 0), 0);
          if (missingWeight.length) {
            toast.error('وزن لاعب ناقص', { description: `أدخل وزن جميع اللاعبين الأساسيين في ${team.name} قبل بدء المباراة.` });
            return;
          }
          if (total > limit) {
            toast.error('مجموع وزن الفريق يتجاوز الحد', { description: `${team.name}: ${total.toFixed(1)} kg > ${limit} kg.` });
            return;
          }
        }
      }
    }
    // In rotation mode, the match must have enough rounds for every roster
    // player (on either team) to play out their full "Max Rounds" — the
    // match keeps rotating through the whole roster instead of stopping at
    // a best-of-N decision, so total rounds = the longer team's sum.
    const totalRotationRounds = teamMode === 'rotation'
      ? Math.max(
          teams[0]?.players.reduce((sum, p) => sum + Math.max(1, p.maxRounds || 1), 0) || 0,
          teams[1]?.players.reduce((sum, p) => sum + Math.max(1, p.maxRounds || 1), 0) || 0,
          1
        )
      : undefined;
    // If 2 teams, go directly to operator with par_equipe mode
    dispatch({
      type: 'INIT_MATCH',
      config: {
        ...DEFAULT_CONFIG,
        scoreResetPerRound: false,
        warningResetPerRound: false,
        competitionMode: 'par_equipe',
        ...teamRules,
        // Rotation mode is decided by point total across ALL rounds, never
        // by a best-of-N round majority, so there's no tie to break with an
        // extra golden round — and `rounds` must fit the whole roster.
        ...(teamMode === 'rotation' ? { rounds: totalRotationRounds, goldenRound: false } : {}),
      },
    });
    if (teams[0]?.players[0]) {
      dispatch({ type: 'SET_PLAYER', color: 'chung', name: teams[0].players[0].name, nationality: teams[0].players[0].nationality, club: teams[0].club, playerNumber: teams[0].players[0].playerNumber, seedNumber: teams[0].players[0].seedNumber, photoUrl: teams[0].players[0].photo });
    }
    if (teams[1]?.players[0]) {
      dispatch({ type: 'SET_PLAYER', color: 'hong', name: teams[1].players[0].name, nationality: teams[1].players[0].nationality, club: teams[1].club, playerNumber: teams[1].players[0].playerNumber, seedNumber: teams[1].players[0].seedNumber, photoUrl: teams[1].players[0].photo });
    }
    if (teamMode === 'rotation') {
      // Each round uses the next player in that team's list, in order —
      // the score keeps accumulating for the team the whole match.
      dispatch({
        type: 'SET_TEAM_ROSTER',
        teamMode: 'rotation',
        roster: {
          chung: teams[0]?.players.map(p => ({ name: p.name, nationality: p.nationality, rounds: Math.max(1, p.maxRounds || 1), photo: p.photo, playerNumber: p.playerNumber, seedNumber: p.seedNumber })) ?? [],
          hong: teams[1]?.players.map(p => ({ name: p.name, nationality: p.nationality, rounds: Math.max(1, p.maxRounds || 1), photo: p.photo, playerNumber: p.playerNumber, seedNumber: p.seedNumber })) ?? [],
        },
      });
    } else {
      // Same two players start the match, but either can be manually
      // substituted mid-match (see the Substitute buttons on the operator screen).
      // We still pass the full roster along so the substitution picker can
      // offer the rest of each team's bench instead of a blind text entry.
      dispatch({
        type: 'SET_TEAM_ROSTER',
        teamMode: 'substitution',
        roster: {
          chung: teams[0]?.players.map(p => ({ name: p.name, nationality: p.nationality, photo: p.photo, playerNumber: p.playerNumber, seedNumber: p.seedNumber })) ?? [],
          hong: teams[1]?.players.map(p => ({ name: p.name, nationality: p.nationality, photo: p.photo, playerNumber: p.playerNumber, seedNumber: p.seedNumber })) ?? [],
        },
      });
    }
    const archiveName=teamCompetitionName.trim()||`${teams[0].name} vs ${teams[1].name}`;
    dispatch({type:'SET_MATCH_INFO',competitionName:archiveName,matchNumber:teamMatchNumber.trim()?Number(teamMatchNumber.trim()):undefined,weightCategory:teamWeightCategory||undefined,ageGroup:teamAgeGroup,gender:teamGender,teamNames:{chung:teams[0].name,hong:teams[1].name},teamLogos:{chung:teams[0].photo,hong:teams[1].photo},clubLogos:{chung:teams[0].clubPhoto,hong:teams[1].clubPhoto},teamCountry:{chung:teams[0].country,hong:teams[1].country},eventDate:teamEventDate||undefined,eventLocation:teamEventLocation||undefined});
    // Archive is persistence, never a prerequisite for opening the live operator.
    // A storage/cloud failure must not crash the match-start route.
    try {
      upsertParEquipeTournamentArchive({tournamentName:archiveName,ageGroup:teamAgeGroup,gender:teamGender,weightCategory:teamWeightCategory,eventDate:teamEventDate||undefined,eventLocation:teamEventLocation||undefined,format:'par_equipe',playMode:teamMode,teams:buildParEquipeArchiveTeams({teams}),matches:teamMatchNumber?[{id:`direct-${teamMatchNumber}`,matchNumber:Number(teamMatchNumber),round:1,team1:teams[0].name,team2:teams[1].name}]:[]});
    } catch (archiveError) {
      console.warn('[Par Équipe] archive write skipped during match start', archiveError);
    }
    navigate('/operator');
    } catch (error) {
      console.error('[Par Équipe] start failed', error);
      toast.error(lang === 'ar' ? 'تعذر فتح مباراة بار إيكيب. تحقق من بيانات الفريقين ثم أعد المحاولة.' : 'Could not open the Par Équipe match. Check both team rosters and try again.');
    }
  };

  const handleSaveParEquipeMatch = () => {
    if (!isParEquipeMatch(state)) {
      toast.error(lang === 'ar' ? 'لا توجد مباراة Par Équipe نشطة للحفظ' : 'No active Par Équipe match to save');
      return;
    }
    const saved = saveParEquipeMatch(state);
    saveParEquipeSafeSnapshot(state, 'referee_safe');
    if (saved) toast.success(lang === 'ar' ? '✓ تم حفظ مباراة Par Équipe' : '✓ Par Équipe match saved');
  };

  if (view === 'parequipe') {
    return (
      <div className="min-h-screen gradient-dark p-6">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="font-display text-2xl font-bold text-[hsl(var(--primary))] flex items-center gap-2">
                <Users size={24} /> {t('parEquipe')}
              </h1>
              <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1">{t('teamMatch')} — {teams.length} {t('teamsCountLabel')}</p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => { window.dispatchEvent(new CustomEvent('wab-open-parequipe-add')); window.setTimeout(() => document.getElementById('parequipe-add-match')?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 30); }}
                className="px-4 py-2 rounded-xl bg-[hsl(var(--primary))]/15 text-[hsl(var(--primary))] border-2 border-[hsl(var(--primary))]/40 text-xs font-black shadow-[0_0_18px_hsl(var(--primary)/0.12)] hover:bg-[hsl(var(--primary))]/25 active:scale-95 transition-all"
                title={lang === 'ar' ? 'إضافة مباراة Par Équipe' : 'Add Par Équipe match'}
              >
                <Plus size={13} className="inline mr-1" /> ADD
              </button>
              <button
                type="button"
                onClick={handleSaveParEquipeMatch}
                disabled={!isParEquipeMatch(state)}
                className="px-4 py-2 rounded-xl bg-emerald-400/10 text-emerald-300 border-2 border-emerald-400/35 text-xs font-black disabled:opacity-35 disabled:cursor-not-allowed hover:bg-emerald-400/20 active:scale-95 transition-all"
                title={lang === 'ar' ? 'حفظ مباراة Par Équipe الحالية' : 'Save current Par Équipe match'}
              >
                <Save size={13} className="inline mr-1" /> SAVE MATCH
              </button>
              <button
                type="button"
                onClick={() => window.dispatchEvent(new CustomEvent('wab-save-parequipe-tournament'))}
                className="px-4 py-2 rounded-xl bg-[hsl(var(--gold))] text-black border-2 border-[hsl(var(--gold))] text-xs font-black shadow-[0_0_22px_hsl(var(--gold)/0.34)] hover:shadow-[0_0_30px_hsl(var(--gold)/0.55)] hover:brightness-110 active:scale-95 transition-all"
                title={lang === 'ar' ? 'حفظ بطولة Par Équipe' : 'Save Par Équipe tournament'}
              >
                <Save size={13} className="inline mr-1" /> SAVE
              </button>
              <button onClick={() => { setView('home'); navigate('/', { replace: true, state: {} }); }} className="px-3 py-1.5 rounded-lg bg-[hsl(var(--secondary))] text-[hsl(var(--muted-foreground))] text-xs font-semibold">← {t('home')}</button>
              <button onClick={clearParEquipeDraft} title={t('startFreshTitle')}
                className="px-3 py-1.5 rounded-lg bg-[hsl(var(--destructive))]/10 text-[hsl(var(--destructive))] text-xs font-semibold">
                {t('startFresh')}
              </button>
              <button onClick={() => setLang(lang === 'en' ? 'ar' : 'en')}
                className="px-3 py-1.5 rounded-lg bg-[hsl(var(--gold))]/10 text-[hsl(var(--gold))] text-xs font-semibold">
                <Globe size={12} className="inline mr-1" />{lang === 'en' ? 'العربية' : 'EN'}
              </button>
            </div>
          </div>

          {/* This whole setup is auto-saved as you type (localStorage) —
              reopening this screen (even after a crash or accidental
              refresh) restores everything exactly where it was left. */}
          <div className="text-[10px] text-[hsl(var(--muted-foreground))] -mt-4 mb-4 flex items-center gap-1">
            💾 {t('autoSavingDraft')}
          </div>

          {/* Saved Par Équipe Tournaments archive — read-only, requested
              separately from the SAVE MATCH feature: a browsable index of
              every team + roster for every Par Équipe tournament ever
              played, without opening each match individually. Lives right
              here in the Par Équipe window per the confirmed placement. */}
          <div id="par-equipe-archive">
            <ParEquipeTournamentArchive />
          </div>

          <div className="panel p-4 mb-4"><div className="flex items-center gap-2 mb-3"><Trophy size={14} className="text-[hsl(var(--gold))]"/><div><h3 className="font-display text-xs font-bold">{t('teamCategoryTitle')}</h3><p className="text-[10px] text-[hsl(var(--muted-foreground))]">{t('teamCategorySubtitle')}</p></div></div><div className="grid grid-cols-1 md:grid-cols-3 gap-3"><div><label className="text-xs text-[hsl(var(--muted-foreground))] font-semibold block mb-1">{t('ageGroup')}</label><select value={teamAgeGroup} onChange={e=>setTeamAgeGroup(e.target.value)} className="w-full px-3 py-2 rounded-lg bg-[hsl(var(--secondary))] border border-[hsl(var(--border))] text-sm">{AGE_GROUPS.map(a=><option key={a.value} value={a.value}>{a.label}</option>)}</select></div><div><label className="text-xs text-[hsl(var(--muted-foreground))] font-semibold block mb-1">{t('gender')}</label><select value={teamGender} onChange={e=>setTeamGender(e.target.value as 'male'|'female')} className="w-full px-3 py-2 rounded-lg bg-[hsl(var(--secondary))] border border-[hsl(var(--border))] text-sm">{GENDERS.map(g=><option key={g.value} value={g.value}>{lang==='ar'?(g.value==='female'?'إناث':'ذكور'):g.label}</option>)}</select></div><div><label className="text-xs text-[hsl(var(--muted-foreground))] font-semibold block mb-1">{t('weightCategory')}</label><select value={teamWeightCategory} onChange={e=>setTeamWeightCategory(e.target.value)} className="w-full px-3 py-2 rounded-lg bg-[hsl(var(--secondary))] border border-[hsl(var(--border))] text-sm">{getWeightCategories(teamAgeGroup,teamGender).map(w=><option key={w} value={w}>{w}</option>)}</select></div></div><div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3"><div><label className="text-xs text-[hsl(var(--muted-foreground))] font-semibold block mb-1"><CalendarDays size={11} className="inline me-1"/>{t('eventDateLabel')}</label><input value={teamEventDate} onChange={e=>setTeamEventDate(e.target.value)} placeholder="2026-08-21" className="w-full px-3 py-2 rounded-lg bg-[hsl(var(--secondary))] border border-[hsl(var(--border))] text-sm"/></div><div><label className="text-xs text-[hsl(var(--muted-foreground))] font-semibold block mb-1"><MapPin size={11} className="inline me-1"/>{t('locationLabel')}</label><input value={teamEventLocation} onChange={e=>setTeamEventLocation(e.target.value)} placeholder="City — Country" className="w-full px-3 py-2 rounded-lg bg-[hsl(var(--secondary))] border border-[hsl(var(--border))] text-sm"/></div></div></div>

          {/* Team-play mode */}
          <div className="panel p-4 mb-4">
            <h3 className="font-display text-xs text-[hsl(var(--muted-foreground))] mb-2">{t('teamMatchTypeLabel')}</h3>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => setTeamMode('rotation')}
                className={`text-start p-3 rounded-lg border-2 transition-all ${teamMode === 'rotation' ? 'border-[hsl(var(--primary))] bg-[hsl(var(--primary))]/10' : 'border-[hsl(var(--border))]'}`}>
                <div className="font-display font-bold text-sm text-[hsl(var(--foreground))]">لكل لاعب جولته</div>
                <div className="text-[11px] text-[hsl(var(--muted-foreground))] mt-1">كل فريق يحدد ترتيب لاعبيه — لاعب مختلف يلعب كل جولة، والنقاط تتراكم للفريق طوال المباراة.</div>
              </button>
              <button onClick={() => setTeamMode('substitution')}
                className={`text-start p-3 rounded-lg border-2 transition-all ${teamMode === 'substitution' ? 'border-[hsl(var(--primary))] bg-[hsl(var(--primary))]/10' : 'border-[hsl(var(--border))]'}`}>
                <div className="font-display font-bold text-sm text-[hsl(var(--foreground))]">تبديل وسط المباراة</div>
                <div className="text-[11px] text-[hsl(var(--muted-foreground))] mt-1">مباراة عادية (Best of 3)، مع إمكانية تبديل أي لاعب يدوياً في أي وقت من شاشة المشغّل.</div>
              </button>
            </div>
            {teamMode === 'rotation' && (
              <p className="text-[10px] text-[hsl(var(--gold))] mt-2">ترتيب اللاعبين في قائمة كل فريق أدناه هو ترتيب دخولهم للجولات (اللاعب الأول → الجولة 1، الثاني → الجولة 2...).</p>
            )}
          </div>

          {/* Optional grouping — pick an existing tournament to inherit its
              Competition Rules directly, and/or fill these in manually so
              this bout shows up alongside other team matches in the match
              strip at the top of the Operator screen (same competition
              name = same strip). */}
          <div className="panel p-4 mb-4">
            <h3 className="font-display text-xs text-[hsl(var(--muted-foreground))] mb-3">ربط المباراة ببطولة (اختياري)</h3>
            {savedTournaments.length > 0 && (
              <div className="mb-3">
                <label className="text-xs text-[hsl(var(--muted-foreground))] font-semibold block mb-1">اختر بطولة محفوظة (يطبّق قوانينها تلقائياً)</label>
                <select value={selectedTournamentId}
                  onChange={e => {
                    const id = e.target.value;
                    setSelectedTournamentId(id);
                    const tr = savedTournaments.find(x => x.id === id);
                    if (tr) { setTeamCompetitionName(tr.name); setTeamRules(tr.rules); }
                    else { setTeamCompetitionName(''); }
                  }}
                  className="w-full bg-[hsl(var(--secondary))]/50 border border-[hsl(var(--border))] rounded-lg px-3 py-2 text-sm text-[hsl(var(--foreground))]">
                  <option value="">— بدون (إدخال يدوي) —</option>
                  {savedTournaments.map(tr => <option key={tr.id} value={tr.id}>{tr.name}</option>)}
                </select>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-[hsl(var(--muted-foreground))] font-semibold block mb-1">اسم البطولة/الدورة</label>
                <input type="text" value={teamCompetitionName} onChange={e => { setTeamCompetitionName(e.target.value); setSelectedTournamentId(''); }}
                  placeholder={`${teams[0]?.name} vs ${teams[1]?.name}`}
                  className="w-full bg-[hsl(var(--secondary))]/50 border border-[hsl(var(--border))] rounded-lg px-3 py-2 text-sm text-[hsl(var(--foreground))]" />
              </div>
              <div>
                <label className="text-xs text-[hsl(var(--muted-foreground))] font-semibold block mb-1">رقم المباراة</label>
                <input type="number" value={teamMatchNumber} onChange={e => setTeamMatchNumber(e.target.value)}
                  className="w-full bg-[hsl(var(--secondary))]/50 border border-[hsl(var(--border))] rounded-lg px-3 py-2 text-sm text-[hsl(var(--foreground))]" />
              </div>
            </div>
            <p className="text-[10px] text-[hsl(var(--muted-foreground))] mt-2">
              استعمل نفس اسم البطولة لعدة مباريات جماعية متتالية ليظهر شريط المباريات في أعلى شاشة المشغّل.
            </p>
          </div>

          {/* Competition Rules — full set, same as the Tournament screen */}
          <div className="panel p-4 mb-4">
            <button onClick={() => setShowTeamRules(!showTeamRules)}
              className="text-xs font-display font-bold text-[hsl(var(--primary))] flex items-center gap-1">
              <Gavel size={12} /> Competition Rules {showTeamRules ? '▲' : '▼'}
            </button>
            <p className="text-[10px] text-[hsl(var(--muted-foreground))] mt-1">
              اضبط قوانين هذه المباراة الجماعية (المدد، عدد الجولات، فارق النقاط، حد الإنذارات...).
            </p>
            {showTeamRules && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3">
                <div>
                  <label className="text-xs text-[hsl(var(--muted-foreground))] font-semibold block mb-1">{t('rounds')}</label>
                  <input type="number" value={teamRules.rounds ?? DEFAULT_CONFIG.rounds}
                    onChange={e => setTeamRules({ ...teamRules, rounds: Number(e.target.value) })}
                    className="w-full bg-[hsl(var(--secondary))]/50 border border-[hsl(var(--border))] rounded-lg px-3 py-2 text-sm text-[hsl(var(--foreground))]" />
                </div>
                <div>
                  <label className="text-xs text-[hsl(var(--muted-foreground))] font-semibold block mb-1">{t('roundTime')}</label>
                  <input type="number" value={teamRules.roundTime ?? DEFAULT_CONFIG.roundTime}
                    onChange={e => setTeamRules({ ...teamRules, roundTime: Number(e.target.value) })}
                    className="w-full bg-[hsl(var(--secondary))]/50 border border-[hsl(var(--border))] rounded-lg px-3 py-2 text-sm text-[hsl(var(--foreground))]" />
                </div>
                <div>
                  <label className="text-xs text-[hsl(var(--muted-foreground))] font-semibold block mb-1">{t('restTime')}</label>
                  <input type="number" value={teamRules.restTime ?? DEFAULT_CONFIG.restTime}
                    onChange={e => setTeamRules({ ...teamRules, restTime: Number(e.target.value) })}
                    className="w-full bg-[hsl(var(--secondary))]/50 border border-[hsl(var(--border))] rounded-lg px-3 py-2 text-sm text-[hsl(var(--foreground))]" />
                </div>
                <div>
                  <label className="text-xs text-[hsl(var(--muted-foreground))] font-semibold flex items-center justify-between mb-1">
                    {t('gamjeomLimitLabel')}
                    <span className="flex items-center gap-1 font-normal">
                      <input type="checkbox" checked={teamRules.enforceGamjeomLimit ?? true} className="w-3.5 h-3.5 accent-primary"
                        onChange={e => setTeamRules({ ...teamRules, enforceGamjeomLimit: e.target.checked })} />
                      {t('enabledLabel')}
                    </span>
                  </label>
                  <input type="number" value={teamRules.gamjeomLimit ?? lastTeamGamjeomLimit} disabled={teamRules.enforceGamjeomLimit === false}
                    onChange={e => { const v = Number(e.target.value); setTeamRules({ ...teamRules, gamjeomLimit: v }); setLastTeamGamjeomLimit(v); }}
                    className="w-full bg-[hsl(var(--secondary))]/50 border border-[hsl(var(--border))] rounded-lg px-3 py-2 text-sm text-[hsl(var(--foreground))] disabled:opacity-40" />
                </div>
                <div>
                  <label className="text-xs text-[hsl(var(--muted-foreground))] font-semibold block mb-1">{t('penaltySchemeLabel')}</label>
                  <div className="flex rounded-lg overflow-hidden border border-[hsl(var(--border))]">
                    <button type="button" onClick={() => setTeamRules({ ...teamRules, penaltyScheme: 'binary' })}
                      className={`flex-1 px-2 py-2 text-xs font-semibold transition-colors ${(teamRules.penaltyScheme ?? 'binary') === 'binary' ? 'bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]' : 'bg-[hsl(var(--secondary))]/50 text-[hsl(var(--muted-foreground))]'}`}>
                      {t('penaltySchemeBinary')}
                    </button>
                    <button type="button" onClick={() => setTeamRules({ ...teamRules, penaltyScheme: 'single' })}
                      className={`flex-1 px-2 py-2 text-xs font-semibold transition-colors ${teamRules.penaltyScheme === 'single' ? 'bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]' : 'bg-[hsl(var(--secondary))]/50 text-[hsl(var(--muted-foreground))]'}`}>
                      {t('penaltySchemeSingle')}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="text-xs text-[hsl(var(--muted-foreground))] font-semibold flex items-center justify-between mb-1">
                    {t('pointGapLabel')}
                    <span className="flex items-center gap-1 font-normal">
                      <input type="checkbox" checked={(teamRules.pointGap ?? DEFAULT_CONFIG.pointGap) > 0} className="w-3.5 h-3.5 accent-primary"
                        onChange={e => {
                          if (e.target.checked) setTeamRules({ ...teamRules, pointGap: lastTeamPointGap });
                          else { const cur = teamRules.pointGap ?? DEFAULT_CONFIG.pointGap; if (cur > 0) setLastTeamPointGap(cur); setTeamRules({ ...teamRules, pointGap: 0 }); }
                        }} />
                      {t('enabledLabel')}
                    </span>
                  </label>
                  <input type="number" value={teamRules.pointGap ?? DEFAULT_CONFIG.pointGap} disabled={(teamRules.pointGap ?? DEFAULT_CONFIG.pointGap) === 0}
                    onChange={e => { const v = Number(e.target.value); setTeamRules({ ...teamRules, pointGap: v }); if (v > 0) setLastTeamPointGap(v); }}
                    className="w-full bg-[hsl(var(--secondary))]/50 border border-[hsl(var(--border))] rounded-lg px-3 py-2 text-sm text-[hsl(var(--foreground))] disabled:opacity-40" />
                </div>
                <div>
                  <label className="text-xs text-[hsl(var(--muted-foreground))] font-semibold block mb-1">{t('turningHeadPointsLabel')}</label>
                  <div className="flex rounded-lg overflow-hidden border border-[hsl(var(--border))]">
                    <button type="button" onClick={() => setTeamRules({ ...teamRules, turningHeadPoints: 5 })}
                      className={`flex-1 px-2 py-2 text-xs font-semibold transition-colors ${(teamRules.turningHeadPoints ?? DEFAULT_CONFIG.turningHeadPoints) === 5 ? 'bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]' : 'bg-[hsl(var(--secondary))]/50 text-[hsl(var(--muted-foreground))]'}`}>
                      {t('turningHeadFive')}
                    </button>
                    <button type="button" onClick={() => setTeamRules({ ...teamRules, turningHeadPoints: 6 })}
                      className={`flex-1 px-2 py-2 text-xs font-semibold transition-colors ${(teamRules.turningHeadPoints ?? DEFAULT_CONFIG.turningHeadPoints) === 6 ? 'bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]' : 'bg-[hsl(var(--secondary))]/50 text-[hsl(var(--muted-foreground))]'}`}>
                      {t('turningHeadSix')}
                    </button>
                  </div>
                  <p className="text-[9px] text-[hsl(var(--muted-foreground))] mt-1">{t('turningHeadPointsDesc')}</p>
                </div>
                <div>
                  <label className="text-xs text-[hsl(var(--muted-foreground))] font-semibold block mb-1">{t('parEquipeRosterFormatLabel')}</label>
                  <select value={teamRules.parEquipeRosterFormat ?? DEFAULT_CONFIG.parEquipeRosterFormat}
                    onChange={e => setTeamRules({ ...teamRules, parEquipeRosterFormat: e.target.value as 'custom'|'4+1'|'5+1' })}
                    className="w-full bg-[hsl(var(--secondary))]/50 border border-[hsl(var(--border))] rounded-lg px-3 py-2 text-sm text-[hsl(var(--foreground))]">
                    <option value="custom">{t('parEquipeRosterCustom')}</option>
                    <option value="4+1">{t('parEquipeRoster4')}</option>
                    <option value="5+1">{t('parEquipeRoster5')}</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-[hsl(var(--muted-foreground))] font-semibold block mb-1">{t('parEquipeTagSecondsLabel')}</label>
                  <input type="number" min={1} max={30} step={0.5} value={teamRules.parEquipeTagSeconds ?? DEFAULT_CONFIG.parEquipeTagSeconds}
                    onChange={e => setTeamRules({ ...teamRules, parEquipeTagSeconds: Number(e.target.value) })}
                    className="w-full bg-[hsl(var(--secondary))]/50 border border-[hsl(var(--border))] rounded-lg px-3 py-2 text-sm text-[hsl(var(--foreground))]" />
                </div>
                <div>
                  <label className="text-xs text-[hsl(var(--muted-foreground))] font-semibold flex items-center justify-between mb-1">
                    {t('parEquipeWeightLimitLabel')}
                    <input type="checkbox" checked={teamRules.parEquipeWeightLimitEnabled ?? DEFAULT_CONFIG.parEquipeWeightLimitEnabled} className="w-3.5 h-3.5 accent-primary"
                      onChange={e => setTeamRules({ ...teamRules, parEquipeWeightLimitEnabled: e.target.checked })} />
                  </label>
                  <input type="number" min={0} step={0.1} disabled={!teamRules.parEquipeWeightLimitEnabled}
                    value={teamRules.parEquipeWeightLimit ?? DEFAULT_CONFIG.parEquipeWeightLimit}
                    onChange={e => setTeamRules({ ...teamRules, parEquipeWeightLimit: Number(e.target.value) })}
                    className="w-full bg-[hsl(var(--secondary))]/50 border border-[hsl(var(--border))] rounded-lg px-3 py-2 text-sm text-[hsl(var(--foreground))] disabled:opacity-40" />
                  <p className="text-[9px] text-[hsl(var(--muted-foreground))] mt-1">{t('parEquipeWeightLimitDesc')}</p>
                </div>
                <div>
                  <label className="text-xs text-[hsl(var(--muted-foreground))] font-semibold block mb-1">{t('judgeCount')}</label>
                  <input type="number" min={1} max={4} value={teamRules.judgeCount ?? DEFAULT_CONFIG.judgeCount}
                    onChange={e => setTeamRules({ ...teamRules, judgeCount: Number(e.target.value) })}
                    className="w-full bg-[hsl(var(--secondary))]/50 border border-[hsl(var(--border))] rounded-lg px-3 py-2 text-sm text-[hsl(var(--foreground))]" />
                </div>
                <div>
                  <label className="text-xs text-[hsl(var(--muted-foreground))] font-semibold block mb-1">{t('ivrQuota')}</label>
                  <input type="number" min={0} value={teamRules.ivrQuota ?? DEFAULT_CONFIG.ivrQuota}
                    onChange={e => setTeamRules({ ...teamRules, ivrQuota: Number(e.target.value) })}
                    className="w-full bg-[hsl(var(--secondary))]/50 border border-[hsl(var(--border))] rounded-lg px-3 py-2 text-sm text-[hsl(var(--foreground))]" />
                </div>
                <div className="flex items-end pb-1">
                  <label className="flex items-center gap-1.5 text-xs font-semibold text-[hsl(var(--muted-foreground))]">
                    <input type="checkbox" checked={teamRules.goldenRound ?? DEFAULT_CONFIG.goldenRound} className="w-3.5 h-3.5 accent-primary"
                      onChange={e => setTeamRules({ ...teamRules, goldenRound: e.target.checked })} />
                    {t('goldenRoundTitle')}
                  </label>
                </div>
                <div className="flex items-end pb-1">
                  <label className="flex items-center gap-1.5 text-xs font-semibold text-[hsl(var(--muted-foreground))]">
                    <input type="checkbox" checked={teamRules.autoApproveJudgeScores ?? DEFAULT_CONFIG.autoApproveJudgeScores} className="w-3.5 h-3.5 accent-primary"
                      onChange={e => setTeamRules({ ...teamRules, autoApproveJudgeScores: e.target.checked })} />
                    {t('autoApproveTitle')}
                  </label>
                </div>
                <div className="flex items-end pb-1">
                  <label className="flex items-center gap-1.5 text-xs font-semibold text-[hsl(var(--muted-foreground))]" title={t('carryScoreDesc')}>
                    <input type="checkbox" checked={!(teamRules.scoreResetPerRound ?? false)} className="w-3.5 h-3.5 accent-primary"
                      onChange={e => setTeamRules({ ...teamRules, scoreResetPerRound: !e.target.checked })} />
                    {t('carryScoreTitle')} — {teamRules.scoreResetPerRound ? 'RESET EACH ROUND · WIN MORE ROUNDS' : 'CUMULATIVE · HIGHEST TOTAL WINS'}
                  </label>
                </div>
                <div className="flex items-end pb-1">
                  <label className="flex items-center gap-1.5 text-xs font-semibold text-[hsl(var(--muted-foreground))]" title="When points reset each round, the match winner is the team that wins more rounds. When points carry, the highest cumulative score wins.">
                    <input type="checkbox" checked={teamRules.warningResetPerRound ?? false} className="w-3.5 h-3.5 accent-primary"
                      onChange={e => setTeamRules({ ...teamRules, warningResetPerRound: e.target.checked })} />
                    Warnings reset each round
                  </label>
                </div>
              </div>
            )}
            <p className="text-[10px] text-[hsl(var(--muted-foreground))] mt-3">
              {t('teamRulesHint')}
            </p>
          </div>

          {/* Team logo — separate from any player photo below */}
          <div className="flex items-center gap-2 mb-3">
            <label className="relative shrink-0 cursor-pointer group" title="إضافة شعار الفريق (Team Logo)">
              {teams[activeTeam]?.photo ? (
                <img src={teams[activeTeam].photo} alt="" className="w-9 h-9 rounded-lg object-cover border border-[hsl(var(--border))]" />
              ) : (
                <div className="w-9 h-9 rounded-lg bg-[hsl(var(--secondary))] border border-dashed border-[hsl(var(--border))] flex items-center justify-center text-[hsl(var(--muted-foreground))] group-hover:border-[hsl(var(--primary))] group-hover:text-[hsl(var(--primary))] transition-colors">
                  <Camera size={15} />
                </div>
              )}
              <input type="file" accept="image/*" className="hidden" onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = (ev) => {
                  const dataUrl = ev.target?.result as string;
                  setTeams(prev => prev.map((t, i) => i === activeTeam ? { ...t, photo: dataUrl } : t));
                };
                reader.readAsDataURL(file);
                e.target.value = '';
              }} />
            </label>
            <button type="button" title="إضافة شعار الفريق برابط (Logo URL)"
              onClick={() => {
                const current = teams[activeTeam]?.photo || '';
                const url = window.prompt('رابط شعار الفريق (Team Logo URL):', /^https?:\/\//i.test(current) ? current : '');
                if (url === null) return;
                setTeams(prev => prev.map((t, i) => i === activeTeam ? { ...t, photo: url.trim() } : t));
              }}
              className="w-9 h-9 shrink-0 rounded-lg bg-[hsl(var(--secondary))] border border-dashed border-[hsl(var(--border))] flex items-center justify-center text-[hsl(var(--muted-foreground))] hover:border-[hsl(var(--primary))] hover:text-[hsl(var(--primary))] transition-colors">
              <LinkIcon size={13} />
            </button>
            <span className="text-xs text-[hsl(var(--muted-foreground))] shrink-0">شعار {teams[activeTeam]?.name}</span>
            <input value={teams[activeTeam]?.club || ''} onChange={e => {
                const val = e.target.value;
                setTeams(prev => prev.map((t, i) => i === activeTeam ? { ...t, club: val } : t));
              }} placeholder={t('clubPlaceholder')} className="flex-1 min-w-0 px-3 py-2 rounded-lg bg-[hsl(var(--secondary))] border border-[hsl(var(--border))] text-[hsl(var(--foreground))] text-sm" />
            <CountryPicker value={teams[activeTeam]?.country || ''}
              onChange={val => setTeams(prev => prev.map((t, i) => i === activeTeam ? { ...t, country: val } : t))}
              placeholder={t('countryLabel')} className="w-28 shrink-0" />
          </div>

          {/* Club logo — distinct from the team's own logo above (e.g. an
              academy/club badge shown as a smaller secondary mark next to
              the team's own crest on the call animation). */}
          <div className="flex items-center gap-2 mb-3">
            <label className="relative shrink-0 cursor-pointer group" title="إضافة شعار النادي (Club Logo)">
              {teams[activeTeam]?.clubPhoto ? (
                <img src={teams[activeTeam].clubPhoto} alt="" className="w-9 h-9 rounded-full object-cover border border-[hsl(var(--border))]" />
              ) : (
                <div className="w-9 h-9 rounded-full bg-[hsl(var(--secondary))] border border-dashed border-[hsl(var(--border))] flex items-center justify-center text-[hsl(var(--muted-foreground))] group-hover:border-[hsl(var(--primary))] group-hover:text-[hsl(var(--primary))] transition-colors">
                  <Camera size={13} />
                </div>
              )}
              <input type="file" accept="image/*" className="hidden" onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = (ev) => {
                  const dataUrl = ev.target?.result as string;
                  setTeams(prev => prev.map((t, i) => i === activeTeam ? { ...t, clubPhoto: dataUrl } : t));
                };
                reader.readAsDataURL(file);
                e.target.value = '';
              }} />
            </label>
            <button type="button" title="إضافة شعار النادي برابط (Club Logo URL)"
              onClick={() => {
                const current = teams[activeTeam]?.clubPhoto || '';
                const url = window.prompt('رابط شعار النادي (Club Logo URL):', /^https?:\/\//i.test(current) ? current : '');
                if (url === null) return;
                setTeams(prev => prev.map((t, i) => i === activeTeam ? { ...t, clubPhoto: url.trim() } : t));
              }}
              className="w-9 h-9 shrink-0 rounded-lg bg-[hsl(var(--secondary))] border border-dashed border-[hsl(var(--border))] flex items-center justify-center text-[hsl(var(--muted-foreground))] hover:border-[hsl(var(--primary))] hover:text-[hsl(var(--primary))] transition-colors">
              <LinkIcon size={13} />
            </button>
            <span className="text-xs text-[hsl(var(--muted-foreground))]">شعار النادي (Club Logo) — اختياري، منفصل عن شعار الفريق</span>
          </div>

          {/* Team tabs */}
          <div className="flex gap-2 mb-4">
            {teams.map((team, i) => (
              <button key={i} onClick={() => setActiveTeam(i)}
                className={`flex-1 py-3 rounded-xl font-display font-bold text-sm transition-all ${
                  activeTeam === i 
                    ? i === 0 ? 'bg-[hsl(var(--chung))] text-white' : 'bg-[hsl(var(--hong))] text-white'
                    : 'bg-[hsl(var(--secondary))] text-[hsl(var(--muted-foreground))]'
                }`}>
                <input value={team.name} onChange={e => setTeams(prev => prev.map((t, j) => j === i ? { ...t, name: e.target.value } : t))}
                  className="bg-transparent text-center w-full outline-none font-display font-bold" />
                <div className="text-xs opacity-60 mt-1">{team.players.length} players</div>
              </button>
            ))}
            <button onClick={addTeam} className="w-12 rounded-xl bg-[hsl(var(--secondary))] text-[hsl(var(--muted-foreground))] flex items-center justify-center">
              <Plus size={18} />
            </button>
          </div>

          {/* Add player */}
          <div className="panel p-4 mb-4">
            <h3 className="font-display text-xs text-[hsl(var(--muted-foreground))] mb-2">{t('addPlayer')} to {teams[activeTeam]?.name}</h3>
            <div className="flex gap-2">
              <label className="relative shrink-0 cursor-pointer group" title="إضافة صورة اللاعب">
                {newPlayerPhoto ? (
                  <img src={newPlayerPhoto} alt="" className="w-9 h-9 rounded-full object-cover border border-[hsl(var(--border))]" />
                ) : (
                  <div className="w-9 h-9 rounded-full bg-[hsl(var(--secondary))] border border-dashed border-[hsl(var(--border))] flex items-center justify-center text-[hsl(var(--muted-foreground))] group-hover:border-[hsl(var(--primary))] group-hover:text-[hsl(var(--primary))] transition-colors">
                    <Camera size={15} />
                  </div>
                )}
                <input type="file" accept="image/*" className="hidden" onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const reader = new FileReader();
                  reader.onload = (ev) => setNewPlayerPhoto(ev.target?.result as string);
                  reader.readAsDataURL(file);
                  e.target.value = '';
                }} />
              </label>
              <button type="button" title="إضافة صورة اللاعب برابط (URL)"
                onClick={() => {
                  const url = window.prompt('رابط صورة اللاعب (Photo URL):', /^https?:\/\//i.test(newPlayerPhoto) ? newPlayerPhoto : '');
                  if (url === null) return;
                  setNewPlayerPhoto(url.trim());
                }}
                className="w-9 h-9 shrink-0 rounded-full bg-[hsl(var(--secondary))] border border-dashed border-[hsl(var(--border))] flex items-center justify-center text-[hsl(var(--muted-foreground))] hover:border-[hsl(var(--primary))] hover:text-[hsl(var(--primary))] transition-colors">
                <LinkIcon size={13} />
              </button>
              <input value={newPlayerName} onChange={e => setNewPlayerName(e.target.value)} placeholder={t('playerName')}
                className="flex-1 px-3 py-2 rounded-lg bg-[hsl(var(--secondary))] border border-[hsl(var(--border))] text-[hsl(var(--foreground))] text-sm"
                onKeyDown={e => e.key === 'Enter' && addTeamPlayer()} />
              <CountryPicker value={newPlayerNat} onChange={setNewPlayerNat} placeholder={t('nationality')} className="w-24" />
              <input value={newPlayerNumber} onChange={e => setNewPlayerNumber(e.target.value)} placeholder="#" type="number"
                className="w-14 px-3 py-2 rounded-lg bg-[hsl(var(--secondary))] border border-[hsl(var(--border))] text-[hsl(var(--foreground))] text-sm" />
              <input value={newPlayerSeed} onChange={e => setNewPlayerSeed(e.target.value)} placeholder={t('seedLabel')} type="number"
                className="w-16 px-3 py-2 rounded-lg bg-[hsl(var(--secondary))] border border-[hsl(var(--border))] text-[hsl(var(--foreground))] text-sm" />
              <input value={newPlayerWeight} onChange={e => setNewPlayerWeight(e.target.value)} placeholder="kg" type="number" min={0} step={0.1}
                className="w-16 px-3 py-2 rounded-lg bg-[hsl(var(--secondary))] border border-[hsl(var(--border))] text-[hsl(var(--foreground))] text-sm" />
              <label className="flex items-center gap-1 text-[10px] text-[hsl(var(--muted-foreground))]">
                <input type="checkbox" checked={newPlayerReserve} onChange={e => setNewPlayerReserve(e.target.checked)} className="w-3.5 h-3.5 accent-primary" /> Reserve
              </label>
              <button onClick={addTeamPlayer} className="px-4 py-2 rounded-lg bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] font-semibold text-sm">
                <UserPlus size={16} />
              </button>
            </div>
          </div>

          {/* Player list */}
          <div className="panel p-4 mb-4">
            <h3 className="font-display text-xs text-[hsl(var(--muted-foreground))] mb-2">{teams[activeTeam]?.name} — {t('players')}</h3>
            <div className="space-y-1">
              {teams[activeTeam]?.players.map((p, i) => (
                <div key={p.id} className="flex items-center justify-between px-3 py-2 rounded-lg bg-[hsl(var(--secondary))]/50 text-sm">
                  <div className="flex items-center gap-3">
                    <span className="text-[hsl(var(--muted-foreground))] text-xs w-6">{i + 1}.</span>
                    <label className="relative shrink-0 cursor-pointer group" title="رفع صورة اللاعب">
                      {p.photo ? (
                        <img src={p.photo} alt={p.name} className="w-6 h-6 rounded-full object-cover border border-[hsl(var(--border))]" />
                      ) : (
                        <div className="w-6 h-6 rounded-full bg-[hsl(var(--muted))] flex items-center justify-center text-[9px] text-[hsl(var(--muted-foreground))] group-hover:bg-[hsl(var(--primary))]/20">
                          <Camera size={11} />
                        </div>
                      )}
                      <input type="file" accept="image/*" className="hidden" onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        const reader = new FileReader();
                        reader.onload = (ev) => {
                          const dataUrl = ev.target?.result as string;
                          setTeams(prev => prev.map((t, ti) => ti === activeTeam ? { ...t, players: t.players.map(pl => pl.id === p.id ? { ...pl, photo: dataUrl } : pl) } : t));
                        };
                        reader.readAsDataURL(file);
                        e.target.value = '';
                      }} />
                    </label>
                    <button type="button" title="إضافة صورة اللاعب برابط (URL)"
                      onClick={() => {
                        const url = window.prompt('رابط صورة اللاعب (Photo URL):', /^https?:\/\//i.test(p.photo || '') ? p.photo : '');
                        if (url === null) return;
                        setTeams(prev => prev.map((t, ti) => ti === activeTeam ? { ...t, players: t.players.map(pl => pl.id === p.id ? { ...pl, photo: url.trim() || undefined } : pl) } : t));
                      }}
                      className="text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--primary))] transition-colors">
                      <LinkIcon size={11} />
                    </button>
                    <span className="font-semibold text-[hsl(var(--foreground))]">{p.name}</span>
                    <span className="text-[hsl(var(--muted-foreground))] text-xs">{p.nationality}</span>
                    {p.playerNumber !== undefined && <span className="text-[hsl(var(--muted-foreground))] text-xs">#{p.playerNumber}</span>}
                    {p.seedNumber !== undefined && <span className="text-[hsl(var(--primary))] text-xs">Seed {p.seedNumber}</span>}
                    {p.weight !== undefined && <span className="text-[hsl(var(--muted-foreground))] text-xs">{p.weight} kg</span>}
                    {p.isReserve && <span className="text-[hsl(var(--warning))] text-[9px] font-bold">RESERVE</span>}
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-xs text-[hsl(var(--muted-foreground))]">Max Rounds:</label>
                    <select value={p.maxRounds} onChange={e => {
                      setTeams(prev => prev.map((t, ti) => ti === activeTeam ? {
                        ...t, players: t.players.map(pl => pl.id === p.id ? { ...pl, maxRounds: Number(e.target.value) } : pl)
                      } : t));
                    }} className="px-2 py-1 rounded bg-[hsl(var(--secondary))] border border-[hsl(var(--border))] text-[hsl(var(--foreground))] text-xs">
                      {[1, 2, 3, 4, 5].map(n => <option key={n} value={n}>{n}</option>)}
                    </select>
                    <label className="flex items-center gap-1 text-[9px] text-[hsl(var(--muted-foreground))]">
                      <input type="checkbox" checked={!!p.isReserve} onChange={e => setTeams(prev => prev.map((t, ti) => ti === activeTeam ? { ...t, players: t.players.map(pl => pl.id === p.id ? { ...pl, isReserve: e.target.checked } : pl) } : t))} className="w-3 h-3 accent-primary" /> Reserve
                    </label>
                    <button onClick={() => setTeams(prev => prev.map((t, ti) => ti === activeTeam ? { ...t, players: t.players.filter(pl => pl.id !== p.id) } : t))}
                      className="text-[hsl(var(--destructive))]/60 hover:text-[hsl(var(--destructive))]">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
              {teams[activeTeam]?.players.length === 0 && (
                <p className="text-xs text-[hsl(var(--muted-foreground))] text-center py-4">{t('noPlayersYet')}</p>
              )}
            </div>
          </div>

          {/* Start button */}
          <button onClick={startParEquipe} disabled={teams.filter(t => t.players.length > 0).length < 2}
            className="btn-power w-full py-4 rounded-xl font-display text-lg flex items-center justify-center gap-2">
            <Swords size={22} />
            {teams.length === 2 ? 'Start Direct Team Match' : `Start Tournament (${teams.length} teams)`}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen gradient-dark flex flex-col items-center justify-center p-6">
      {/* Language toggle */}
      <div className="absolute top-4 end-4 flex gap-2">
        <button onClick={() => setLang(lang === 'en' ? 'ar' : 'en')}
          className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[hsl(var(--gold))]/10 text-[hsl(var(--gold))] text-xs font-semibold">
          <Globe size={12} /> {lang === 'en' ? 'العربية' : 'English'}
        </button>
      </div>

      <div className="text-center mb-10 animate-slide-up">
        <div className="relative inline-flex items-center justify-center w-24 h-24 rounded-2xl mb-4 overflow-hidden"
          style={{ boxShadow: '0 0 46px hsl(45 93% 58% / 0.35), 0 0 90px hsl(0 72% 51% / 0.15), 0 0 90px hsl(217 91% 55% / 0.15)' }}>
          <img src={appIconUrl} alt="WAB-TKD" className="w-full h-full object-cover" />
        </div>
        <h1 className="font-display text-4xl font-black tracking-wide brand-metal-text">
          WAB-TKD
        </h1>
        <p className="text-[11px] font-display font-bold tracking-[0.3em] text-[hsl(var(--muted-foreground))] mt-2">
          WORLD ADVANCED BATTLE TAEKWONDO
        </p>
      </div>

      <div className="w-full max-w-4xl animate-slide-up" style={{ animationDelay: '0.1s' }}>
        {/* Main 3 sections */}
        <div className="grid grid-cols-3 gap-4 mb-4">
          <NavCard icon={Swords} title={t('individualMatchTitle')} description={t('individualMatchDesc')}
            onClick={() => navigate('/operator')} color="bg-[hsl(var(--gold))]/20 text-[hsl(var(--gold))]" />
          <NavCard icon={Users} title={t('parEquipe')} description={t('parEquipeDesc')}
            onClick={() => setView('parequipe')} color="bg-[hsl(var(--hong))]/20 text-[hsl(var(--hong))]" />
          <NavCard icon={Settings} title={t('admin')} description={t('configure')}
            onClick={() => goToFreshAdminOrTournament('/admin')} color="bg-[hsl(var(--primary))]/20 text-[hsl(var(--primary))]" />
        </div>
        
        {/* Secondary nav */}
        <div className="grid grid-cols-4 gap-3">
          <NavCard icon={Gavel} title={t('operator')} description={t('controlMatch')}
            onClick={() => navigate('/operator')} color="bg-[hsl(var(--gold))]/20 text-[hsl(var(--gold))]" />
          <NavCard icon={Monitor} title={t('scoreboard')} description={t('publicDisplay')}
            onClick={() => navigate('/scoreboard')} color="bg-[hsl(var(--success))]/20 text-[hsl(var(--success))]" />
          <NavCard icon={Users} title={t('judge')} description={t('sideRefScoring')}
            onClick={() => navigate('/judge')} color="bg-[hsl(var(--info))]/20 text-[hsl(var(--info))]" />
          <NavCard icon={Trophy} title={t('tournament')} description={t('knockoutBracket')}
            onClick={() => goToFreshAdminOrTournament('/tournament')} color="bg-[hsl(var(--hong))]/20 text-[hsl(var(--hong))]" />
        </div>
      </div>

      <div className="mt-10 text-center">
        <p className="text-[10px] text-[hsl(var(--muted-foreground))]">WAB-TKD v1.0 — Protector & Scoring System</p>
      </div>
    </div>
  );
}
