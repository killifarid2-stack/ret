import React, { useState, useEffect, useRef } from 'react';
import { Search, X, FolderPlus } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useI18n } from '@/lib/i18n';
import { loadAllLocalTournaments } from '@/lib/tournament-local';

/** Minimal shape enough to attach a match to an existing tournament and
 *  prefill its shared fields — not the full TournamentManager record. */
export interface PickedTournament {
  id: string;
  name: string;
  gender?: string;
  weightCategory?: string;
  ageGroup?: string;
}

interface TournamentPickerProps {
  onPick: (t: PickedTournament) => void;
  placeholder?: string;
}

/** Search-first tournament picker (WAB-TKD: "تسجيل البطولات" fix).
 *
 *  Previously AdminPanel had no way to attach a stand-alone match to a
 *  tournament that already existed — every Save either silently reused
 *  whatever `state.tournamentId` happened to be left over from something
 *  else, or auto-created a brand-new "local-<uuid>" tournament wrapper
 *  (see AdminPanel's save handler). That's fine as a fallback for a truly
 *  new tournament, but it meant tournaments created earlier (via
 *  Tournament Manager, or a previous Admin session) were never
 *  searchable/selectable from Admin — every session risked spawning a
 *  new duplicate tournament record instead of registering the match
 *  under the existing one.
 *
 *  Merges the same two sources Tournament Manager and the Par Équipe
 *  home screen already read from (loadAllLocalTournaments() +
 *  supabase.tournaments) — no new storage, no new table, purely a search
 *  UI over what's already there. Typing with no match still falls
 *  through to Admin's existing auto-create-new-tournament behavior
 *  unchanged. */
const TournamentPicker: React.FC<TournamentPickerProps> = ({ onPick, placeholder }) => {
  const { t, lang } = useI18n();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<PickedTournament[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query.trim().length < 2) { setResults([]); return; }
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const needle = query.trim().toLowerCase();
        const local = loadAllLocalTournaments()
          .filter(tr => tr.name?.toLowerCase().includes(needle))
          .map(tr => ({ id: tr.id, name: tr.name, gender: tr.gender, weightCategory: tr.weight_category, ageGroup: tr.age_group }));

        let cloud: PickedTournament[] = [];
        try {
          const { data, error } = await supabase.from('tournaments')
            .select('id,name,gender,weight_category,age_group')
            .ilike('name', `%${query.trim()}%`).limit(20);
          if (!error && data) {
            cloud = data.map((tr: any) => ({ id: tr.id, name: tr.name, gender: tr.gender, weightCategory: tr.weight_category, ageGroup: tr.age_group }));
          }
        } catch { /* offline — local results still show */ }

        // Merge, de-duplicating by id (a synced local record and its
        // cloud row share the same id once the sync in AdminPanel's save
        // handler has run at least once).
        const byId = new Map<string, PickedTournament>();
        [...cloud, ...local].forEach(tr => { if (!byId.has(tr.id)) byId.set(tr.id, tr); });
        setResults(Array.from(byId.values()));
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query]);

  useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  return (
    <div ref={boxRef} className="relative">
      <div className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg bg-secondary border border-border">
        <Search size={13} className="text-muted-foreground shrink-0" />
        <input
          value={query}
          onChange={e => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          placeholder={placeholder || (lang === 'ar' ? 'ابحث عن بطولة موجودة...' : 'Search an existing tournament...')}
          className="flex-1 min-w-0 bg-transparent text-xs text-foreground focus:outline-none"
        />
        {query && (
          <button type="button" onClick={() => { setQuery(''); setResults([]); }} className="text-muted-foreground hover:text-foreground shrink-0">
            <X size={12} />
          </button>
        )}
      </div>

      {open && query.trim().length >= 2 && (
        <div className="absolute z-20 mt-1 w-80 max-w-[85vw] rounded-lg border border-border bg-popover shadow-lg overflow-hidden">
          <div className="max-h-56 overflow-y-auto">
            {loading && <div className="px-3 py-2 text-xs text-muted-foreground">…</div>}
            {!loading && results.length === 0 && (
              <div className="px-3 py-2 text-xs text-muted-foreground">
                {lang === 'ar' ? 'ماكاينش بطولة بهاد الاسم — كتبقى تقدر تكتب اسم جديد فوق وتحفظ عادي.' : 'No matching tournament — typing a new name above and saving will still work as before.'}
              </div>
            )}
            {!loading && results.map(tr => (
              <button
                key={tr.id}
                type="button"
                onClick={() => { onPick(tr); setQuery(''); setResults([]); setOpen(false); }}
                className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-secondary text-xs"
              >
                <FolderPlus size={13} className="text-muted-foreground shrink-0" />
                <span className="font-semibold text-foreground flex-1 truncate">{tr.name}</span>
                {tr.weightCategory && <span className="text-muted-foreground shrink-0">{tr.weightCategory}</span>}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default TournamentPicker;
