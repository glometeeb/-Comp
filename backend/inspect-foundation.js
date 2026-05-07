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
  console.log('Connecting to Foundation...');
  const pool = await sql.connect(config);
  console.log('Connected!\n');

  // Find all distinct job IDs that contain K2852
  const jobs = await pool.request().query(`
    SELECT DISTINCT RTRIM(job_id) AS job_id, RTRIM(job_no) AS job_no, job_description
    FROM v_job_history
    WHERE job_id LIKE '%2852%' OR job_no LIKE '%2852%' OR job_description LIKE '%2852%'
  `);
  console.log('=== Jobs matching "2852" ===');
  console.log(JSON.stringify(jobs.recordset, null, 2));

  // Also show a sample of distinct job IDs so we can see the format
  const allJobs = await pool.request().query(`
    SELECT DISTINCT TOP 20 RTRIM(job_id) AS job_id, job_description
    FROM v_job_history
    ORDER BY job_id
  `);
  console.log('\n=== Sample of job IDs in Foundation (top 20) ===');
  allJobs.recordset.forEach(r => console.log(`  "${r.job_id}" — ${r.job_description}`));

  await pool.close();
}

run().catch(err => {
  console.error('ERROR:', err.message);
  process.exit(1);
});
