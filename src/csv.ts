/**
 * RFC 4180 CSV escaping (seed task US-021).
 */

/**
 * Escape a single field for an RFC 4180 CSV record.
 *
 * The field is wrapped in double-quotes when it contains a comma, a
 * double-quote, or a line break (CR or LF); embedded double-quotes are then
 * doubled per the spec. Fields without those characters are returned unchanged.
 *
 * @param field - The raw field value to escape.
 * @returns The field, quoted and escaped only when RFC 4180 requires it.
 */
export function escapeCsvField(field: string): string {
  if (/[",\r\n]/.test(field)) {
    return `"${field.replace(/"/g, '""')}"`;
  }
  return field;
}

/**
 * Join fields into a single RFC 4180 record.
 *
 * Each field is escaped with {@link escapeCsvField}, then the results are joined
 * with commas. No trailing line break is appended.
 *
 * @param fields - The ordered field values for the row.
 * @returns A single comma-separated, RFC 4180-escaped record string.
 */
export function toCsvRow(fields: string[]): string {
  return fields.map(escapeCsvField).join(',');
}
