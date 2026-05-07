const express = require('express');
const router = express.Router();
const supabase = require('../services/supabase');
const { requireAuth, requireEditor } = require('../middleware/auth');
const { computeLine, rollupPhase } = require('../services/calculations');

router.use(requireAuth);

// GET /api/phases/:phaseId/lines
router.get('/:phaseId/lines', async (req, res) => {
  const { data: lines, error } = await supabase
    .from('cost_code_lines')
    .select('*')
    .eq('phase_id', req.params.phaseId)
    .order('cost_code');

  if (error) return res.status(500).json({ error: error.message });

  const computed = lines.map(computeLine);
  const rollup = rollupPhase(lines);

  res.json({
    lines: computed,
    rollup: {
      total_budget: rollup.total_budget,
      total_earned: rollup.total_earned,
      total_cost_to_complete: rollup.total_cost_to_complete,
      pct_complete: rollup.pct_complete,
    },
  });
});

// PATCH /api/lines/:id/override — set % complete
router.patch('/:id/override', requireEditor, async (req, res) => {
  const { pct_complete_override } = req.body;

  if (pct_complete_override === undefined) {
    return res.status(400).json({ error: 'pct_complete_override is required' });
  }
  if (pct_complete_override !== null && (pct_complete_override < 0 || pct_complete_override > 100)) {
    return res.status(400).json({ error: 'pct_complete_override must be 0–100' });
  }

  const { data: line } = await supabase
    .from('cost_code_lines')
    .select('pct_complete_override')
    .eq('id', req.params.id)
    .single();

  const { data: updated, error } = await supabase
    .from('cost_code_lines')
    .update({ pct_complete_override })
    .eq('id', req.params.id)
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });

  await supabase.from('overrides_audit').insert({
    cost_code_line_id: req.params.id,
    changed_by: req.user.id,
    field_name: 'pct_complete_override',
    old_value: String(line?.pct_complete_override ?? ''),
    new_value: String(pct_complete_override ?? ''),
  });

  res.json(computeLine(updated));
});

// DELETE /api/lines/:id/override — clear % complete override (reset to 0)
router.delete('/:id/override', requireEditor, async (req, res) => {
  const { data: line } = await supabase
    .from('cost_code_lines')
    .select('pct_complete_override')
    .eq('id', req.params.id)
    .single();

  const { data: updated, error } = await supabase
    .from('cost_code_lines')
    .update({ pct_complete_override: null })
    .eq('id', req.params.id)
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });

  await supabase.from('overrides_audit').insert({
    cost_code_line_id: req.params.id,
    changed_by: req.user.id,
    field_name: 'pct_complete_override',
    old_value: String(line?.pct_complete_override ?? ''),
    new_value: null,
  });

  res.json(computeLine(updated));
});

module.exports = router;
