/** Assembles the full Profile from the SEC and FRED clients plus the pure resolver. */
import { CONTRACT_VERSION, type Company, type FilingRef, type Profile } from "../contracts/profile";
import { UnsupportedFilerError } from "./errors";
import { fetchMacro, type FredDeps } from "./fred";
import { makeContext, resolveTable } from "./resolver";
import { filingUrl, type SecClient, type Submissions } from "./sec";

export function latestFiling(sub: Submissions, cik10: string, form: "10-K" | "10-Q"): FilingRef | null {
  const r = sub.filings.recent;
  // `recent` is newest first; pick the newest exact form match (amendments are not "the latest 10-K").
  for (let i = 0; i < r.form.length; i++) {
    if (r.form[i] === form) {
      const accn = r.accessionNumber[i]!;
      return {
        form,
        accn,
        filed: r.filingDate[i]!,
        reportDate: r.reportDate[i] ?? "",
        url: filingUrl(cik10, accn, r.primaryDocument[i]),
      };
    }
  }
  return null;
}

export type ProfileDeps = {
  sec: SecClient;
  fred: FredDeps;
  dataMode: "live" | "fixtures";
  now?: () => Date;
  log?: (msg: string) => void;
};

/** ticker must already be normalized and validated. */
export async function buildProfile(ticker: string, deps: ProfileDeps): Promise<Profile> {
  const { cik10, otherTickers } = await deps.sec.lookupTicker(ticker);
  const [submissions, facts, macro] = await Promise.all([
    deps.sec.getSubmissions(cik10),
    deps.sec.getCompanyFacts(cik10),
    fetchMacro(deps.fred, deps.log),
  ]);
  const latest10K = latestFiling(submissions, cik10, "10-K");
  if (!latest10K && submissions.filings.recent.form.some((f) => f === "20-F" || f === "40-F")) {
    throw new UnsupportedFilerError("Foreign private issuers (20-F/40-F) are not supported in v1");
  }
  const ctx = makeContext(facts, submissions, cik10);
  const { table, warnings } = resolveTable(ctx, submissions.sic);
  if (otherTickers.length) warnings.push(`Multiple share classes/tickers share this CIK: ${otherTickers.join(", ")}. Share counts cover all classes.`);

  const company: Company = {
    name: submissions.name,
    ticker,
    cik: cik10,
    sic: submissions.sic,
    sicDescription: submissions.sicDescription,
    fiscalYearEnd: submissions.fiscalYearEnd,
    exchanges: submissions.exchanges ?? [],
    otherTickers,
  };
  return {
    contractVersion: CONTRACT_VERSION,
    generatedAt: (deps.now ?? (() => new Date()))().toISOString(),
    dataMode: deps.dataMode,
    company,
    filings: { latest10K, latest10Q: latestFiling(submissions, cik10, "10-Q") },
    units: "$ in millions, except per-share data; shares in millions",
    table,
    macro,
    warnings,
  };
}
