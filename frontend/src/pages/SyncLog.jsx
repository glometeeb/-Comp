import { useQuery } from '@tanstack/react-query';
import { useParams, Link } from 'react-router-dom';
import { api } from '../lib/api';

export default function SyncLog() {
  const { id: jobId } = useParams();

  // If no jobId, we render a general page asking user to navigate to a job
  if (!jobId) {
    return (
      <div className="max-w-2xl">
        <h1 className="text-2xl font-bold text-gray-800 mb-4">Sync Log</h1>
        <p className="text-gray-500">Navigate to a specific job to view its sync history, or go to the <Link to="/" className="text-blue-600 underline">Dashboard</Link>.</p>
      </div>
    );
  }

  return <JobSyncLog jobId={jobId} />;
}

function JobSyncLog({ jobId }) {
  const { data: logs, isLoading } = useQuery({ queryKey: ['sync-log', jobId], queryFn: () => api.getSyncLog(jobId) });
  const { data: job } = useQuery({ queryKey: ['job', jobId], queryFn: () => api.getJob(jobId) });

  if (isLoading) return <p className="text-gray-400 mt-10 text-center">Loading…</p>;

  return (
    <div className="max-w-3xl">
      <div className="flex items-center gap-2 text-sm text-gray-400 mb-4">
        <Link to="/" className="hover:text-blue-600">Dashboard</Link>
        <span>/</span>
        <Link to={`/jobs/${jobId}`} className="hover:text-blue-600">{job?.job_name}</Link>
        <span>/</span>
        <span className="text-gray-700">Sync Log</span>
      </div>

      <h1 className="text-2xl font-bold text-gray-800 mb-6">Foundation Sync History</h1>

      {logs?.length === 0 ? (
        <p className="text-gray-400">No syncs yet for this job.</p>
      ) : (
        <div className="bg-white rounded-xl shadow border border-gray-100 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
              <tr>
                <th className="text-left px-5 py-3">Date</th>
                <th className="text-left px-5 py-3">By</th>
                <th className="text-right px-5 py-3">Rows Updated</th>
                <th className="text-left px-5 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {logs?.map(log => (
                <tr key={log.id}>
                  <td className="px-5 py-3 text-gray-600">{new Date(log.synced_at).toLocaleString()}</td>
                  <td className="px-5 py-3 text-gray-600">{log.profiles?.full_name || '—'}</td>
                  <td className="px-5 py-3 text-right text-gray-600">{log.rows_updated ?? '—'}</td>
                  <td className="px-5 py-3">
                    {log.errors ? (
                      <span className="text-red-500 text-xs">{log.errors}</span>
                    ) : (
                      <span className="text-green-600 text-xs font-medium">OK</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
