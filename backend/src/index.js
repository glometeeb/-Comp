require('dotenv').config();
const express = require('express');
const cors = require('cors');

const jobsRouter = require('./routes/jobs');
const phasesRouter = require('./routes/phases');
const linesRouter = require('./routes/lines');
const uploadRouter = require('./routes/upload');
const usersRouter = require('./routes/users');
const syncRouter = require('./routes/sync');

const app = express();

const allowedOrigins = [
  process.env.FRONTEND_URL,
  'http://localhost:5173',
  'https://comp-ten-iota.vercel.app',
].filter(Boolean);
app.use(cors({ origin: allowedOrigins, credentials: true }));
app.use(express.json());

app.use('/api/jobs', jobsRouter);
app.use('/api/jobs', syncRouter);
app.use('/api', syncRouter);  // mounts /foundation/test and /foundation/schema
app.use('/api/jobs', phasesRouter);   // mounts /:jobId/phases under /api/jobs
app.use('/api/phases', linesRouter);  // mounts /:phaseId/lines under /api/phases
app.use('/api/lines', linesRouter);   // mounts /:id/override under /api/lines
app.use('/api/upload', uploadRouter);
app.use('/api/users', usersRouter);

app.get('/api/health', (_req, res) => res.json({ ok: true }));

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`CostTrack API listening on port ${PORT}`));
