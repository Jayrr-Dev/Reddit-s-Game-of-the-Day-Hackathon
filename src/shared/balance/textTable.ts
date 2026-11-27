// ===================================================================
// TEXT TABLES
// Plain-text and Markdown tables for the balance CLIs.
// ===================================================================

/** A Markdown table from a header row and body rows. */
export const markdownTable = (headers: readonly string[], rows: readonly string[][]): string =>
  [headers, headers.map(() => '---'), ...rows].map((cells) => `| ${cells.join(' | ')} |`).join('\n');

/** A plain-text table with padded columns (the last column is left unpadded). */
export const textTable = (headers: readonly string[], rows: readonly string[][]): string => {
  const all = [headers, ...rows];
  const widths = headers.map((_, column) => Math.max(...all.map((row) => (row[column] ?? '').length)));
  return all
    .map((row) => row.map((cell, column) => (column === row.length - 1 ? cell : cell.padEnd(widths[column] ?? 0))).join('  '))
    .join('\n');
};
