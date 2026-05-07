import { supabase } from './supabase';

async function authHeaders() {
  const { data: { session } } = await supabase.auth.getSession();
  return { Authorization: `Bearer ${session?.access_token}`, 'Content-Type': 'application/json' };
}

async function request(method, path, body) {
  const headers = await authHeaders();
  const opts = { method, headers };
  if (body !== undefined) opts.body = JSON.stringify(body);
  const res = await fetch(`/api${path}`, opts);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || res.statusText);
  }
  if (res.status === 204) return null;
  return res.json();
}

export const api = {
  // Jobs
  getJobs: () => request('GET', '/jobs'),
  getJob: (id) => request('GET', `/jobs/${id}`),
  deleteJob: (id) => request('DELETE', `/jobs/${id}`),

  // Phases
  getPhases: (jobId) => request('GET', `/jobs/${jobId}/phases`),
  renamePhase: (jobId, phaseId, phase_name) => request('PATCH', `/jobs/${jobId}/phases/${phaseId}`, { phase_name }),

  // Lines
  getLines: (phaseId) => request('GET', `/phases/${phaseId}/lines`),
  setPct: (lineId, pct) => request('PATCH', `/lines/${lineId}/override`, { pct_complete_override: pct }),
  clearPct: (lineId) => request('DELETE', `/lines/${lineId}/override`),
  getFoundation: (jobId) => request('GET', `/jobs/${jobId}/foundation`),

  // Sync
  triggerSync: (jobId) => request('POST', `/jobs/${jobId}/sync`),
  getSyncLog: (jobId) => request('GET', `/jobs/${jobId}/sync-log`),

  // Upload
  async uploadExcel(file, jobName, jobNumber) {
    const { data: { session } } = await supabase.auth.getSession();
    const form = new FormData();
    form.append('file', file);
    form.append('job_name', jobName);
    form.append('job_number', jobNumber);
    const res = await fetch('/api/upload', {
      method: 'POST',
      headers: { Authorization: `Bearer ${session?.access_token}` },
      body: form,
    });
    if (!res.ok) { const e = await res.json(); throw new Error(e.error); }
    return res.json();
  },
  confirmUpload: (body) => request('POST', '/upload/confirm', body),

  // Users
  getUsers: () => request('GET', '/users'),
  updateRole: (userId, role) => request('PATCH', `/users/${userId}/role`, { role }),
};
