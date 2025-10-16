import express from 'express';
import multer from 'multer';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs/promises';
import db from '../config/database.js';
import { authenticateToken } from '../middleware/auth.js';
import { analyzePcapFile } from '../controllers/pcapAnalyzer.js';

const router = express.Router();

// Configure multer for PCAP uploads
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const uploadDir = path.join(process.cwd(), 'server', 'uploads', 'pcap');
    await fs.mkdir(uploadDir, { recursive: true });
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${uuidv4()}-${file.originalname}`;
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    if (file.originalname.endsWith('.pcap') || file.originalname.endsWith('.pcapng')) {
      cb(null, true);
    } else {
      cb(new Error('Only .pcap and .pcapng files are allowed'));
    }
  },
  limits: { fileSize: 100 * 1024 * 1024 } // 100MB limit
});

router.use(authenticateToken);

// Upload PCAP files
router.post('/upload', upload.array('files', 10), async (req, res) => {
  try {
    const { sessionId } = req.body;

    if (!sessionId) {
      return res.status(400).json({ error: 'Session ID required' });
    }

    // Verify session belongs to user
    const [sessions] = await db.query(
      'SELECT id FROM analysis_sessions WHERE id = ? AND user_id = ?',
      [sessionId, req.user.userId]
    );

    if (sessions.length === 0) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const fileRecords = [];

    for (const file of req.files) {
      const fileId = uuidv4();
      const filePath = `/uploads/pcap/${file.filename}`;

      await db.query(
        'INSERT INTO pcap_files (id, session_id, file_name, file_path, file_size, uploaded_at) VALUES (?, ?, ?, ?, ?, NOW())',
        [fileId, sessionId, file.originalname, filePath, file.size]
      );

      fileRecords.push({
        id: fileId,
        fileName: file.originalname,
        filePath,
        fileSize: file.size
      });
    }

    // Start analysis in background
    analyzePcapFile(sessionId).catch(err => {
      console.error('PCAP analysis error:', err);
    });

    res.json({
      success: true,
      files: fileRecords,
      message: 'Files uploaded, analysis started'
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: 'Failed to upload files' });
  }
});

export default router;
