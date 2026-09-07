import { getIso2, getLocalFlagUrl } from '@/lib/flags'

/** Runtime player-call data is supplied by MatchState. This module contains only shared flag utilities; no sample athletes are stored here. */
/** Common country-name → ISO alpha-2 lookup so operators can type a name. */
export const COUNTRY_CODES: Record<string, string> = {
  turkey: 'tr',
  türkiye: 'tr',
  turkiye: 'tr',
  morocco: 'ma',
  maroc: 'ma',
  france: 'fr',
  germany: 'de',
  spain: 'es',
  italy: 'it',
  'united states': 'us',
  usa: 'us',
  'united kingdom': 'gb',
  uk: 'gb',
  korea: 'kr',
  'south korea': 'kr',
  japan: 'jp',
  china: 'cn',
  brazil: 'br',
  egypt: 'eg',
  iran: 'ir',
  jordan: 'jo',
  serbia: 'rs',
  croatia: 'hr',
  russia: 'ru',
  ukraine: 'ua',
  mexico: 'mx',
  canada: 'ca',
  azerbaijan: 'az',
  uzbekistan: 'uz',
  thailand: 'th',
  taiwan: 'tw',
  greece: 'gr',
  netherlands: 'nl',
  belgium: 'be',
  poland: 'pl',
  tunisia: 'tn',
  algeria: 'dz',
}

/**
 * Resolve a flag field into an <img> src.
 * Accepts a full URL, an ISO alpha-2 code, or a country name.
 */
export function resolveFlagSrc(flag: string, country: string): string | null {
  const value = (flag || '').trim()
  if (value.startsWith('http') || value.startsWith('/') || value.startsWith('data:')) {
    return value
  }
  let code = value.toLowerCase()
  if (code.length !== 2) {
    code = COUNTRY_CODES[country.trim().toLowerCase()] ?? ''
  }
  if (!code) {
    const iso2 = getIso2(flag || country)
    if (iso2) code = iso2.toLowerCase()
  }
  if (!code) return null
  // Local asset first: public screens must work offline.
  return getLocalFlagUrl(code) || null
}
