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
      id: job.id, job_name: job.job_name, job_number: job.job_number,
      uploaded_at: job.uploaded_at, status: job.status,
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
  const { data, error } = await supabase
    .from('jobs')
    .insert({ job_name, job_number, uploaded_by: req.user.id })
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

// GET /api/jobs/:id/foundation — Live Foundation actuals + change orders vs. our budget
router.get('/:id/foundation', async (req, res) => {
  // 1. Get job to find job_number
  const { data: job, error: jobErr } = await supabase
    .from('jobs')
    .select('id, job_number')
    .eq('id', req.params.id)
    .single();
  if (jobErr) return res.status(404).json({ error: 'Job not found' });

  // 2. Get our budget lines from Supabase
  const { data: lines, error: linesErr } = await supabase
    .from('cost_code_lines')
    .select('cost_code, description, type, budget_amount, phases!inner(job_id)')
    .eq('phases.job_id', req.params.id);
  if (linesErr) return res.status(500).json({ error: linesErr.message });

  // 3. Aggregate original budgets by cost_code
  const budgetByCode = {};
  for (const line of lines || []) {
    if (!budgetByCode[line.cost_code]) {
      budgetByCode[line.cost_code] = { description: line.description, original_budget: 0 };
    }
    budgetByCode[line.cost_code].original_budget += parseFloat(line.budget_amount) || 0;
  }

  // 4. Pull live data from Foundation (errors returned as structured response, not 500)
  let foundationRows = [];
  let changeOrderRows = [];
  let foundationError = null;

  try {
    [foundationRows, changeOrderRows] = await Promise.all([
      fetchFoundationActuals(job.job_number),
      fetchChangeOrders(job.job_number),
    ]);
  } catch (err) {
    foundationError = err.message;
  }

  // 5. Build lookup maps
  const foundationByCode = {};
  for (const r of foundationRows) {
    foundationByCode[r.cost_code] = {
      description: r.description,
      foundation_actual: parseFloat(r.total_cost) || 0,
    };
  }

  const coByCode = {};
  for (const r of changeOrderRows) {
    coByCode[r.cost_code] = (coByCode[r.cost_code] || 0) + (parseFloat(r.co_adj) || 0);
  }

  // 6. Union all cost codes across budget, Foundation actuals, and change orders
  const allCodes = new Set([
    ...Object.keys(budgetByCode),
    ...Object.keys(foundationByCode),
    ...Object.keys(coByCode),
  ]);

  const rows = Array.from(allCodes)
    .map(code => {
      const budget = budgetByCode[code];
      const found = foundationByCode[code];
      const originalBudget = budget?.original_budget || 0;
      const coAdj = coByCode[code] || 0;
      const currentBudget = originalBudget + coAdj;
      const foundationActual = found?.foundation_actual || 0;
      const remaining = currentBudget - foundationActual;
      return {
        cost_code: code,
        description: budget?.description || found?.description || '',
        original_budget: originalBudget,
        co_adj: coAdj,
        current_budget: currentBudget,
        foundation_actual: foundationActual,
        remaining,                // positive = cost left, negative = overage
      };
    })
    .sort((a, b) => a.cost_code.localeCompare(b.cost_code));

  // 7. Totals
  const totals = rows.reduce(
    (s, r) => ({
      original_budget: s.original_budget + r.original_budget,
      co_adj: s.co_adj + r.co_adj,
      current_budget: s.current_budget + r.current_budget,
      foundation_actual: s.foundation_actual + r.foundation_actual,
      remaining: s.remaining + r.remaining,
    }),
    { original_budget: 0, co_adj: 0, current_budget: 0, foundation_actual: 0, remaining: 0 }
  );

  res.json({ rows, totals, foundationError });
});

// DELETE /api/jobs/:id
router.delete('/:id', requireEditor, async (req, res) => {
  const { error } = await supabase.from('jobs').delete().eq('id', req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  res.status(204).end();
});

module.exports = router;
