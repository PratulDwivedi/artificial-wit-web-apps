// ── Shared DateTime formatter ─────────────────────────────────────────────────
// Formats a raw date value using the tenant's configured format + timezone
// (from useAppStore: datetimeFormat / timeZone). Used by DynamicReportTable
// cells and DynamicViewRecord fields so both render identically.

const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

export function formatDateTimeValue(
  value:    unknown,
  format:   string | null | undefined,
  timeZone: string | null | undefined,
  dateOnly  = false,
): string {
  if (value == null || value === '') return ''
  const date = new Date(String(value))
  if (isNaN(date.getTime())) return String(value)

  const tz  = timeZone || 'UTC'
  const fmt = format   || 'DD-MMM-YYYY hh:mm A'

  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    year:     'numeric',
    month:    '2-digit',
    day:      '2-digit',
    hour:     '2-digit',
    minute:   '2-digit',
    hour12:   false,
  }).formatToParts(date)

  const get    = (type: string) => parts.find(p => p.type === type)?.value ?? ''
  const hour24 = parseInt(get('hour'), 10) % 24
  const monthN = parseInt(get('month'), 10)
  const hour12 = hour24 === 0 ? 12 : hour24 > 12 ? hour24 - 12 : hour24

  const dateFmt = fmt
    .replace('YYYY', get('year'))
    .replace('MMM',  MONTHS_SHORT[monthN - 1] ?? '')
    .replace('MM',   String(monthN).padStart(2, '0'))
    .replace('DD',   get('day'))

  if (dateOnly) return dateFmt

  return dateFmt
    .replace('hh', String(hour12).padStart(2, '0'))
    .replace('HH', String(hour24).padStart(2, '0'))
    .replace('mm', get('minute'))
    .replace('A',  hour24 < 12 ? 'AM' : 'PM')
}
