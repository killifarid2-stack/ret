import { useState, useRef, useEffect } from 'react';
import { TKD_COUNTRIES } from '@/lib/tkd-data';
import { getCountryFlag } from '@/lib/flags';

interface CountryPickerProps {
  value: string;
  onChange: (code: string) => void;
  placeholder?: string;
  className?: string;
}

/** Searchable country/nationality input with flags — type to filter (by
 *  code or, loosely, by what's typed), click a result to select. Same
 *  country list (TKD_COUNTRIES) and flags used everywhere else in the app
 *  (Admin, brackets, results), so a player's nationality is always picked
 *  from the same canonical list instead of typed freehand. */
export default function CountryPicker({ value, onChange, placeholder = 'Country', className = '' }: CountryPickerProps) {
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  const filtered = TKD_COUNTRIES.filter(c => c.toLowerCase().includes(search.toLowerCase()));

  return (
    <div ref={wrapRef} className={`relative ${className}`}>
      <input
        value={open ? search : value}
        onChange={e => { setSearch(e.target.value); onChange(e.target.value); setOpen(true); }}
        onFocus={() => { setSearch(value); setOpen(true); }}
        placeholder={placeholder}
        className="w-full px-3 py-2 rounded-lg bg-[hsl(var(--secondary))] border border-[hsl(var(--border))] text-[hsl(var(--foreground))] text-sm"
      />
      {value && !open && (
        <span className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-base">{getCountryFlag(value)}</span>
      )}
      {open && filtered.length > 0 && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 max-h-40 overflow-y-auto rounded-lg bg-[hsl(var(--card))] border border-[hsl(var(--border))] shadow-lg">
          {filtered.slice(0, 30).map(c => (
            <button
              key={c}
              type="button"
              onMouseDown={() => { onChange(c); setSearch(c); setOpen(false); }}
              className="w-full text-left px-3 py-1.5 text-xs text-[hsl(var(--foreground))] hover:bg-[hsl(var(--primary))]/20 transition-colors flex items-center gap-1.5"
            >
              <span>{getCountryFlag(c)}</span> {c}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
