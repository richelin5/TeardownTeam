/**
 * Browser mirror of normalizeTicker in src/data/sec.ts (that module pulls in server-only code, so it is not
 * imported here). tests/unit/ui-round1.test.ts asserts the two agree. Returns null where the server throws 400.
 */
const TICKER_RE = /^(?=.{1,10}$)[A-Z0-9]+(?:-[A-Z0-9]+)*$/;

export function normalizeTickerUi(input: string): string | null {
  const t = input.trim().toUpperCase().replace(/[./]/g, "-");
  return TICKER_RE.test(t) ? t : null;
}
