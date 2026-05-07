import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { api } from '../lib/api';
import { useAuth } from '../hooks/useAuth';
import ProgressBar from '../components/ProgressBar';

function fmt(n) {
  if (n == null) return '—';
  return n < 0
    ? `(${Math.abs(n).toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })})`
    : n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
}

function PhaseNameCell({ phase, jobId, isEditor, onRenamed }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');

  if (editing) {
    return (
      <form
        onSubmit={async e => {
          e.preventDefault();
          if (draft.trim()) await onRenamed(phase.id, draft.trim());
          setEditing(false);
        }}
        className="flex items-center gap-1"
      >
        <input
          autoFocus value={draft} onChange={e => setDraft(e.target.value)}
          className="border border-blue-400 rounded px-2 py-0.5 text-sm w-52"
        />
        <button type="submit" className="text-green-600 font-bold px-1">✓</button>
        <button type="button" onClick={() => setEditing(false)} className="text-gray-400 px-1">✕</button>
      </form>
    );
  }

  return (
    <div className="flex items-center gap-2 group">
      <Link to={`/jobs/${jobId}/phases/${phase.id}`} className="text-blue-700 hover:underline font-medium">
        {phase.phase_name}
      </Link>
      {isEditor && (
        <button
          onClick={() => { setDraft(phase.phase_name); setEditing(true); }}
          className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-blue-500 text-xs transition"
          title="Rename phase"
        >✎</button>
      )}
    </div>
  );
}

function SummaryTab({ job, isEditor, onPhaseRenamed }) {
  return (
    <>
      {/* Overall progress bar */}
      <div className="bg-white rounded-xl border border-gray-100 shadow p-5 mb-6">
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm font-medium text-gray-600">Overall % Complete</span>
          <span className="text-2xl font-bold text-blue-700">{job.pct_complete?.toFixed(1)}%</span>
        </div>
        <ProgressBar pct={job.pct_complete} className="h-3" />
        <div className="grid grid-cols-3 gap-4 mt-4 text-sm">
          <div>
            <div className="font-semibold text-gray-800">{fmt(job.total_budget)}</div>
            <div className="text-gray-400 text-xs">Total Budget</div>
          </div>
          <div>
            <div className="font-semibold text-gray-800">{fmt(job.total_earned)}</div>
            <div className="text-gray-400 text-xs">Entered Cost</div>
          </div>
          <div>
            <div className="font-semibold text-gray-800">{fmt(job.total_cost_to_complete)}</div>
            <div className="text-gray-400 text-xs">Remaining</div>
          </div>
        </div>
      </div>

      {/* Phase breakdown */}
      <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2">Phases</h2>
      <div className="bg-white rounded-xl shadow border border-gray-100 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
            <tr>
              <th className="text-left px-4 py-3">Phase</th>
              <th className="text-right px-4 py-3">Budget</th>
              <th className="text-right px-4 py-3">Entered Cost</th>
              <th className="text-right px-4 py-3">Remaining</th>
              <th className="text-right px-4 py-3 w-44">% Complete</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {(job.phases || []).map(phase => (
              <tr key={phase.id} className="hover:bg-blue-50 transition">
                <td className="px-4 py-3">
                  <PhaseNameCell phase={phase} jobId={job.id} isEditor={isEditor} onRenamed={onPhaseRenamed} />
                </td>
                <td className="px-4 py-3 text-right text-gray-600">{fmt(phase.total_budget)}</td>
                <td className="px-4 py-3 text-right text-gray-600">{fmt(phase.total_earned)}</td>
                <td className="px-4 py-3 text-right text-gray-600">{fmt(phase.total_cost_to_complete)}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2 justify-end">
                    <span className="w-12 text-right text-gray-700 font-medium">{phase.pct_complete?.toFixed(1)}%</span>
                    <ProgressBar pct={phase.pct_complete} className="w-20" />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
          {/* Totals row */}
          <tfoot className="bg-gray-50 font-semibold text-gray-700 text-sm border-t-2 border-gray-200">
            <tr>
              <td className="px-4 py-3">Total</td>
              <td className="px-4 py-3 text-right">{fmt(job.total_budget)}</td>
              <td className="px-4 py-3 text-right">{fmt(job.total_earned)}</td>
              <td className="px-4 py-3 text-right">{fmt(job.total_cost_to_complete)}</td>
              <td className="px-4 py-3 text-right">{job.pct_complete?.toFixed(1)}%</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </>
  );
}

function FoundationTab({ jobId }) {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['foundation', jobId],
    queryFn: () => api.getFoundation(jobId),
  });

  if (isLoading) return <p className="text-gray-400 mt-6 text-center">Loading Foundation data…</p>;
  if (isError) return <p className="text-red-500 mt-6">Failed to load Foundation data: {error?.message}</p>;

  const { rows = [], totals, foundationError } = data || {};

  // remaining > 0 = under budget (green), < 0 = over budget (red)
  const totalRemaining = totals?.remaining ?? 0;
  const totalIsOver = totalRemaining < 0;
  const remainingLabel = totalIsOver ? 'Overage' : 'Cost Remaining';
  const remainingColor = totalIsOver ? 'text-red-600' : 'text-green-600';
  const remainingBg = totalIsOver ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200';

  return (
    <div>
      {foundationError && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-4 text-sm text-amber-700">
          ⚠ Foundation connection error: {foundationError}
        </div>
      )}

      {/* Totals banner */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-gray-100 shadow p-4">
          <div className="text-xl font-bold text-gray-800">{fmt(totals?.original_budget)}</div>
          <div className="text-xs text-gray-400 mt-1">Original Budget</div>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 shadow p-4">
          <div className={`text-xl font-bold ${(totals?.co_adj || 0) !== 0 ? 'text-blue-700' : 'text-gray-800'}`}>
            {(totals?.co_adj || 0) >= 0 ? '+' : ''}{fmt(totals?.co_adj)}
          </div>
          <div className="text-xs text-gray-400 mt-1">Change Orders</div>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 shadow p-4">
          <div className="text-xl font-bold text-gray-800">{fmt(totals?.foundation_actual)}</div>
          <div className="text-xs text-gray-400 mt-1">Foundation Actual</div>
        </div>
        <div className={`rounded-xl border shadow p-4 ${remainingBg}`}>
          <div className={`text-xl font-bold ${remainingColor}`}>
            {fmt(Math.abs(totalRemaining))}
          </div>
          <div className={`text-xs mt-1 ${totalIsOver ? 'text-red-500' : 'text-green-600'}`}>{remainingLabel}</div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow border border-gray-100 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
            <tr>
              <th className="text-left px-4 py-3 w-20">Code</th>
              <th className="text-left px-4 py-3">Description</th>
              <th className="text-right px-4 py-3">Orig. Budget</th>
              <th className="text-right px-4 py-3">Change Orders</th>
              <th className="text-right px-4 py-3">Curr. Budget</th>
              <th className="text-right px-4 py-3">Foundation Actual</th>
              <th className="text-right px-4 py-3">Cost Remaining / Overage</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.map(row => {
              const isOver = row.remaining < 0;
              return (
                <tr key={row.cost_code} className={isOver ? 'bg-red-50' : ''}>
                  <td className="px-4 py-2 font-mono text-gray-500 text-xs">{row.cost_code}</td>
                  <td className="px-4 py-2 text-gray-700">{row.description}</td>
                  <td className="px-4 py-2 text-right text-gray-600">{fmt(row.original_budget)}</td>
                  <td className={`px-4 py-2 text-right ${row.co_adj !== 0 ? 'text-blue-600 font-medium' : 'text-gray-400'}`}>
                    {row.co_adj !== 0 ? `${row.co_adj >= 0 ? '+' : ''}${fmt(row.co_adj)}` : '—'}
                  </td>
                  <td className="px-4 py-2 text-right text-gray-700 font-medium">{fmt(row.current_budget)}</td>
                  <td className="px-4 py-2 text-right text-gray-600">{fmt(row.foundation_actual)}</td>
                  <td className={`px-4 py-2 text-right font-medium ${isOver ? 'text-red-600' : row.remaining > 0 ? 'text-green-600' : 'text-gray-400'}`}>
                    {isOver
                      ? `(${fmt(Math.abs(row.remaining))} over)`
                      : row.remaining > 0
                        ? fmt(row.remaining)
                        : '—'}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot className="bg-gray-50 font-semibold text-gray-700 border-t-2 border-gray-200">
            <tr>
              <td colSpan={2} className="px-4 py-3">Total</td>
              <td className="px-4 py-3 text-right">{fmt(totals?.original_budget)}</td>
              <td className={`px-4 py-3 text-right ${(totals?.co_adj || 0) !== 0 ? 'text-blue-600' : ''}`}>
                {(totals?.co_adj || 0) !== 0 ? `${(totals?.co_adj || 0) >= 0 ? '+' : ''}${fmt(totals?.co_adj)}` : '—'}
              </td>
              <td className="px-4 py-3 text-right">{fmt(totals?.current_budget)}</td>
              <td className="px-4 py-3 text-right">{fmt(totals?.foundation_actual)}</td>
              <td className={`px-4 py-3 text-right ${totalIsOver ? 'text-red-600' : 'text-green-600'}`}>
                {totalIsOver
                  ? `(${fmt(Math.abs(totalRemaining))} over)`
                  : fmt(totalRemaining)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

export default function JobDetail() {
  const { id } = useParams();
  const { isEditor } = useAuth();
  const qc = useQueryClient();
  const [tab, setTab] = useState('summary');

  const { data: job, isLoading } = useQuery({ queryKey: ['job', id], queryFn: () => api.getJob(id) });

  const syncMut = useMutation({
    mutationFn: () => api.triggerSync(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['job', id] });
      qc.invalidateQueries({ queryKey: ['foundation', id] });
    },
  });

  const renameMut = useMutation({
    mutationFn: ({ phaseId, phase_name }) => api.renamePhase(id, phaseId, phase_name),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['job', id] }),
  });

  if (isLoading) return <p className="text-gray-400 mt-10 text-center">Loading…</p>;
  if (!job) return <p className="text-red-500 mt-10 text-center">Job not found.</p>;

  return (
    <div>
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-400 mb-4">
        <Link to="/" className="hover:text-blue-600">Dashboard</Link>
        <span>/</span>
        <span className="text-gray-700 font-medium">{job.job_name}</span>
      </div>

      {/* Header */}
      <div className="flex flex-wrap gap-4 items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">{job.job_name}</h1>
          {job.job_number && <p className="text-sm text-gray-400">Job #{job.job_number}</p>}
        </div>
        {isEditor && (
          <button
            onClick={() => syncMut.mutate()}
            disabled={syncMut.isPending}
            className="bg-blue-700 hover:bg-blue-800 text-white px-4 py-2 rounded-lg text-sm font-medium transition disabled:opacity-50"
          >
            {syncMut.isPending ? 'Syncing…' : 'Sync Foundation'}
          </button>
        )}
      </div>

      {syncMut.isError && <p className="text-red-500 text-sm mb-4">{syncMut.error.message}</p>}
      {syncMut.isSuccess && <p className="text-green-600 text-sm mb-4">Foundation sync complete.</p>}

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-gray-200">
        {[
          { key: 'summary', label: 'Summary' },
          { key: 'foundation', label: 'Foundation vs. Budget' },
        ].map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition -mb-px ${
              tab === t.key
                ? 'border-blue-600 text-blue-700'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'summary' && (
        <SummaryTab
          job={job}
          isEditor={isEditor}
          onPhaseRenamed={(phaseId, phase_name) => renameMut.mutate({ phaseId, phase_name })}
        />
      )}
      {tab === 'foundation' && <FoundationTab jobId={id} />}
    </div>
  );
}
