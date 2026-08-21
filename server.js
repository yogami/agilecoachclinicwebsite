const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const NOTIFY_EMAIL = process.env.NOTIFY_EMAIL || 'gopal.yami@gmail.com';
const CALENDLY_URL = process.env.CALENDLY_URL || 'https://calendly.com/berlin-ai-labs/30min';
const RESEND_API_KEY = process.env.RESEND_API_KEY || '';

// In-memory visitor analytics & lead log
const visitorLogs = [];
const capturedLeads = [];

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
    console.log(`[EMAIL ALERT SIMULATION] New Lead from ${lead.name} (${lead.email}). Set RESEND_API_KEY on Railway to enable real-time inbox delivery.`);
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

  // Server-Side Visitor Event Logging
  const eventData = {
    timestamp: new Date().toISOString(),
    domain: host,
    path: pathname,
    ip: clientIp.split(',')[0].trim(),
    referrer: referrer,
    userAgent: userAgent,
    query: Object.fromEntries(parsedUrl.searchParams)
  };

  if (!pathname.match(/\.(css|js|png|jpg|jpeg|webp|svg|ico)$/)) {
    visitorLogs.push(eventData);
    if (visitorLogs.length > 500) visitorLogs.shift();
  }

  // Handle Form Triage Submission (POST /api/triage)
  if (pathname === '/api/triage' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', async () => {
      try {
        const lead = JSON.parse(body);
        lead.timestamp = new Date().toISOString();
        lead.ip = clientIp.split(',')[0].trim();
        
        capturedLeads.push(lead);
        console.log('🚨 NEW LEAD CAPTURED:', lead);

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

  // Internal Analytics & Leads Endpoint
  if (pathname === '/api/analytics') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ 
      totalVisits: visitorLogs.length, 
      totalLeads: capturedLeads.length,
      recentLeads: capturedLeads.slice(-20),
      recentVisitors: visitorLogs.slice(-50) 
    }, null, 2));
    return;
  }

  // Static File Serving & Clean Path Routing
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
