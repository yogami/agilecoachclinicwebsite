const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;

// In-memory visitor analytics log (Server-side ICP discovery log)
const visitorLogs = [];

const MIME_TYPES = {
  '.html': 'text/html; charset=UTF-8',
  '.css': 'text/css; charset=UTF-8',
  '.js': 'application/javascript; charset=UTF-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.json': 'application/json'
};

const server = http.createServer((req, res) => {
  const host = req.headers['host'] || 'unknown';
  const userAgent = req.headers['user-agent'] || 'unknown';
  const referrer = req.headers['referer'] || req.headers['referrer'] || 'direct';
  const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
  const parsedUrl = new URL(req.url, `http://${host}`);
  const pathname = parsedUrl.pathname;

  // Server-Side Visitor Event Logging (Bypasses Ad-Blockers & Parameter Stripping)
  const eventData = {
    timestamp: new Date().toISOString(),
    domain: host,
    path: pathname,
    ip: clientIp.split(',')[0].trim(),
    referrer: referrer,
    userAgent: userAgent,
    query: Object.fromEntries(parsedUrl.searchParams)
  };

  // Skip asset logging to keep analytics clean
  if (!pathname.match(/\.(css|js|png|jpg|svg|ico)$/)) {
    visitorLogs.push(eventData);
    if (visitorLogs.length > 500) visitorLogs.shift(); // Keep latest 500 entries
    console.log(`[VISITOR LOG] ${eventData.timestamp} | Host: ${host} | Path: ${pathname} | IP: ${eventData.ip} | Ref: ${referrer}`);
  }

  // Internal Analytics Endpoint (Protected / Debug view)
  if (pathname === '/api/analytics') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ totalVisits: visitorLogs.length, recentVisitors: visitorLogs.slice(-50) }, null, 2));
    return;
  }

  // Handle Clean Professional Routing
  let filePath = path.join(__dirname, 'index.html');
  if (pathname !== '/' && pathname !== '/clinic') {
    const potentialPath = path.join(__dirname, pathname);
    if (fs.existsSync(potentialPath) && fs.statSync(potentialPath).isFile()) {
      filePath = potentialPath;
    }
  }

  // Security check to prevent directory traversal
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
      res.end(content, 'utf-8');
    }
  });
});

server.listen(PORT, () => {
  console.log(`Professional Coach Clinic server running on port ${PORT}`);
});
