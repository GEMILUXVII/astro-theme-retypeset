// Utilities for parsing published/updated dates including partial inputs
// Supports YYYY, YYYY-MM, and full ISO-like dates, returning both Date object and display label

export interface ParsedDateField {
  date: Date
  display: string
}

export function parsePublishedInput(value: unknown): ParsedDateField {
  // Normalize different input types to string for parsing
  if (value instanceof Date) {
    const date = value
    if (Number.isNaN(date.getTime())) {
      throw new Error('Invalid date value')
    }
    const display = date.toISOString().split('T')[0]
    return { date, display }
  }

  const raw = typeof value === 'number'
    ? String(value)
    : typeof value === 'string'
      ? value.trim()
      : ''

  if (!raw) {
    throw new Error('Published date is required')
  }

  // Accept year-only and year-month inputs
  let dateStr = raw
  if (/^\d{4}$/.test(raw)) {
    dateStr = `${raw}-01-01`
  }
  else if (/^\d{4}-\d{2}$/.test(raw)) {
    dateStr = `${raw}-01`
  }

  const date = new Date(dateStr)
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid date format: ${raw}`)
  }

  return {
    date,
    display: raw,
  }
}