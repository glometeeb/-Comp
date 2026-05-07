const express = require('express');
const multer = require('multer');
const router = express.Router();
const supabase = require('../services/supabase');
const { requireAuth, requireEditor } = require('../middleware/auth');
const { parseWorkbook } = require('../services/excelParser');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

// In-memory preview store (keyed by upload token)
const previews = new Map();

// POST /api/upload — parse Excel, return preview
router.post('/', requireAuth, requireEditor, upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  try {
    const parsed = parseWorkbook(req.file.buffer);
    const token = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    previews.set(token, { parsed, job_name: req.body.job_name || req.file.originalname, job_number: req.body.job_number || '' });

    // Auto-expire after 30 minutes
    setTimeout(() => previews.delete(token), 30 * 60 * 1000);

    res.json({ token, phases: parsed.phases.map(p => ({ phaseName: p.phaseName, phaseCode: p.phaseCode, lineCount: p.lines.length })), unmappedRows: parsed.unmappedRows });
  } catch (err) {
    res.status(422).json({ error: `Parse error: ${err.message}` });
  }
});

// POST /api/upload/confirm — write parsed data to DB
router.post('/confirm', requireAuth, requireEditor, async (req, res) => {
  const { token, job_name, job_number } = req.body;
  const preview = previews.get(token);
  if (!preview) return res.status(400).json({ error: 'Invalid or expired upload token' });

  const { parsed } = preview;
  const name = job_name || preview.job_name;
  const num = job_number || preview.job_number;

  // Create job
  const { data: job, error: jobErr } = await supabase
    .from('jobs')
    .insert({ job_name: name, job_number: num, uploaded_by: req.user.id })
    .select()
    .single();

  if (jobErr) return res.status(500).json({ error: jobErr.message });

  for (const phase of parsed.phases) {
    const { data: phaseRow, error: phaseErr } = await supabase
      .from('phases')
      .insert({ job_id: job.id, phase_name: phase.phaseName, phase_code: phase.phaseCode, is_single_phase: phase.isSinglePhase, sort_order: phase.sort_order || 0 })
      .select()
      .single();

    if (phaseErr) continue;

    if (phase.lines.length > 0) {
      const linesToInsert = phase.lines.map(l => ({ phase_id: phaseRow.id, ...l }));
      await supabase.from('cost_code_lines').insert(linesToInsert);
    }
  }

  previews.delete(token);
  res.status(201).json({ job_id: job.id, job_name: job.job_name });
});

module.exports = router;
