/**
 * RFC 4180 CSV escaping (seed task US-021).
 *
 * A field must be quoted if it contains a comma, a double-quote, or a line
 * break (CR or LF). Inside a quoted field, each double-quote is doubled.
 */
export function escapeCsvField(field: string): string {
  if (/[",\r\n]/.test(field)) {
    return `"${field.replace(/"/g, '""')}"`;
  }
  return field;
}

/** Join fields into a single RFC 4180 record (comma-separated, each escaped). */
export function toCsvRow(fields: string[]): string {
  return fields.map(escapeCsvField).join(',');
}
