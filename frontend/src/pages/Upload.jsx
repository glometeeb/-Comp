import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';

export default function Upload() {
  const [file, setFile] = useState(null);
  const [jobName, setJobName] = useState('');
  const [jobNumber, setJobNumber] = useState('');
  const [preview, setPreview] = useState(null);
  const [token, setToken] = useState('');
  const [error, setError] = useState('');
  const [step, setStep] = useState('form');
  const inputRef = useRef();
  const navigate = useNavigate();

  async function handleParse(e) {
    e.preventDefault();
    if (!file) return;
    if (!jobNumber.trim()) { setError('Job number is required'); return; }
    setError('');
    setStep('confirming');
    try {
      const result = await api.uploadExcel(file, jobName || file.name.replace(/\.xlsx?$/, ''), jobNumber);
      setToken(result.token);
      setPreview(result);
      setStep('preview');
    } catch (err) {
      setError(err.message);
      setStep('form');
    }
  }

  async function handleConfirm() {
    setError('');
    setStep('confirming');
    try {
      const result = await api.confirmUpload({ token, job_name: jobName, job_number: jobNumber });
      navigate(`/jobs/${result.job_id}`);
    } catch (err) {
      setError(err.message);
      setStep('preview');
    }
  }

  function handleDrop(e) {
    e.preventDefault();
    const f = e.dataTransfer.files[0];
    if (f) { setFile(f); setJobName(prev => prev || f.name.replace(/\.xlsx?$/, '')); }
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Upload Excel Budget</h1>

      {step === 'form' || step === 'confirming' ? (
        <form onSubmit={handleParse} className="bg-white rounded-xl shadow border border-gray-100 p-6 space-y-5">
          <div
            onDrop={handleDrop} onDragOver={e => e.preventDefault()}
            onClick={() => inputRef.current.click()}
            className="border-2 border-dashed border-gray-300 hover:border-blue-400 rounded-xl p-10 text-center cursor-pointer transition"
          >
            <input ref={inputRef} type="file" accept=".xlsx,.xls" className="hidden"
              onChange={e => { const f = e.target.files[0]; if (f) { setFile(f); setJobName(prev => prev || f.name.replace(/\.xlsx?$/, '')); } }} />
            {file ? (
              <p className="text-blue-700 font-medium">{file.name}</p>
            ) : (
              <p className="text-gray-400">Drag & drop an Excel file here, or click to browse</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Job Number <span className="text-red-500">*</span>
            </label>
            <input type="text" required value={jobNumber} onChange={e => setJobNumber(e.target.value)}
              placeholder="e.g. K2852"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            <p className="text-xs text-gray-400 mt-1">Must match the job number in Foundation Software</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Job Name</label>
            <input type="text" required value={jobName} onChange={e => setJobName(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>

          {error && <p className="text-red-600 text-sm">{error}</p>}

          <button type="submit" disabled={!file || step === 'confirming'}
            className="bg-blue-700 hover:bg-blue-800 text-white font-semibold py-2 px-6 rounded-lg transition disabled:opacity-50">
            {step === 'confirming' ? 'Parsing…' : 'Parse & Preview'}
          </button>
        </form>
      ) : (
        <div className="space-y-6">
          <div className="bg-white rounded-xl shadow border border-gray-100 p-6">
            <h2 className="font-semibold text-gray-700 mb-1">Detected Phases ({preview.phases.length})</h2>
            <p className="text-xs text-gray-400 mb-3">Job #{jobNumber}</p>
            <table className="w-full text-sm text-gray-600">
              <thead className="text-xs text-gray-400 uppercase">
                <tr><th className="text-left pb-2">Phase</th><th className="text-left pb-2">Code</th><th className="text-right pb-2">Lines</th></tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {preview.phases.map((p, i) => (
                  <tr key={i}><td className="py-2">{p.phaseName}</td><td className="py-2">{p.phaseCode || '—'}</td><td className="py-2 text-right">{p.lineCount}</td></tr>
                ))}
              </tbody>
            </table>
          </div>

          {preview.unmappedRows?.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
              <h3 className="font-semibold text-amber-700 mb-2">{preview.unmappedRows.length} unmapped row(s)</h3>
              <ul className="text-sm text-amber-600 space-y-1">
                {preview.unmappedRows.slice(0, 5).map((r, i) => (
                  <li key={i}>{r.reason}: {JSON.stringify(r.raw)}</li>
                ))}
                {preview.unmappedRows.length > 5 && <li>…and {preview.unmappedRows.length - 5} more</li>}
              </ul>
            </div>
          )}

          {error && <p className="text-red-600 text-sm">{error}</p>}

          <div className="flex gap-3">
            <button onClick={handleConfirm} disabled={step === 'confirming'}
              className="bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-6 rounded-lg transition disabled:opacity-50">
              {step === 'confirming' ? 'Saving…' : 'Confirm & Save'}
            </button>
            <button onClick={() => setStep('form')}
              className="border border-gray-300 text-gray-600 hover:bg-gray-50 py-2 px-6 rounded-lg transition">
              Back
            </button>
          </div>
        </div>
      )}
    </div>
  );
}