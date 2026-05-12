const http = require("http");
const fs = require("fs");
const { StringStream } = require("scramjet");

// Load users from the users.json file
const users = JSON.parse(fs.readFileSync("./users.json"));
const sessions = {}; // Temporary in-memory session storage

const server = http.createServer((req, res) => {
  let body = "";

  req.on("data", (chunk) => {
    body += chunk.toString();
  });

  req.on("end", async () => {
    const { url, method } = req;

    if (url === "/login" && method === "POST") {
      const { username, password } = JSON.parse(body);

      if (users[username] && users[username] === password) {
        const token = `${username}-${Date.now()}`;
        sessions[token] = username;
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: true, token }));
      } else {
        res.writeHead(401, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: false, message: "Invalid username or password" }));
      }
    } else if (url.startsWith("/proxy") && sessions[req.headers.authorization]) {
      const targetUrl = new URLSearchParams(url.split("?")[1]).get("url");
      if (!targetUrl) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: false, message: "Missing target URL" }));
        return;
      }

      http.get(targetUrl, (proxyRes) => {
        res.writeHead(proxyRes.statusCode, proxyRes.headers);
        StringStream.from(proxyRes).pipe(res);
      }).on("error", (err) => {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: false, message: "Error proxying request", error: err.message }));
      });
    } else {
      res.writeHead(403, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: false, message: "Access denied" }));
    }
  });
});

server.listen(3000, () => {
  console.log("Server is running at http://localhost:3000");
});
