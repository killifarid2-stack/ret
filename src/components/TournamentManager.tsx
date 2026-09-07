import React, { useState, useRef, useEffect } from 'react';
import { Player, MatchStage, MatchConfig, DEFAULT_CONFIG } from '@/types/tkd';
import { generateBracket } from '@/lib/match-engine';
import { Plus, Trash2, Trophy, Shuffle, Users, Upload, Download, Swords, Medal, Crown, FolderOpen, Save, CloudUpload, RefreshCw, FileText, Archive, ClipboardList, Gavel, Camera, Link as LinkIcon, Circle } from 'lucide-react';
import MatchStrip from './MatchStrip';
import { useNavigate, useLocation } from 'react-router-dom';
import { TKD_COUNTRIES, AGE_GROUPS, GENDERS, COMPETITION_MODES, CLUB_POINTS, getWeightCategories, suggestAgeGroup, formatFreeWeight } from '@/lib/tkd-data';
import { supabase } from '@/integrations/supabase/client';
import { saveTournamentLocal, loadTournamentLocal, loadAllLocalTournaments, deleteTournamentLocal, isLocalTournamentId, getExternalDisplayColors } from '@/lib/tournament-local';
import { registerTournamentArchiveCategory } from '@/lib/tournament-archive-index';
import { buildParEquipeArchiveTeams, upsertParEquipeTournamentArchive } from '@/lib/par-equipe-tournament-archive';
import { orderEntrantsForFairBracket, separateSameClubFirstRound } from '@/lib/bracket-seeding';
import { generateSmartKnockout, generateSmartLeague } from '@/lib/tournament-matchmaker';
import { logAudit, getAuditLog } from '@/lib/audit-log';
import { loadAllMatchesLocal, loadMatchesLocal, saveMatchLocal } from '@/lib/match-local';
import { computeClubMedalTotals, hasPlacementRecord, recordPlacements, getPlacementRecords } from '@/lib/tournament-placements';
import { exportCertificatesPdf } from '@/lib/certificate-export';
import ResultView from './ResultView';
import { parseXlsxFirstSheet, parseXlsxFirstSheetWithImages } from '@/lib/xlsx-lite';
import { getCountryFlag } from '@/lib/flags';
import { getMatCount } from '@/lib/mat-status';
import { exportFullBackup, restoreFromBackup, runAutoBackupSnapshot, getLastAutoBackupTime, exportAutoBackupSnapshot } from '@/lib/backup';
import CountryPicker from './CountryPicker';
import CategoryMatchBrowser from './CategoryMatchBrowser';
import CategoryStatusArchive from './CategoryStatusArchive';
import TournamentFileCenter from './TournamentFileCenter';
import { useMatch } from '@/context/MatchContext';
import { useI18n } from '@/lib/i18n';
import { toast } from 'sonner';

interface BracketMatchDisplay {
  id: string; round: number; position: number;
  player1?: Player; player2?: Player; isBye: boolean;
  winner?: string; nextMatchId?: string;
}

interface ClubStanding {
  name: string; country: string; gold: number; silver: number; bronze: number; points: number;
}

interface LeagueMatch {
  id: string; matchNumber: number;
  player1: Player; player2: Player;
  winner?: string; score?: string;
}

interface LeagueStanding {
  player: Player;
  played: number;
  wins: number;
  losses: number;
  pointsFor: number;
  pointsAgainst: number;
  diff: number;
}

function computeLeagueStandings(matches: LeagueMatch[]): LeagueStanding[] {
  const byId = new Map<string, LeagueStanding>();
  const get = (p: Player) => {
    if (!byId.has(p.id)) byId.set(p.id, { player: p, played: 0, wins: 0, losses: 0, pointsFor: 0, pointsAgainst: 0, diff: 0 });
    return byId.get(p.id)!;
  };
  for (const m of matches) {
    if (!m.winner || !m.score) continue; // not played yet
    const [s1, s2] = m.score.split('-').map(Number);
    const chungScore = Number.isFinite(s1) ? s1 : 0;
    const hongScore = Number.isFinite(s2) ? s2 : 0;
    const st1 = get(m.player1);
    const st2 = get(m.player2);
    st1.played++; st2.played++;
    st1.pointsFor += chungScore; st1.pointsAgainst += hongScore;
    st2.pointsFor += hongScore; st2.pointsAgainst += chungScore;
    if (m.winner === 'chung') { st1.wins++; st2.losses++; } else { st2.wins++; st1.losses++; }
  }
  for (const st of byId.values()) st.diff = st.pointsFor - st.pointsAgainst;
  const standings = Array.from(byId.values());
  // Tiebreak: wins desc, then point differential desc, then head-to-head result.
  standings.sort((a, b) => {
    if (b.wins !== a.wins) return b.wins - a.wins;
    if (b.diff !== a.diff) return b.diff - a.diff;
    const h2h = matches.find(m =>
      (m.player1.id === a.player.id && m.player2.id === b.player.id) ||
      (m.player1.id === b.player.id && m.player2.id === a.player.id)
    );
    if (h2h && h2h.winner) {
      const aWonH2h = (h2h.player1.id === a.player.id && h2h.winner === 'chung') || (h2h.player2.id === a.player.id && h2h.winner === 'hong');
      return aWonH2h ? -1 : 1;
    }
    return 0;
  });
  return standings;
}

interface SavedTournament {
  id: string;
  name: string;
  gender: string;
  weight_category: string;
  age_group: string;
  format: string;
  status: string;
  created_at: string;
  bracket_data?: { mode: string; bracket: BracketMatchDisplay[] | null; league: LeagueMatch[] | null; rules?: Partial<MatchConfig>; eventLocation?: string; eventDate?: string; teamRosters?: Record<string, { id: string; name: string; nationality: string; rounds: number; playerNumber?: number; seedNumber?: number; photo?: string }[]>; teamPlayMode?: 'rotation' | 'substitution' } | null;
}

interface TournamentTemplate {
  id: string;
  name: string;
  format: string | null;
  age_group: string | null;
  gender: string | null;
  weight_category: string | null;
  substitution_mode: string | null;
}

export default function TournamentManager() {
  const { t: tr, lang } = useI18n();
  const navigate = useNavigate();
  const location = useLocation();
  const { state: matchState, dispatch } = useMatch();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [players, setPlayers] = useState<Player[]>([]);
  const [newName, setNewName] = useState('');
  const [newNat, setNewNat] = useState('');
  const [newClub, setNewClub] = useState('');
  const [newPlayerNumber, setNewPlayerNumber] = useState('');
  const [newSeedNumber, setNewSeedNumber] = useState('');
  const [newPhoto, setNewPhoto] = useState('');
  // Par Équipe only: the team's club/federation logo — a separate field
  // from newPhoto so team logos are never mixed up with player photos.
  const [newTeamLogo, setNewTeamLogo] = useState('');
  const [bracket, setBracket] = useState<BracketMatchDisplay[] | null>(null);
  const [leagueMatches, setLeagueMatches] = useState<LeagueMatch[] | null>(null);
  // Set when arriving from the Operator screen's "match finished, continue
  // tournament" flow — tells the effect below to auto-start the next ready
  // match instead of leaving the operator to pick one by hand.
  const [pendingAutoStart, setPendingAutoStart] = useState(false);
  const [pendingAutoStartMat, setPendingAutoStartMat] = useState<number | undefined>(undefined);
  const [pendingAssignedMatch, setPendingAssignedMatch] = useState<any | null>(null);
  const [tournamentName, setTournamentName] = useState('');
  // Shown on the audience calling screen ("JULY 15-20, 2027 | NEW YORK - USA").
  // Date defaults to today so the referee usually just needs to fill in the
  // location; both stay freely editable since a tournament may span several
  // days or a referee may want a custom format.
  const [eventLocation, setEventLocation] = useState('');
  const [eventDate, setEventDate] = useState(() => new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' }));
  const [locatingEvent, setLocatingEvent] = useState(false);
  const [ageGroup, setAgeGroup] = useState('senior');
  const [gender, setGender] = useState('male');
  const [weightCat, setWeightCat] = useState('');
  // Gender → Age Group → Weight Category browser: shows every match already
  // saved in a category and lets the organizer "Generate" a new one there
  // (Individual or Par Équipe) with just names — tournament/gender/age/
  // weight are auto-filled from the selected bucket. See category-library.ts.
  const [showCategoryBrowser, setShowCategoryBrowser] = useState(false);
  // Single-screen category status board (gender → age → every weight at
  // once, each a glowing status circle) — separate from the step-by-step
  // browser above; opens on top of it, never replaces it.
  const [showCategoryArchive, setShowCategoryArchive] = useState(false);
  // Free-entry mode: instead of picking Age Group + Weight Category from the
  // fixed dropdowns/lists, the organizer types a raw age (years) and weight
  // (kg) — the age group is then only *suggested* from the typed age (still
  // overridable in the dropdown), and the weight category string is built
  // from the typed number + under/over toggle. Tournaments saved before this
  // feature existed keep using the fixed WEIGHT_CATEGORIES lists untouched.
  const [useCustomCategory, setUseCustomCategory] = useState(false);
  const [customAge, setCustomAge] = useState('');
  const [customWeightSign, setCustomWeightSign] = useState<'-' | '+'>('-');
  const [customWeightAmount, setCustomWeightAmount] = useState('');
  const [mode, setMode] = useState('knockout');
  const [clubStandings, setClubStandings] = useState<ClubStanding[]>([]);
  const [countrySearch, setCountrySearch] = useState('');
  const [showCountryDropdown, setShowCountryDropdown] = useState(false);
  const [showPodium, setShowPodium] = useState(false);
  const [savedTournaments, setSavedTournaments] = useState<SavedTournament[]>([]);
  const [showAuditLog, setShowAuditLog] = useState(false);
  const [showSavedList, setShowSavedList] = useState(false);
  // Per-tournament Competition Rules — every match started from this
  // tournament's bracket/league will use these settings instead of whatever
  // was last configured in the operator's Admin panel.
  const [showRules, setShowRules] = useState(false);
  const [rules, setRules] = useState<Partial<MatchConfig>>({});
  const [lastRulesPointGap, setLastRulesPointGap] = useState(DEFAULT_CONFIG.pointGap);
  const [lastRulesGamjeomLimit, setLastRulesGamjeomLimit] = useState(DEFAULT_CONFIG.gamjeomLimit);
  const [currentTournamentId, setCurrentTournamentId] = useState<string | null>(null);
  // LEAGUE MEDAL POINTS (round-robin has no single "final match" event, so
  // — unlike Bracket — the organizer must define when the league is "done".
  // 'auto' = the moment every scheduled league match has a winner; 'manual'
  // = only when the referee/admin taps the explicit "End League & Award
  // Medals" button below. Stored per-tournament (bracket_data.leagueMedalTrigger)
  // so it travels with the tournament; defaults to 'manual' (the safer
  // choice — never guesses the organizer's intent) for tournaments saved
  // before this setting existed.
  const [leagueMedalTrigger, setLeagueMedalTrigger] = useState<'auto' | 'manual'>('manual');
  const [leagueMedalsRecorded, setLeagueMedalsRecorded] = useState(false);
  const [syncingId, setSyncingId] = useState<string | null>(null);
  // Item #1: same pattern already used in AdminPanel — a failed cloud save
  // used to only log to console, leaving the operator thinking everything
  // was saved when the tournament (or a player/club edit) never reached
  // the database. Surfaced here the same way, and stays visible until the
  // next attempt succeeds.
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveOkNotice, setSaveOkNotice] = useState(false);
  // "Saved Matches" — was only reachable from inside the Operator screen
  // (buried behind a running match), with no way to browse it from
  // Tournament/Admin at all, even though every finished match (however it
  // was started — Admin, Tournament bracket, or Par Équipe) already gets
  // cached here via saveMatchLocal, same as tournaments. This just exposes
  // that existing data, reusing the same ResultView used in Operator.
  const [showSavedMatches, setShowSavedMatches] = useState(false);

  // Item #6: automatic scheduled backup — every 15 minutes while this
  // screen is open (i.e. during an active tournament session), silently
  // snapshot everything into localStorage (no download dialog spam).
  const [lastAutoBackup, setLastAutoBackup] = useState<string | null>(() => {
    const t = getLastAutoBackupTime();
    return t ? new Date(t).toLocaleTimeString('ar-MA', { hour: '2-digit', minute: '2-digit' }) : null;
  });
  useEffect(() => {
    const runSnapshot = () => {
      runAutoBackupSnapshot()
        .then(({ createdAt }) => setLastAutoBackup(new Date(createdAt).toLocaleTimeString('ar-MA', { hour: '2-digit', minute: '2-digit' })))
        .catch(err => console.warn('Auto-backup snapshot failed:', err));
    };
    const AUTO_BACKUP_INTERVAL_MS = 15 * 60 * 1000;
    const initialTimer = setTimeout(runSnapshot, 60 * 1000);
    const interval = setInterval(runSnapshot, AUTO_BACKUP_INTERVAL_MS);
    return () => { clearTimeout(initialTimer); clearInterval(interval); };
  }, []);
  // Par Équipe tournaments: each entry in `players` IS one team (its `name`
  // is the team name). This map holds each team's roster — the individual
  // players and how many consecutive rounds each one plays — keyed by the
  // team's id, so bracket generation/rendering/save-load are reused as-is.
  const [teamRosters, setTeamRosters] = useState<Record<string, { id: string; name: string; nationality: string; rounds: number; playerNumber?: number; seedNumber?: number; photo?: string }[]>>({});
  // Par Équipe: does each roster player get a fixed number of consecutive
  // rounds ('rotation'), or do the two starting players play a normal
  // best-of-N match with manual mid-match substitutions from the bench
  // ('substitution')? Mirrors the choice on the standalone Par Équipe
  // quick-start page, now available from inside Tournament Manager too.
  const [teamPlayMode, setTeamPlayMode] = useState<'rotation' | 'substitution'>('rotation');
  // Tournament-level workload plan: each physical mat may be assigned one or
  // more weight categories. An empty list means the mat accepts all categories.
  const [matWeightAssignments, setMatWeightAssignments] = useState<Record<string, string[]>>({});
  const [activeRosterTeamId, setActiveRosterTeamId] = useState<string>('');
  const [newRosterName, setNewRosterName] = useState('');
  const [newRosterNat, setNewRosterNat] = useState('');
  const [newRosterNumber, setNewRosterNumber] = useState('');
  const [newRosterSeed, setNewRosterSeed] = useState('');
  const [newRosterPhoto, setNewRosterPhoto] = useState('');
  // Tournament Templates — save the current format/age-group/gender/weight/
  // substitution settings under a name, and reload them later (persisted in
  // Supabase so they're available across devices/sessions, not just this
  // browser's localStorage).
  const [templates, setTemplates] = useState<TournamentTemplate[]>([]);
  const [matPlanOpen, setMatPlanOpen] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const isParEquipe = mode === 'par_equipe';

  const weightCategories = getWeightCategories(ageGroup, gender);
  // When reopening/switching a saved tournament category, show only the
  // players registered for the currently selected gender/age/weight bucket.
  // The full `players` array remains intact so switching back to another
  // weight never deletes or loses its roster.
  const visiblePlayers = players.filter(p => {
    const category = (p.category || '').trim();
    return !weightCat || !category || category === weightCat;
  });

  // Free-entry mode: typing an age only *suggests* an age group (still
  // editable in the dropdown below), and typing a weight builds the
  // weight-category string directly.
  useEffect(() => {
    if (!useCustomCategory) return;
    if (customAge.trim() === '') return;
    const n = parseInt(customAge, 10);
    if (Number.isFinite(n) && n > 0) setAgeGroup(suggestAgeGroup(n));
  }, [customAge, useCustomCategory]);

  useEffect(() => {
    if (!useCustomCategory) return;
    setWeightCat(formatFreeWeight(customWeightSign, customWeightAmount));
  }, [customWeightSign, customWeightAmount, useCustomCategory]);

  useEffect(() => {
    loadSavedTournaments();
    loadTemplates();
    supabase.from('clubs').select('*').then(({ data }) => {
      if (data && data.length > 0) {
        setClubStandings(data.map(c => ({
          name: c.name, country: c.country || '', gold: c.gold || 0, silver: c.silver || 0, bronze: c.bronze || 0, points: c.points || 0,
        })));
      }
    });
  }, []);

  // MEDAL SYNC (B1 — see tournament-placements.ts): the `clubs` table has
  // always had gold/silver/bronze/points columns, but nothing in the app
  // ever wrote to them — they were read once above and stayed at 0
  // forever. Now that finals record real placements automatically, sync
  // those real counts into both the local display and the `clubs` table,
  // by club name (never inventing/removing a club row; only updating
  // medal counts on ones that already exist). Runs whenever the loaded
  // tournament or its bracket changes (a final may have just been
  // recorded).
  useEffect(() => {
    if (!currentTournamentId) return;
    const totals = computeClubMedalTotals(currentTournamentId);
    if (totals.length === 0) return;
    setClubStandings(prev => prev.map(c => {
      const t = totals.find(x => x.club.toLowerCase() === c.name.trim().toLowerCase());
      if (!t || (c.gold === t.gold && c.silver === t.silver && c.bronze === t.bronze)) return c;
      const points = t.gold * CLUB_POINTS.gold + t.silver * CLUB_POINTS.silver + t.bronze * CLUB_POINTS.bronze;
      supabase.from('clubs').update({ gold: t.gold, silver: t.silver, bronze: t.bronze, points }).eq('name', c.name).then(() => {});
      return { ...c, gold: t.gold, silver: t.silver, bronze: t.bronze, points };
    }));
  }, [currentTournamentId, bracket, leagueMedalsRecorded]);

  const loadTemplates = async () => {
    try {
      const { data, error } = await supabase.from('tournament_templates').select('*').order('created_at', { ascending: false });
      if (!error && data) setTemplates(data as TournamentTemplate[]);
    } catch {
      // Templates are a convenience feature — silently skip if offline/table
      // not yet migrated, rather than blocking the rest of the screen.
    }
  };

  const handleSaveTemplate = async () => {
    const name = window.prompt('اسم القالب (Template name):', tournamentName || '');
    if (!name || !name.trim()) return;
    try {
      const { error } = await supabase.from('tournament_templates').insert({
        name: name.trim(),
        format: mode,
        age_group: ageGroup,
        gender,
        weight_category: weightCat,
        substitution_mode: isParEquipe ? teamPlayMode : null,
      });
      if (error) throw error;
      await loadTemplates();
    } catch (err) {
      console.warn('Failed to save tournament template:', err);
      window.alert('تعذر حفظ القالب — تحقق من الاتصال بالإنترنت.');
    }
  };

  const handleLoadTemplate = (templateId: string) => {
    setSelectedTemplateId(templateId);
    if (!templateId) return;
    const t = templates.find(t => t.id === templateId);
    if (!t) return;
    if (t.format) setMode(t.format);
    if (t.age_group) setAgeGroup(t.age_group);
    if (t.gender) setGender(t.gender);
    if (t.weight_category) setWeightCat(t.weight_category);
    if (t.substitution_mode === 'rotation' || t.substitution_mode === 'substitution') setTeamPlayMode(t.substitution_mode);
    // A template is a ready-made category by definition, so make sure the
    // free-entry toggle isn't left on from a previous selection.
    setUseCustomCategory(false);
  };

  const loadSavedTournaments = async () => {
    const localList = loadAllLocalTournaments();
    let cloudList: any[] = [];
    try {
      const { data, error } = await supabase.from('tournaments').select('*').order('created_at', { ascending: false });
      if (!error && data) cloudList = data;
    } catch { /* offline/unconfigured — local list still works */ }

    // A tournament row does not contain its player roster in Supabase —
    // players live in the separate `players` table. The old loader therefore
    // replaced the rich local copy with the cloud row and the File Center
    // suddenly displayed PLAYERS = 0 / CLUBS = 0 even though the roster had
    // been saved correctly. Hydrate cloud tournaments with their players,
    // then merge cloud + local copies field-by-field so roster, colors and
    // offline bracket snapshots are never discarded.
    const cloudIds = cloudList.map(t => t.id).filter(Boolean);
    const playersByTournament = new Map<string, any[]>();
    if (cloudIds.length) {
      try {
        const { data: playerRows, error: playerError } = await supabase
          .from('players').select('*').in('tournament_id', cloudIds);
        if (!playerError) {
          for (const row of playerRows || []) {
            const list = playersByTournament.get(String(row.tournament_id)) || [];
            list.push({
              id: row.id, name: row.name, nationality: row.nationality || '', club: row.club || '',
              category: row.weight_category || '', photo: row.photo || undefined,
              playerNumber: row.player_number ?? undefined, seedNumber: row.seed_number ?? undefined,
              teamLogo: row.team_logo || undefined, clubLogo: row.club_logo || undefined,
            });
            playersByTournament.set(String(row.tournament_id), list);
          }
        }
      } catch { /* local embedded roster remains the fallback */ }
    }

    // Hydrate the local match cache from the cloud too. The File Center and
    // tournament statistics are intentionally synchronous/local-first; without
    // this bridge a tournament opened on another device had its bracket but
    // showed 0 completed matches.
    if (cloudIds.length) {
      try {
        const { data: cloudMatches, error: matchError } = await supabase
          .from('matches').select('*').in('tournament_id', cloudIds);
        if (!matchError) {
          for (const row of cloudMatches || []) {
            saveMatchLocal({
              ...(row as any), id: row.id, match_id: row.id, competition_name: row.competition_name || row.tournament_name || 'Tournament',
              match_number: row.match_number ?? 0, status: row.status || 'finished', winner: row.winner ?? null,
              tournament_id: row.tournament_id, weight_category: row.weight_category ?? null, gender: row.gender ?? null, age_group: row.age_group ?? null,
              match_stage: row.match_stage ?? null, chung_name: row.chung_name ?? null, hong_name: row.hong_name ?? null,
            } as any);
          }
        }
      } catch { /* local cache is still authoritative offline */ }
    }

    const localById = new Map(localList.map(t => [t.id, t]));
    const mergedCloud = cloudList.map((cloud: any) => {
      const local = localById.get(cloud.id) as any;
      const remotePlayers = playersByTournament.get(String(cloud.id)) || [];
      return {
        ...local,
        ...cloud,
        // Prefer a real cloud roster; otherwise preserve the locally embedded
        // roster saved by Tournament Manager.
        players: remotePlayers.length ? remotePlayers : (Array.isArray(local?.players) ? local.players : []),
        display_colors: cloud.display_colors || local?.display_colors,
        // Merge the durable local snapshot with the cloud snapshot instead of
        // replacing it wholesale. Cloud rows may lag one save behind while
        // the local copy already contains matchRecords/replay/roster data.
        bracket_data: { ...(local?.bracket_data || {}), ...(cloud.bracket_data || {}),
          matchRecords: (Array.isArray(cloud.bracket_data?.matchRecords) && cloud.bracket_data.matchRecords.length) ? cloud.bracket_data.matchRecords : (local?.bracket_data?.matchRecords || []),
          rosterSnapshot: (Array.isArray(cloud.bracket_data?.rosterSnapshot) && cloud.bracket_data.rosterSnapshot.length) ? cloud.bracket_data.rosterSnapshot : (local?.bracket_data?.rosterSnapshot || []),
        },
        created_at: cloud.created_at || local?.created_at || new Date().toISOString(),
        updated_at: cloud.updated_at || local?.updated_at,
      };
    });
    const merged = [...mergedCloud, ...localList.filter(l => !cloudList.some(c => c.id === l.id))]
      .sort((a, b) => (b.updated_at || b.created_at || '').localeCompare(a.updated_at || a.created_at || ''));
    setSavedTournaments(merged as SavedTournament[]);
    const continueId = (location.state as any)?.continueTournamentId;
    const autoStartNext = !!(location.state as any)?.autoStartNext;
    const assignedMatch = (location.state as any)?.assignedMatch || null;
    if (continueId) {
      const t = merged.find((t: any) => t.id === continueId);
      if (t) {
        loadTournament(t as SavedTournament);
        // handleStartMatch reads bracket/leagueMatches/mode/etc. from
        // component state, which loadTournament only *schedules* an update
        // for — it isn't readable yet in this same synchronous call. Flag
        // it instead and let the effect below fire once that state has
        // actually landed (all set together at the end of loadTournament).
        if (assignedMatch) setPendingAssignedMatch({ ...assignedMatch, matNumber: (location.state as any)?.matNumber });
        else if (autoStartNext) { setPendingAutoStartMat((location.state as any)?.matNumber); setPendingAutoStart(true); }
      }
      // Clear the navigation state so a manual refresh/back doesn't re-trigger this.
      navigate(location.pathname, { replace: true, state: {} });
    }
  };

  // A Control Center assignment is authoritative for this physical mat.
  // It prevents two mats from both claiming the same ready bracket slot.
  useEffect(() => {
    if (!pendingAssignedMatch) return;
    if (bracket) {
      const m = bracket.find(x => x.id === pendingAssignedMatch.bracket_match_id);
      if (m?.player1 && m?.player2 && !m.winner && !m.isBye) {
        setPendingAssignedMatch(null);
        const idx = bracket.findIndex(x => x.id === m.id);
        handleStartMatch(m.player1, m.player2, idx + 1, m.round, Math.max(...bracket.map(b => b.round)), m.id, pendingAssignedMatch.matNumber);
        return;
      }
    }
    if (leagueMatches.length) {
      const m = leagueMatches.find(x => x.id === pendingAssignedMatch.bracket_match_id);
      if (m?.player1 && m?.player2 && !m.winner) {
        setPendingAssignedMatch(null);
        handleStartMatch(m.player1, m.player2, m.matchNumber, 1, 1, m.id, pendingAssignedMatch.matNumber);
        return;
      }
    }
    if (bracket !== null || leagueMatches !== null) setPendingAssignedMatch(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingAssignedMatch, bracket, leagueMatches]);

  // Fires once loadTournament's state (bracket/leagueMatches/mode/players/
  // teamRosters) has actually re-rendered after a "continue tournament,
  // auto-start the next match" navigation from the Operator screen's winner
  // countdown — picks the first not-yet-played, fully-known match and starts
  // it exactly like tapping "Start" on the match strip would.
  useEffect(() => {
    if (!pendingAutoStart) return;
    if (mode === 'league') {
      if (!leagueMatches) return; // still loading
      setPendingAutoStart(false);
      const next = leagueMatches.find(m => !m.winner);
      if (next) handleStartMatch(next.player1, next.player2, next.matchNumber, undefined, undefined, next.id, pendingAutoStartMat);
      return;
    }
    if (!bracket) return; // still loading
    setPendingAutoStart(false);
    const idx = bracket.findIndex(m => !m.winner && m.player1 && m.player2 && !m.isBye);
    if (idx !== -1) {
      const m = bracket[idx];
      const totalRoundsHere = Math.max(...bracket.map(b => b.round));
      handleStartMatch(m.player1 as Player, m.player2 as Player, idx + 1, m.round, totalRoundsHere, m.id, pendingAutoStartMat);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingAutoStart, pendingAutoStartMat, mode, bracket, leagueMatches]);

  const loadTournament = async (t: SavedTournament) => {
    setCurrentTournamentId(t.id);
    // Never let the previous weight's roster remain visible while the new
    // tournament is loading. This used to make one category look populated
    // and could accidentally save those players into another category.
    setPlayers([]);
    setTournamentName(t.name);
    setGender(t.gender);
    setWeightCat(t.weight_category);
    setAgeGroup(t.age_group);
    setMode(t.format);
    // Restore the tournament's saved external color identity when reopening it.
    // Older tournaments fall back to the current external scoreboard theme.
    const savedDisplayColors = (t as any).display_colors || (t.bracket_data as any)?.displayColors;
    if (savedDisplayColors) {
      try {
        const current = JSON.parse(localStorage.getItem('tkd-scoreboard-settings') || '{}');
        localStorage.setItem('tkd-scoreboard-settings', JSON.stringify({
          ...current,
          titleColor: savedDisplayColors.titleColor,
          subColor: savedDisplayColors.subColor,
          playerNameColor: savedDisplayColors.playerNameColor,
          chungColor: savedDisplayColors.blueColor,
          hongColor: savedDisplayColors.redColor,
          timerColor: savedDisplayColors.timerColor,
          winnerColor: savedDisplayColors.winnerColor,
          roundActiveColor: savedDisplayColors.roundActiveColor,
        }));
        window.dispatchEvent(new CustomEvent('wab-tournament-colors-restored', { detail: savedDisplayColors }));
      } catch {}
    }
    const savedRules = t.bracket_data?.rules ?? {};
    setRules(savedRules);
    if (savedRules.pointGap) setLastRulesPointGap(savedRules.pointGap);
    if (savedRules.gamjeomLimit) setLastRulesGamjeomLimit(savedRules.gamjeomLimit);
    if (t.bracket_data?.eventLocation !== undefined) setEventLocation(t.bracket_data.eventLocation);
    if (t.bracket_data?.eventDate !== undefined) setEventDate(t.bracket_data.eventDate);
    setTeamRosters(t.bracket_data?.teamRosters ?? {});
    setTeamPlayMode(t.bracket_data?.teamPlayMode ?? 'rotation');
    setMatWeightAssignments((t.bracket_data as any)?.matWeightAssignments ?? {});
    // Load players registered under this specific tournament (falls back to
    // matching by weight/age/gender for tournaments saved before players
    // were linked by tournament_id, or to the embedded local snapshot when
    // this tournament only ever existed locally / the cloud is unreachable).
    const localPlayers = (t as any).players as Player[] | undefined;
    if (isLocalTournamentId(t.id)) {
      setPlayers(Array.isArray(localPlayers) ? localPlayers : []);
    } else {
      try {
        const { data: playerData } = await supabase.from('players')
          .select('*')
          .eq('tournament_id', t.id);
        const rows = (playerData && playerData.length > 0) ? playerData : (
          await supabase.from('players').select('*')
            .eq('weight_category', t.weight_category)
            .eq('age_group', t.age_group)
            .eq('gender', t.gender)
        ).data;
        if (rows && rows.length > 0) {
          setPlayers(rows.map(p => ({
            id: p.id, name: p.name, nationality: p.nationality || '', club: p.club || '', category: p.weight_category || '',
            photo: p.photo || undefined, playerNumber: p.player_number ?? undefined, seedNumber: p.seed_number ?? undefined,
            teamLogo: p.team_logo || undefined, clubLogo: (p as any).club_logo || undefined,
          })));
        } else {
          setPlayers(Array.isArray(localPlayers) ? localPlayers : []);
        }
      } catch {
        setPlayers(Array.isArray(localPlayers) ? localPlayers : []);
      }
    }
    setShowSavedList(false);
    // Restore the generated bracket / league matches exactly as they were saved.
    if (t.bracket_data && t.bracket_data.mode === 'league' && t.bracket_data.league) {
      setLeagueMatches(t.bracket_data.league);
      setBracket(null);
    } else if (t.bracket_data && t.bracket_data.bracket) {
      setBracket(t.bracket_data.bracket);
      setLeagueMatches(null);
    } else {
      setBracket(null);
      setLeagueMatches(null);
    }
    setLeagueMedalTrigger((t.bracket_data as any)?.leagueMedalTrigger === 'auto' ? 'auto' : 'manual');
    setLeagueMedalsRecorded(hasPlacementRecord(t.id));
  };

  // Best-effort "use my current location" — reads the computer's GPS/network
  // location via the browser Geolocation API, then tries a free reverse-geocode
  // lookup to turn coordinates into a city/country string. If either step fails
  // (no permission, no internet, lookup down) it falls back gracefully rather
  // than blocking — the referee can always just type the location by hand.
  const handleUseMyLocation = () => {
    if (!navigator.geolocation) { alert('هذا الجهاز/المتصفح لا يدعم تحديد الموقع.'); return; }
    setLocatingEvent(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        try {
          if (typeof navigator.onLine === 'boolean' && !navigator.onLine) {
            setEventLocation(`${latitude.toFixed(3)}, ${longitude.toFixed(3)}`);
            return;
          }
          const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=10`, {
            headers: { Accept: 'application/json' },
            signal: AbortSignal.timeout(8000),
          });
          if (!res.ok) throw new Error(`Reverse geocoding failed: ${res.status}`);
          const data = await res.json();
          const city = data?.address?.city || data?.address?.town || data?.address?.village || data?.address?.state;
          const country = data?.address?.country;
          setEventLocation([city, country].filter(Boolean).join(' - ') || `${latitude.toFixed(3)}, ${longitude.toFixed(3)}`);
        } catch {
          setEventLocation(`${latitude.toFixed(3)}, ${longitude.toFixed(3)}`);
        } finally {
          setLocatingEvent(false);
        }
      },
      () => { setLocatingEvent(false); alert('تعذّر الوصول للموقع — تحقق من إذن الموقع الجغرافي، أو أدخل المكان يدوياً.'); },
      { timeout: 10000 }
    );
  };

  const handleAutoFillWeight = (ctx:{tournamentName:string; gender:'male'|'female'; ageGroup:string; weight:string; record?:any}) => {
    if (ctx.record) {
      loadTournament(ctx.record as SavedTournament);
      setTournamentName(ctx.tournamentName);
      setGender(ctx.gender);
      setAgeGroup(ctx.ageGroup);
      setWeightCat(ctx.weight);
      setUseCustomCategory(false);
      setShowSavedList(false);
    } else {
      setCurrentTournamentId(null);
      setTournamentName(ctx.tournamentName);
      setGender(ctx.gender);
      setAgeGroup(ctx.ageGroup);
      setWeightCat(ctx.weight);
      setUseCustomCategory(false);
      setBracket(null);
      setLeagueMatches(null);
      setShowSavedList(false);
    }
    window.setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 30);
    toast.success(lang === 'ar' ? `✓ تم ملء معلومات ${ctx.weight} تلقائياً — أضف اللاعبين الآن` : `✓ ${ctx.weight} information loaded — add players now`);
  };

  const handleSaveTournament = async (opts?: { bracketOverride?: BracketMatchDisplay[] | null; leagueOverride?: LeagueMatch[] | null; nameOverride?: string }) => {
    // A bracket must ALWAYS end up linked to a real tournament id — otherwise
    // it displays and plays just fine, but there's nothing for a finished
    // match to report back to (no bracket-advance, no auto-return), and the
    // operator lands on a blank screen. So rather than silently bailing out
    // when the name field is empty, auto-name the tournament instead.
    const resolvedName = tournamentName.trim() || opts?.nameOverride?.trim() ||
      `${gender === 'male' ? 'Male' : 'Female'} ${weightCat || ''} ${AGE_GROUPS.find(a => a.value === ageGroup)?.label || ageGroup} — ${new Date().toLocaleDateString()}`.replace(/\s+/g, ' ').trim();
    if (resolvedName !== tournamentName) setTournamentName(resolvedName);
    // Postgres/JSONB rejects embedded control characters (e.g. a stray NUL
    // byte from a bad import) — sanitize defensively so one bad player entry
    // can't silently fail the entire save.
    const cleanStr = (s?: string) => (s || '').replace(/[\x00-\x1F\uFFFD]/g, '');
    const cleanPlayer = (p: Player) => ({ ...p, name: cleanStr(p.name), nationality: cleanStr(p.nationality), club: p.club ? cleanStr(p.club) : p.club });
    const cleanBracketMatches = (matches: BracketMatchDisplay[] | null) => matches?.map(m => ({
      ...m,
      player1: m.player1 ? cleanPlayer(m.player1) : m.player1,
      player2: m.player2 ? cleanPlayer(m.player2) : m.player2,
    })) ?? null;
    // Use the freshly-generated bracket/league passed in by handleGenerateBracket
    // when present — React state (`bracket`/`leagueMatches`) hasn't re-rendered
    // yet at that point, so reading it here would save the previous bracket.
    const effectiveBracket = opts && 'bracketOverride' in opts ? opts.bracketOverride! : bracket;
    const effectiveLeague = opts && 'leagueOverride' in opts ? opts.leagueOverride! : leagueMatches;
    const bracketData = {
      mode,
      bracket: mode !== 'league' ? cleanBracketMatches(effectiveBracket) : null,
      league: mode === 'league' ? effectiveLeague?.map(m => ({ ...m, player1: cleanPlayer(m.player1), player2: cleanPlayer(m.player2) })) ?? null : null,
      rules,
      eventLocation,
      eventDate,
      teamRosters: mode === 'par_equipe' ? teamRosters : undefined,
      teamPlayMode: mode === 'par_equipe' ? teamPlayMode : undefined,
      matWeightAssignments,
      leagueMedalTrigger: mode === 'league' ? leagueMedalTrigger : undefined,
      displayColors: getExternalDisplayColors(),
      // Immutable-at-save roster snapshot. The File Center can therefore
      // reconstruct player/club counts even when the remote players table is
      // temporarily unavailable. The live `players` field remains the
      // editable source before a category starts.
      rosterSnapshot: players.map(cleanPlayer),
      rosterSavedAt: new Date().toISOString(),
    };
    if(mode==='par_equipe'){const archiveTeams=players.map((team:any)=>({id:team.id,name:team.name,photo:team.teamLogo||team.photo,clubPhoto:team.clubLogo,club:team.club,country:team.nationality,players:teamRosters[team.id]||[]}));const archiveMatches=(effectiveBracket||[]).filter((m:any)=>m&&m.player1&&m.player2&&!m.isBye).map((m:any)=>({id:m.id,matchNumber:m.position!=null?m.position+1:undefined,round:m.round,team1:m.player1?.name,team2:m.player2?.name,status:m.winner?'COMPLETED':'READY'}));upsertParEquipeTournamentArchive({tournamentId:currentTournamentId||undefined,tournamentName:resolvedName,ageGroup,gender:gender as 'male'|'female',weightCategory:weightCat,eventDate,eventLocation,format:mode,playMode:teamPlayMode,displayColors:getExternalDisplayColors(),teams:buildParEquipeArchiveTeams({teams:archiveTeams}),matches:archiveMatches});}

    const cleanedPlayers = players.map(cleanPlayer);

    // Always keep a local copy first — the tournament (and its bracket) must
    // survive even when the cloud is unreachable (Supabase not configured,
    // or the machine is offline), otherwise navigating away to play a match
    // loses everything and the "go to next match" flow breaks entirely.
    // A tournament name is a container, not a unique category. Each
    // Tournament + Gender + Age + Weight + Format is its own saved category
    // record, so adding -68 KG never overwrites an existing -58 KG record.
    const categoryIdentity = (t:any) => `${String(t.name||'').trim().toLowerCase()}|${t.gender||''}|${t.age_group||''}|${t.weight_category||''}|${t.format||''}`;
    const wantedIdentity = `${resolvedName.trim().toLowerCase()}|${gender}|${ageGroup}|${weightCat}|${mode}`;
    const currentStillMatches = currentTournamentId && savedTournaments.some(t => t.id === currentTournamentId && categoryIdentity(t) === wantedIdentity);
    const tournamentId = currentStillMatches
      ? currentTournamentId!
      : savedTournaments.find(t => categoryIdentity(t) === wantedIdentity)?.id
      || `local-${crypto.randomUUID()}`;
    if (currentTournamentId !== tournamentId) setCurrentTournamentId(tournamentId);
    const localRecord = {
      id: tournamentId, name: resolvedName, gender, weight_category: weightCat, age_group: ageGroup, format: mode,
      bracket_data: bracketData, players: cleanedPlayers, display_colors: getExternalDisplayColors(), created_at: (currentTournamentId ? (savedTournaments.find(x=>x.id===currentTournamentId)?.created_at || new Date().toISOString()) : new Date().toISOString()), updated_at: new Date().toISOString(),
    };
    saveTournamentLocal(localRecord);
    registerTournamentArchiveCategory({ tournamentName: resolvedName, gender, ageGroup, weightCategory: weightCat, format: mode });
    logAudit(currentTournamentId ? 'tournament_updated' : 'tournament_created', `"${resolvedName}" (${weightCat}, ${gender}, ${ageGroup}, ${mode})`);
    setSavedTournaments(prev => [localRecord as any, ...prev.filter(t => t.id !== tournamentId)]);

    // Best-effort cloud sync on top — never blocks or undoes the local save above.
    try {
      if (!isLocalTournamentId(tournamentId)) {
        const { error } = await supabase.from('tournaments').update({
          name: resolvedName, gender, weight_category: weightCat, age_group: ageGroup, format: mode,
          bracket_data: bracketData as any,
        }).eq('id', tournamentId);
        if (error) throw error;
        if (cleanedPlayers.length > 0) {
          await supabase.from('players').upsert(cleanedPlayers.map(p => ({
            id: p.id, name: p.name, nationality: p.nationality, club: p.club || '',
            age_group: ageGroup, gender, weight_category: p.category || weightCat,
            photo: p.photo || null, player_number: p.playerNumber ?? null, seed_number: p.seedNumber ?? null, team_logo: p.teamLogo || null, club_logo: p.clubLogo || null,
            tournament_id: tournamentId,
          })) as any, { onConflict: 'id' });
        }
      } else {
        const { data, error } = await supabase.from('tournaments').insert({
          name: resolvedName, format: mode, age_group: ageGroup, gender, weight_category: weightCat, status: 'active',
          bracket_data: bracketData as any,
        }).select().single();
        if (error) throw error;
        if (data) {
          // Cloud accepted it — migrate the local cache to the real id so
          // judges/other devices can see it too. Existing locally-saved match
          // records must migrate as well; otherwise the tournament appears
          // to have 0 played matches after its local id is promoted.
          for (const m of loadAllMatchesLocal().filter(x => x.tournament_id === tournamentId)) {
            saveMatchLocal({ ...m, tournament_id: data.id, updated_at: new Date().toISOString() });
          }
          deleteTournamentLocal(tournamentId);
          saveTournamentLocal({ ...localRecord, id: data.id });
          setCurrentTournamentId(data.id);
          if (cleanedPlayers.length > 0) {
            await supabase.from('players').upsert(cleanedPlayers.map(p => ({
              id: p.id, name: p.name, nationality: p.nationality, club: p.club || '',
              age_group: ageGroup, gender, weight_category: p.category || weightCat,
              photo: p.photo || null, player_number: p.playerNumber ?? null, seed_number: p.seedNumber ?? null, team_logo: p.teamLogo || null, club_logo: p.clubLogo || null,
              tournament_id: data.id,
            })) as any, { onConflict: 'id' });
          }
        }
      }
      loadSavedTournaments();
      setSaveError(null);
    } catch (err: any) {
      // The tournament is safe locally regardless — this is just informing
      // the user the cloud copy (needed for judge sync on other devices)
      // didn't go through, not that the save failed outright.
      console.warn('Cloud sync failed (tournament kept locally):', err);
      setSaveError(err?.message || String(err));
    }
    if (!opts) setSaveOkNotice(true);
  };

  // Top-bar SAVE on the Tournament screen uses this same official
  // TournamentManager persistence path. This is deliberately separate from
  // OperatorScreen's SAVE MATCH event: saving a tournament/category must
  // never be mistaken for saving a finished match.
  useEffect(() => {
    const onGlobalTournamentSave = () => {
      void handleSaveTournament();
    };
    window.addEventListener('wab-save-tournament', onGlobalTournamentSave);
    return () => window.removeEventListener('wab-save-tournament', onGlobalTournamentSave);
  }, [handleSaveTournament]);

  // Manually push a local-only tournament (id prefixed "local-") to the
  // cloud, for whenever the connection comes back after it was saved
  // offline — instead of waiting for the next edit + Save to trigger it.
  const handleSyncToCloud = async (t: SavedTournament) => {
    if (!isLocalTournamentId(t.id)) return;
    setSyncingId(t.id);
    try {
      const { data, error } = await supabase.from('tournaments').insert({
        name: t.name, format: t.format, age_group: t.age_group, gender: t.gender, weight_category: t.weight_category, status: 'active',
        bracket_data: t.bracket_data as any,
      }).select().single();
      if (error) throw error;
      if (data) {
        const localPlayers = (t as any).players as Player[] | undefined;
        deleteTournamentLocal(t.id);
        saveTournamentLocal({ ...(t as any), id: data.id });
        // Promote any locally cached match records to the new cloud
        // tournament id before deleting the local tournament wrapper.
        for (const m of loadAllMatchesLocal().filter(x => x.tournament_id === t.id)) {
          saveMatchLocal({ ...m, tournament_id: data.id, updated_at: new Date().toISOString() });
        }
        if (localPlayers && localPlayers.length > 0) {
          await supabase.from('players').upsert(localPlayers.map(p => ({
            id: p.id, name: p.name, nationality: p.nationality, club: p.club || '',
            age_group: t.age_group, gender: t.gender, weight_category: p.category || t.weight_category,
            photo: p.photo || null, player_number: p.playerNumber ?? null, seed_number: p.seedNumber ?? null, team_logo: p.teamLogo || null, club_logo: p.clubLogo || null,
            tournament_id: data.id,
          })) as any, { onConflict: 'id' });
        }
        if (currentTournamentId === t.id) setCurrentTournamentId(data.id);
        loadSavedTournaments();
      }
    } catch (err: any) {
      alert(`تعذّرت المزامنة الآن: ${err?.message || 'تحقق من اتصال الإنترنت'}`);
    } finally {
      setSyncingId(null);
    }
  };

  // Full local-data backup: bundles every locally-cached tournament and
  // match record into one JSON file — useful before switching machines, or
  // just as a safety net independent of the cloud.
  const handleExportBackup = () => {
    const backup = {
      exportedAt: new Date().toISOString(),
      tournaments: loadAllLocalTournaments(),
      matches: loadAllMatchesLocal(),
    };
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `kyorugi-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const backupFileInputRef = useRef<HTMLInputElement>(null);
  const handleImportBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const backup = JSON.parse(evt.target?.result as string);
        const tCount = (backup.tournaments || []).length;
        const mCount = (backup.matches || []).length;
        if (!confirm(`استيراد ${tCount} بطولة و ${mCount} مباراة من هذا الملف؟ سيُدمَج مع بياناتك الحالية.`)) return;
        (backup.tournaments || []).forEach((t: any) => saveTournamentLocal(t));
        (backup.matches || []).forEach((m: any) => saveMatchLocal(m));
        loadSavedTournaments();
        alert('تم الاستيراد بنجاح.');
      } catch {
        alert('ملف النسخة الاحتياطية غير صالح.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const [cloudBackupBusy, setCloudBackupBusy] = useState(false);
  const cloudBackupFileInputRef = useRef<HTMLInputElement>(null);

  // Full-database backup — everything currently saved in Supabase (every
  // tournament, match, player, club, score-event log, and template),
  // regardless of which device/browser created it. This is distinct from
  // the "محلي" backup above, which only ever covers this browser's own
  // offline localStorage tournaments/matches. Supabase's own automatic
  // backups (Point-in-Time-Recovery) need a paid plan and aren't
  // downloadable by the operator — this gives a free, portable safety net
  // either way (e.g. right after a tournament wraps up).
  const handleExportCloudBackup = async () => {
    setCloudBackupBusy(true);
    try {
      const counts = await exportFullBackup();
      const summary = Object.entries(counts).map(([t, n]) => `${t}: ${n}`).join('\n');
      alert(`تم تصدير النسخة الاحتياطية الكاملة من Supabase:\n\n${summary}`);
    } catch (e: any) {
      alert(`فشل التصدير: ${e?.message || e}`);
    } finally {
      setCloudBackupBusy(false);
    }
  };

  const handleImportCloudBackup = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!confirm('هاذشي غادي يعيد كتابة (upsert) البيانات فSupabase بالنسخة اللي فهاذ الملف. أي صف موجود بنفس الـ id غادي يتبدل. كمّلي؟')) return;
    setCloudBackupBusy(true);
    try {
      const result = await restoreFromBackup(file);
      const summary = Object.entries(result).map(([t, r]) => `${t}: ${r.restored} استرجعو${r.failed ? `, ${r.failed} فشلو` : ''}`).join('\n');
      alert(`تم الاسترجاع:\n\n${summary}`);
      loadSavedTournaments();
    } catch (e: any) {
      if (String(e?.message || e).includes('BACKUP_CONFLICT_NEWER_CURRENT_DATA')) {
        if (confirm('هذه النسخة أقدم من بيانات موجودة حالياً. هل تريد الاسترجاع بالقوة واستبدال الصفوف المطابقة؟')) {
          try {
            const result = await restoreFromBackup(file, { force: true });
            const summary = Object.entries(result).map(([t, r]) => `${t}: ${r.restored} استرجعو${r.failed ? `, ${r.failed} فشلو` : ''}`).join('\n');
            alert(`تم الاسترجاع بالقوة:\n\n${summary}`);
            loadSavedTournaments();
          } catch (forceError: any) { alert(`فشل الاسترجاع بالقوة: ${forceError?.message || forceError}`); }
        }
      } else alert(`فشل الاسترجاع: ${e?.message || e}`);
    } finally {
      setCloudBackupBusy(false);
    }
  };

  const persistRosterSnapshotLocally = (nextPlayers: Player[]) => {
    if (!currentTournamentId) return;
    const existing = loadTournamentLocal(currentTournamentId) || savedTournaments.find((x:any)=>x.id===currentTournamentId);
    if (!existing) return;
    const nextBracketData = { ...(existing as any).bracket_data, rosterSnapshot: nextPlayers, rosterSavedAt: new Date().toISOString() };
    saveTournamentLocal({ ...(existing as any), players: nextPlayers, bracket_data: nextBracketData, updated_at: new Date().toISOString() });
    setSavedTournaments(prev => prev.map((x:any)=>x.id===currentTournamentId ? { ...x, players: nextPlayers, bracket_data: nextBracketData, updated_at: new Date().toISOString() } : x));
  };

  const addPlayer = async () => {
    if (!newName.trim()) return;
    const startedForCurrentTournament = tournamentHasStarted;
    if (startedForCurrentTournament) {
      alert('This weight has already started matches. Players can only be added before the first match is saved.');
      return;
    }
    const clean = (s: string) => s.replace(/[\x00-\x1F\uFFFD]/g, '').trim();
    const player: Player = {
      id: crypto.randomUUID(), name: clean(newName), nationality: clean(newNat), club: clean(newClub), category: weightCat,
      playerNumber: newPlayerNumber.trim() ? Number(newPlayerNumber.trim()) : undefined,
      seedNumber: newSeedNumber.trim() ? Number(newSeedNumber.trim()) : undefined,
      photo: newPhoto || undefined,
      teamLogo: isParEquipe ? (newTeamLogo || undefined) : undefined,
    };
    setPlayers(prev => { const next = [...prev, player]; persistRosterSnapshotLocally(next); return next; });
    try {
      const { error } = await supabase.from('players').insert({
        id: player.id, name: player.name, nationality: player.nationality, club: player.club,
        age_group: ageGroup, gender, weight_category: weightCat, tournament_id: currentTournamentId || null,
        photo: player.photo || null, player_number: player.playerNumber ?? null, seed_number: player.seedNumber ?? null,
        team_logo: player.teamLogo || null,
        club_logo: player.clubLogo || null,
      } as any);
      if (error) throw error;
      setSaveError(null);
      if (newClub.trim()) {
        setClubStandings(prev => {
          const existing = prev.find(c => c.name === newClub.trim());
          if (!existing) return [...prev, { name: newClub.trim(), country: newNat.trim(), gold: 0, silver: 0, bronze: 0, points: 0 }];
          return prev;
        });
        const { data: existingClub } = await supabase.from('clubs').select('id').eq('name', newClub.trim()).maybeSingle();
        if (!existingClub) await supabase.from('clubs').insert({ name: newClub.trim(), country: newNat.trim() });
      }
    } catch (e: any) {
      // Was previously a fire-and-forget await with no catch: the player
      // showed up in the list either way, so a failed cloud save (network,
      // RLS, offline) went completely unnoticed until the roster mysteriously
      // "lost" someone later on another device. Now surfaced via the same
      // persistent banner AdminPanel and the tournament-save path above use —
      // the player stays in the local list (nothing lost), but the operator
      // knows the cloud copy didn't go through.
      console.error('Failed to save player to cloud:', e);
      setSaveError(e?.message || String(e));
    }
    setNewName(''); setNewNat(''); setNewClub(''); setNewPlayerNumber(''); setNewSeedNumber(''); setNewPhoto(''); setNewTeamLogo('');
  };

  const removePlayer = async (id: string) => {
    if (tournamentHasStarted) {
      alert('This weight has already started matches. Player roster is locked.');
      return;
    }
    const removed = players.find(p => p.id === id);
    setPlayers(prev => { const next = prev.filter(p => p.id !== id); persistRosterSnapshotLocally(next); return next; });
    setTeamRosters(prev => { const next = { ...prev }; delete next[id]; return next; });
    try {
      const { error } = await supabase.from('players').delete().eq('id', id);
      if (error) throw error;
      setSaveError(null);
    } catch (e: any) {
      console.error('Failed to delete player from cloud:', e);
      setSaveError(e?.message || String(e));
    }
  };

  const addRosterPlayer = () => {
    if (!activeRosterTeamId || !newRosterName.trim()) return;
    const entry = {
      id: crypto.randomUUID(), name: newRosterName.trim(), nationality: newRosterNat.trim(), rounds: 1,
      playerNumber: newRosterNumber.trim() ? Number(newRosterNumber.trim()) : undefined,
      seedNumber: newRosterSeed.trim() ? Number(newRosterSeed.trim()) : undefined,
      photo: newRosterPhoto || undefined,
    };
    setTeamRosters(prev => ({ ...prev, [activeRosterTeamId]: [...(prev[activeRosterTeamId] || []), entry] }));
    setNewRosterName(''); setNewRosterNat(''); setNewRosterNumber(''); setNewRosterSeed(''); setNewRosterPhoto('');
  };

  const removeRosterPlayer = (teamId: string, playerId: string) => {
    setTeamRosters(prev => ({ ...prev, [teamId]: (prev[teamId] || []).filter(p => p.id !== playerId) }));
  };

  const setRosterPlayerRounds = (teamId: string, playerId: string, rounds: number) => {
    setTeamRosters(prev => ({ ...prev, [teamId]: (prev[teamId] || []).map(p => p.id === playerId ? { ...p, rounds } : p) }));
  };

  const setRosterPlayerNumber = (teamId: string, playerId: string, playerNumber: number | undefined) => {
    setTeamRosters(prev => ({ ...prev, [teamId]: (prev[teamId] || []).map(p => p.id === playerId ? { ...p, playerNumber } : p) }));
  };

  const setRosterPlayerSeed = (teamId: string, playerId: string, seedNumber: number | undefined) => {
    setTeamRosters(prev => ({ ...prev, [teamId]: (prev[teamId] || []).map(p => p.id === playerId ? { ...p, seedNumber } : p) }));
  };

  const setRosterPlayerPhoto = (teamId: string, playerId: string, photo: string | undefined) => {
    setTeamRosters(prev => ({ ...prev, [teamId]: (prev[teamId] || []).map(p => p.id === playerId ? { ...p, photo } : p) }));
  };

  // LEAGUE MEDAL POINTS — see tournament-placements.ts's documented "KNOWN
  // GAP" and the leagueMedalTrigger state above. A league is "complete" once
  // every generated match has been played (has a winner) — the same signal
  // the match strip already uses to know nothing is left to start.
  const isLeagueComplete = (matches: LeagueMatch[] | null): boolean =>
    !!matches && matches.length > 0 && matches.every(m => !!m.winner);

  const handleFinalizeLeagueMedals = () => {
    if (!currentTournamentId || !leagueMatches) return;
    if (hasPlacementRecord(currentTournamentId)) { setLeagueMedalsRecorded(true); return; }
    const standings = computeLeagueStandings(leagueMatches);
    const top3 = standings.slice(0, 3);
    if (top3.length === 0) return;
    const medalFor: ('gold' | 'silver' | 'bronze')[] = ['gold', 'silver', 'bronze'];
    const medals = top3.map((s, i) => ({
      club: (s.player.club || '').trim(),
      medal: medalFor[i],
      playerName: s.player.name,
    }));
    recordPlacements({
      tournamentId: currentTournamentId,
      tournamentName: tournamentName || 'League',
      weightCategory: weightCat ?? null,
      ageGroup: ageGroup ?? null,
      gender: gender ?? null,
      medals,
    });
    setLeagueMedalsRecorded(true);
  };

  // AUTO trigger: fires the moment the league becomes complete, but only
  // when the organizer explicitly chose 'auto' for this tournament (see
  // leagueMedalTrigger state doc comment) — never for tournaments left on
  // the 'manual' default.
  useEffect(() => {
    if (mode !== 'league' || leagueMedalTrigger !== 'auto') return;
    if (!currentTournamentId || leagueMedalsRecorded) return;
    if (isLeagueComplete(leagueMatches)) handleFinalizeLeagueMedals();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, leagueMedalTrigger, currentTournamentId, leagueMatches, leagueMedalsRecorded]);

  const handleGenerateBracket = async () => {
    if (players.length < 2) return;

    if (mode === 'league') {
      const smart = generateSmartLeague(players, ageGroup, { allowSoloPlayerMerge: rules.allowSoloPlayerMerge !== false, avoidSameClubFirstRounds: true });
      const matches: LeagueMatch[] = smart.matches.map(m => ({ id: m.id, matchNumber: m.matchNumber, player1: m.player1, player2: m.player2 }));
      setLeagueMatches(matches);
      setBracket(null);
      await handleSaveTournament({ bracketOverride: null, leagueOverride: matches });
    } else {
      const smart = generateSmartKnockout(players, ageGroup, { allowSoloPlayerMerge: rules.allowSoloPlayerMerge !== false, avoidSameClubFirstRounds: true });
      const bracketMatches = smart.matches as BracketMatchDisplay[];
      setBracket(bracketMatches);
      setLeagueMatches(null);
      await handleSaveTournament({ bracketOverride: bracketMatches, leagueOverride: null });
    }
  };

  const roundToStage = (round: number, totalRounds: number): MatchStage => {
    const fromEnd = totalRounds - round; // 0 = final, 1 = semifinal, ...
    if (fromEnd === 0) return 'final';
    if (fromEnd === 1) return 'semifinal';
    if (fromEnd === 2) return 'quarterfinal';
    if (fromEnd === 3) return 'round_of_16';
    if (fromEnd === 4) return 'round_of_32';
    return 'qualification';
  };

  const handleStartMatch = (p1: Player, p2: Player, matchNum: number, round?: number, totalRoundsForStage?: number, bracketMatchId?: string, matNumber?: number) => {
    if (isParEquipe) {
      // Here p1/p2 are actually the two TEAMS (their `.name` is the team
      // name) — look up each team's individual roster.
      const chungRoster = teamRosters[p1.id] || [];
      const hongRoster = teamRosters[p2.id] || [];
      if (teamPlayMode === 'rotation') {
        // A different player from each team's roster plays each round, in
        // order, and the match never ends on a round majority — it keeps
        // rotating through the whole roster until every player has played
        // all their rounds, then waits for the operator to reveal the
        // winner by total point difference.
        const totalRounds = Math.max(
          chungRoster.reduce((s, p) => s + Math.max(1, p.rounds || 1), 0),
          hongRoster.reduce((s, p) => s + Math.max(1, p.rounds || 1), 0),
          1
        );
        dispatch({
          type: 'INIT_MATCH',
          config: {
            ...matchState.config, ...rules,
            scoreResetPerRound: rules.scoreResetPerRound ?? false,
            warningResetPerRound: rules.warningResetPerRound ?? false,
            competitionMode: 'par_equipe',
            rounds: totalRounds,
            goldenRound: false,
          },
        });
      } else {
        // Normal best-of-N match between the first two roster entries —
        // any player can be substituted from the bench mid-match via the
        // "Substitute" control on the Operator screen.
        dispatch({
          type: 'INIT_MATCH',
          config: {
            ...matchState.config, ...rules,
            competitionMode: 'par_equipe',
          },
        });
      }
      // The roster player's own SET_PLAYER call has no `club` of its own
      // (RosterPlayer never carries one — only name/nationality/photo/
      // number) — pass the TEAM's club name here so the club badge shown
      // everywhere (call cinematic, winner screen, NEXT ON THE MATCH card)
      // has something to display for tournament-started Par Équipe matches,
      // same as it already does for matches started from Admin directly.
      if (chungRoster[0]) dispatch({ type: 'SET_PLAYER', color: 'chung', name: chungRoster[0].name, nationality: chungRoster[0].nationality, club: p1.club, playerNumber: chungRoster[0].playerNumber, seedNumber: chungRoster[0].seedNumber, photoUrl: chungRoster[0].photo });
      if (hongRoster[0]) dispatch({ type: 'SET_PLAYER', color: 'hong', name: hongRoster[0].name, nationality: hongRoster[0].nationality, club: p2.club, playerNumber: hongRoster[0].playerNumber, seedNumber: hongRoster[0].seedNumber, photoUrl: hongRoster[0].photo });
      dispatch({
        type: 'SET_TEAM_ROSTER',
        teamMode: teamPlayMode,
        roster: {
          chung: chungRoster.map(p => ({ name: p.name, nationality: p.nationality, rounds: Math.max(1, p.rounds || 1), playerNumber: p.playerNumber, seedNumber: p.seedNumber, photo: p.photo })),
          hong: hongRoster.map(p => ({ name: p.name, nationality: p.nationality, rounds: Math.max(1, p.rounds || 1), playerNumber: p.playerNumber, seedNumber: p.seedNumber, photo: p.photo })),
        },
      });
      dispatch({
        type: 'SET_MATCH_INFO',
        competitionName: tournamentName,
        matchNumber: matchNum,
        weightCategory: `${gender === 'male' ? 'M' : 'F'} ${weightCat}`,
        gender: gender as 'male' | 'female',
        ageGroup,
        matchStage: (round && totalRoundsForStage) ? roundToStage(round, totalRoundsForStage) : undefined,
        tournamentId: currentTournamentId || undefined,
        bracketMatchId,
        matNumber,
        teamNames: { chung: p1.name, hong: p2.name },
        clubNames: { chung: p1.club, hong: p2.club },
        teamLogos: { chung: p1.teamLogo, hong: p2.teamLogo },
        clubLogos: { chung: p1.clubLogo, hong: p2.clubLogo },
        // Team country/flag was only ever set when a match was started from
        // Admin directly — tournament-started matches (bracket or league)
        // left it blank even though each team's own nationality is right
        // here on the Player record. Carry it through the same way.
        teamCountry: { chung: p1.nationality || undefined, hong: p2.nationality || undefined },
        eventLocation: eventLocation.trim() || undefined,
        eventDate: eventDate.trim() || undefined,
      });
      navigate('/operator');
      return;
    }
    // Start every match from a clean slate, applying this tournament's own
    // Competition Rules (if any were set) on top of the currently configured
    // timing/rest/point-gap settings — this is what makes rules configured
    // per tournament actually apply to every match in it. `mode` (Tournament,
    // League, Friendly) is carried over explicitly so the call-up screen's
    // type badge reflects what was actually selected here, not whatever
    // competitionMode happened to be left over from a previous match.
    dispatch({ type: 'INIT_MATCH', config: { ...matchState.config, ...rules, competitionMode: mode as MatchConfig['competitionMode'] } });
    dispatch({ type: 'SET_PLAYER', color: 'chung', name: p1.name, nationality: p1.nationality, club: p1.club, seedNumber: p1.seedNumber, playerNumber: p1.playerNumber, photoUrl: p1.photo });
    dispatch({ type: 'SET_PLAYER', color: 'hong', name: p2.name, nationality: p2.nationality, club: p2.club, seedNumber: p2.seedNumber, playerNumber: p2.playerNumber, photoUrl: p2.photo });
    dispatch({
      type: 'SET_MATCH_INFO',
      competitionName: tournamentName,
      matchNumber: matchNum,
      weightCategory: `${gender === 'male' ? 'M' : 'F'} ${weightCat}`,
      gender: gender as 'male' | 'female',
      ageGroup,
      matchStage: (round && totalRoundsForStage) ? roundToStage(round, totalRoundsForStage) : undefined,
      tournamentId: currentTournamentId || undefined,
      bracketMatchId,
      matNumber,
      eventLocation: eventLocation.trim() || undefined,
      eventDate: eventDate.trim() || undefined,
    });
    navigate('/operator');
  };

  const handleFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const clean = (s: string) => s.replace(/[\x00-\x1F\uFFFD]/g, '').trim();

    if (/\.xlsx$/i.test(file.name)) {
      parseXlsxFirstSheetWithImages(file)
        .then(({ rows, rowNumbers, imagesByRow }) => {
          const start = rows[0]?.[0]?.toLowerCase().includes('name') ? 1 : 0;
          const newPlayers: Player[] = [];
          // Columns: Name, Country, Club, Number (رقم اللاعب), Seed (التصنيف), Photo URL (اختياري)
          // Photo: either a URL typed in column F, OR an actual picture
          // pasted/inserted into that row in Excel (extracted automatically
          // from the file — no need to type anything in that case).
          for (let i = start; i < rows.length; i++) {
            const name = clean(rows[i][0] || '');
            const numRaw = clean(rows[i][3] || '');
            const seedRaw = clean(rows[i][4] || '');
            const photoRaw = clean(rows[i][5] || '');
            const embeddedPhoto = imagesByRow.get(rowNumbers[i]);
            if (name) newPlayers.push({
              id: crypto.randomUUID(), name, nationality: clean(rows[i][1] || ''), club: clean(rows[i][2] || ''), category: weightCat,
              playerNumber: numRaw && /^\d+$/.test(numRaw) ? Number(numRaw) : undefined,
              seedNumber: seedRaw && /^\d+$/.test(seedRaw) ? Number(seedRaw) : undefined,
              photo: /^https?:\/\//i.test(photoRaw) ? photoRaw : embeddedPhoto,
            });
          }
          if (newPlayers.length === 0) {
            alert('لم أجد أي أسماء لاعبين في العمود الأول من هذا الملف.');
            return;
          }
          setPlayers(prev => [...prev, ...newPlayers]);
        })
        .catch(err => {
          console.error('xlsx import failed:', err);
          alert('تعذّرت قراءة ملف Excel هذا. جرّب حفظه كـ CSV من Excel ثم استيراد ملف الـ CSV بدلاً منه.');
        });
      e.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = evt.target?.result as string;
      if (!text) return;
      // Defense in depth: if the file still isn't real text (e.g. wrong
      // extension on a binary file), the replacement character or control
      // bytes will show up a lot — bail out rather than import garbage.
      const controlCharCount = (text.match(/[\x00-\x08\x0E-\x1F\uFFFD]/g) || []).length;
      if (controlCharCount > text.length * 0.02) {
        alert('يبدو أن هذا الملف ليس نصياً (CSV) صالحاً — لم يتم استيراد أي لاعب. تأكد من أنه ملف CSV أو TXT.');
        e.target.value = '';
        return;
      }
      const lines = text.split('\n').filter(l => l.trim());
      const newPlayers: Player[] = [];
      const start = lines[0]?.toLowerCase().includes('name') ? 1 : 0;
      for (let i = start; i < lines.length; i++) {
        const cols = lines[i].split(/[,;\t]/).map(c => clean(c));
        if (cols[0]) newPlayers.push({
          id: crypto.randomUUID(), name: cols[0], nationality: cols[1] || '', club: cols[2] || '', category: weightCat,
          playerNumber: cols[3] && /^\d+$/.test(cols[3]) ? Number(cols[3]) : undefined,
          seedNumber: cols[4] && /^\d+$/.test(cols[4]) ? Number(cols[4]) : undefined,
          photo: cols[5] && /^https?:\/\//i.test(cols[5]) ? cols[5] : undefined,
        });
      }
      setPlayers(prev => [...prev, ...newPlayers]);
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleExport = () => {
    const csv = ['Name,Country,Club,Number,Seed,Photo', ...players.map(p => `${p.name},${p.nationality},${p.club || ''},${p.playerNumber ?? ''},${p.seedNumber ?? ''},${p.photo || ''}`)].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `${tournamentName || 'players'}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadBracket = () => {
    if (!bracket) return;
    const totalRounds = Math.max(...bracket.map(m => m.round));
    const isRtl = lang === 'ar';
    let html = `<html dir="${isRtl ? 'rtl' : 'ltr'}"><head><title>${tournamentName || tr('tournamentDefaultLabel')} ${tr('bracketTitle')}</title>
      <style>body{font-family:Arial;background:#0a0f1a;color:white;padding:20px}
      .round{display:inline-block;vertical-align:top;margin:0 15px}
      .match{background:#1a1f2e;border-radius:8px;padding:8px 12px;margin:8px 0;min-width:180px}
      .blue{color:#3b82f6}.red{color:#ef4444}.gold{color:#eab308}
      h1{text-align:center;color:#eab308}h2{color:#3b82f6;font-size:14px;text-align:center}</style></head><body>
      <h1>🏆 ${tournamentName || tr('tournamentDefaultLabel')}</h1>
      <p style="text-align:center;color:#888">${AGE_GROUPS.find(a => a.value === ageGroup)?.label} • ${gender === 'male' ? tr('maleLabel') : tr('femaleLabel')} • ${weightCat}</p>
      <div style="display:flex;justify-content:center;overflow-x:auto">`;
    
    for (let round = 1; round <= totalRounds; round++) {
      const roundMatches = bracket.filter(m => m.round === round);
      html += `<div class="round"><h2>${getRoundLabel(round, totalRounds)}</h2>`;
      roundMatches.forEach(m => {
        html += `<div class="match">
          <div class="blue">${m.player1?.name || (m.isBye ? tr('byeLabel') : '—')}</div>
          <div style="color:#666;font-size:11px;text-align:center">${tr('vsLabel')}</div>
          <div class="red">${m.player2?.name || (m.isBye ? tr('byeLabel') : '—')}</div>
          ${m.isBye ? `<div class="gold" style="font-size:10px;text-align:center">${tr('autoAdvanceLabel')}</div>` : ''}
        </div>`;
      });
      html += '</div>';
    }
    html += '</div></body></html>';
    
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `${tournamentName || tr('bracketTitle')}.html`; a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportTournamentReport = () => {
    const isRtl = lang === 'ar';
    const catLine = `${AGE_GROUPS.find(a => a.value === ageGroup)?.label || ageGroup} • ${gender === 'male' ? tr('maleLabel') : tr('femaleLabel')} • ${weightCat}`;
    let body = '';

    if (mode === 'league' && leagueMatches) {
      const standings = computeLeagueStandings(leagueMatches);
      body += `<h2>${tr('finalStandingsLabel')}</h2><table class="report-table"><tr><th>#</th><th>${tr('playerColumnLabel')}</th><th>P</th><th>W</th><th>L</th><th>+/-</th><th>${tr('diffColumnLabel')}</th></tr>`;
      standings.forEach((s, i) => {
        body += `<tr class="${i === 0 && s.played > 0 ? 'gold-row' : ''}"><td>${i + 1}</td><td>${s.player.name}</td><td>${s.played}</td><td>${s.wins}</td><td>${s.losses}</td><td>${s.pointsFor}-${s.pointsAgainst}</td><td>${s.diff > 0 ? '+' : ''}${s.diff}</td></tr>`;
      });
      body += `</table><h2>${tr('allMatchesLabel')}</h2><table class="report-table"><tr><th>#</th><th>${tr('blue')}</th><th>${tr('red')}</th><th>${tr('scoreLabel')}</th><th>${tr('winnerLabel')}</th></tr>`;
      leagueMatches.forEach(m => {
        const winnerName = m.winner === 'chung' ? m.player1.name : m.winner === 'hong' ? m.player2.name : '—';
        body += `<tr><td>${m.matchNumber}</td><td class="blue">${m.player1.name}</td><td class="red">${m.player2.name}</td><td>${m.score || '—'}</td><td>${winnerName}</td></tr>`;
      });
      body += `</table>`;
    } else if (bracket) {
      const totalRounds = Math.max(...bracket.map(m => m.round));
      const finalMatch = bracket.find(m => m.round === totalRounds);
      const champion = finalMatch?.winner ? (finalMatch.winner === 'chung' ? finalMatch.player1?.name : finalMatch.player2?.name) : null;
      if (champion) body += `<div class="champion-box">🏆 ${tr('championLabel')}<br/><span>${champion}</span></div>`;
      for (let round = 1; round <= totalRounds; round++) {
        const roundMatches = bracket.filter(m => m.round === round);
        body += `<h2>${getRoundLabel(round, totalRounds)}</h2><table class="report-table"><tr><th>${tr('blue')}</th><th>${tr('red')}</th><th>${tr('winnerLabel')}</th></tr>`;
        roundMatches.forEach(m => {
          const winnerName = m.winner === 'chung' ? m.player1?.name : m.winner === 'hong' ? m.player2?.name : (m.isBye ? tr('byeAutoLabel') : tr('tbdLabel'));
          body += `<tr><td class="blue">${m.player1?.name || tr('tbdLabel')}</td><td class="red">${m.player2?.name || tr('tbdLabel')}</td><td>${winnerName}</td></tr>`;
        });
        body += `</table>`;
      }
    } else {
      body = `<p>${tr('noResultsToReport')}</p>`;
    }

    const html = `<html dir="${isRtl ? 'rtl' : 'ltr'}"><head><title>${tournamentName || tr('tournamentDefaultLabel')} — ${tr('reportTitle')}</title>
      <style>
        body{font-family:Arial,sans-serif;background:#fff;color:#111;padding:30px;max-width:800px;margin:0 auto}
        h1{text-align:center;color:#b8860b;margin-bottom:4px}
        .subtitle{text-align:center;color:#666;margin-bottom:24px}
        h2{color:#3b82f6;font-size:15px;border-bottom:2px solid #eee;padding-bottom:4px;margin-top:28px}
        .report-table{width:100%;border-collapse:collapse;margin-bottom:10px;font-size:13px}
        .report-table th{background:#f3f4f6;text-align:${isRtl ? 'right' : 'left'};padding:6px 8px}
        .report-table td{padding:6px 8px;border-bottom:1px solid #eee}
        .blue{color:#2563eb;font-weight:600}.red{color:#dc2626;font-weight:600}
        .gold-row{background:#fffbe6;font-weight:700}
        .champion-box{text-align:center;background:#fffbe6;border:2px solid #eab308;border-radius:12px;padding:20px;margin-bottom:20px;font-weight:700;color:#92700a}
        .champion-box span{display:block;font-size:26px;margin-top:6px}
        .footer{text-align:center;color:#999;font-size:11px;margin-top:30px}
      </style></head><body>
      <h1>🏆 ${tournamentName || tr('tournamentDefaultLabel')}</h1>
      <p class="subtitle">${catLine}</p>
      ${body}
      <div class="footer">${tr('reportFooterLabel')} ${new Date().toLocaleString()}</div>
      </body></html>`;

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(html);
      printWindow.document.close();
      setTimeout(() => printWindow.print(), 500);
    }
  };

  const filteredCountries = TKD_COUNTRIES.filter(c => c.toLowerCase().includes(countrySearch.toLowerCase()));

  const getRoundLabel = (round: number, totalRounds: number) => {
    const fromEnd = totalRounds - round; // 0 = final, 1 = semi, 2 = quarter, 3+ = qualification
    if (fromEnd === 0) return `🏆 ${tr('finalRoundLabel')}`;
    if (fromEnd === 1) return tr('semiFinalLabel');
    if (fromEnd === 2) return tr('quarterFinalLabel');
    return tr('qualificationLabel');
  };

  const totalRounds = bracket ? Math.max(...bracket.map(m => m.round)) : 0;
  const sortedClubs = [...clubStandings].sort((a, b) => b.points - a.points);
  const tournamentHasStarted = Boolean(
    currentTournamentId && (
      loadMatchesLocal(tournamentName || '').some((m: any) => m.tournament_id === currentTournamentId && m.status && m.status !== 'waiting') ||
      (matchState.tournamentId === currentTournamentId && matchState.status !== 'waiting')
    )
  );

  return (
    <div className="min-h-screen gradient-dark">
      
      <div className="p-4 max-w-5xl mx-auto space-y-4">
        {/* Header */}
        <div className="panel p-4 flex items-center justify-between">
          <div>
            <h1 className="title-power text-xl flex items-center gap-2">
              <Trophy size={20} className="text-[hsl(var(--gold))]" /> Tournament
            </h1>
            <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1">Tournament & Club Ranking Manager</p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setShowSavedList(!showSavedList)} className="text-xs px-3 py-1.5 rounded-lg bg-[hsl(var(--primary))]/20 text-[hsl(var(--primary))] font-semibold flex items-center gap-1">
              <FolderOpen size={12} /> Saved ({savedTournaments.length})
            </button>
            <button onClick={() => setShowCategoryBrowser(true)} title="تصفح حسب الجنس ← الفئة العمرية ← الوزن، وتوليد مباريات جديدة بالاسم فقط"
              className="text-xs px-3 py-1.5 rounded-lg bg-[hsl(var(--gold))]/20 text-[hsl(var(--gold))] font-semibold flex items-center gap-1">
              <Swords size={12} /> مكتبة الفئات والأوزان
            </button>
            <button onClick={() => setShowCategoryArchive(true)} title="كل الأوزان دفعة واحدة مع حالة كل فئة (دوائر مضيئة)"
              className="text-xs px-3 py-1.5 rounded-lg bg-[hsl(var(--gold))]/20 text-[hsl(var(--gold))] font-semibold flex items-center gap-1">
              <Circle size={12} /> أرشيف حالة الفئات
            </button>
            <button onClick={() => setShowPodium(!showPodium)} className="text-xs px-3 py-1.5 rounded-lg bg-[hsl(var(--gold))]/20 text-[hsl(var(--gold))] font-semibold flex items-center gap-1">
              <Crown size={12} /> Podium
            </button>
            <button onClick={() => navigate('/operator')} className="text-xs px-3 py-1.5 rounded-lg bg-[hsl(var(--primary))]/20 text-[hsl(var(--primary))] font-semibold flex items-center gap-1">
              <Swords size={12} /> Friendly Match
            </button>
            <button onClick={handleExportTournamentReport} title="تصدير تقرير شامل للبطولة (كل المباريات + الترتيب النهائي) كـ PDF"
              className="text-xs px-3 py-1.5 rounded-lg bg-[hsl(var(--gold))]/20 text-[hsl(var(--gold))] font-semibold flex items-center gap-1">
              <FileText size={12} /> تقرير البطولة
            </button>
            <button onClick={handleExportBackup} title="تصدير كل البيانات المحلية (بطولات + مباريات) كملف JSON"
              className="text-xs px-3 py-1.5 rounded-lg bg-[hsl(var(--secondary))] text-[hsl(var(--foreground))] font-semibold flex items-center gap-1">
              <Archive size={12} /> نسخة احتياطية
            </button>
            <input ref={backupFileInputRef} type="file" accept=".json" onChange={handleImportBackup} className="hidden" />
            {/* Full cloud (Supabase) backup — every tournament/match/player/
                club/template currently saved, from any device, not just
                this browser's own local data (the button above). */}
            <button onClick={handleExportCloudBackup} disabled={cloudBackupBusy}
              title="تصدير كل البيانات من Supabase (كل الأجهزة) كملف JSON واحد"
              className="text-xs px-3 py-1.5 rounded-lg bg-[hsl(var(--success))]/20 text-[hsl(var(--success))] font-semibold flex items-center gap-1 disabled:opacity-50">
              <Archive size={12} /> {cloudBackupBusy ? 'جاري...' : 'نسخة احتياطية كاملة (سحابة)'}
            </button>
            <input ref={cloudBackupFileInputRef} type="file" accept=".json" onChange={handleImportCloudBackup} className="hidden" />
            <button onClick={() => cloudBackupFileInputRef.current?.click()} disabled={cloudBackupBusy}
              title="استرجاع نسخة احتياطية كاملة إلى Supabase"
              className="text-xs px-3 py-1.5 rounded-lg bg-[hsl(var(--success))]/20 text-[hsl(var(--success))] font-semibold flex items-center gap-1 disabled:opacity-50">
              <Upload size={12} /> استرجاع (سحابة)
            </button>
            <button onClick={() => setShowAuditLog(true)} title="سجل التعديلات (من غيّر ماذا ومتى)"
              className="text-xs px-3 py-1.5 rounded-lg bg-[hsl(var(--secondary))] text-[hsl(var(--foreground))] font-semibold flex items-center gap-1">
              <ClipboardList size={12} /> سجل التعديلات
            </button>
            <button onClick={() => backupFileInputRef.current?.click()} title="استيراد نسخة احتياطية"
              className="text-xs px-3 py-1.5 rounded-lg bg-[hsl(var(--secondary))] text-[hsl(var(--foreground))] font-semibold flex items-center gap-1">
              <Upload size={12} /> استيراد
            </button>
          </div>
        </div>

        {/* Saved Tournaments List */}
        {showSavedList && (
          <div className="panel p-4 animate-fade-in">
            <h2 className="font-display text-sm font-bold text-[hsl(var(--primary))] mb-3 flex items-center gap-2">
              <FolderOpen size={16} /> {tr('savedTournamentsTitle')}
            </h2>
            {savedTournaments.length === 0 ? (
              <p className="text-xs text-[hsl(var(--muted-foreground))] text-center py-4">{tr('noSavedTournaments')}</p>
            ) : (
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {savedTournaments.map(t => (
                  <div key={t.id}
                    className="w-full flex items-center gap-2 px-4 py-3 rounded-xl bg-[hsl(var(--secondary))]/50 hover:bg-[hsl(var(--primary))]/20 transition-colors border border-[hsl(var(--border))]/30">
                    <button onClick={() => loadTournament(t)} className="flex-1 text-left min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <div className="font-semibold text-[hsl(var(--foreground))] text-sm truncate flex items-center gap-1.5">
                            {t.name}
                            {isLocalTournamentId(t.id) && (
                              <span className="text-[9px] px-1.5 py-0.5 rounded bg-[hsl(var(--warning))]/20 text-[hsl(var(--warning))] font-bold shrink-0" title="محفوظة محلياً فقط، لم تُزامَن مع السحابة بعد">
                                محلي فقط
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-[hsl(var(--muted-foreground))]">
                            {t.gender === 'male' ? 'Male' : 'Female'} • {t.weight_category} • {t.format} • {t.age_group}
                          </div>
                          {(t as any).display_colors && (
                            <div className="flex items-center gap-1.5 mt-1.5" title="Saved tournament display colors">
                              <span className="text-[8px] font-black text-white/35 uppercase tracking-wider">COLORS</span>
                              <span className="w-4 h-4 rounded-full border border-white/20 shadow-[0_0_8px_rgba(255,255,255,.12)]" style={{background:(t as any).display_colors.redColor}} />
                              <span className="w-4 h-4 rounded-full border border-white/20 shadow-[0_0_8px_rgba(255,255,255,.12)]" style={{background:(t as any).display_colors.blueColor}} />
                              <span className="w-3 h-3 rounded-full border border-white/15" style={{background:(t as any).display_colors.titleColor}} />
                            </div>
                          )}
                        </div>
                        <div className={`text-xs px-2 py-1 rounded shrink-0 ${t.status === 'active' ? 'bg-[hsl(var(--success))]/20 text-[hsl(var(--success))]' : 'bg-[hsl(var(--muted))]/20 text-[hsl(var(--muted-foreground))]'}`}>
                          {t.status}
                        </div>
                      </div>
                    </button>
                    {isLocalTournamentId(t.id) && (
                      <button
                        onClick={async (e) => {
                          e.stopPropagation();
                          await handleSyncToCloud(t);
                        }}
                        disabled={syncingId === t.id}
                        className="shrink-0 p-2 rounded-lg text-[hsl(var(--info))] hover:bg-[hsl(var(--info))]/15 transition-colors disabled:opacity-40"
                        title="مزامنة هذه البطولة مع السحابة الآن"
                      >
                        {syncingId === t.id ? <RefreshCw size={14} className="animate-spin" /> : <CloudUpload size={14} />}
                      </button>
                    )}
                    <button
                      onClick={async (e) => {
                        e.stopPropagation();
                        if (!confirm(`Delete tournament "${t.name}"? This cannot be undone.`)) return;
                        deleteTournamentLocal(t.id);
                        logAudit('tournament_deleted', `Deleted tournament "${t.name}" (${t.weight_category}, ${t.gender}, ${t.age_group})`);
                        try { await supabase.from('tournaments').delete().eq('id', t.id); } catch { /* may only have existed locally */ }
                        loadSavedTournaments();
                      }}
                      className="shrink-0 p-2 rounded-lg text-[hsl(var(--destructive))] hover:bg-[hsl(var(--destructive))]/15 transition-colors"
                      title={tr('deleteTournamentTitle')}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <TournamentFileCenter tournaments={savedTournaments} activeMatch={matchState} onOpen={loadTournament} onStart={(t:any)=>{ setPendingAutoStart(true); setPendingAutoStartMat((t as any)?.matNumber); void loadTournament(t as SavedTournament); }} onAutoFill={handleAutoFillWeight} />

        {/* Podium Display */}
        {showPodium && sortedClubs.length > 0 && (
          <div className="panel-power p-6 animate-fade-in">
            <h2 className="title-power text-lg text-center mb-6 flex items-center justify-center gap-2">
              <Crown size={20} className="text-[hsl(var(--gold))]" /> Club Podium
            </h2>
            <div className="flex items-end justify-center gap-4 mb-6" style={{ minHeight: '200px' }}>
              {sortedClubs[1] && (
                <div className="text-center" style={{ animation: 'podiumRise 0.6s ease-out 0.2s both' }}>
                  <div className="text-4xl mb-2">🥈</div>
                  <div className="w-28 rounded-t-xl flex flex-col items-center justify-end p-3" style={{ height: '120px', background: 'linear-gradient(180deg, hsl(0 0% 75%), hsl(0 0% 55%))' }}>
                    <div className="font-display font-bold text-white text-sm">{sortedClubs[1].name}</div>
                    <div className="text-white/70 text-xs">{getCountryFlag(sortedClubs[1].country)} {sortedClubs[1].country}</div>
                    <div className="font-display font-bold text-white text-lg mt-1">{sortedClubs[1].points} pts</div>
                  </div>
                </div>
              )}
              {sortedClubs[0] && (
                <div className="text-center" style={{ animation: 'podiumRise 0.6s ease-out both' }}>
                  <div className="text-5xl mb-2">🥇</div>
                  <div className="w-32 rounded-t-xl flex flex-col items-center justify-end p-3" style={{ height: '160px', background: 'linear-gradient(180deg, hsl(45 93% 58%), hsl(38 80% 40%))', boxShadow: '0 0 30px hsl(45 93% 58% / 0.4)' }}>
                    <div className="font-display font-bold text-white text-base">{sortedClubs[0].name}</div>
                    <div className="text-white/70 text-xs">{getCountryFlag(sortedClubs[0].country)} {sortedClubs[0].country}</div>
                    <div className="font-display font-bold text-white text-2xl mt-1">{sortedClubs[0].points} pts</div>
                  </div>
                </div>
              )}
              {sortedClubs[2] && (
                <div className="text-center" style={{ animation: 'podiumRise 0.6s ease-out 0.4s both' }}>
                  <div className="text-4xl mb-2">🥉</div>
                  <div className="w-28 rounded-t-xl flex flex-col items-center justify-end p-3" style={{ height: '100px', background: 'linear-gradient(180deg, hsl(30 60% 50%), hsl(25 50% 35%))' }}>
                    <div className="font-display font-bold text-white text-sm">{sortedClubs[2].name}</div>
                    <div className="text-white/70 text-xs">{getCountryFlag(sortedClubs[2].country)} {sortedClubs[2].country}</div>
                    <div className="font-display font-bold text-white text-lg mt-1">{sortedClubs[2].points} pts</div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {saveOkNotice && (
          <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
            <div className="w-full max-w-md rounded-2xl border-2 border-emerald-400/35 bg-[#07110d] p-6 text-center shadow-[0_30px_100px_rgba(0,0,0,.75)]">
              <div className="text-lg font-black text-emerald-300">✓ {lang === 'ar' ? 'تم حفظ البطولة' : 'TOURNAMENT SAVED'}</div>
              <div className="mt-2 text-xs text-white/55">{lang === 'ar' ? `${tournamentName} · ${gender} · ${ageGroup} · ${weightCat}` : `${tournamentName} · ${gender} · ${ageGroup} · ${weightCat}`}</div>
              <button onClick={() => setSaveOkNotice(false)} className="mt-5 w-full rounded-xl bg-emerald-400 py-3 text-sm font-black text-black">OK</button>
            </div>
          </div>
        )}

        {/* Tournament Settings */}
        <div className="panel p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-display text-sm font-bold text-[hsl(var(--foreground))]">{tr('tournamentSettingsTitle')}</h2>
            <button onClick={() => handleSaveTournament()} className="text-xs px-3 py-1.5 rounded-lg bg-[hsl(var(--success))]/20 text-[hsl(var(--success))] font-semibold flex items-center gap-1">
              <Save size={12} /> {tr('saveLabel')}
            </button>
            <button onClick={() => { if (!exportAutoBackupSnapshot()) alert('ماكاينش نسخة تلقائية بعد — راه كتدار كل 15 دقيقة تلقائيا.'); }}
              title="تصدير آخر نسخة احتياطية تلقائية (تلقائية كل 15 دقيقة)"
              className="text-xs px-3 py-1.5 rounded-lg bg-[hsl(var(--secondary))] text-[hsl(var(--muted-foreground))] font-semibold flex items-center gap-1">
              <Archive size={12} /> آخر نسخة تلقائية{lastAutoBackup ? ` (${lastAutoBackup})` : ''}
            </button>
            <button onClick={() => setShowSavedMatches(true)}
              title="تصفح كل المباريات المحفوظة (السحابة + محليا) لهاذ البطولة"
              className="text-xs px-3 py-1.5 rounded-lg bg-[hsl(var(--secondary))] text-[hsl(var(--foreground))] font-semibold flex items-center gap-1">
              <ClipboardList size={12} /> المباريات المحفوظة
            </button>
          </div>
          {saveError && (
            <div className="mb-3 p-2.5 rounded-lg bg-destructive/10 border border-destructive text-destructive text-xs font-semibold">
              ⚠ تعذّرت مزامنة السحابة: {saveError} — البيانات محفوظة محليا، ولكن ماوصلاتش لقاعدة البيانات (الأجهزة الأخرى ماغاديش تشوفها). تحقق من الاتصال وعاود Save.
            </div>
          )}

          {/* Tournament Templates — reuse a saved format/age/gender/weight
              (and substitution mode, for Par Équipe) combo instead of
              re-entering it every time. Persisted in Supabase, so it's
              available on any device, not just this browser. */}
          <div className="flex flex-wrap items-center gap-2 mb-3 pb-3 border-b border-[hsl(var(--border))]/30">
            <FolderOpen size={13} className="text-[hsl(var(--muted-foreground))] shrink-0" />
            <select value={selectedTemplateId} onChange={e => handleLoadTemplate(e.target.value)}
              className="px-2 py-1.5 rounded-lg bg-[hsl(var(--secondary))] border border-[hsl(var(--border))] text-[hsl(var(--foreground))] text-xs max-w-[220px]">
              <option value="">تحميل قالب...</option>
              {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
            <button type="button" onClick={handleSaveTemplate}
              className="text-xs px-2.5 py-1.5 rounded-lg bg-[hsl(var(--secondary))] border border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--primary))] hover:border-[hsl(var(--primary))] transition-colors flex items-center gap-1">
              <Save size={12} /> حفظ كقالب
            </button>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <div>
              <label className="text-xs text-[hsl(var(--muted-foreground))] font-semibold block mb-1">{tr('tournamentNameLabel')}</label>
              <input value={tournamentName} onChange={e => setTournamentName(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-[hsl(var(--secondary))] border border-[hsl(var(--border))] text-[hsl(var(--foreground))] text-sm focus:ring-2 focus:ring-[hsl(var(--primary))] focus:outline-none"
                placeholder={tr('tournamentNameExample')} />
            </div>
            <div>
              <label className="text-xs text-[hsl(var(--muted-foreground))] font-semibold block mb-1">{tr('eventDateLabel')}</label>
              <input value={eventDate} onChange={e => setEventDate(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-[hsl(var(--secondary))] border border-[hsl(var(--border))] text-[hsl(var(--foreground))] text-sm"
                placeholder={tr('eventDateExample')} />
            </div>
            <div>
              <label className="text-xs text-[hsl(var(--muted-foreground))] font-semibold flex items-center justify-between mb-1">
                {tr('locationLabel')}
                <button type="button" onClick={handleUseMyLocation} disabled={locatingEvent}
                  className="text-[10px] text-[hsl(var(--primary))] font-normal disabled:opacity-50">
                  {locatingEvent ? '...جارٍ التحديد' : '📍 استعمل موقعي الحالي'}
                </button>
              </label>
              <input value={eventLocation} onChange={e => setEventLocation(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-[hsl(var(--secondary))] border border-[hsl(var(--border))] text-[hsl(var(--foreground))] text-sm"
                placeholder={tr('locationExample')} />
            </div>
            <div>
              <label className="text-xs text-[hsl(var(--muted-foreground))] font-semibold block mb-1">{tr('competitionTypeLabel')}</label>
              <select value={mode} onChange={e => setMode(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-[hsl(var(--secondary))] border border-[hsl(var(--border))] text-[hsl(var(--foreground))] text-sm">
                {COMPETITION_MODES.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
            </div>
            {mode === 'league' && (
              <div>
                <label className="text-xs text-[hsl(var(--muted-foreground))] font-semibold block mb-1">
                  متى تنتهي بطولة الدوري؟ / When is the league considered finished?
                </label>
                <select value={leagueMedalTrigger} onChange={e => setLeagueMedalTrigger(e.target.value as 'auto' | 'manual')}
                  className="w-full px-3 py-2 rounded-lg bg-[hsl(var(--secondary))] border border-[hsl(var(--border))] text-[hsl(var(--foreground))] text-sm">
                  <option value="manual">يدويًا (زر "إنهاء الدوري وتوزيع الميداليات") / Manual (End League &amp; Award Medals button)</option>
                  <option value="auto">تلقائيًا عند لعب كل المباريات / Automatic once every match is played</option>
                </select>
                <p className="text-[10px] text-[hsl(var(--muted-foreground))] mt-1">
                  يحدد هذا متى تُسجَّل ميداليات 🥇🥈🥉 لأول 3 مراكز في الترتيب. / Controls when 🥇🥈🥉 medals get recorded for the top 3 standings.
                </p>
              </div>
            )}
            <div>
              <label className="text-xs text-[hsl(var(--muted-foreground))] font-semibold block mb-1">
                {tr('ageGroupLabel')} {useCustomCategory && <span className="opacity-60">(مقترح — يمكن تغييره)</span>}
              </label>
              <select value={ageGroup} onChange={e => { setAgeGroup(e.target.value); if (!useCustomCategory) setWeightCat(''); }}
                className="w-full px-3 py-2 rounded-lg bg-[hsl(var(--secondary))] border border-[hsl(var(--border))] text-[hsl(var(--foreground))] text-sm">
                {AGE_GROUPS.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-[hsl(var(--muted-foreground))] font-semibold block mb-1">{tr('genderToggle')}</label>
              <select value={gender} onChange={e => { setGender(e.target.value); if (!useCustomCategory) setWeightCat(''); }}
                className="w-full px-3 py-2 rounded-lg bg-[hsl(var(--secondary))] border border-[hsl(var(--border))] text-[hsl(var(--foreground))] text-sm">
                {GENDERS.map(g => <option key={g.value} value={g.value}>{g.label}</option>)}
              </select>
            </div>
            {!useCustomCategory && (
              <div>
                <label className="text-xs text-[hsl(var(--muted-foreground))] font-semibold block mb-1">{tr('weightCategoryLabel')}</label>
                <select value={weightCat} onChange={e => setWeightCat(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-[hsl(var(--secondary))] border border-[hsl(var(--border))] text-[hsl(var(--foreground))] text-sm">
                  <option value="">{tr('selectWeightPlaceholder')}</option>
                  {weightCategories.map(w => <option key={w} value={w}>{w}</option>)}
                </select>
              </div>
            )}
          </div>

          {/* Free-entry toggle: pick a ready-made age/weight category, or type
              them in freely (useful for Kids groups or non-standard weigh-ins).
              Tournaments saved before this feature keep working unchanged —
              this only adds an alternative way to fill the same ageGroup /
              weightCat fields. */}
          <div className="flex items-center gap-2 mt-2">
            <button type="button" onClick={() => setUseCustomCategory(v => !v)}
              className={`text-[11px] px-2.5 py-1 rounded-full border transition-colors ${useCustomCategory ? 'bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] border-[hsl(var(--primary))]' : 'bg-[hsl(var(--secondary))] border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))]'}`}>
              {useCustomCategory ? '✓ إدخال حر (العمر/الوزن)' : 'استعمال إدخال حر بدل الفئات الجاهزة'}
            </button>
          </div>
          {useCustomCategory && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-2">
              <div>
                <label className="text-xs text-[hsl(var(--muted-foreground))] font-semibold block mb-1">العمر (سنوات)</label>
                <input value={customAge} onChange={e => setCustomAge(e.target.value.replace(/[^0-9]/g, ''))}
                  inputMode="numeric" placeholder="مثال: 10"
                  className="w-full px-3 py-2 rounded-lg bg-[hsl(var(--secondary))] border border-[hsl(var(--border))] text-[hsl(var(--foreground))] text-sm" />
              </div>
              <div className="col-span-2 md:col-span-2">
                <label className="text-xs text-[hsl(var(--muted-foreground))] font-semibold block mb-1">الوزن (kg)</label>
                <div className="flex gap-1">
                  <select value={customWeightSign} onChange={e => setCustomWeightSign(e.target.value as '-' | '+')}
                    className="px-2 py-2 rounded-lg bg-[hsl(var(--secondary))] border border-[hsl(var(--border))] text-[hsl(var(--foreground))] text-sm">
                    <option value="-">تحت (-)</option>
                    <option value="+">فوق (+)</option>
                  </select>
                  <input value={customWeightAmount} onChange={e => setCustomWeightAmount(e.target.value.replace(/[^0-9.]/g, ''))}
                    inputMode="decimal" placeholder="مثال: 27"
                    className="flex-1 px-3 py-2 rounded-lg bg-[hsl(var(--secondary))] border border-[hsl(var(--border))] text-[hsl(var(--foreground))] text-sm" />
                  <span className="self-center text-xs text-[hsl(var(--muted-foreground))] px-1">
                    {weightCat || '—'}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* MAT WEIGHT WORKLOAD PLAN — saved with the tournament and used by
              Tournament Control Center to decide which ready matches can be
              queued on each physical mat. Empty assignment = all weights. */}
          <div className="mt-4 pt-4 border-t border-[hsl(var(--border))]/30">
            <button type="button" onClick={() => setMatPlanOpen(v => !v)} className="text-xs font-display font-black text-[hsl(var(--gold))] flex items-center gap-2">
              🧭 MAT WORKLOAD / توزيع الأوزان على البسطات {matPlanOpen ? '▲' : '▼'}
            </button>
            <p className="text-[10px] text-[hsl(var(--muted-foreground))] mt-1">
              حدد الأوزان التي يتكلف بها كل بساط في هذه البطولة. عند تفعيل التوزيع، لن يرسل النظام مباراة وزنها مختلف إلى ذلك البساط. البساط بدون أوزان محددة يقبل كل الأوزان.
            </p>
            {matPlanOpen && (
              <div className="mt-3 space-y-2">
                {Array.from({ length: getMatCount() }, (_, i) => i + 1).map(mat => {
                  const selected = matWeightAssignments[String(mat)] || [];
                  const active = selected.length > 0;
                  return (
                    <div key={mat} className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--secondary))]/30 p-3">
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <div className="text-xs font-display font-black text-[hsl(var(--gold))]">MAT {String(mat).padStart(2,'0')}</div>
                        <span className="text-[9px] text-muted-foreground">{active ? `${selected.length} weight${selected.length > 1 ? 's' : ''} assigned` : 'ALL WEIGHTS'}</span>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {weightCategories.map(w => {
                          const checked = selected.includes(w);
                          return <button key={w} type="button" onClick={() => setMatWeightAssignments(prev => { const key=String(mat); const cur=prev[key] || []; const next=checked ? cur.filter(x=>x!==w) : [...cur,w]; const copy={...prev}; if(next.length) copy[key]=next; else delete copy[key]; return copy; })} className={`px-2 py-1 rounded-md text-[9px] font-bold border ${checked ? 'bg-[hsl(var(--gold))]/20 border-[hsl(var(--gold))] text-[hsl(var(--gold))]' : 'bg-black/10 border-[hsl(var(--border))] text-muted-foreground'}`}>{checked ? '✓ ' : ''}{w}</button>;
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Competition Rules — per-tournament match settings, applied to every match started from this tournament's bracket */}
          <div className="mt-3 pt-3 border-t border-[hsl(var(--border))]/30">
            <button onClick={() => setShowRules(!showRules)}
              className="text-xs font-semibold text-[hsl(var(--primary))] flex items-center gap-1">
              <Gavel size={12} /> Competition Rules {showRules ? '▲' : '▼'}
            </button>
            <p className="text-[10px] text-[hsl(var(--muted-foreground))] mt-1">
              اضبط قوانين المباراة الخاصة بهذه البطولة (المدد، عدد الجولات، فارق النقاط، حد الإنذارات...) — ستُطبَّق تلقائياً على كل مباراة تُبدأ من هذه البطولة.
            </p>
            {showRules && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3">
                <div>
                  <label className="text-xs text-[hsl(var(--muted-foreground))] font-semibold block mb-1">{tr('rounds')}</label>
                  <input type="number" value={rules.rounds ?? DEFAULT_CONFIG.rounds}
                    onChange={e => setRules({ ...rules, rounds: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-lg bg-[hsl(var(--secondary))] border border-[hsl(var(--border))] text-[hsl(var(--foreground))] text-sm" />
                </div>
                <div>
                  <label className="text-xs text-[hsl(var(--muted-foreground))] font-semibold block mb-1">{tr('roundTime')}</label>
                  <input type="number" value={rules.roundTime ?? DEFAULT_CONFIG.roundTime}
                    onChange={e => setRules({ ...rules, roundTime: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-lg bg-[hsl(var(--secondary))] border border-[hsl(var(--border))] text-[hsl(var(--foreground))] text-sm" />
                </div>
                <div>
                  <label className="text-xs text-[hsl(var(--muted-foreground))] font-semibold block mb-1">{tr('restTime')}</label>
                  <input type="number" value={rules.restTime ?? DEFAULT_CONFIG.restTime}
                    onChange={e => setRules({ ...rules, restTime: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-lg bg-[hsl(var(--secondary))] border border-[hsl(var(--border))] text-[hsl(var(--foreground))] text-sm" />
                </div>
                <div>
                  <label className="text-xs text-[hsl(var(--muted-foreground))] font-semibold flex items-center justify-between mb-1">
                    {tr('gamjeomLimitLabel')}
                    <span className="flex items-center gap-1 font-normal">
                      <input type="checkbox" checked={rules.enforceGamjeomLimit ?? true} className="w-3.5 h-3.5 accent-primary"
                        onChange={e => setRules({ ...rules, enforceGamjeomLimit: e.target.checked })} />
                      {tr('enabledLabel')}
                    </span>
                  </label>
                  <input type="number" value={rules.gamjeomLimit ?? lastRulesGamjeomLimit} disabled={rules.enforceGamjeomLimit === false}
                    onChange={e => { const v = Number(e.target.value); setRules({ ...rules, gamjeomLimit: v }); setLastRulesGamjeomLimit(v); }}
                    className="w-full px-3 py-2 rounded-lg bg-[hsl(var(--secondary))] border border-[hsl(var(--border))] text-[hsl(var(--foreground))] text-sm disabled:opacity-40" />
                </div>
                <div>
                  <label className="text-xs text-[hsl(var(--muted-foreground))] font-semibold flex items-center justify-between mb-1">
                    آخر 10 ثوانٍ — 1v1 + Par Équipe
                    <span className="flex items-center gap-1 font-normal">
                      <input type="checkbox" checked={rules.last10SecondsRuleEnabled ?? true} className="w-3.5 h-3.5 accent-primary"
                        onChange={e => setRules({ ...rules, last10SecondsRuleEnabled: e.target.checked })} />
                      {tr('enabledLabel')}
                    </span>
                  </label>
                  <div className="flex rounded-lg overflow-hidden border border-[hsl(var(--border))]">
                    <button type="button" disabled={rules.last10SecondsRuleEnabled === false} onClick={() => setRules({ ...rules, last10SecondsGamjeomPoints: 1 })}
                      className={`flex-1 px-2 py-2 text-xs font-semibold transition-colors ${(rules.last10SecondsGamjeomPoints ?? 2) === 1 ? 'bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]' : 'bg-[hsl(var(--secondary))]/50 text-[hsl(var(--muted-foreground))]'}`}>+1</button>
                    <button type="button" disabled={rules.last10SecondsRuleEnabled === false} onClick={() => setRules({ ...rules, last10SecondsGamjeomPoints: 2 })}
                      className={`flex-1 px-2 py-2 text-xs font-semibold transition-colors ${(rules.last10SecondsGamjeomPoints ?? 2) === 2 ? 'bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]' : 'bg-[hsl(var(--secondary))]/50 text-[hsl(var(--muted-foreground))]'}`}>+2</button>
                  </div>
                  <div className="text-[10px] text-[hsl(var(--muted-foreground))] mt-1">القاعدة تعمل فقط أثناء آخر 10 ثوانٍ، والإنذار العادي يبقى 0 نقطة.</div>
                </div>
                <div>
                  <label className="text-xs text-[hsl(var(--muted-foreground))] font-semibold block mb-1">{tr('penaltySchemeLabel')}</label>
                  <div className="flex rounded-lg overflow-hidden border border-[hsl(var(--border))]">
                    <button type="button" onClick={() => setRules({ ...rules, penaltyScheme: 'binary' })}
                      className={`flex-1 px-2 py-2 text-xs font-semibold transition-colors ${(rules.penaltyScheme ?? 'binary') === 'binary' ? 'bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]' : 'bg-[hsl(var(--secondary))]/50 text-[hsl(var(--muted-foreground))]'}`}>
                      {tr('penaltySchemeBinary')}
                    </button>
                    <button type="button" onClick={() => setRules({ ...rules, penaltyScheme: 'single' })}
                      className={`flex-1 px-2 py-2 text-xs font-semibold transition-colors ${rules.penaltyScheme === 'single' ? 'bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]' : 'bg-[hsl(var(--secondary))]/50 text-[hsl(var(--muted-foreground))]'}`}>
                      {tr('penaltySchemeSingle')}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="text-xs text-[hsl(var(--muted-foreground))] font-semibold flex items-center justify-between mb-1">
                    {tr('pointGapLabel')} (PTG)
                    <span className="flex items-center gap-1 font-normal">
                      <input type="checkbox" checked={(rules.pointGap ?? DEFAULT_CONFIG.pointGap) > 0} className="w-3.5 h-3.5 accent-primary"
                        onChange={e => {
                          if (e.target.checked) setRules({ ...rules, pointGap: lastRulesPointGap });
                          else { const cur = rules.pointGap ?? DEFAULT_CONFIG.pointGap; if (cur > 0) setLastRulesPointGap(cur); setRules({ ...rules, pointGap: 0 }); }
                        }} />
                      {tr('enabledLabel')}
                    </span>
                  </label>
                  <input type="number" value={rules.pointGap ?? DEFAULT_CONFIG.pointGap} disabled={(rules.pointGap ?? DEFAULT_CONFIG.pointGap) === 0}
                    onChange={e => { const v = Number(e.target.value); setRules({ ...rules, pointGap: v }); if (v > 0) setLastRulesPointGap(v); }}
                    className="w-full px-3 py-2 rounded-lg bg-[hsl(var(--secondary))] border border-[hsl(var(--border))] text-[hsl(var(--foreground))] text-sm disabled:opacity-40" />
                </div>
                <div>
                  <label className="text-xs text-[hsl(var(--muted-foreground))] font-semibold block mb-1">{tr('turningHeadPointsLabel')}</label>
                  <div className="flex rounded-lg overflow-hidden border border-[hsl(var(--border))]">
                    <button type="button" onClick={() => setRules({ ...rules, turningHeadPoints: 5 })}
                      className={`flex-1 px-2 py-2 text-xs font-semibold transition-colors ${(rules.turningHeadPoints ?? DEFAULT_CONFIG.turningHeadPoints) === 5 ? 'bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]' : 'bg-[hsl(var(--secondary))]/50 text-[hsl(var(--muted-foreground))]'}`}>
                      {tr('turningHeadFive')}
                    </button>
                    <button type="button" onClick={() => setRules({ ...rules, turningHeadPoints: 6 })}
                      className={`flex-1 px-2 py-2 text-xs font-semibold transition-colors ${(rules.turningHeadPoints ?? DEFAULT_CONFIG.turningHeadPoints) === 6 ? 'bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]' : 'bg-[hsl(var(--secondary))]/50 text-[hsl(var(--muted-foreground))]'}`}>
                      {tr('turningHeadSix')}
                    </button>
                  </div>
                  <p className="text-[9px] text-[hsl(var(--muted-foreground))] mt-1">{tr('turningHeadPointsDesc')}</p>
                </div>
                {mode === 'par_equipe' && <>
                  <div className="mt-2 rounded-xl border border-[hsl(var(--gold))]/25 bg-[hsl(var(--gold))]/5 p-3">
                    <div className="text-[10px] font-black uppercase tracking-wider text-[hsl(var(--gold))] mb-2">PAR ÉQUIPE — SCORE RULES</div>
                    <label className="text-xs text-[hsl(var(--muted-foreground))] font-semibold block mb-1">{tr('turningHeadPointsLabel')}</label>
                    <div className="flex rounded-lg overflow-hidden border border-[hsl(var(--border))]">
                      <button type="button" onClick={() => setRules({ ...rules, turningHeadPoints: 5 })}
                        className={`flex-1 px-3 py-2 text-xs font-black transition-colors ${(rules.turningHeadPoints ?? DEFAULT_CONFIG.turningHeadPoints) === 5 ? 'bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]' : 'bg-[hsl(var(--secondary))]/50 text-[hsl(var(--muted-foreground))]'}`}>
                        +5
                      </button>
                      <button type="button" onClick={() => setRules({ ...rules, turningHeadPoints: 6 })}
                        className={`flex-1 px-3 py-2 text-xs font-black transition-colors ${(rules.turningHeadPoints ?? DEFAULT_CONFIG.turningHeadPoints) === 6 ? 'bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]' : 'bg-[hsl(var(--secondary))]/50 text-[hsl(var(--muted-foreground))]'}`}>
                        +6
                      </button>
                    </div>
                    <p className="text-[9px] text-[hsl(var(--muted-foreground))] mt-2">The Main Referee tournament setting is authoritative. A judge request marked as Turning Head uses this value when approved.</p>
                  </div>
                  <div>
                    <label className="text-xs text-[hsl(var(--muted-foreground))] font-semibold block mb-1">{tr('parEquipeRosterFormatLabel')}</label>
                    <select value={rules.parEquipeRosterFormat ?? DEFAULT_CONFIG.parEquipeRosterFormat}
                      onChange={e => setRules({ ...rules, parEquipeRosterFormat: e.target.value as 'custom'|'4+1'|'5+1' })}
                      className="w-full px-3 py-2 rounded-lg bg-[hsl(var(--secondary))] border border-[hsl(var(--border))] text-[hsl(var(--foreground))] text-sm">
                      <option value="custom">{tr('parEquipeRosterCustom')}</option>
                      <option value="4+1">{tr('parEquipeRoster4')}</option>
                      <option value="5+1">{tr('parEquipeRoster5')}</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-[hsl(var(--muted-foreground))] font-semibold block mb-1">{tr('parEquipeTagSecondsLabel')}</label>
                    <input type="number" min={1} max={30} step={0.5} value={rules.parEquipeTagSeconds ?? DEFAULT_CONFIG.parEquipeTagSeconds}
                      onChange={e => setRules({ ...rules, parEquipeTagSeconds: Number(e.target.value) })}
                      className="w-full px-3 py-2 rounded-lg bg-[hsl(var(--secondary))] border border-[hsl(var(--border))] text-[hsl(var(--foreground))] text-sm" />
                  </div>
                  <div>
                    <label className="text-xs text-[hsl(var(--muted-foreground))] font-semibold flex items-center justify-between mb-1">
                      {tr('parEquipeWeightLimitLabel')}
                      <input type="checkbox" checked={rules.parEquipeWeightLimitEnabled ?? DEFAULT_CONFIG.parEquipeWeightLimitEnabled} className="w-3.5 h-3.5 accent-primary"
                        onChange={e => setRules({ ...rules, parEquipeWeightLimitEnabled: e.target.checked })} />
                    </label>
                    <input type="number" min={0} step={0.1} disabled={!rules.parEquipeWeightLimitEnabled}
                      value={rules.parEquipeWeightLimit ?? DEFAULT_CONFIG.parEquipeWeightLimit}
                      onChange={e => setRules({ ...rules, parEquipeWeightLimit: Number(e.target.value) })}
                      className="w-full px-3 py-2 rounded-lg bg-[hsl(var(--secondary))] border border-[hsl(var(--border))] text-[hsl(var(--foreground))] text-sm disabled:opacity-40" />
                    <p className="text-[9px] text-[hsl(var(--muted-foreground))] mt-1">{tr('parEquipeWeightLimitDesc')}</p>
                  </div>
                </>}
                <div>
                  <label className="text-xs text-[hsl(var(--muted-foreground))] font-semibold block mb-1">{tr('judgeCount')}</label>
                  <input type="number" min={1} max={4} value={rules.judgeCount ?? DEFAULT_CONFIG.judgeCount}
                    onChange={e => setRules({ ...rules, judgeCount: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-lg bg-[hsl(var(--secondary))] border border-[hsl(var(--border))] text-[hsl(var(--foreground))] text-sm" />
                </div>
                <div>
                  <label className="text-xs text-[hsl(var(--muted-foreground))] font-semibold block mb-1">{tr('ivrQuota')}</label>
                  <input type="number" min={0} value={rules.ivrQuota ?? DEFAULT_CONFIG.ivrQuota}
                    onChange={e => setRules({ ...rules, ivrQuota: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-lg bg-[hsl(var(--secondary))] border border-[hsl(var(--border))] text-[hsl(var(--foreground))] text-sm" />
                </div>
                <div className="flex items-end pb-1">
                  <label className="flex items-center gap-1.5 text-xs font-semibold text-[hsl(var(--muted-foreground))]">
                    <input type="checkbox" checked={rules.goldenRound ?? DEFAULT_CONFIG.goldenRound} className="w-3.5 h-3.5 accent-primary"
                      onChange={e => setRules({ ...rules, goldenRound: e.target.checked })} />
                    {tr('goldenRoundTitle')}
                  </label>
                </div>
                <div className="flex items-end pb-1">
                  <label className="flex items-center gap-1.5 text-xs font-semibold text-[hsl(var(--muted-foreground))]">
                    <input type="checkbox" checked={rules.autoApproveJudgeScores ?? DEFAULT_CONFIG.autoApproveJudgeScores} className="w-3.5 h-3.5 accent-primary"
                      onChange={e => setRules({ ...rules, autoApproveJudgeScores: e.target.checked })} />
                    {tr('autoApproveTitle')}
                  </label>
                </div>
                <div className="flex items-end pb-1">
                  <label className="flex items-center gap-1.5 text-xs font-semibold text-[hsl(var(--muted-foreground))]" title={tr('carryScoreDesc')}>
                    <input type="checkbox" checked={!(rules.scoreResetPerRound ?? true)} className="w-3.5 h-3.5 accent-primary"
                      onChange={e => setRules({ ...rules, scoreResetPerRound: !e.target.checked })} />
                    {tr('carryScoreTitle')}
                  </label>
                </div>
                <div className="flex items-end pb-1">
                  <label className="flex items-center gap-1.5 text-xs font-semibold text-[hsl(var(--muted-foreground))]" title="Warnings reset each round">
                    <input type="checkbox" checked={rules.warningResetPerRound ?? true} className="w-3.5 h-3.5 accent-primary"
                      onChange={e => setRules({ ...rules, warningResetPerRound: e.target.checked })} />
                    Warnings reset each round
                  </label>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Add players */}
        <div className="panel p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-display text-sm font-bold text-[hsl(var(--foreground))] flex items-center gap-2">
              <Users size={16} /> {isParEquipe ? `${tr('teamsCountTitle')} (${visiblePlayers.length})` : `${tr('playersCountTitle')} (${visiblePlayers.length})`}
            </h2>
            <div className="flex gap-2">
              <input ref={fileInputRef} type="file" accept=".csv,.txt,.tsv,.xlsx" onChange={handleFileImport} className="hidden" />
              <button disabled={tournamentHasStarted} onClick={() => fileInputRef.current?.click()}
                title="الأعمدة: الاسم، الدولة، النادي، رقم اللاعب، التصنيف/البذرة، رابط الصورة (اختياري)"
                className="text-xs px-3 py-1.5 rounded-lg bg-[hsl(var(--primary))]/20 text-[hsl(var(--primary))] font-semibold flex items-center gap-1">
                <Upload size={12} /> Import CSV/Excel
              </button>
              {players.length > 0 && (
                <button onClick={handleExport}
                  className="text-xs px-3 py-1.5 rounded-lg bg-[hsl(var(--secondary))] text-[hsl(var(--muted-foreground))] font-semibold flex items-center gap-1">
                  <Download size={12} /> Export
                </button>
              )}
            </div>
          </div>

          {tournamentHasStarted && (
            <div className="mb-3 rounded-xl border-2 border-amber-400/30 bg-amber-400/[.06] px-3 py-2 text-[10px] font-black text-amber-200">
              🔒 ROSTER LOCKED — THIS WEIGHT HAS STARTED. Players cannot be added/removed until this category is reset by an authorized correction flow.
            </div>
          )}
          <div className="flex gap-2 mb-3">
            <label className="relative shrink-0 cursor-pointer group" title={isParEquipe ? 'إضافة شعار الفريق (Team Logo)' : 'إضافة صورة اللاعب'}>
              {(isParEquipe ? newTeamLogo : newPhoto) ? (
                <img src={isParEquipe ? newTeamLogo : newPhoto} alt="" className={`w-9 h-9 ${isParEquipe ? 'rounded-lg' : 'rounded-full'} object-cover border border-[hsl(var(--border))]`} />
              ) : (
                <div className={`w-9 h-9 ${isParEquipe ? 'rounded-lg' : 'rounded-full'} bg-[hsl(var(--secondary))] border border-dashed border-[hsl(var(--border))] flex items-center justify-center text-[hsl(var(--muted-foreground))] group-hover:border-[hsl(var(--primary))] group-hover:text-[hsl(var(--primary))] transition-colors`}>
                  <Camera size={15} />
                </div>
              )}
              <input type="file" accept="image/*" className="hidden" onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = (ev) => {
                  const dataUrl = ev.target?.result as string;
                  if (isParEquipe) setNewTeamLogo(dataUrl); else setNewPhoto(dataUrl);
                };
                reader.readAsDataURL(file);
                e.target.value = '';
              }} />
            </label>
            <button type="button" title={isParEquipe ? 'إضافة شعار الفريق برابط (Logo URL)' : 'إضافة صورة برابط (URL)'}
              onClick={() => {
                const current = isParEquipe ? newTeamLogo : newPhoto;
                const url = window.prompt(isParEquipe ? 'رابط شعار الفريق (Team Logo URL):' : 'رابط الصورة (Photo URL):', /^https?:\/\//i.test(current) ? current : '');
                if (url === null) return;
                if (isParEquipe) setNewTeamLogo(url.trim()); else setNewPhoto(url.trim());
              }}
              className="w-9 h-9 shrink-0 rounded-full bg-[hsl(var(--secondary))] border border-dashed border-[hsl(var(--border))] flex items-center justify-center text-[hsl(var(--muted-foreground))] hover:border-[hsl(var(--primary))] hover:text-[hsl(var(--primary))] transition-colors">
              <LinkIcon size={13} />
            </button>
            <input disabled={tournamentHasStarted} value={newName} onChange={e => setNewName(e.target.value)} placeholder={isParEquipe ? 'Team name' : 'Player name'}
              className="flex-1 px-3 py-2 rounded-lg bg-[hsl(var(--secondary))] border border-[hsl(var(--border))] text-[hsl(var(--foreground))] text-sm"
              onKeyDown={e => e.key === 'Enter' && addPlayer()} />
            <div className="relative w-24">
              <input disabled={tournamentHasStarted} value={newNat}
                onChange={e => { setNewNat(e.target.value); setCountrySearch(e.target.value); setShowCountryDropdown(true); }}
                onFocus={() => { setCountrySearch(newNat); setShowCountryDropdown(true); }}
                onBlur={() => setTimeout(() => setShowCountryDropdown(false), 200)}
                placeholder={tr('countryLabel')}
                className="w-full px-3 py-2 rounded-lg bg-[hsl(var(--secondary))] border border-[hsl(var(--border))] text-[hsl(var(--foreground))] text-sm" />
              {showCountryDropdown && filteredCountries.length > 0 && (
                <div className="absolute z-50 top-full left-0 right-0 mt-1 max-h-40 overflow-y-auto rounded-lg bg-[hsl(var(--card))] border border-[hsl(var(--border))] shadow-lg">
                  {filteredCountries.slice(0, 20).map(c => (
                    <button key={c} onMouseDown={() => { setNewNat(c); setShowCountryDropdown(false); }}
                      className="w-full text-left px-3 py-1.5 text-xs text-[hsl(var(--foreground))] hover:bg-[hsl(var(--primary))]/20 transition-colors">
                      {getCountryFlag(c)} {c}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <input disabled={tournamentHasStarted} value={newClub} onChange={e => setNewClub(e.target.value)} placeholder={tr('clubPlaceholder')}
              className="w-24 px-3 py-2 rounded-lg bg-[hsl(var(--secondary))] border border-[hsl(var(--border))] text-[hsl(var(--foreground))] text-sm" />
            {!isParEquipe && (
              <>
                <input value={newPlayerNumber} onChange={e => setNewPlayerNumber(e.target.value.replace(/[^0-9]/g, ''))} placeholder="#" title="رقم اللاعب"
                  inputMode="numeric"
                  className="w-14 px-2 py-2 rounded-lg bg-[hsl(var(--secondary))] border border-[hsl(var(--border))] text-[hsl(var(--foreground))] text-sm text-center" />
                <input value={newSeedNumber} onChange={e => setNewSeedNumber(e.target.value.replace(/[^0-9]/g, ''))} placeholder={tr('seedLabel')} title={tr('seedTitle')}
                  inputMode="numeric"
                  className="w-16 px-2 py-2 rounded-lg bg-[hsl(var(--secondary))] border border-[hsl(var(--border))] text-[hsl(var(--foreground))] text-sm text-center" />
              </>
            )}
            <button onClick={addPlayer} disabled={tournamentHasStarted}
              className="px-3 py-2 rounded-lg bg-[hsl(var(--primary))] disabled:opacity-40 disabled:cursor-not-allowed text-[hsl(var(--primary-foreground))] font-semibold text-sm flex items-center gap-1 active:scale-95 transition-all">
              <Plus size={14} /> Add
            </button>
          </div>

          <div className="space-y-1 max-h-48 overflow-y-auto">
            {visiblePlayers.map((p, i) => (
              <div key={p.id} className="flex items-center justify-between px-3 py-2 rounded-lg bg-[hsl(var(--secondary))]/50 text-sm">
                <div className="flex items-center gap-3">
                  <span className="text-[hsl(var(--muted-foreground))] text-xs w-6">{i + 1}.</span>
                  <label className="relative shrink-0 cursor-pointer group" title={isParEquipe ? 'رفع شعار الفريق' : 'رفع صورة اللاعب'}>
                    {(isParEquipe ? p.teamLogo : p.photo) ? (
                      <img src={isParEquipe ? p.teamLogo : p.photo} alt={p.name} className={`w-6 h-6 ${isParEquipe ? 'rounded' : 'rounded-full'} object-cover border border-[hsl(var(--border))]`} />
                    ) : (
                      <div className={`w-6 h-6 ${isParEquipe ? 'rounded' : 'rounded-full'} bg-[hsl(var(--muted))] flex items-center justify-center text-[9px] text-[hsl(var(--muted-foreground))] group-hover:bg-[hsl(var(--primary))]/20`}>
                        {p.name.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <input type="file" accept="image/*" className="hidden" onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const reader = new FileReader();
                      reader.onload = (ev) => {
                        const dataUrl = ev.target?.result as string;
                        setPlayers(prev => prev.map(pl => pl.id === p.id ? (isParEquipe ? { ...pl, teamLogo: dataUrl } : { ...pl, photo: dataUrl }) : pl));
                      };
                      reader.readAsDataURL(file);
                      e.target.value = '';
                    }} />
                  </label>
                  <button type="button" title={isParEquipe ? 'إضافة شعار الفريق برابط (URL)' : 'إضافة صورة برابط (URL)'}
                    onClick={() => {
                      const current = isParEquipe ? p.teamLogo : p.photo;
                      const url = window.prompt(isParEquipe ? 'رابط شعار الفريق (Team Logo URL):' : 'رابط الصورة (Photo URL):', /^https?:\/\//i.test(current || '') ? current : '');
                      if (url === null) return;
                      setPlayers(prev => prev.map(pl => pl.id === p.id ? (isParEquipe ? { ...pl, teamLogo: url.trim() } : { ...pl, photo: url.trim() }) : pl));
                    }}
                    className="w-4 h-4 -ml-2 mt-2 shrink-0 rounded-full bg-[hsl(var(--secondary))] border border-[hsl(var(--border))] flex items-center justify-center text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--primary))] transition-colors">
                    <LinkIcon size={8} />
                  </button>
                  {/* Club logo — secondary badge, separate from the team's own
                      (prominent) logo above. Was previously only settable per
                      live match in Admin, so a tournament-started match always
                      left this blank; now it's part of the team entry itself. */}
                  {isParEquipe && (
                    <label className="relative shrink-0 cursor-pointer group -ml-1" title="رفع شعار النادي (شارة ثانوية)">
                      {p.clubLogo ? (
                        <img src={p.clubLogo} alt="" className="w-5 h-5 rounded-full object-cover border border-[hsl(var(--border))] bg-black" />
                      ) : (
                        <div className="w-5 h-5 rounded-full bg-[hsl(var(--muted))] flex items-center justify-center text-[8px] text-[hsl(var(--muted-foreground))] group-hover:bg-[hsl(var(--primary))]/20">
                          🏛️
                        </div>
                      )}
                      <input type="file" accept="image/*" className="hidden" onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        const reader = new FileReader();
                        reader.onload = (ev) => {
                          const dataUrl = ev.target?.result as string;
                          setPlayers(prev => prev.map(pl => pl.id === p.id ? { ...pl, clubLogo: dataUrl } : pl));
                        };
                        reader.readAsDataURL(file);
                        e.target.value = '';
                      }} />
                    </label>
                  )}
                  <span>{getCountryFlag(p.nationality)}</span>
                  <span className="font-semibold text-[hsl(var(--foreground))]">{p.name}</span>
                  <span className="text-[hsl(var(--muted-foreground))] text-xs">{p.nationality}</span>
                  {p.club && <span className="text-[hsl(var(--primary))]/60 text-xs">{p.club}</span>}
                </div>
                <div className="flex items-center gap-2">
                  {!isParEquipe && (
                    <>
                      <input type="text" inputMode="numeric" placeholder="#" title="رقم اللاعب" value={p.playerNumber ?? ''}
                        onChange={e => {
                          const v = e.target.value.replace(/[^0-9]/g, '');
                          setPlayers(prev => prev.map(pl => pl.id === p.id ? { ...pl, playerNumber: v ? Number(v) : undefined } : pl));
                        }}
                        disabled={tournamentHasStarted}
                        className="w-10 px-1 py-1 rounded bg-[hsl(var(--background))] border border-[hsl(var(--border))] text-[hsl(var(--foreground))] text-xs text-center" />
                      <input type="text" inputMode="numeric" placeholder={tr('seedLabel')} title={tr('seedTitle')} value={p.seedNumber ?? ''}
                        onChange={e => {
                          const v = e.target.value.replace(/[^0-9]/g, '');
                          setPlayers(prev => prev.map(pl => pl.id === p.id ? { ...pl, seedNumber: v ? Number(v) : undefined } : pl));
                        }}
                        disabled={tournamentHasStarted}
                        className="w-12 px-1 py-1 rounded bg-[hsl(var(--background))] border border-[hsl(var(--border))] text-[hsl(var(--foreground))] text-xs text-center" />
                    </>
                  )}
                  <button onClick={() => removePlayer(p.id)} disabled={tournamentHasStarted} title={tournamentHasStarted ? 'Players are locked after the category starts' : 'Remove player'} className="text-[hsl(var(--destructive))]/60 hover:text-[hsl(var(--destructive))] transition-colors disabled:opacity-20 disabled:cursor-not-allowed">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Team Roster editor — Par Équipe only. Pick a team above, then
            build its list of individual players IN THE ORDER they enter the
            match, each with how many consecutive rounds they play. The
            match rotates through this exact order, round after round, until
            everyone has played — it never ends early on a round majority. */}
        {isParEquipe && (
          <div className="panel p-4">
            <h2 className="font-display text-sm font-bold text-[hsl(var(--foreground))] flex items-center gap-2 mb-1">
              <Users size={16} /> Team Roster
            </h2>
            <div className="grid grid-cols-2 gap-2 mb-3">
              <button onClick={() => setTeamPlayMode('rotation')}
                className={`text-start p-3 rounded-lg border-2 transition-all ${teamPlayMode === 'rotation' ? 'border-[hsl(var(--primary))] bg-[hsl(var(--primary))]/10' : 'border-[hsl(var(--border))]'}`}>
                <div className="font-display font-bold text-sm text-[hsl(var(--foreground))]">لكل لاعب جولته</div>
                <div className="text-[11px] text-[hsl(var(--muted-foreground))] mt-1">كل فريق يحدد ترتيب لاعبيه — لاعب مختلف يلعب كل جولة، والنقاط تتراكم للفريق طوال المباراة.</div>
              </button>
              <button onClick={() => setTeamPlayMode('substitution')}
                className={`text-start p-3 rounded-lg border-2 transition-all ${teamPlayMode === 'substitution' ? 'border-[hsl(var(--primary))] bg-[hsl(var(--primary))]/10' : 'border-[hsl(var(--border))]'}`}>
                <div className="font-display font-bold text-sm text-[hsl(var(--foreground))]">تبديل وسط المباراة</div>
                <div className="text-[11px] text-[hsl(var(--muted-foreground))] mt-1">مباراة عادية (Best of 3)، مع إمكانية تبديل أي لاعب يدوياً في أي وقت من شاشة الحكم الرئيسي.</div>
              </button>
            </div>
            <p className="text-[11px] text-[hsl(var(--muted-foreground))] mb-3">
              {teamPlayMode === 'rotation'
                ? 'كل لاعب يلعب عدد الجولات المحدد له تلقائياً بالترتيب أدناه. لا يوجد تبديل يدوي وسط الجولة في هذا الوضع؛ تغيير اللاعب يحدث فقط عند حد الجولة المحدد له.'
                : 'أول لاعبين في قائمة كل فريق يبدآن المباراة؛ باقي القائمة يبقى على الدكة (bench) للتبديل اليدوي وقت الحاجة.'}
            </p>
            {players.length === 0 ? (
              <p className="text-xs text-[hsl(var(--muted-foreground))] text-center py-2">أضف فريقين على الأقل أولاً.</p>
            ) : (
              <>
                <div className="flex gap-2 mb-3 flex-wrap">
                  {players.map(team => (
                    <button key={team.id} onClick={() => setActiveRosterTeamId(team.id)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${activeRosterTeamId === team.id ? 'bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]' : 'bg-[hsl(var(--secondary))] text-[hsl(var(--muted-foreground))]'}`}>
                      {team.name} ({(teamRosters[team.id] || []).length})
                    </button>
                  ))}
                </div>
                {activeRosterTeamId && (
                  <>
                    <div className="flex gap-2 mb-3">
                      <label className="relative shrink-0 cursor-pointer group" title="إضافة صورة اللاعب">
                        {newRosterPhoto ? (
                          <img src={newRosterPhoto} alt="" className="w-9 h-9 rounded-full object-cover border border-[hsl(var(--border))]" />
                        ) : (
                          <div className="w-9 h-9 rounded-full bg-[hsl(var(--secondary))] border border-dashed border-[hsl(var(--border))] flex items-center justify-center text-[hsl(var(--muted-foreground))] group-hover:border-[hsl(var(--primary))] group-hover:text-[hsl(var(--primary))] transition-colors">
                            <Camera size={15} />
                          </div>
                        )}
                        <input type="file" accept="image/*" className="hidden" onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          const reader = new FileReader();
                          reader.onload = (ev) => setNewRosterPhoto(ev.target?.result as string);
                          reader.readAsDataURL(file);
                          e.target.value = '';
                        }} />
                      </label>
                      <button type="button" title="إضافة صورة اللاعب برابط (URL)"
                        onClick={() => {
                          const url = window.prompt('رابط صورة اللاعب (Photo URL):', /^https?:\/\//i.test(newRosterPhoto) ? newRosterPhoto : '');
                          if (url === null) return;
                          setNewRosterPhoto(url.trim());
                        }}
                        className="w-9 h-9 shrink-0 rounded-full bg-[hsl(var(--secondary))] border border-dashed border-[hsl(var(--border))] flex items-center justify-center text-[hsl(var(--muted-foreground))] hover:border-[hsl(var(--primary))] hover:text-[hsl(var(--primary))] transition-colors">
                        <LinkIcon size={13} />
                      </button>
                      <input value={newRosterName} onChange={e => setNewRosterName(e.target.value)} placeholder={tr('playerName')}
                        className="flex-1 px-3 py-2 rounded-lg bg-[hsl(var(--secondary))] border border-[hsl(var(--border))] text-[hsl(var(--foreground))] text-sm"
                        onKeyDown={e => e.key === 'Enter' && addRosterPlayer()} />
                      <CountryPicker value={newRosterNat} onChange={setNewRosterNat} placeholder={tr('nationality')} className="w-28" />
                      <input value={newRosterNumber} onChange={e => setNewRosterNumber(e.target.value.replace(/[^0-9]/g, ''))} placeholder="#" title="رقم اللاعب"
                        inputMode="numeric"
                        className="w-14 px-2 py-2 rounded-lg bg-[hsl(var(--secondary))] border border-[hsl(var(--border))] text-[hsl(var(--foreground))] text-sm text-center" />
                      <input value={newRosterSeed} onChange={e => setNewRosterSeed(e.target.value.replace(/[^0-9]/g, ''))} placeholder={tr('seedLabel')} title={tr('seedTitle')}
                        inputMode="numeric"
                        className="w-16 px-2 py-2 rounded-lg bg-[hsl(var(--secondary))] border border-[hsl(var(--border))] text-[hsl(var(--foreground))] text-sm text-center" />
                      <button onClick={addRosterPlayer}
                        className="px-3 py-2 rounded-lg bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] font-semibold text-sm flex items-center gap-1 active:scale-95 transition-all">
                        <Plus size={14} /> Add
                      </button>
                    </div>
                    <div className="space-y-1">
                      {(teamRosters[activeRosterTeamId] || []).map((p, i) => (
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
                                reader.onload = (ev) => setRosterPlayerPhoto(activeRosterTeamId, p.id, ev.target?.result as string);
                                reader.readAsDataURL(file);
                                e.target.value = '';
                              }} />
                            </label>
                            <button type="button" title="إضافة صورة اللاعب برابط (URL)"
                              onClick={() => {
                                const url = window.prompt('رابط صورة اللاعب (Photo URL):', /^https?:\/\//i.test(p.photo || '') ? p.photo : '');
                                if (url === null) return;
                                setRosterPlayerPhoto(activeRosterTeamId, p.id, url.trim() || undefined);
                              }}
                              className="text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--primary))] transition-colors">
                              <LinkIcon size={11} />
                            </button>
                            <span className="font-semibold text-[hsl(var(--foreground))]">{p.name}</span>
                            <span className="text-[hsl(var(--muted-foreground))] text-xs">{p.nationality}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <input type="text" inputMode="numeric" placeholder="#" title="رقم اللاعب" value={p.playerNumber ?? ''}
                              onChange={e => {
                                const v = e.target.value.replace(/[^0-9]/g, '');
                                setRosterPlayerNumber(activeRosterTeamId, p.id, v ? Number(v) : undefined);
                              }}
                              disabled={tournamentHasStarted}
                        className="w-10 px-1 py-1 rounded bg-[hsl(var(--background))] border border-[hsl(var(--border))] text-[hsl(var(--foreground))] text-xs text-center" />
                            <input type="text" inputMode="numeric" placeholder={tr('seedLabel')} title={tr('seedTitle')} value={p.seedNumber ?? ''}
                              onChange={e => {
                                const v = e.target.value.replace(/[^0-9]/g, '');
                                setRosterPlayerSeed(activeRosterTeamId, p.id, v ? Number(v) : undefined);
                              }}
                              disabled={tournamentHasStarted}
                        className="w-12 px-1 py-1 rounded bg-[hsl(var(--background))] border border-[hsl(var(--border))] text-[hsl(var(--foreground))] text-xs text-center" />
                            {teamPlayMode === 'rotation' && (
                              <>
                                <label className="text-xs text-[hsl(var(--muted-foreground))]">{tr('roundsColonLabel')}</label>
                                <select value={p.rounds} onChange={e => setRosterPlayerRounds(activeRosterTeamId, p.id, Number(e.target.value))}
                                  className="px-2 py-1 rounded bg-[hsl(var(--secondary))] border border-[hsl(var(--border))] text-[hsl(var(--foreground))] text-xs">
                                  {[1, 2, 3, 4, 5].map(n => <option key={n} value={n}>{n}</option>)}
                                </select>
                              </>
                            )}
                            <button onClick={() => removeRosterPlayer(activeRosterTeamId, p.id)} className="text-[hsl(var(--destructive))]/60 hover:text-[hsl(var(--destructive))]">
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      ))}
                      {(teamRosters[activeRosterTeamId] || []).length === 0 && (
                        <p className="text-xs text-[hsl(var(--muted-foreground))] text-center py-3">لم تُضَف بعد لاعبين لهذا الفريق.</p>
                      )}
                    </div>
                    <p className="text-[10px] text-[hsl(var(--gold))] mt-2">
                      {teamPlayMode === 'rotation' ? 'ترتيب اللاعبين هنا هو ترتيب دخولهم للجولات.' : 'أول لاعب في القائمة يبدأ المباراة؛ الباقي على الدكة.'}
                    </p>
                  </>
                )}
              </>
            )}
          </div>
        )}

        <button onClick={handleGenerateBracket} disabled={players.length < 2}
          className="w-full py-3 rounded-xl gradient-gold text-[hsl(var(--accent-foreground))] font-display font-bold flex items-center justify-center gap-2 active:scale-95 transition-all disabled:opacity-30">
          <Shuffle size={18} /> {mode === 'league' ? 'Generate League Matches' : 'Generate Bracket'}
        </button>

        {/* Club standings */}
        {clubStandings.length > 0 && (
          <div className="panel p-4">
            <h2 className="font-display text-sm font-bold text-[hsl(var(--gold))] mb-3 flex items-center gap-2">
              <Trophy size={16} /> Club Rankings
            </h2>
            <div className="text-xs text-[hsl(var(--muted-foreground))] mb-2">
              Points: 🥇 {CLUB_POINTS.gold} pts • 🥈 {CLUB_POINTS.silver} pts • 🥉 {CLUB_POINTS.bronze} pts
            </div>
            <button
              onClick={() => {
                const records = getPlacementRecords().filter(r => !currentTournamentId || r.tournamentId === currentTournamentId);
                const count = exportCertificatesPdf(records);
                if (count === 0) window.alert('لا توجد ميداليات مسجلة بعد لهاد البطولة');
              }}
              className="mb-3 w-full py-2 rounded-lg bg-[hsl(var(--secondary))] text-[hsl(var(--foreground))] text-xs font-semibold flex items-center justify-center gap-2 hover:bg-[hsl(var(--secondary))]/70 transition-colors">
              🎖️ طباعة الشواهد (Certificates)
            </button>
            <div className="space-y-1">
              {sortedClubs.map((club, i) => (
                <div key={club.name} className="flex items-center justify-between px-3 py-2 rounded-lg bg-[hsl(var(--secondary))]/50 text-sm">
                  <div className="flex items-center gap-3">
                    <span className="text-[hsl(var(--gold))] font-display w-6 font-bold">
                      {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`}
                    </span>
                    <span>{getCountryFlag(club.country)}</span>
                    <span className="font-semibold text-[hsl(var(--foreground))]">{club.name}</span>
                    <span className="text-[hsl(var(--muted-foreground))] text-xs">{club.country}</span>
                  </div>
                  <div className="flex items-center gap-3 text-xs">
                    <span>🥇{club.gold}</span><span>🥈{club.silver}</span><span>🥉{club.bronze}</span>
                    <span className="font-display font-bold text-[hsl(var(--gold))] ml-2">{club.points} pts</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* League Matches */}
        {leagueMatches && (
          <div className="panel p-4">
            <h2 className="font-display text-sm font-bold text-[hsl(var(--gold))] mb-4 flex items-center gap-2">
              <Swords size={16} /> {tournamentName || 'League'} — Round Robin Matches
            </h2>

            {/* Standings */}
            {(() => {
              const standings = computeLeagueStandings(leagueMatches);
              if (standings.length === 0) return null;
              return (
                <div className="mb-5 overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-[hsl(var(--muted-foreground))] border-b border-[hsl(var(--border))]">
                        <th className="text-start py-1.5 px-2">#</th>
                        <th className="text-start py-1.5 px-2">{tr('playerColumnLabel')}</th>
                        <th className="text-center py-1.5 px-2">P</th>
                        <th className="text-center py-1.5 px-2">W</th>
                        <th className="text-center py-1.5 px-2">L</th>
                        <th className="text-center py-1.5 px-2">+/-</th>
                        <th className="text-center py-1.5 px-2">{tr('diffColumnLabel')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {standings.map((s, i) => (
                        <tr key={s.player.id} className={`border-b border-[hsl(var(--border))]/30 ${i === 0 && s.played > 0 ? 'text-[hsl(var(--gold))] font-bold' : ''}`}>
                          <td className="py-1.5 px-2">{i + 1}</td>
                          <td className="py-1.5 px-2 flex items-center gap-1.5">{getCountryFlag(s.player.nationality)} {s.player.name}</td>
                          <td className="text-center py-1.5 px-2">{s.played}</td>
                          <td className="text-center py-1.5 px-2 text-[hsl(var(--success))]">{s.wins}</td>
                          <td className="text-center py-1.5 px-2 text-[hsl(var(--destructive))]">{s.losses}</td>
                          <td className="text-center py-1.5 px-2">{s.pointsFor}-{s.pointsAgainst}</td>
                          <td className="text-center py-1.5 px-2">{s.diff > 0 ? '+' : ''}{s.diff}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              );
            })()}

            {/* League medal finalization — see leagueMedalTrigger state doc
                comment. Manual button only appears once every match has
                been played and medals haven't already been recorded; auto
                mode records silently (via the effect above) and just shows
                the confirmation line instead. */}
            {isLeagueComplete(leagueMatches) && (
              leagueMedalsRecorded ? (
                <div className="mb-5 px-4 py-3 rounded-xl bg-[hsl(var(--success))]/10 border border-[hsl(var(--success))]/30 text-[hsl(var(--success))] text-xs font-semibold flex items-center gap-2">
                  <Medal size={14} /> تم توزيع الميداليات لهذا الدوري / Medals have been awarded for this league
                </div>
              ) : leagueMedalTrigger === 'manual' ? (
                <button onClick={handleFinalizeLeagueMedals}
                  className="w-full mb-5 py-3 rounded-xl gradient-gold text-[hsl(var(--accent-foreground))] font-display font-bold flex items-center justify-center gap-2 active:scale-95 transition-all">
                  <Medal size={18} /> إنهاء الدوري وتوزيع الميداليات / End League &amp; Award Medals
                </button>
              ) : null
            )}

            <div className="space-y-2">
              {leagueMatches.map(m => (
                <div key={m.id} className="flex items-center justify-between px-4 py-3 rounded-xl bg-[hsl(var(--secondary))]/50 border border-[hsl(var(--border))]/50">
                  <div className="flex items-center gap-3">
                    <div className="font-display text-lg font-black text-[hsl(var(--gold))]">MATCH {m.matchNumber}</div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <span>{getCountryFlag(m.player1.nationality)}</span>
                      <span className="font-semibold text-[hsl(var(--chung))]">{m.player1.name}</span>
                    </div>
                    <span className="text-[hsl(var(--muted-foreground))] font-display text-xs">VS</span>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-[hsl(var(--hong))]">{m.player2.name}</span>
                      <span>{getCountryFlag(m.player2.nationality)}</span>
                    </div>
                  </div>
                  {m.winner ? (
                    <div className="px-3 py-1.5 rounded-lg border border-emerald-400/20 bg-emerald-400/5 text-emerald-300 text-xs font-black">✓ COMPLETED · LOCKED</div>
                  ) : (
                    <button onClick={() => handleStartMatch(m.player1, m.player2, m.matchNumber, undefined, undefined, m.id)}
                      className="px-3 py-1.5 rounded-lg bg-[hsl(var(--primary))]/20 text-[hsl(var(--primary))] text-xs font-semibold">
                      {leagueMatches.findIndex(x => x.id === m.id) === leagueMatches.findIndex(x => !x.winner) ? 'START NEXT' : 'START'}
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Bracket */}
        {bracket && (
          <div className="panel p-4 overflow-x-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display text-sm font-bold text-[hsl(var(--gold))] flex items-center gap-2">
                <Trophy size={16} /> {tournamentName || 'Tournament'} — {AGE_GROUPS.find(a => a.value === ageGroup)?.label} {gender === 'male' ? 'M' : 'F'} {weightCat}
              </h2>
              <button onClick={handleDownloadBracket} className="text-xs px-3 py-1.5 rounded-lg bg-[hsl(var(--gold))]/20 text-[hsl(var(--gold))] font-semibold flex items-center gap-1">
                <Download size={12} /> Download Bracket
              </button>
            </div>

            {/* Match order strip — every match in true play order (Round 1
                first, then Round 2, etc.), the same order the winner of one
                match feeds into the next. Tap a "ready" match to start it —
                this is the single place matches get started from now,
                instead of scattered buttons across the bracket tree below.
                Finished matches are colored by winner and can't be restarted;
                the match currently loaded on the Operator screen is gold. */}
            <MatchStrip
              matches={bracket}
              currentMatchId={matchState.tournamentId === currentTournamentId ? matchState.bracketMatchId : undefined}
              onStart={(m, i) => handleStartMatch(m.player1 as Player, m.player2 as Player, i + 1, m.round, totalRounds, m.id)}
            />
            
            {(() => {
              const finalMatch = bracket.find(m => m.round === totalRounds);
              const earlyRounds = Array.from({ length: Math.max(0, totalRounds - 1) }, (_, i) => i + 1);

              // Every round splits cleanly in half between the left and right
              // side of the draw (that's how generateBracket pairs matches
              // into the next round), so we can mirror the two halves and
              // meet in the middle at the final.
              const getSideMatches = (round: number, side: 'left' | 'right') => {
                const roundMatches = bracket.filter(m => m.round === round).sort((a, b) => a.position - b.position);
                const half = roundMatches.length / 2;
                return side === 'left' ? roundMatches.slice(0, half) : roundMatches.slice(half);
              };

              const renderCard = (match: BracketMatchDisplay, isFinal = false) => (
                <div key={match.id} className={`w-48 panel p-2 ${isFinal ? 'border-[hsl(var(--gold))]/50 border-2' : ''}`}>
                  <div className={`flex items-center gap-2 px-2 py-1.5 rounded ${match.player1 ? 'bg-[hsl(var(--chung))]/10' : 'bg-[hsl(var(--secondary))]/30'}`}>
                    <div className="w-1.5 h-1.5 rounded-full bg-[hsl(var(--chung))] shrink-0" />
                    <span className="text-xs font-semibold truncate flex-1 text-[hsl(var(--chung))]">
                      {match.player1 ? `${getCountryFlag(match.player1.nationality)} ${match.player1.name}` : (match.isBye && !match.player2 ? 'BYE' : 'TBD')}
                    </span>
                  </div>
                  <div className="text-center text-[10px] text-[hsl(var(--muted-foreground))] my-0.5">vs</div>
                  <div className={`flex items-center gap-2 px-2 py-1.5 rounded ${match.player2 ? 'bg-[hsl(var(--hong))]/10' : 'bg-[hsl(var(--secondary))]/30'}`}>
                    <div className="w-1.5 h-1.5 rounded-full bg-[hsl(var(--hong))] shrink-0" />
                    <span className="text-xs font-semibold truncate flex-1 text-[hsl(var(--hong))]">
                      {match.player2 ? `${getCountryFlag(match.player2.nationality)} ${match.player2.name}` : (match.isBye ? 'BYE' : 'TBD')}
                    </span>
                  </div>
                  {match.isBye && <div className="text-[10px] text-[hsl(var(--gold))] text-center mt-1">{tr('autoAdvanceLabel')}</div>}
                  {match.player1 && match.player2 && !match.isBye && (
                    <div className={`text-[10px] text-center mt-1 font-semibold ${match.winner ? (match.winner === 'chung' ? 'text-[hsl(var(--chung))]' : 'text-[hsl(var(--hong))]') : 'text-[hsl(var(--muted-foreground))]'}`}>
                      {match.winner
                        ? `✓ ${match.winner === 'chung' ? match.player1.name : match.player2.name} won`
                        : `Match ${bracket.findIndex(m => m.id === match.id) + 1} — start it from the strip above`}
                    </div>
                  )}
                </div>
              );

              const renderRoundColumn = (round: number, side: 'left' | 'right') => (
                <div className="flex flex-col" key={`${side}-${round}`}>
                  <div className="text-xs font-display text-center mb-2 text-[hsl(var(--muted-foreground))]">
                    {getRoundLabel(round, totalRounds)}
                  </div>
                  <div className="flex flex-col justify-around flex-1 gap-4" style={{ paddingTop: `${(Math.pow(2, round - 1) - 1) * 30}px` }}>
                    {getSideMatches(round, side).map(match => renderCard(match))}
                  </div>
                </div>
              );

              const chevron = (dir: '›' | '‹', key: string) => (
                <div key={key} className="flex flex-col items-center justify-center text-[hsl(var(--gold))]/40 text-lg select-none" aria-hidden>
                  {dir}
                </div>
              );

              return (
                <div className="flex gap-6 min-w-max items-center justify-center">
                  {/* Left half of the draw — flows toward the center */}
                  <div className="flex gap-6 items-center">
                    {earlyRounds.map(round => (
                      <React.Fragment key={`l-${round}`}>
                        {renderRoundColumn(round, 'left')}
                        {chevron('›', `lc-${round}`)}
                      </React.Fragment>
                    ))}
                  </div>

                  {/* The final sits in the middle */}
                  {finalMatch && (
                    <div className="flex flex-col mx-2">
                      <div className="text-sm font-display font-bold text-center mb-2 text-[hsl(var(--gold))]">
                        🏆 Final
                      </div>
                      {renderCard(finalMatch, true)}
                    </div>
                  )}

                  {/* Right half of the draw — mirrored, also flows toward the center */}
                  <div className="flex gap-6 items-center">
                    {[...earlyRounds].reverse().map(round => (
                      <React.Fragment key={`r-${round}`}>
                        {chevron('‹', `rc-${round}`)}
                        {renderRoundColumn(round, 'right')}
                      </React.Fragment>
                    ))}
                  </div>
                </div>
              );
            })()}
          </div>
        )}
      </div>

      {/* Audit log viewer */}
      {showAuditLog && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={() => setShowAuditLog(false)}>
          <div onClick={e => e.stopPropagation()} className="panel p-5 w-full max-w-lg max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-display font-bold text-sm flex items-center gap-2 text-[hsl(var(--gold))]">
                <ClipboardList size={16} /> سجل التعديلات
              </h3>
              <button onClick={() => setShowAuditLog(false)} className="text-[hsl(var(--muted-foreground))]">✕</button>
            </div>
            <div className="overflow-y-auto space-y-2 flex-1">
              {getAuditLog().length === 0 ? (
                <p className="text-xs text-[hsl(var(--muted-foreground))] text-center py-6">لا يوجد سجل بعد.</p>
              ) : getAuditLog().map((entry, i) => (
                <div key={i} className="px-3 py-2 rounded-lg bg-[hsl(var(--secondary))]/50 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-[hsl(var(--primary))]">{entry.action}</span>
                    <span className="text-[hsl(var(--muted-foreground))]">{new Date(entry.ts).toLocaleString()}</span>
                  </div>
                  <div className="text-[hsl(var(--foreground))] mt-0.5">{entry.details}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
      {showSavedMatches && (
        <ResultView
          competitionName={tournamentName.trim() || (savedTournaments[0]?.name ?? '')}
          onClose={() => setShowSavedMatches(false)}
        />
      )}
      {showCategoryBrowser && (
        <CategoryMatchBrowser
          onClose={() => setShowCategoryBrowser(false)}
          onMatchCreated={() => loadSavedTournaments()}
        />
      )}
      {showCategoryArchive && (
        <CategoryStatusArchive
          onClose={() => setShowCategoryArchive(false)}
          onMatchCreated={() => loadSavedTournaments()}
        />
      )}
    </div>
  );
}
