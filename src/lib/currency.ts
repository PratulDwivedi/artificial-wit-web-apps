// ── Shared currency formatter ─────────────────────────────────────────────────
// Formats a raw numeric value using the tenant's configured currency
// (from useAppStore: currency / currencySymbol). Used by DynamicReportTable
// cells and DynamicViewRecord fields so both render identically.
//
// Number grouping is locale-driven, not timezone-driven (e.g. INR groups as
// 1,00,000 under en-IN vs 100,000 under en-US) — so it's keyed off the
// tenant's currency code rather than the visitor's machine/browser, which
// would make the same record render differently for different viewers.

const CURRENCY_LOCALE: Record<string, string> = {
  INR: 'en-IN',
  USD: 'en-US',
  GBP: 'en-GB',
  EUR: 'de-DE',
  AED: 'ar-AE',
  SAR: 'ar-SA',
  JPY: 'ja-JP',
  CNY: 'zh-CN',
  AUD: 'en-AU',
  CAD: 'en-CA',
  SGD: 'en-SG',
  CHF: 'de-CH',
  ZAR: 'en-ZA',
}

/** Grouped number only (no symbol) — used for the form input's display-when-blurred state. */
export function formatCurrencyNumber(
  value:        unknown,
  currencyCode: string | null | undefined,
): string {
  if (value == null || value === '') return ''
  const num = Number(value)
  if (isNaN(num)) return String(value)

  const locale = CURRENCY_LOCALE[currencyCode ?? ''] ?? 'en-US'
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num)
}

export function formatCurrencyValue(
  value:          unknown,
  currencySymbol: string | null | undefined,
  currencyCode:   string | null | undefined,
): string {
  const formatted = formatCurrencyNumber(value, currencyCode)
  if (formatted === '') return ''
  return `${currencySymbol || ''}${formatted}`
}
