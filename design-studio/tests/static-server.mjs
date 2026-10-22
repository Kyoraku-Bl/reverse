import http from "node:http";
import fs from "node:fs";
import path from "node:path";
export async function staticServer(root, base = "/reverse/") {
  const dir = path.resolve(root),
    requests = [];
  const server = http.createServer((req, res) => {
    const pathname = new URL(req.url, "http://local").pathname;
    requests.push(pathname);
    if (!pathname.startsWith(base)) {
      res.writeHead(404);
      res.end("Not found");
      return;
    }
    let file = path.resolve(
      dir,
      decodeURIComponent(pathname.slice(base.length) || "index.html"),
    );
    if (!file.startsWith(dir + path.sep)) {
      res.writeHead(403);
      res.end();
      return;
    }
    if (!fs.existsSync(file) || !fs.statSync(file).isFile()) {
      res.writeHead(404);
      res.end("Not found");
      return;
    }
    const types = {
      ".html": "text/html",
      ".js": "text/javascript",
      ".css": "text/css",
      ".wasm": "application/wasm",
      ".jpg": "image/jpeg",
      ".png": "image/png",
      ".ttf": "font/ttf",
      ".txt": "text/plain",
    };
    res.writeHead(200, {
      "Content-Type": types[path.extname(file)] || "application/octet-stream",
      "Cache-Control": "no-store",
    });
    fs.createReadStream(file).pipe(res);
  });
  await new Promise((r) => server.listen(0, "0.0.0.0", r));
  return {
    server,
    requests,
    url: "http://127.0.0.1:" + server.address().port + base,
    close: () => new Promise((r) => server.close(r)),
  };
}
