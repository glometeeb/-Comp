import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuth } from '../hooks/useAuth';
import ProgressBar from '../components/ProgressBar';

function fmt(n) {
  if (n == null) return '—';
  return n < 0
    ? `(${Math.abs(n).toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })})`
    : n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
}

export default function Dashboard() {
  const { isEditor } = useAuth();
  const qc = useQueryClient();
  const { data: jobs, isLoading, isError } = useQuery({ queryKey: ['jobs'], queryFn: api.getJobs, refetchInterval: 60000 });

  const deleteMut = useMutation({
    mutationFn: (id) => api.deleteJob(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['jobs'] }),
  });

  function handleDelete(e, id, name) {
    e.preventDefault();
    if (confirm(`Delete "${name}"? This cannot be undone.`)) {
      deleteMut.mutate(id);
    }
  }

  if (isLoading) return <p className="text-gray-400 mt-10 text-center">Loading jobs…</p>;
  if (isError) return <p className="text-red-500 mt-10 text-center">Failed to load jobs.</p>;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Jobs</h1>
        {isEditor && (
          <Link to="/upload" className="bg-blue-700 hover:bg-blue-800 text-white px-4 py-2 rounded-lg text-sm font-medium transition">
            + Upload Excel
          </Link>
        )}
      </div>

      {jobs?.length === 0 && (
        <div className="text-center text-gray-400 mt-20">
          <p className="text-lg">No jobs yet.</p>
          {isEditor && <Link to="/upload" className="text-blue-600 underline mt-2 inline-block">Upload an Excel budget to get started.</Link>}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {jobs?.map(job => (
          <div key={job.id} className="relative group">
            <Link to={`/jobs/${job.id}`} className="bg-white rounded-xl shadow hover:shadow-md border border-gray-100 p-5 transition flex flex-col gap-3 block">
              <div className="flex justify-between items-start">
                <div>
                  <h2 className="font-semibold text-gray-800">{job.job_name}</h2>
                  {job.job_number && <p className="text-xs text-gray-400">#{job.job_number}</p>}
                </div>
                <span className="text-2xl font-bold text-blue-700">{job.pct_complete?.toFixed(1)}%</span>
              </div>
              <ProgressBar pct={job.pct_complete} />
              <div className="grid grid-cols-2 text-xs text-gray-500 gap-x-3 gap-y-2 mt-1">
                <div><div className="font-medium text-gray-700">{fmt(job.total_budget)}</div>Budget</div>
                <div><div className="font-medium text-gray-700">{fmt(job.total_cost_to_complete)}</div>Remaining</div>
                <div><div className="font-medium text-gray-700">{fmt(job.total_earned)}</div>Entered Cost</div>
                <div><div className="font-medium text-gray-700">{fmt(job.foundation_total)}</div>Foundation</div>
              </div>
              <div className={`text-xs font-medium mt-1 ${job.difference >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                Difference: {job.difference >= 0 ? '+' : ''}{fmt(job.difference)}
                <span className="text-gray-400 font-normal ml-1">(entered vs foundation)</span>
              </div>
            </Link>
            {isEditor && (
              <button
                onClick={(e) => handleDelete(e, job.id, job.job_name)}
                disabled={deleteMut.isPending}
                className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 bg-red-100 hover:bg-red-200 text-red-600 rounded-lg px-2 py-1 text-xs font-medium transition"
              >
                Delete
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}