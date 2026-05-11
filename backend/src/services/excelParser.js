 const XLSX = require('xlsx');

const SKIP_PATTERNS = /^(total|scope:|phase:)$/i;
const SKIP_SHEETS = /^(summary|total|cover|index)$/i;
const COST_CODE_RE = /^(\d{4})\s+(.+)$/;

function extractPhaseName(rows, sheetName) {
  // Try col C row 0 — must be a real name, not a cost code reference
  const colC0 = String(rows[0]?.[2] || '').trim();
  if (colC0 && !/^cost\s*\d*/i.test(colC0) && !/^(scope:|phase:|budget)$/i.test(colC0)) {
    return colC0;
  }

  // Try col A row 0 — strip trailing "- Cost XX" if present
  const colA0 = String(rows[0]?.[0] || '').trim();
  if (colA0 && !/^(scope:|phase:|budget)$/i.test(colA0)) {
    return colA0.replace(/\s*-?\s*Cost\s*\d+\s*$/i, '').trim();
  }

  // Fall back to sheet tab name
  return sheetName;
}

function parseSheet(sheet, sheetName) {
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

  const phaseName = extractPhaseName(rows, sheetName);

  // Extract phase code from rows 0-1, col C
  let phaseCode = null;
  for (let i = 0; i < 2; i++) {
    const cell = String(rows[i]?.[2] || '');
    const m = /Cost\s*(\d+)/i.exec(cell);
    if (m) { phaseCode = m[1]; break; }
  }
  // Also check col A row 0 for phase code
  if (!phaseCode) {
    const m = /Cost\s*(\d+)/i.exec(String(rows[0]?.[0] || ''));
    if (m) phaseCode = m[1];
  }

  // Find header row containing 'BUDGET'
  let headerIdx = rows.findIndex(row =>
    row.some(cell => String(cell).toUpperCase().includes('BUDGET'))
  );
  if (headerIdx === -1) headerIdx = 2;

  const dataRows = rows.slice(headerIdx + 1);
  const lines = [];
  const unmappedRows = [];

  for (const row of dataRows) {
    const colA = String(row[0] || '').trim();
    const colB = String(row[1] || '').trim().toUpperCase();
    const colC = row[2];

    if (!colA || SKIP_PATTERNS.test(colA)) continue;

    const match = COST_CODE_RE.exec(colA);
    const type = colB === 'LABOR' || colB === 'MATERIALS' ? colB : null;
    const budget = parseFloat(colC) || 0;

    if (!match || !type) {
      unmappedRows.push({ raw: row.slice(0, 5), reason: !match ? 'bad cost code' : 'bad type' });
      continue;
    }

    lines.push({
      cost_code: match[1],
      description: match[2].trim(),
      type,
      budget_amount: budget,
    });
  }

  return { phaseName, phaseCode, lines, unmappedRows };
}

function parseWorkbook(buffer) {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const phases = [];
  const unmappedRows = [];

  const filteredSheets = workbook.SheetNames.filter(name => !SKIP_SHEETS.test(name.trim()));

  filteredSheets.forEach((name, idx) => {
    const sheet = workbook.Sheets[name];
    const result = parseSheet(sheet, name);
    result.sort_order = idx;
    result.isSinglePhase = filteredSheets.length === 1;
    phases.push(result);
    unmappedRows.push(...(result.unmappedRows || []));
  });

  return { phases, unmappedRows };
}

module.exports = { parseWorkbook };