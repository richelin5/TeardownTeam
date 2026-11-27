/**
 * v1 tag chains. Mirrors .claude/skills/xbrl-mapping/tag-chains.md as amended by the finance-reviewer
 * ruling in docs/finance/definitions-v1.md (ST borrowings: first match only; NotesAndLoansPayable first).
 * Changing these needs finance-reviewer + qa-tester sign-off.
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
  debt_total_direct: ["LongTermDebt"],
  debt_noncurrent: ["LongTermDebtNoncurrent", "LongTermDebtAndCapitalLeaseObligations"],
  debt_current: ["LongTermDebtCurrent", "LongTermDebtAndCapitalLeaseObligationsCurrent"],
  st_borrowings: ["NotesAndLoansPayable", "ShortTermBorrowings", "CommercialPaper"],
  diluted_shares: ["WeightedAverageNumberOfDilutedSharesOutstanding", "WeightedAverageNumberOfShareOutstandingBasicAndDiluted"],
} as const;

/** Notes attached when a lower-ranked tag is used. */
export const TAG_NOTES: Record<string, string> = {
  ProfitLoss: "Includes net income attributable to noncontrolling interests.",
  CashCashEquivalentsRestrictedCashAndRestrictedCashEquivalents: "Includes restricted cash.",
  LongTermDebtAndCapitalLeaseObligations: "Long-term debt line includes finance lease obligations as tagged by the company.",
  LongTermDebtAndCapitalLeaseObligationsCurrent: "Current debt line includes finance lease obligations as tagged by the company.",
  WeightedAverageNumberOfShareOutstandingBasicAndDiluted: "Company reports one basic-and-diluted share count.",
};
