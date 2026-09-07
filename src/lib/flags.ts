// Country code to 2-letter ISO mapping for flag images
const COUNTRY_MAP: Record<string, string> = {
  // Asia
  KOR: 'KR', PRK: 'KP', JPN: 'JP', CHN: 'CN', TPE: 'TW', HKG: 'HK', MAC: 'MO',
  MGL: 'MN', VNM: 'VN', VIE: 'VN', THA: 'TH', LAO: 'LA', KHM: 'KH', MYA: 'MM',
  MAS: 'MY', SGP: 'SG', PHL: 'PH', INA: 'ID', IDN: 'ID', BRU: 'BN', TLS: 'TL',
  IND: 'IN', PAK: 'PK', BAN: 'BD', BGD: 'BD', NEP: 'NP', NPL: 'NP', BHU: 'BT',
  SRI: 'LK', LKA: 'LK', MDV: 'MV', AFG: 'AF',
  // Middle East
  IRN: 'IR', IRQ: 'IQ', SYR: 'SY', LBN: 'LB', JOR: 'JO', ISR: 'IL', PLE: 'PS',
  PSE: 'PS', SAU: 'SA', YEM: 'YE', OMA: 'OM', UAE: 'AE', QAT: 'QA', BRN: 'BH',
  BHR: 'BH', KUW: 'KW',
  // Central Asia / Caucasus
  KAZ: 'KZ', UZB: 'UZ', TKM: 'TM', TJK: 'TJ', KGZ: 'KG', GEO: 'GE', ARM: 'AM', AZE: 'AZ',
  // Europe
  GBR: 'GB', ENG: 'GB', SCO: 'GB', WAL: 'GB', NIR: 'GB', IRL: 'IE',
  FRA: 'FR', GER: 'DE', ITA: 'IT', ESP: 'ES', POR: 'PT', NED: 'NL', BEL: 'BE',
  LUX: 'LU', SUI: 'CH', AUT: 'AT', LIE: 'LI', MON: 'MC', AND: 'AD', SMR: 'SM',
  MLT: 'MT', VAT: 'VA', ISL: 'IS', DEN: 'DK', SWE: 'SE', NOR: 'NO', FIN: 'FI',
  EST: 'EE', LAT: 'LV', LTU: 'LT', BLR: 'BY', UKR: 'UA', RUS: 'RU', MDA: 'MD',
  POL: 'PL', CZE: 'CZ', SVK: 'SK', HUN: 'HU', ROU: 'RO', BUL: 'BG', GRE: 'GR',
  TUR: 'TR', CYP: 'CY', SRB: 'RS', CRO: 'HR', SLO: 'SI', BIH: 'BA', MNE: 'ME',
  MKD: 'MK', ALB: 'AL', KOS: 'XK', FRO: 'FO', GRL: 'GL',
  // Americas
  USA: 'US', CAN: 'CA', MEX: 'MX', GUA: 'GT', BLZ: 'BZ', HON: 'HN', SLV: 'SV',
  NCA: 'NI', CRC: 'CR', PAN: 'PA', CUB: 'CU', JAM: 'JM', HAI: 'HT', DOM: 'DO',
  PUR: 'PR', BAH: 'BS', BAR: 'BB', TTO: 'TT', GRN: 'GD', LCA: 'LC', VIN: 'VC',
  ATG: 'AG', DMA: 'DM', SKN: 'KN', BRA: 'BR', ARG: 'AR', CHI: 'CL', COL: 'CO',
  PER: 'PE', VEN: 'VE', ECU: 'EC', BOL: 'BO', PAR: 'PY', URU: 'UY', GUY: 'GY',
  SUR: 'SR',
  // Africa
  EGY: 'EG', MAR: 'MA', ALG: 'DZ', TUN: 'TN', LBY: 'LY', SDN: 'SD', SSD: 'SS',
  ETH: 'ET', ERI: 'ER', DJI: 'DJ', SOM: 'SO', KEN: 'KE', UGA: 'UG', TAN: 'TZ',
  RWA: 'RW', BDI: 'BI', COD: 'CD', CGO: 'CG', CAF: 'CF', CMR: 'CM', GAB: 'GA',
  GEQ: 'GQ', STP: 'ST', AGO: 'AO', ANG: 'AO', ZAM: 'ZM', ZIM: 'ZW', MOZ: 'MZ',
  MAW: 'MW', MWI: 'MW', NAM: 'NA', BOT: 'BW', RSA: 'ZA', LES: 'LS', SWZ: 'SZ',
  ESW: 'SZ', MAD: 'MG', MRI: 'MU', SEY: 'SC', COM: 'KM', CPV: 'CV', NGR: 'NG',
  NIG: 'NE', BEN: 'BJ', TOG: 'TG', GHA: 'GH', CIV: 'CI', LBR: 'LR', SLE: 'SL',
  GUI: 'GN', GBS: 'GW', SEN: 'SN', GAM: 'GM', MTN: 'MR', MLI: 'ML', BUR: 'BF',
  BFA: 'BF',
  // Oceania
  AUS: 'AU', NZL: 'NZ', FIJ: 'FJ', PNG: 'PG', SOL: 'SB', VAN: 'VU', SAM: 'WS',
  TGA: 'TO', KIR: 'KI', TUV: 'TV', NRU: 'NR', PLW: 'PW', FSM: 'FM', MHL: 'MH',
};


// Local bundled flag assets. The public display must not depend on internet
// access at the venue. Any SVG placed in src/assets/flags/ becomes available
// automatically here.
const LOCAL_FLAG_ASSETS = import.meta.glob('../assets/flags/*.svg', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>;

export function getLocalFlagUrl(code: string): string {
  const iso2 = getIso2(code);
  if (!iso2) return '';
  const key = `../assets/flags/${iso2.toLowerCase()}.svg`;
  return LOCAL_FLAG_ASSETS[key] || '';
}

/** Get 2-letter ISO code from any input (2 or 3 letter) */
export function getIso2(code: string): string | null {
  if (!code || code.length < 2) return null;
  const upper = code.toUpperCase().trim();
  return COUNTRY_MAP[upper] || (upper.length === 2 ? upper : null);
}

/**
 * Resolve a flag to a bundled local asset. There is intentionally no remote
 * CDN fallback: public screens must remain deterministic and work offline.
 */
export function getFlagUrl(code: string): string {
  return getLocalFlagUrl(code)
}

/**
 * Text-only country fallback. Broadcast/referee screens must use FlagImage,
 * which resolves the real bundled SVG from src/assets/flags. Other admin/text
 * surfaces use the ISO code here instead of an emoji or generated flag.
 */
export function getCountryFlag(code: string): string {
  return getIso2(code) || '';
}
