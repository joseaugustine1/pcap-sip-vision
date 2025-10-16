import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import db from '../config/database.js';

const router = express.Router();

function isPublicIP(ip) {
  const parts = ip.split('.').map(Number);
  
  if (parts.length !== 4 || parts.some(p => isNaN(p) || p < 0 || p > 255)) {
    return false;
  }
  
  if (parts[0] === 10) return false;
  if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return false;
  if (parts[0] === 192 && parts[1] === 168) return false;
  if (parts[0] === 127) return false;
  if (parts[0] === 169 && parts[1] === 254) return false;
  
  return true;
}

router.post('/', async (req, res) => {
  try {
    const { ip } = req.body;

    if (!ip) {
      return res.status(400).json({ error: 'IP address required' });
    }

    if (!isPublicIP(ip)) {
      return res.json({
        ip,
        isPrivate: true,
        info: 'Private IP'
      });
    }

    // Check cache
    const [cached] = await db.query(
      'SELECT * FROM ip_lookups WHERE ip_address = ?',
      [ip]
    );

    if (cached.length > 0) {
      return res.json({
        ip,
        country: cached[0].country,
        city: cached[0].city,
        isp: cached[0].isp,
        org: cached[0].org,
        cached: true
      });
    }

    // Fetch from ip-api.com
    const response = await fetch(`http://ip-api.com/json/${ip}?fields=status,message,country,city,isp,org,as`);
    const data = await response.json();

    if (data.status === 'fail') {
      return res.status(400).json({
        ip,
        error: data.message || 'Lookup failed'
      });
    }

    // Cache result
    await db.query(
      'INSERT INTO ip_lookups (id, ip_address, country, city, isp, org, lookup_data, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, NOW())',
      [uuidv4(), ip, data.country || null, data.city || null, data.isp || null, data.org || null, JSON.stringify(data)]
    );

    res.json({
      ip,
      country: data.country,
      city: data.city,
      isp: data.isp,
      org: data.org,
      as: data.as
    });
  } catch (error) {
    console.error('IP lookup error:', error);
    res.status(500).json({ error: 'Failed to lookup IP address' });
  }
});

export default router;
