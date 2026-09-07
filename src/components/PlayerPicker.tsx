import React, { useState, useEffect, useRef } from 'react';
import { Search, X, UserPlus } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useI18n } from '@/lib/i18n';

/** Minimal shape returned by the players table — enough to fill a roster
 *  entry without pulling in the full TournamentManager Player type. */
export interface PickedPlayer {
  id: string;
  name: string;
  nationality: string;
  club?: string;
  photo?: string;
  playerNumber?: number;
  seedNumber?: number;
}

interface PlayerPickerProps {
  /** Current tournament id — search here first (see WAB-TKD spec §36:
   *  don't create a duplicate player if one already exists). Optional
   *  because a brand-new local tournament may not have an id yet. */
  tournamentId?: string;
  /** Ids already in this roster, so a player can't be added twice. */
  excludeIds?: string[];
  onPick: (p: PickedPlayer) => void;
  onManualAdd: (name: string) => void;
  placeholder?: string;
}

type SearchScope = 'tournament' | 'global';

/** Search-first player picker for Par Équipe rosters.
 *  Flow: type a name → search the CURRENT tournament's players first
 *  → if nothing relevant turns up, one click widens the search to the
 *  whole `players` table → picking a result reuses that player's row
 *  instead of creating a new one. Typing a name with no match still
 *  falls back to "add as new player" so the roster is never blocked. */
const PlayerPicker: React.FC<PlayerPickerProps> = ({ tournamentId, excludeIds = [], onPick, onManualAdd, placeholder }) => {
  const { t } = useI18n();
  const [query, setQuery] = useState('');
  const [scope, setScope] = useState<SearchScope>('tournament');
  const [results, setResults] = useState<PickedPlayer[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  // Reset to the narrower, tournament-scoped search whenever the picker
  // is reopened for a fresh query — global scope is an explicit,
  // per-search opt-in, not a sticky setting.
  useEffect(() => { if (!open) setScope('tournament'); }, [open]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query.trim().length < 2) { setResults([]); return; }
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        let req = supabase.from('players').select('id,name,nationality,club,photo,player_number,seed_number').ilike('name', `%${query.trim()}%`).limit(20);
        if (scope === 'tournament' && tournamentId) req = req.eq('tournament_id', tournamentId);
        const { data, error } = await req;
        if (!error && data) {
          setResults(data
            .filter((p: any) => !excludeIds.includes(p.id))
            .map((p: any) => ({ id: p.id, name: p.name, nationality: p.nationality || '', club: p.club || '', photo: p.photo || undefined, playerNumber: p.player_number ?? undefined, seedNumber: p.seed_number ?? undefined })));
        }
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, scope, tournamentId]);

  useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  const showWidenOption = scope === 'tournament' && !!tournamentId && query.trim().length >= 2 && !loading;

  return (
    <div ref={boxRef} className="relative">
      <div className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg bg-secondary border border-border">
        <Search size={13} className="text-muted-foreground shrink-0" />
        <input
          value={query}
          onChange={e => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          placeholder={placeholder || t('playerNamePlaceholder')}
          className="flex-1 min-w-0 bg-transparent text-xs text-foreground focus:outline-none"
        />
        {query && (
          <button type="button" onClick={() => { setQuery(''); setResults([]); }} className="text-muted-foreground hover:text-foreground shrink-0">
            <X size={12} />
          </button>
        )}
      </div>

      {open && query.trim().length >= 2 && (
        <div className="absolute z-20 mt-1 w-72 max-w-[80vw] rounded-lg border border-border bg-popover shadow-lg overflow-hidden">
          <div className="max-h-56 overflow-y-auto">
            {loading && <div className="px-3 py-2 text-xs text-muted-foreground">{t('searchingLabel') || '...'}</div>}

            {!loading && results.length === 0 && (
              <div className="px-3 py-2 text-xs text-muted-foreground">
                {scope === 'tournament' ? (t('noPlayersInTournamentLabel') || 'ماكاينش نتيجة فهاد البطولة') : (t('noPlayersFoundLabel') || 'ماكاينش نتيجة')}
              </div>
            )}

            {!loading && results.map(p => (
              <button
                key={p.id}
                type="button"
                onClick={() => { onPick(p); setQuery(''); setResults([]); setOpen(false); }}
                className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-secondary text-xs"
              >
                {p.photo ? (
                  <img src={p.photo} alt="" className="w-6 h-6 rounded-full object-cover shrink-0" />
                ) : (
                  <div className="w-6 h-6 rounded-full border border-dashed border-border shrink-0" />
                )}
                <span className="font-semibold text-foreground flex-1 truncate">{p.name}</span>
                <span className="text-muted-foreground shrink-0">{p.nationality}</span>
                {p.club && <span className="text-muted-foreground shrink-0 truncate max-w-[5rem]">{p.club}</span>}
              </button>
            ))}
          </div>

          <div className="border-t border-border">
            {showWidenOption && (
              <button
                type="button"
                onClick={() => setScope('global')}
                className="w-full px-3 py-2 text-left text-xs font-semibold text-primary hover:bg-secondary"
              >
                {t('widenSearchAllPlayersLabel') || 'وسّع البحث لكل قاعدة اللاعبين'}
              </button>
            )}
            <button
              type="button"
              onClick={() => { onManualAdd(query.trim()); setQuery(''); setResults([]); setOpen(false); }}
              className="w-full flex items-center gap-1.5 px-3 py-2 text-left text-xs font-semibold text-foreground hover:bg-secondary"
            >
              <UserPlus size={12} /> {(t('addAsNewPlayerLabel') || 'زيدو كلاعب جديد')}: "{query.trim()}"
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default PlayerPicker;
