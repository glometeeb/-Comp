const express = require('express');
const router = express.Router();
const supabase = require('../services/supabase');
const { requireAuth, requireEditor } = require('../middleware/auth');
const { rollupPhase, rollupJob } = require('../services/calculations');
const { fetchFoundationActuals, fetchChangeOrders } = require('../services/foundationSync');

router.use(requireAuth);

// GET /api/jobs — list all jobs with rollup stats
router.get('/', async (req, res) => {
  const { data: jobs, error } = await supabase
    .from('jobs')
    .select('*, phases(id, phase_name, cost_code_lines(budget_amount, pct_complete_override, committed_cost_foundation))')
    .eq('status', 'active')
    .order('uploaded_at', { ascending: false });

  if (error) return res.status(500).json({ error: error.message });

  const result = jobs.map(job => {
    const allLines = (job.phases || []).flatMap(p => p.cost_code_lines || []);
    const phases = (job.phases || []).map(p => rollupPhase(p.cost_code_lines || []));
    const rollup = rollupJob(phases);
    const foundation_total = allLines.reduce((s, l) => s + (parseFloat(l.committed_cost_foundation) || 0), 0);
    return {
      id: job.id,
      job_name: job.job_name,
      job_number: job.job_number,
      uploaded_at: job.uploaded_at,
      status: job.status,
      ...rollup,
      foundation_total: Math.round(foundation_total * 100) / 100,
      difference: Math.round((rollup.total_earned - foundation_total) * 100) / 100,
    };
  });

  res.json(result);
});

// POST /api/jobs
router.post('/', requireEditor, async (req, res) => {
  const { job_name, job_number } = req.body;
  if (!job_number || !job_number.trim()) {
    return res.status(400).json({ error: 'Job number is required' });
  }

  const { data, error } = await supabase
    .from('jobs')
    .insert({ job_name, job_number: job_number.trim(), uploaded_by: req.user.id })
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json(data);
});

// GET /api/jobs/:id — job detail with phases and rollup
router.get('/:id', async (req, res) => {
  const { data: job, error } = await supabase
    .from('jobs')
    .select('*, phases(*, cost_code_lines(*))')
    .eq('id', req.params.id)
    .single();

  if (error) return res.status(404).json({ error: 'Job not found' });

  const phases = (job.phases || [])
    .sort((a, b) => a.sort_order - b.sort_order)
    .map(phase => {
      const rollup = rollupPhase(phase.cost_code_lines || []);
      return {
        id: phase.id,
        phase_name: phase.phase_name,
        phase_code: phase.phase_code,
        sort_order: phase.sort_order,
        is_single_phase: phase.is_single_phase,
        total_budget: rollup.total_budget,
        total_earned: rollup.total_earned,
        total_cost_to_complete: rollup.total_cost_to_complete,
        pct_complete: rollup.pct_complete,
      };
    });

  const jobRollup = rollupJob(phases);
  const { phases: _p, ...jobBase } = job;

  const { data: lastSync } = await supabase
    .from('sync_log')
    .select('synced_at')
    .eq('job_id', req.params.id)
    .order('synced_at', { ascending: false })
    .limit(1)
    .single();

  res.json({ ...jobBase, ...jobRollup, phases, last_synced_at: lastSync?.synced_at || null });
});

// GET /api/jobs/:id/foundation — live Foundation actuals vs budget
router.get('/:id/foundation', async (req, res) => {
  const { data: job, error: jobErr } = await supabase
    .from('jobs')
    .select('id, job_number')
    .eq('id', req.params.id)
    .single();
  if (jobErr) return res.status(404).json({ error: 'Job not found' });

  // Use database function to get budget by cost code across all phases
  const { data: budgetRows, error: budgetErr } = await supabase
    .rpc('get_job_budget_by_code', { p_job_id: req.params.id });
  if (budgetErr) return res.status(500).json({ error: budgetErr.message });

  const budgetByCode = {};
  for (const row of budgetRows || []) {
    budgetByCode[row.cost_code] = {
      description: row.description,
      original_budget: parseFloat(row.original_budget) || 0,
    };
  }

  // Pull live Foundation data
  let foundationRows = [];
  let changeOrderRows = [];
  let foundationError = null;

  try {
    foundationRows = await fetchFoundationActuals(job.job_number);
    changeOrderRows = await fetchChangeOrders(job.job_number);
  } catch (err) {
    foundationError = err.message;
  }

  const foundationByCode = {};
  for (const r of foundationRows) {
    const code = (r.cost_code || '').trim();
    if (!code) continue;
    foundationByCode[code] = {
      description: r.description,
      foundation_actual: parseFloat(r.total_cost) || 0,
    };
  }

  const coByCode = {};
  for (const r of changeOrderRows) {
    const code = (r.cost_code || '').trim();
    if (!code) continue;
    coByCode[code] = (coByCode[code] || 0) + (parseFloat(r.co_adj) || 0);
  }

  const allCodes = new Set([
    ...Object.keys(budgetByCode),
    ...Object.keys(foundationByCode),
    ...Object.keys(coByCode),
  ]);

  const rows = Array.from(allCodes)
    .map(code => {
      const budget = budgetByCode[code];
      const found = foundationByCode[code];
      const originalBudget = budget ? budget.original_budget : 0;
      const coAdj = coByCode[code] || 0;
      const currentBudget = originalBudget + coAdj;
      const foundationActual = found ? found.foundation_actual : 0;
      const remaining = currentBudget - foundationActual;
      return {
        cost_code: code,
        description: (budget ? budget.description : null) || (found ? found.description : null) || '',
        original_budget: Math.round(originalBudget * 100) / 100,
        co_adj: Math.round(coAdj * 100) / 100,
        current_budget: Math.round(currentBudget * 100) / 100,
        foundation_actual: Math.round(foundationActual * 100) / 100,
        remaining: Math.round(remaining * 100) / 100,
      };
    })
    .sort((a, b) => a.cost_code.localeCompare(b.cost_code));

  const totals = { original_budget: 0, co_adj: 0, current_budget: 0, foundation_actual: 0, remaining: 0 };
  for (const r of rows) {
    totals.original_budget += r.original_budget;
    totals.co_adj += r.co_adj;
    totals.current_budget += r.current_budget;
    totals.foundation_actual += r.foundation_actual;
    totals.remaining += r.remaining;
  }
  totals.original_budget = Math.round(totals.original_budget * 100) / 100;
  totals.co_adj = Math.round(totals.co_adj * 100) / 100;
  totals.current_budget = Math.round(totals.current_budget * 100) / 100;
  totals.foundation_actual = Math.round(totals.foundation_actual * 100) / 100;
  totals.remaining = Math.round(totals.remaining * 100) / 100;

  res.json({ rows, totals, foundationError });
});

// DELETE /api/jobs/:id
router.delete('/:id', requireEditor, async (req, res) => {
  const { error } = await supabase.from('jobs').delete().eq('id', req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  res.status(204).end();
});

module.exports = router;