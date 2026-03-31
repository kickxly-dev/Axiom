/**
 * src/web-server.js
 *
 * Simple static file server for the Axiom web client.
 * Serves the web/ directory on WEB_PORT (default 8080).
 *
 * Run with:  node src/web-server.js
 * or:        npm run start:web
 */

import "dotenv/config";
import http from "http";
import fs   from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WEB_DIR   = path.join(__dirname, "..", "web");
const PORT      = parseInt(process.env.WEB_PORT || "8080", 10);

const MIME = {
  ".html": "text/html",
  ".js":   "application/javascript",
  ".css":  "text/css",
  ".json": "application/json",
  ".png":  "image/png",
  ".ico":  "image/x-icon",
};

const server = http.createServer((req, res) => {
  let urlPath = req.url === "/" ? "/index.html" : req.url;
  // Strip query string
  urlPath = urlPath.split("?")[0];

  const filePath = path.join(WEB_DIR, urlPath);
  // Security: prevent directory traversal
  if (!filePath.startsWith(WEB_DIR)) {
    res.writeHead(403); res.end("Forbidden"); return;
  }

  const ext  = path.extname(filePath);
  const mime = MIME[ext] || "text/plain";

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("Not found");
      return;
    }
    res.writeHead(200, { "Content-Type": mime });
    res.end(data);
  });
});

server.listen(PORT, () => {
  console.log(`✅ Axiom Web Client running on http://localhost:${PORT}`);
  console.log(`   Make sure the API is running at http://localhost:${process.env.API_PORT || 3000}`);
});
