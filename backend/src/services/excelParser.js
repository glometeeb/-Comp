const XLSX = require('xlsx');

const SKIP_PATTERNS = /^(total|scope:|phase:)$/i;
const COST_CODE_RE = /^(\d{4})\s+(.+)$/;
const PHASE_CODE_RE = /Cost\s*(\d+)/i;

function parseSheet(sheet, phaseName, phaseCode, isSinglePhase) {
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

  // Find header row containing 'BUDGET'
  let headerIdx = rows.findIndex(row =>
    row.some(cell => String(cell).toUpperCase().includes('BUDGET'))
  );
  if (headerIdx === -1) headerIdx = 2; // fallback

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

  return { phaseName, phaseCode, isSinglePhase, lines };
}

function parseWorkbook(buffer) {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const sheetNames = workbook.SheetNames;
  const phases = [];
  const unmappedRows = [];

  if (sheetNames.length === 1) {
    const sheet = workbook.Sheets[sheetNames[0]];
    const result = parseSheet(sheet, sheetNames[0], null, true);
    phases.push(result);
    unmappedRows.push(...(result.unmappedRows || []));
  } else {
    sheetNames.forEach((name, idx) => {
      const sheet = workbook.Sheets[name];
      const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
      // Try to extract phase name from A1 and phase code from rows 0-1
      const titleCell = String(rows[0]?.[0] || name).trim();
      const scopeText = [String(rows[0] || ''), String(rows[1] || '')].join(' ');
      const codeMatch = PHASE_CODE_RE.exec(scopeText);
      const phaseCode = codeMatch ? codeMatch[1] : null;

      const result = parseSheet(sheet, titleCell || name, phaseCode, false);
      result.sort_order = idx;
      phases.push(result);
      unmappedRows.push(...(result.unmappedRows || []));
    });
  }

  return { phases, unmappedRows };
}

module.exports = { parseWorkbook };
