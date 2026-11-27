/**
 * v1 tag chains. Mirrors .claude/skills/xbrl-mapping/tag-chains.md as amended by the finance-reviewer
 * rulings in docs/finance/definitions-v1.md (ST borrowings: first match only, NotesAndLoansPayable first;
 * total debt includes finance leases). Changing these needs finance-reviewer + qa-tester sign-off.
 */
export const CHAINS = {
  revenue: [
    "RevenueFromContractWithCustomerExcludingAssessedTax",
    "Revenues",
    "RevenueFromContractWithCustomerIncludingAssessedTax",
    "SalesRevenueNet",
  ],
  operating_income: ["OperatingIncomeLoss"],
  net_income: ["NetIncomeLoss", "NetIncomeLossAvailableToCommonStockholdersBasic", "ProfitLoss"],
  /** Totals only. The computed fallback (Depreciation + AmortizationOfIntangibleAssets) is rank 3, in the resolver. */
  da: ["DepreciationDepletionAndAmortization", "DepreciationAndAmortization", "DepreciationAmortizationAndAccretionNet"],
  da_components: ["Depreciation", "AmortizationOfIntangibleAssets"],
  cash: ["CashAndCashEquivalentsAtCarryingValue", "CashCashEquivalentsRestrictedCashAndRestrictedCashEquivalents"],
  /** Note only (the cash row excludes them): first match is quantified in the cash note. */
  st_investments: [
    "ShortTermInvestments",
    "MarketableSecuritiesCurrent",
    "AvailableForSaleSecuritiesDebtSecuritiesCurrent",
    "OtherShortTermInvestments",
  ],
  debt_total_direct: ["LongTermDebt"],
  debt_noncurrent: ["LongTermDebtNoncurrent", "LongTermDebtAndCapitalLeaseObligations"],
  debt_current: ["LongTermDebtCurrent", "LongTermDebtAndCapitalLeaseObligationsCurrent"],
  /** Debt lines that include finance leases by definition (used to verify a LongTermDebt comparative). */
  debt_incl_finance_leases: ["LongTermDebtAndCapitalLeaseObligations", "LongTermDebtAndCapitalLeaseObligationsCurrent"],
  st_borrowings: ["NotesAndLoansPayable", "ShortTermBorrowings", "CommercialPaper"],
  /** Sanity check only: CP must not exceed the chosen NotesAndLoansPayable/ShortTermBorrowings line. */
  commercial_paper: ["CommercialPaper"],
  /** Added to total debt when no debt line already includes finance leases. Total first, else current + non-current. */
  finance_lease_total: ["FinanceLeaseLiability"],
  finance_lease_parts: ["FinanceLeaseLiabilityCurrent", "FinanceLeaseLiabilityNoncurrent"],
  diluted_shares: ["WeightedAverageNumberOfDilutedSharesOutstanding", "WeightedAverageNumberOfShareOutstandingBasicAndDiluted"],
} as const;

/** Every us-gaap tag the resolver reads. The SEC client trims companyfacts to these before caching (security L1). */
export const RESOLVER_TAGS: readonly string[] = [...new Set(Object.values(CHAINS).flat())];

/** Notes attached when a lower-ranked tag is used. */
export const TAG_NOTES: Record<string, string> = {
  NetIncomeLossAvailableToCommonStockholdersBasic: "After preferred dividends; not net income attributable to the parent.",
  ProfitLoss: "Includes net income attributable to noncontrolling interests.",
  CashCashEquivalentsRestrictedCashAndRestrictedCashEquivalents: "Includes restricted cash.",
  WeightedAverageNumberOfShareOutstandingBasicAndDiluted: "Company reports one basic-and-diluted share count.",
};
