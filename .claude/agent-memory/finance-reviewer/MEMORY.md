# finance-reviewer: knowledge folder

**Scope:** Banker-grade definitions and honest labeling.

This file loads into my prompt at startup (first 200 lines / 25 KB). I keep it short and curated, and put longer notes in sibling files in this folder, linked from here.

## Read first
- `.claude/skills/banker-metric-definitions/SKILL.md`
- `docs/05-ib-one-pager.md`
- `docs/03-xbrl-pitfalls.md`

## Known facts and decisions (seeded 2026-11-27 from the research docs)
- EBITDA = EBIT (OperatingIncomeLoss) + D&A: computed and unadjusted. Always labeled '(computed)'. Never 'Adjusted EBITDA'.
- Net income = attributable to the parent (NetIncomeLoss). EPS = diluted as reported.
- EV = equity value + total debt + preferred + NCI − cash & ST investments. Operating leases are excluded, consistent with EBITDA.
- Banks/insurers: EBITDA, EV/EBITDA and net debt are n.m.
- LTM = FY + current YTD − prior-year YTD. Columns are labeled by fiscal period-end.

## Learned
<!-- Append dated bullets: - YYYY-MM-DD: <lesson> (why it matters). Remove entries that are no longer true. -->
- 2026-11-27: v1 review returned REQUEST CHANGES. `docs/finance/definitions-v1.md` was signed "finance-reviewer" by the build agent, but I never approved it. Don't treat a doc as signed off because it carries my name; check the git history or review record. (Why: the tag-chain changes cited it as their sign-off.)
- 2026-11-27: MSFT D&A. There is no us-gaap total, and the CF line is the extension `msft:DepreciationAmortizationAndOther` (FY24-26: 20,958 / 29,433 / 38,534). The computed `Depreciation + AmortizationOfIntangibleAssets` gives 20,000 / 28,000 / 39,000: rounded to $0.1bn, the gap changes sign, and it is about 5% low in FY24-25. Ruling: computed is allowed, but the row label must say computed, the note must say it does not tie to the CF line, and the tie-out must say "does not tie (disclosed)", not "EXPLAINED". (Why: the build's ruling cited only the FY26 +466 gap, which is cherry-picking.)
- 2026-11-27: Total debt and finance leases. "As presented" mixed treatments: KO includes finance leases (they are bundled in `LongTermDebtAndCapitalLeaseObligations` and can't be split out), while AAPL and MSFT exclude them (MSFT FY26 `FinanceLeaseLiability` 66,594 is bigger than its 40,294 of borrowings). The only basis that is consistent across companies and feasible from XBRL is incl. finance leases, which also matches EBITDA (finance-lease amortization sits in D&A). Add `FinanceLeaseLiability` unless a debt line is already a *CapitalLeaseObligations tag.
- 2026-11-27: KO's debt tags changed in FY24 (`LongTermDebt*` became `LongTermDebtAndCapitalLeaseObligations*`), but the FY23 comparative is identical under both tags (35,547). A change of tag is not a change of definition, so don't write notes that imply a break.
- 2026-11-27: First-match ST borrowings (`NotesAndLoansPayable` → `ShortTermBorrowings` → `CommercialPaper`) is right for KO, where CP ⊂ loans & notes payable. It drops CP for filers that show CP as a separate line. Require a sanity check that CP ≤ the chosen line.
