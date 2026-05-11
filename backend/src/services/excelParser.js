const XLSX = require('xlsx');

const SKIP_PATTERNS = /^(total|scope:|phase:|cost\s*code)$/i;
const SKIP_SHEETS = /^(summary|total|cover|index)$/i;
const COST_CODE_RE = /^(\d{4})\s+(.+)$/;

function parseSheet(sheet, sheetName) {
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

  // Phase name is always the sheet tab name now
  const phaseName = sheetName.trim();

  // Find header row containing 'BUDGET'
  let headerIdx = rows.findIndex(row =>
    row.some(cell => String(cell).toUpperCase().includes('BUDGET'))
  );
  if (headerIdx === -1) headerIdx = 0;

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

  return { phaseName, phaseCode: null, lines, unmappedRows };
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