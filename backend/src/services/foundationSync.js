const sql = require('mssql');

function buildConfig() {
  const server = (process.env.FOUNDATION_SERVER || 'sql.foundationsoft.com,9000').trim();
  const parts = server.split(',');
  return {
    server: parts[0].trim(),
    port: parseInt(parts[1]?.trim() || '9000'),
    database: (process.env.FOUNDATION_DATABASE || 'Cas_15082').trim(),
    user: (process.env.FOUNDATION_USER || '').trim(),
    password: (process.env.FOUNDATION_PASSWORD || '').trim(),
    options: { encrypt: false, trustServerCertificate: true },
    connectionTimeout: 15000,
    requestTimeout: 30000,
  };
}

let pool = null;

async function getPool() {
  // If pool exists and is connected, reuse it
  if (pool && pool.connected) return pool;

  // Otherwise close any broken pool and reconnect
  if (pool) {
    try { await pool.close(); } catch (_) {}
    pool = null;
  }

  pool = await sql.connect(buildConfig());
  return pool;
}

async function testConnection() {
  const p = await getPool();
  const result = await p.request().query('SELECT 1 AS ok');
  return result.recordset[0];
}

const LABOR_CLASSES = ['1', '3', '5', '6', '7', '9'];

async function fetchFoundationActuals(jobNumber) {
  const p = await getPool();
  const laborList = LABOR_CLASSES.map(c => `'${c}'`).join(',');
  const result = await p.request()
    .input('jobNumber', sql.VarChar, jobNumber.trim())
    .query(`
      SELECT
        REPLACE(RTRIM(cost_code_no), '-', '') AS cost_code,
        MAX(cost_code_description)            AS description,
        SUM(CASE WHEN cost_class_id IN (${laborList}) THEN cost ELSE 0 END) AS labor_cost,
        SUM(CASE WHEN cost_class_id NOT IN (${laborList}) THEN cost ELSE 0 END) AS other_cost,
        SUM(cost) AS total_cost
      FROM v_job_history
      WHERE RTRIM(job_no) = @jobNumber
        AND record_status = 'A'
      GROUP BY cost_code_no
      ORDER BY cost_code_no
    `);
  return result.recordset;
}

async function fetchChangeOrders(jobNumber) {
  const p = await getPool();
  const result = await p.request()
    .input('jobNumber', sql.VarChar, jobNumber.trim())
    .query(`
      SELECT
        REPLACE(RTRIM(cost_code_no), '-', '') AS cost_code,
        SUM(cost_adj) AS co_adj
      FROM job_chg_budgets
      WHERE RTRIM(job_no) = @jobNumber
        AND record_status = 'A'
      GROUP BY cost_code_no
      ORDER BY cost_code_no
    `);
  return result.recordset;
}

async function syncJob(supabase, jobId, jobNumber, userId) {
  let rowsUpdated = 0;
  let errorText = null;

  try {
    const foundationRows = await fetchFoundationActuals(jobNumber);

    if (foundationRows.length === 0) {
      errorText = `No records found in Foundation for job "${jobNumber}". Check the job number matches exactly.`;
    }

    const { data: lines } = await supabase
      .from('cost_code_lines')
      .select('id, cost_code, type, phases!inner(job_id)')
      .eq('phases.job_id', jobId);

    const now = new Date().toISOString();
    const lineIds = (lines || []).map(l => l.id);

    if (lineIds.length > 0) {
      await supabase
        .from('cost_code_lines')
        .update({ committed_cost_foundation: null })
        .in('id', lineIds);
    }

    for (const fRow of foundationRows) {
      const costCode = fRow.cost_code?.trim();
      if (!costCode) continue;

      const matching = (lines || []).filter(l => l.cost_code === costCode);
      if (!matching.length) continue;

      const target = matching.find(l => l.type === 'LABOR') || matching[0];
      await supabase
        .from('cost_code_lines')
        .update({ committed_cost_foundation: fRow.total_cost, last_synced_at: now })
        .eq('id', target.id);

      rowsUpdated++;
    }
  } catch (err) {
    // Reset pool on connection errors so next request reconnects fresh
    pool = null;
    errorText = err.message;
  }

  await supabase.from('sync_log').insert({
    job_id: jobId,
    synced_by: userId,
    rows_updated: rowsUpdated,
    errors: errorText,
  });

  return { rowsUpdated, errors: errorText };
}

module.exports = { testConnection, syncJob, fetchFoundationActuals, fetchChangeOrders };