import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import db from '../config/database.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

// Get all sessions for user
router.get('/', async (req, res) => {
  try {
    const [sessions] = await db.query(
      'SELECT * FROM analysis_sessions WHERE user_id = ? ORDER BY created_at DESC',
      [req.user.userId]
    );
    res.json(sessions);
  } catch (error) {
    console.error('Get sessions error:', error);
    res.status(500).json({ error: 'Failed to fetch sessions' });
  }
});

// Get session by ID
router.get('/:id', async (req, res) => {
  try {
    const [sessions] = await db.query(
      'SELECT * FROM analysis_sessions WHERE id = ? AND user_id = ?',
      [req.params.id, req.user.userId]
    );
    
    if (sessions.length === 0) {
      return res.status(404).json({ error: 'Session not found' });
    }

    res.json(sessions[0]);
  } catch (error) {
    console.error('Get session error:', error);
    res.status(500).json({ error: 'Failed to fetch session' });
  }
});

// Create session
router.post('/', async (req, res) => {
  try {
    const { name } = req.body;
    const sessionId = uuidv4();

    await db.query(
      'INSERT INTO analysis_sessions (id, name, user_id, status, created_at, total_calls, avg_mos, avg_jitter, avg_latency) VALUES (?, ?, ?, ?, NOW(), 0, NULL, NULL, NULL)',
      [sessionId, name, req.user.userId, 'pending']
    );

    const [sessions] = await db.query('SELECT * FROM analysis_sessions WHERE id = ?', [sessionId]);
    res.json(sessions[0]);
  } catch (error) {
    console.error('Create session error:', error);
    res.status(500).json({ error: 'Failed to create session' });
  }
});

// Get call metrics for session
router.get('/:id/metrics', async (req, res) => {
  try {
    const [metrics] = await db.query(
      `SELECT cm.* FROM call_metrics cm
       JOIN analysis_sessions s ON s.id = cm.session_id
       WHERE s.id = ? AND s.user_id = ?`,
      [req.params.id, req.user.userId]
    );
    res.json(metrics);
  } catch (error) {
    console.error('Get metrics error:', error);
    res.status(500).json({ error: 'Failed to fetch metrics' });
  }
});

// Get SIP messages for session
router.get('/:id/sip-messages', async (req, res) => {
  try {
    const [messages] = await db.query(
      `SELECT sm.* FROM sip_messages sm
       JOIN analysis_sessions s ON s.id = sm.session_id
       WHERE s.id = ? AND s.user_id = ?
       ORDER BY sm.timestamp ASC`,
      [req.params.id, req.user.userId]
    );
    res.json(messages);
  } catch (error) {
    console.error('Get SIP messages error:', error);
    res.status(500).json({ error: 'Failed to fetch SIP messages' });
  }
});

// Get interval metrics for call
router.get('/call/:callId/intervals', async (req, res) => {
  try {
    const [intervals] = await db.query(
      `SELECT im.* FROM interval_metrics im
       JOIN call_metrics cm ON cm.id = im.call_id
       JOIN analysis_sessions s ON s.id = cm.session_id
       WHERE cm.id = ? AND s.user_id = ?
       ORDER BY im.interval_start ASC`,
      [req.params.callId, req.user.userId]
    );
    res.json(intervals);
  } catch (error) {
    console.error('Get intervals error:', error);
    res.status(500).json({ error: 'Failed to fetch interval metrics' });
  }
});

// Delete session
router.delete('/:id', async (req, res) => {
  try {
    await db.query(
      'DELETE FROM analysis_sessions WHERE id = ? AND user_id = ?',
      [req.params.id, req.user.userId]
    );
    res.json({ success: true });
  } catch (error) {
    console.error('Delete session error:', error);
    res.status(500).json({ error: 'Failed to delete session' });
  }
});

export default router;
