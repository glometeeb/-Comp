const express = require('express');
const router = express.Router();
const supabase = require('../services/supabase');
const { requireAuth, requireEditor } = require('../middleware/auth');
const { rollupPhase } = require('../services/calculations');

router.use(requireAuth);

// GET /api/jobs/:jobId/phases
router.get('/:jobId/phases', async (req, res) => {
  const { data: phases, error } = await supabase
    .from('phases')
    .select('*, cost_code_lines(*)')
    .eq('job_id', req.params.jobId)
    .order('sort_order');

  if (error) return res.status(500).json({ error: error.message });

  const result = phases.map(phase => {
    const rollup = rollupPhase(phase.cost_code_lines || []);
    const { cost_code_lines, ...phaseBase } = phase;
    return { ...phaseBase, ...rollup };
  });

  res.json(result);
});

// PATCH /api/jobs/:jobId/phases/:phaseId — rename a phase
router.patch('/:jobId/phases/:phaseId', requireEditor, async (req, res) => {
  const { phase_name } = req.body;
  if (!phase_name?.trim()) return res.status(400).json({ error: 'phase_name is required' });

  const { data, error } = await supabase
    .from('phases')
    .update({ phase_name: phase_name.trim() })
    .eq('id', req.params.phaseId)
    .eq('job_id', req.params.jobId)
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

module.exports = router;
