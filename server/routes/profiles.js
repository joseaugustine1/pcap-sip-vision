import express from 'express';
import db from '../config/database.js';
import { authenticateToken } from '../middleware/auth.js';
 
const router = express.Router();
 
// Get user profile
router.get('/:userId', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.params;
    const [profiles] = await db.query(
      'SELECT display_name, avatar_url FROM profiles WHERE user_id = ?',
      [userId]
    );
    if (profiles.length === 0) {
      return res.status(404).json({ error: 'Profile not found' });
    }
    res.json(profiles[0]);
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});
 
export default router;