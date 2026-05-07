require('dotenv').config();
const sql = require('mssql');

const config = {
  server: process.env.FOUNDATION_SERVER?.split(',')[0],
  port: parseInt(process.env.FOUNDATION_SERVER?.split(',')[1] || '9000'),
  database: process.env.FOUNDATION_DATABASE,
  user: process.env.FOUNDATION_USER,
  password: process.env.FOUNDATION_PASSWORD,
  options: { encrypt: false, trustServerCertificate: true },
};

async function run() {
  const pool = await sql.connect(config);
  console.log('Connected!\n');

  const cols = await pool.request().query(`
    SELECT COLUMN_NAME, DATA_TYPE
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_NAME = 'job_chg_budgets'
    ORDER BY ORDINAL_POSITION
  `);
  console.log('=== job_chg_budgets columns ===');
  cols.recordset.forEach(c => console.log(' ', c.COLUMN_NAME, '-', c.DATA_TYPE));

  const sample = await pool.request()
    .input('j', sql.VarChar, 'K2852')
    .query(`SELECT TOP 10 * FROM job_chg_budgets WHERE RTRIM(job_no) = @j`);
  console.log('\n=== Sample rows for K2852 ===');
  console.log(JSON.stringify(sample.recordset, null, 2));

  pool.close();
}

run().catch(e => console.error('ERROR:', e.message));
