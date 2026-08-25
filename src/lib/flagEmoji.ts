/**
 * Derives a flag emoji from an ISO 3166-1 alpha-2 country code (e.g. "FR" →
 * 🇫🇷) via Unicode Regional Indicator Symbols, so the admin never manages a
 * flag image asset per country. Returns '' for anything that isn't exactly
 * two letters, so callers can always do `{countryFlagEmoji(code)} {name}`
 * without a conditional.
 */
export function countryFlagEmoji(code: string | null | undefined): string {
  if (!code) return '';
  const upper = code.trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(upper)) return '';
  const REGIONAL_INDICATOR_A = 0x1f1e6;
  const codePoints = [...upper].map((char) => REGIONAL_INDICATOR_A + (char.charCodeAt(0) - 65));
  return String.fromCodePoint(...codePoints);
}
