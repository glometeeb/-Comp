const express = require('express');
const router = express.Router();
const supabase = require('../services/supabase');
const { requireAuth, requireEditor } = require('../middleware/auth');
const { syncJob, testConnection } = require('../services/foundationSync');

router.use(requireAuth);

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
    if (result.errors) {
      return res.status(502).json({ error: result.errors, rowsUpdated: result.rowsUpdated });
    }
    res.json({ success: true, rowsUpdated: result.rowsUpdated });
  } catch (err) {
    res.status(502).json({ error: `Foundation sync failed: ${err.message}` });
  }
});

// GET /api/jobs/:id/sync-log
router.get('/:id/sync-log', async (req, res) => {
  const { data, error } = await supabase
    .from('sync_log')
    .select('*, profiles(full_name)')
    .eq('job_id', req.params.id)
    .order('synced_at', { ascending: false });

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// GET /api/foundation/test
router.get('/foundation/test', requireEditor, async (req, res) => {
  try {
    await testConnection();
    res.json({ ok: true, message: 'Connected to Foundation SQL Server successfully' });
  } catch (err) {
    res.status(502).json({ ok: false, error: err.message });
  }
});

module.exports = router;