const express = require('express');
const router = express.Router();
const supabase = require('../services/supabase');
const { requireAuth, requireEditor } = require('../middleware/auth');

router.use(requireAuth);

// GET /api/users — list all users (editor only)
router.get('/', requireEditor, async (req, res) => {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, role, created_at')
    .order('created_at');

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// PATCH /api/users/:id/role — change user role (editor only)
router.patch('/:id/role', requireEditor, async (req, res) => {
  const { role } = req.body;
  if (!['EDITOR', 'VIEWER'].includes(role)) {
    return res.status(400).json({ error: 'Role must be EDITOR or VIEWER' });
  }

  const { data, error } = await supabase
    .from('profiles')
    .update({ role })
    .eq('id', req.params.id)
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

module.exports = router;
