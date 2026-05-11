const XLSX = require('xlsx');

const SKIP_PATTERNS = /^(total|scope:|phase:)$/i;
const COST_CODE_RE = /^(\d{4})\s+(.+)$/;

function parseSheet(sheet, sheetName) {
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

  // Extract phase name — check col C of row 0 first, then col A
  let phaseName = String(rows[0]?.[2] || '').trim();
  if (!phaseName || /^cost\s*\d*/i.test(phaseName)) {
    phaseName = String(rows[0]?.[0] || sheetName).trim();
  }
  if (!phaseName || /^(phase:|scope:)$/i.test(phaseName)) phaseName = sheetName;

  // Extract phase code from rows 0-1, col C
  let phaseCode = null;
  for (let i = 0; i < 2; i++) {
    const cell = String(rows[i]?.[2] || '');
    const m = /Cost\s*(\d+)/i.exec(cell);
    if (m) { phaseCode = m[1]; break; }
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

  workbook.SheetNames.forEach((name, idx) => {
    const sheet = workbook.Sheets[name];
    const result = parseSheet(sheet, name);
    result.sort_order = idx;
    result.isSinglePhase = workbook.SheetNames.length === 1;
    phases.push(result);
    unmappedRows.push(...(result.unmappedRows || []));
  });

  return { phases, unmappedRows };
}

module.exports = { parseWorkbook };