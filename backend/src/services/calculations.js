function computeLine(line) {
  const budget = parseFloat(line.budget_amount) || 0;
  const pct = line.pct_complete_override != null ? parseFloat(line.pct_complete_override) : 0;
  const costToComplete = budget * (1 - pct / 100);
  const earnedValue = budget * (pct / 100);

  return {
    ...line,
    pct_complete_effective: pct,
    cost_to_complete: Math.round(costToComplete * 100) / 100,
    earned_value: Math.round(earnedValue * 100) / 100,
    has_override: line.pct_complete_override != null,
  };
}

function rollupPhase(lines) {
  const computed = lines.map(computeLine);
  const totalBudget = computed.reduce((s, l) => s + (parseFloat(l.budget_amount) || 0), 0);
  const totalEarned = computed.reduce((s, l) => s + l.earned_value, 0);
  const totalCTC = computed.reduce((s, l) => s + l.cost_to_complete, 0);
  const phasePct = totalBudget > 0 ? (totalEarned / totalBudget) * 100 : 0;

  return {
    lines: computed,
    total_budget: Math.round(totalBudget * 100) / 100,
    total_earned: Math.round(totalEarned * 100) / 100,
    total_cost_to_complete: Math.round(totalCTC * 100) / 100,
    pct_complete: Math.round(phasePct * 100) / 100,
  };
}

function rollupJob(phases) {
  const totalBudget = phases.reduce((s, p) => s + p.total_budget, 0);
  const totalEarned = phases.reduce((s, p) => s + p.total_earned, 0);
  const totalCTC = phases.reduce((s, p) => s + p.total_cost_to_complete, 0);
  const jobPct = totalBudget > 0 ? (totalEarned / totalBudget) * 100 : 0;

  return {
    total_budget: Math.round(totalBudget * 100) / 100,
    total_earned: Math.round(totalEarned * 100) / 100,
    total_cost_to_complete: Math.round(totalCTC * 100) / 100,
    pct_complete: Math.round(jobPct * 100) / 100,
  };
}

module.exports = { computeLine, rollupPhase, rollupJob };
