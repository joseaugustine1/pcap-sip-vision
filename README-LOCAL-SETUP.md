# VoIP Analyzer - Local Setup Guide

This guide explains how to run the VoIP Analyzer completely offline using Node.js + MySQL.

## Prerequisites

### Required Software

1. **Node.js 18+**
   - Download: https://nodejs.org/
   - Verify: `node --version`

2. **MySQL 8.0+**
   - Download: https://dev.mysql.com/downloads/mysql/
   - Verify: `mysql --version`

3. **tshark (Wireshark CLI)**
   - **Windows**: Install Wireshark from https://www.wireshark.org/download.html
   - **Linux**: `sudo apt-get install tshark`
   - **macOS**: `brew install wireshark`
   - Verify: `tshark --version`

4. **Git** (for cloning)
   - Download: https://git-scm.com/

## Installation Steps

### 1. Clone the Repository

```bash
git clone <repository-url>
cd voip-analyzer
```

### 2. Setup MySQL Database

```bash
# Login to MySQL
mysql -u root -p

# Create database and user
CREATE DATABASE voip_analyzer;
CREATE USER 'voip_user'@'localhost' IDENTIFIED BY 'your_secure_password';
GRANT ALL PRIVILEGES ON voip_analyzer.* TO 'voip_user'@'localhost';
FLUSH PRIVILEGES;
EXIT;

# Import schema
mysql -u root -p voip_analyzer < server/schema.sql
```

### 3. Configure Backend

```bash
cd server

# Install dependencies
npm install

# Copy environment template
cp .env.example .env

# Edit .env file with your settings
# nano .env  (or use your preferred editor)
```

**Required .env configuration:**

```env
PORT=3001
NODE_ENV=development

DB_HOST=localhost
DB_USER=voip_user
DB_PASSWORD=your_secure_password
DB_NAME=voip_analyzer

JWT_SECRET=generate-a-long-random-string-here

UPLOAD_DIR=./server/uploads
TSHARK_PATH=
```

**Generate JWT Secret:**

```bash
# On Linux/macOS:
openssl rand -base64 32

# On Windows (PowerShell):
[Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Minimum 0 -Maximum 256 }))
```

### 4. Configure Frontend

```bash
cd ..  # Back to root directory

# Install frontend dependencies
npm install

# Create .env file for frontend
echo "VITE_API_URL=http://localhost:3001/api" > .env
```

### 5. Create Upload Directories

```bash
# From project root
mkdir -p server/uploads/pcap
mkdir -p server/uploads/audio
```

## Running the Application

### Start Backend Server

```bash
# Terminal 1 - Start backend
cd server
npm run dev
```

You should see:
```
🚀 VoIP Analyzer Server running on port 3001
✅ MySQL connected successfully
```

### Start Frontend

```bash
# Terminal 2 - Start frontend
npm run dev
```

You should see:
```
VITE v5.x.x ready in XXX ms
➜ Local:   http://localhost:5173/
```

### Access the Application

Open your browser to: **http://localhost:5173**

## Testing the Setup

### 1. Test Database Connection

```bash
mysql -u voip_user -p voip_analyzer

# Verify tables exist
SHOW TABLES;

# Should show:
# analysis_sessions
# call_metrics
# interval_metrics
# ip_lookups
# pcap_files
# profiles
# sip_messages
# users
```

### 2. Test tshark

```bash
tshark --version

# Should output version information
```

### 3. Test API Health

```bash
curl http://localhost:3001/api/health

# Should return: {"status":"ok","timestamp":"..."}
```

### 4. Create Test Account

1. Open http://localhost:5173
2. Click "Sign Up"
3. Create account with email/password
4. You should be redirected to the main page

## PCAP Analysis Workflow

### How It Works

1. **Upload**: User uploads .pcap/.pcapng files
2. **Storage**: Files saved to `server/uploads/pcap/`
3. **Analysis**: Backend uses tshark to extract:
   - RTP packets (voice data)
   - SIP messages (call signaling)
4. **Metrics**: Calculates:
   - Call quality (MOS score)
   - Jitter and latency
   - Packet loss
5. **Results**: Stored in MySQL, displayed in UI

### Using Your Own PCAP Files

Place your PCAP files anywhere, then upload via the UI. Supported formats:
- `.pcap` - Standard PCAP
- `.pcapng` - Next-generation PCAP

## Troubleshooting

### Backend won't start

**Error: "Cannot connect to MySQL"**

```bash
# Check MySQL is running
mysql -u voip_user -p

# Verify credentials in server/.env match MySQL user
```

**Error: "Port 3001 already in use"**

```bash
# Find process using port
lsof -i :3001  # macOS/Linux
netstat -ano | findstr :3001  # Windows

# Kill it or change PORT in server/.env
```

### Frontend won't connect to backend

**CORS errors in browser console**

- Ensure backend is running on http://localhost:3001
- Check `.env` has: `VITE_API_URL=http://localhost:3001/api`
- Restart frontend: `npm run dev`

### PCAP analysis fails

**Error: "tshark not found"**

```bash
# Verify installation
which tshark  # Linux/macOS
where tshark  # Windows

# If not found, install Wireshark
# Windows: Add to PATH: C:\Program Files\Wireshark
```

**Error: "Permission denied"**

On Linux, tshark may need permissions:

```bash
sudo dpkg-reconfigure wireshark-common
sudo usermod -a -G wireshark $USER
# Logout and login again
```

### Database issues

**Error: "Table doesn't exist"**

```bash
# Re-run schema
mysql -u voip_user -p voip_analyzer < server/schema.sql
```

**Need to reset database**

```bash
mysql -u root -p
DROP DATABASE voip_analyzer;
CREATE DATABASE voip_analyzer;
EXIT;

mysql -u voip_user -p voip_analyzer < server/schema.sql
```

## File Structure

```
voip-analyzer/
├── server/                    # Backend (Node.js + Express)
│   ├── config/
│   │   └── database.js       # MySQL connection
│   ├── controllers/
│   │   └── pcapAnalyzer.js   # PCAP parsing logic
│   ├── middleware/
│   │   └── auth.js           # JWT authentication
│   ├── routes/
│   │   ├── auth.js           # Login/signup
│   │   ├── sessions.js       # Analysis sessions
│   │   ├── pcap.js           # PCAP upload
│   │   └── ipLookup.js       # IP geolocation
│   ├── uploads/              # File storage
│   │   ├── pcap/            # PCAP files
│   │   └── audio/           # Extracted audio
│   ├── index.js              # Server entry point
│   ├── schema.sql            # Database schema
│   ├── package.json          # Backend dependencies
│   └── .env                  # Backend config
│
├── src/                       # Frontend (React + Vite)
│   ├── lib/
│   │   └── api.ts            # API client (replaces Supabase)
│   └── ...
│
├── .env                       # Frontend config
└── package.json              # Frontend dependencies
```

## Security Notes

⚠️ **For Development Only**

This setup is for local development. For production deployment:

1. Use proper secrets management
2. Enable HTTPS
3. Configure firewall rules
4. Use environment-specific configs
5. Implement rate limiting
6. Add request validation
7. Set up proper logging
8. Use connection pooling

## Offline Capabilities

✅ **Fully Offline Features:**
- User authentication (local JWT)
- PCAP upload and analysis
- Database storage (local MySQL)
- All UI features

❌ **Requires Internet:**
- IP geolocation lookups (uses ip-api.com)
  - Cached after first lookup
  - Gracefully degrades if offline

## Performance Tips

1. **MySQL Optimization**
   ```sql
   # In MySQL config (my.cnf)
   innodb_buffer_pool_size = 1G
   max_connections = 100
   ```

2. **Large PCAP Files**
   - Files > 100MB may take time to analyze
   - Consider splitting large captures
   - Monitor server memory usage

3. **Concurrent Uploads**
   - Backend processes one session at a time
   - Multiple users supported via connection pooling

## Next Steps

- [x] Setup complete
- [ ] Upload sample PCAP file
- [ ] View analysis results
- [ ] Explore call metrics
- [ ] Check SIP ladder diagram
- [ ] Review audio playback (if available)

## Support

For issues or questions:
1. Check the troubleshooting section
2. Review console logs (browser + backend)
3. Verify all prerequisites are installed
4. Ensure all services are running

---

**Happy analyzing! 📞📊**
