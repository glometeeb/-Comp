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

function PctCell({ line, onSave, onClear, isEditor }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');

  const pct = line.pct_complete_effective ?? 0;

  if (!isEditor) {
    return (
      <div className="flex items-center gap-2 justify-end">
        <span className="w-12 text-right">{pct.toFixed(1)}%</span>
        <ProgressBar pct={pct} className="w-20" />
      </div>
    );
  }

  if (editing) {
    return (
      <form
        onSubmit={e => {
          e.preventDefault();
          const val = parseFloat(draft);
          if (!isNaN(val) && val >= 0 && val <= 100) onSave(val);
          setEditing(false);
        }}
        className="flex items-center gap-1 justify-end"
      >
        <input
          autoFocus type="number" min="0" max="100" step="0.1"
          value={draft} onChange={e => setDraft(e.target.value)}
          className="w-20 border border-blue-400 rounded px-2 py-0.5 text-sm text-right"
        />
        <span className="text-gray-500 text-sm">%</span>
        <button type="submit" className="text-green-600 font-bold px-1 text-sm">✓</button>
        <button type="button" onClick={() => setEditing(false)} className="text-gray-400 px-1 text-sm">✕</button>
      </form>
    );
  }

  return (
    <div className="flex items-center gap-2 justify-end group">
      {line.has_override && (
        <button
          onClick={() => onClear()}
          title="Reset to 0%"
          className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600 text-xs transition"
        >↩</button>
      )}
      <span
        onClick={() => { setDraft(pct.toFixed(1)); setEditing(true); }}
        className="w-12 text-right cursor-pointer hover:text-blue-600 font-medium"
        title="Click to edit"
      >
        {pct.toFixed(1)}%
      </span>
      <ProgressBar pct={pct} className="w-20" />
    </div>
  );
}

function LineTable({ rows, label, isEditor, onSave, onClear }) {
  if (!rows.length) return null;
  return (
    <div className="mb-8">
      <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">{label}</h3>
      <div className="bg-white rounded-xl shadow border border-gray-100 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
            <tr>
              <th className="text-left px-4 py-2 w-20">Code</th>
              <th className="text-left px-4 py-2">Description</th>
              <th className="text-right px-4 py-2">Budget</th>
              <th className="text-right px-4 py-2">Earned Value</th>
              <th className="text-right px-4 py-2">To Complete</th>
              <th className="text-right px-4 py-2 w-48">% Complete</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.map(line => (
              <tr key={line.id} className={line.budget_amount === 0 ? 'opacity-40' : ''}>
                <td className="px-4 py-2 font-mono text-gray-500 text-xs">{line.cost_code}</td>
                <td className="px-4 py-2 text-gray-700">{line.description}</td>
                <td className="px-4 py-2 text-right text-gray-600">{fmt(line.budget_amount)}</td>
                <td className="px-4 py-2 text-right text-gray-600">{fmt(line.earned_value)}</td>
                <td className="px-4 py-2 text-right text-gray-600">{fmt(line.cost_to_complete)}</td>
                <td className="px-4 py-2">
                  <PctCell
                    line={line}
                    isEditor={isEditor}
                    onSave={pct => onSave(line.id, pct)}
                    onClear={() => onClear(line.id)}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function PhaseDetail() {
  const { id: jobId, phaseId } = useParams();
  const { isEditor } = useAuth();
  const qc = useQueryClient();

  const { data: job } = useQuery({ queryKey: ['job', jobId], queryFn: () => api.getJob(jobId) });
  const { data, isLoading } = useQuery({ queryKey: ['lines', phaseId], queryFn: () => api.getLines(phaseId) });

  const phase = job?.phases?.find(p => p.id === phaseId);

  const saveMut = useMutation({
    mutationFn: ({ lineId, pct }) => api.setPct(lineId, pct),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['lines', phaseId] });
      qc.invalidateQueries({ queryKey: ['job', jobId] });
    },
  });

  const clearMut = useMutation({
    mutationFn: (lineId) => api.clearPct(lineId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['lines', phaseId] });
      qc.invalidateQueries({ queryKey: ['job', jobId] });
    },
  });

  if (isLoading) return <p className="text-gray-400 mt-10 text-center">Loading…</p>;

  const { lines = [], rollup } = data || {};
  const labor = lines.filter(l => l.type === 'LABOR');
  const materials = lines.filter(l => l.type === 'MATERIALS');

  return (
    <div>
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-400 mb-4">
        <Link to="/" className="hover:text-blue-600">Dashboard</Link>
        <span>/</span>
        <Link to={`/jobs/${jobId}`} className="hover:text-blue-600">{job?.job_name}</Link>
        <span>/</span>
        <span className="text-gray-700 font-medium">{phase?.phase_name}</span>
      </div>

      <h1 className="text-2xl font-bold text-gray-800 mb-6">{phase?.phase_name}</h1>

      {/* Summary cards */}
      {rollup && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[
            { label: 'Budget', value: fmt(rollup.total_budget) },
            { label: 'Earned Value', value: fmt(rollup.total_earned) },
            { label: 'To Complete', value: fmt(rollup.total_cost_to_complete) },
            { label: '% Complete', value: `${rollup.pct_complete?.toFixed(1) ?? 0}%` },
          ].map(({ label, value }) => (
            <div key={label} className="bg-white rounded-xl border border-gray-100 shadow p-4">
              <div className="text-xl font-bold text-gray-800">{value}</div>
              <div className="text-xs text-gray-400 mt-1">{label}</div>
            </div>
          ))}
        </div>
      )}

      {isEditor && (
        <p className="text-xs text-gray-400 mb-4">Click a % value to edit it. Use ↩ to reset to 0%.</p>
      )}

      <LineTable
        rows={labor} label="Labor" isEditor={isEditor}
        onSave={(lineId, pct) => saveMut.mutate({ lineId, pct })}
        onClear={(lineId) => clearMut.mutate(lineId)}
      />
      <LineTable
        rows={materials} label="Materials" isEditor={isEditor}
        onSave={(lineId, pct) => saveMut.mutate({ lineId, pct })}
        onClear={(lineId) => clearMut.mutate(lineId)}
      />
    </div>
  );
}
