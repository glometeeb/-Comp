const express = require('express');
const router = express.Router();
const supabase = require('../services/supabase');
const { requireAuth, requireEditor } = require('../middleware/auth');
const { syncJob, testConnection, inspectSchema } = require('../services/foundationSync');

router.use(requireAuth);

// GET /api/foundation/test — verify SQL Server connectivity
router.get('/foundation/test', requireEditor, async (req, res) => {
  try {
    await testConnection();
    res.json({ ok: true, message: 'Connected to Foundation SQL Server successfully' });
  } catch (err) {
    res.status(502).json({ ok: false, error: err.message });
  }
});

// GET /api/foundation/schema — inspect jc* tables to confirm column names
router.get('/foundation/schema', requireEditor, async (req, res) => {
  try {
    const schema = await inspectSchema();
    res.json(schema);
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

// POST /api/jobs/:id/sync — trigger Foundation sync
router.post('/:id/sync', requireEditor, async (req, res) => {
  const { data: job, error } = await supabase
    .from('jobs')
    .select('id, job_number')
    .eq('id', req.params.id)
    .single();

  if (error || !job) return res.status(404).json({ error: 'Job not found' });
  if (!job.job_number) return res.status(400).json({ error: 'Job has no job number — cannot sync with Foundation' });

  try {
    const result = await syncJob(supabase, job.id, job.job_number, req.user.id);
    res.json(result);
  } catch (err) {
    res.status(502).json({ error: `Foundation sync failed: ${err.message}` });
  }
});

// GET /api/jobs/:id/sync-log — sync history
router.get('/:id/sync-log', async (req, res) => {
  const { data, error } = await supabase
    .from('sync_log')
    .select('*, profiles(full_name)')
    .eq('job_id', req.params.id)
    .order('synced_at', { ascending: false });

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

module.exports = router;
