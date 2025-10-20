import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import authRoutes from './routes/auth.js';
import sessionsRoutes from './routes/sessions.js';
import pcapRoutes from './routes/pcap.js';
import ipLookupRoutes from './routes/ipLookup.js';
import profileRoutes from './routes/profiles.js';




dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Static file serving for uploads
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/sessions', sessionsRoutes);
app.use('/api/pcap', pcapRoutes);
app.use('/api/ip-lookup', ipLookupRoutes);
app.use('/api/profiles', profileRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('[ERROR]', {
    timestamp: new Date().toISOString(),
    error: err.message,
    stack: err.stack
  });
  
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error'
  });
});


app.listen(PORT, () => {
  console.log(`🚀 VoIP Analyzer Server running on port ${PORT}`);
  console.log(`📁 Upload directory: ${path.join(__dirname, 'uploads')}`);
});
