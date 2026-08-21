const http = require('http');
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const PORT = process.env.PORT || 3000;
const NOTIFY_EMAIL = process.env.NOTIFY_EMAIL || 'gopal.yami@gmail.com';
const CALENDLY_URL = process.env.CALENDLY_URL || 'https://calendly.com/berlin-ai-labs/30min';
const RESEND_API_KEY = process.env.RESEND_API_KEY || '';
const DATABASE_URL = process.env.DATABASE_URL || '';

// Initialize PostgreSQL Pool if DATABASE_URL exists
let dbPool = null;
if (DATABASE_URL) {
  dbPool = new Pool({
    connectionString: DATABASE_URL,
    ssl: DATABASE_URL.includes('railway.internal') ? false : { rejectUnauthorized: false }
  });

  // Initialize PostgreSQL tables automatically
  dbPool.query(`
    CREATE TABLE IF NOT EXISTS visitor_logs (
      id SERIAL PRIMARY KEY,
      timestamp TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
      host TEXT,
      path TEXT,
      ip TEXT,
      referrer TEXT,
      user_agent TEXT
    );
    CREATE TABLE IF NOT EXISTS leads (
      id SERIAL PRIMARY KEY,
      timestamp TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
      name TEXT,
      email TEXT,
      role TEXT,
      challenge TEXT,
      ip TEXT
    );
  `).then(() => {
    console.log('✅ PostgreSQL Analytics Tables Initialized on Railway');
  }).catch(err => {
    console.error('❌ PostgreSQL Initialization Error:', err);
  });
}

const MIME_TYPES = {
  '.html': 'text/html; charset=UTF-8',
  '.css': 'text/css; charset=UTF-8',
  '.js': 'application/javascript; charset=UTF-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.json': 'application/json'
};

// Helper: Send email notification via Resend API
async function sendNotificationEmail(lead) {
  if (!RESEND_API_KEY) {
    console.log(`[EMAIL ALERT SIMULATION] New Lead from ${lead.name} (${lead.email}).`);
    return;
  }

  try {
    const payload = JSON.stringify({
      from: 'Coach Clinic <onboarding@resend.dev>',
      to: [NOTIFY_EMAIL],
      subject: `🚨 New Coach Clinic Lead: ${lead.name} (${lead.role})`,
      html: `
        <div style="font-family: sans-serif; padding: 20px; color: #111;">
          <h2>🚨 New Coach Clinic Triage Request</h2>
          <p><strong>Name:</strong> ${lead.name}</p>
          <p><strong>Email:</strong> <a href="mailto:${lead.email}">${lead.email}</a></p>
          <p><strong>Role:</strong> ${lead.role}</p>
          <p><strong>Challenge Description:</strong></p>
          <blockquote style="background: #f4f4f5; padding: 14px; border-left: 4px solid #8b5cf6; font-size: 1.05em;">${lead.challenge}</blockquote>
          <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
          <p style="font-size: 0.85em; color: #666;"><strong>Timestamp:</strong> ${lead.timestamp}<br/><strong>IP Address:</strong> ${lead.ip}</p>
        </div>
      `
    });

    const req = http.request({
      hostname: 'api.resend.com',
      port: 443,
      path: '/emails',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Length': Buffer.byteLength(payload)
      }
    });

    req.on('response', (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        console.log(`[RESEND EMAIL SENT] Status: ${res.statusCode} | Response:`, data);
      });
    });

    req.on('error', (err) => {
      console.error('[RESEND EMAIL ERROR]:', err);
    });

    req.write(payload);
    req.end();
  } catch (err) {
    console.error('Failed to send email notification:', err);
  }
}

const server = http.createServer((req, res) => {
  const host = req.headers['host'] || 'unknown';
  const userAgent = req.headers['user-agent'] || 'unknown';
  const referrer = req.headers['referer'] || req.headers['referrer'] || 'direct';
  const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
  const parsedUrl = new URL(req.url, `http://${host}`);
  const pathname = parsedUrl.pathname;
  const ip = clientIp.split(',')[0].trim();

  // Server-Side Visitor Event Logging into PostgreSQL
  if (!pathname.match(/\.(css|js|png|jpg|jpeg|webp|svg|ico)$/)) {
    if (dbPool) {
      dbPool.query(
        `INSERT INTO visitor_logs (host, path, ip, referrer, user_agent) VALUES ($1, $2, $3, $4, $5)`,
        [host, pathname, ip, referrer, userAgent]
      ).catch(e => console.error('DB Visitor Log Error:', e.message));
    }
  }

  // Handle Form Triage Submission (POST /api/triage)
  if (pathname === '/api/triage' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', async () => {
      try {
        const lead = JSON.parse(body);
        lead.timestamp = new Date().toISOString();
        lead.ip = ip;
        
        console.log('🚨 NEW LEAD CAPTURED:', lead);

        // Store Lead into PostgreSQL
        if (dbPool) {
          await dbPool.query(
            `INSERT INTO leads (name, email, role, challenge, ip) VALUES ($1, $2, $3, $4, $5)`,
            [lead.name, lead.email, lead.role, lead.challenge, lead.ip]
          ).catch(e => console.error('DB Lead Log Error:', e.message));
        }

        // Send Real-Time Email Notification via Resend
        await sendNotificationEmail(lead);

        // Pre-fill Calendly redirect URL
        const redirectUrl = `${CALENDLY_URL}?name=${encodeURIComponent(lead.name)}&email=${encodeURIComponent(lead.email)}`;

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ 
          success: true, 
          message: 'Triage request received.',
          redirectUrl: redirectUrl 
        }));
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'Invalid JSON payload' }));
      }
    });
    return;
  }

  // Static File Serving & Clean Path Routing (NOTE: NO public /api/analytics endpoint exists!)
  let filePath = path.join(__dirname, 'index.html');
  if (pathname !== '/' && pathname !== '/clinic') {
    const potentialPath = path.join(__dirname, pathname);
    if (fs.existsSync(potentialPath) && fs.statSync(potentialPath).isFile()) {
      filePath = potentialPath;
    }
  }

  if (!filePath.startsWith(__dirname)) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end('Forbidden');
    return;
  }

  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'text/html; charset=UTF-8';

  fs.readFile(filePath, (err, content) => {
    if (err) {
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end(`Server Error: ${err.code}`);
    } else {
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content);
    }
  });
});

server.listen(PORT, () => {
  console.log(`Coach Clinic server running on port ${PORT}`);
});
