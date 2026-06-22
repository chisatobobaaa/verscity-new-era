const dgram = require("dgram");
const dns = require("dns").promises;
const fs = require("fs");
const http = require("http");
const path = require("path");
const { createAdminCookie, clearAdminCookie, isAdminRequest } = require("./lib/admin-auth");
const { createCheckoutOrder, syncMidtransOrders, updateOrderFromMidtrans, updateOrderStatus } = require("./lib/orders");
const { readSiteData, writeSiteData } = require("./lib/site-data-store");
const { createUcp, deleteUcp, listUcps } = require("./lib/ucp");

const WEB_PORT = Number(process.env.WEB_PORT || 8080);
const SAMP_HOST = process.env.SAMP_HOST || "127.0.0.1";
const SAMP_PORT = Number(process.env.SAMP_PORT || 7777);
const SERVER_CFG = process.env.SAMP_CONFIG || "C:\\Users\\mardi\\Videos\\verscity roleplay newera\\server.cfg";
const ROOT = __dirname;

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".svg": "image/svg+xml"
};

function readServerConfig() {
  try {
    const text = fs.readFileSync(SERVER_CFG, "utf8");
    const getValue = (key) => {
      const match = text.match(new RegExp(`^${key}\\s+(.+)$`, "im"));
      return match ? match[1].trim() : "";
    };

    return {
      hostname: getValue("hostname") || "Verscity Roleplay | NewEra",
      mapname: getValue("mapname") || "San Andreas",
      language: getValue("language") || "Bahasa English/Indonesia",
      maxplayers: Number(getValue("maxplayers")) || 250,
      port: Number(getValue("port")) || SAMP_PORT
    };
  } catch (error) {
    return {
      hostname: "Verscity Roleplay | NewEra",
      mapname: "San Andreas",
      language: "Bahasa English/Indonesia",
      maxplayers: 250,
      port: SAMP_PORT
    };
  }
}

function readString(buffer, offset) {
  const length = buffer.readUInt32LE(offset);
  const start = offset + 4;
  const end = start + length;
  return {
    value: buffer.toString("latin1", start, end),
    offset: end
  };
}

async function resolveIpv4(host) {
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return host;
  const records = await dns.lookup(host, { family: 4 });
  return records.address;
}

async function querySampServer(host, port, timeoutMs = 1400) {
  const ip = await resolveIpv4(host);
  const ipParts = ip.split(".").map(Number);
  const packet = Buffer.alloc(11);
  packet.write("SAMP", 0, "ascii");
  ipParts.forEach((part, index) => packet.writeUInt8(part, 4 + index));
  packet.writeUInt16LE(port, 8);
  packet.write("i", 10, "ascii");

  return new Promise((resolve, reject) => {
    const socket = dgram.createSocket("udp4");
    const timer = setTimeout(() => {
      socket.close();
      reject(new Error("SA-MP query timeout"));
    }, timeoutMs);

    socket.once("message", (message) => {
      clearTimeout(timer);
      socket.close();

      if (message.length < 20 || message.toString("ascii", 0, 4) !== "SAMP") {
        reject(new Error("Invalid SA-MP query response"));
        return;
      }

      let offset = 11;
      const passworded = Boolean(message.readUInt8(offset));
      offset += 1;
      const players = message.readUInt16LE(offset);
      offset += 2;
      const maxplayers = message.readUInt16LE(offset);
      offset += 2;
      const hostname = readString(message, offset);
      offset = hostname.offset;
      const gamemode = readString(message, offset);
      offset = gamemode.offset;
      const language = readString(message, offset);

      resolve({
        online: true,
        host,
        port,
        passworded,
        players,
        maxplayers,
        hostname: hostname.value,
        gamemode: gamemode.value,
        mapname: "San Andreas",
        language: language.value
      });
    });

    socket.once("error", (error) => {
      clearTimeout(timer);
      socket.close();
      reject(error);
    });

    socket.send(packet, port, host);
  });
}

function sendJson(response, statusCode, payload) {
  const body = JSON.stringify(payload);
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "Content-Length": Buffer.byteLength(body)
  });
  response.end(body);
}

function readJsonBody(request, maxBytes = 8 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    let body = "";

    request.on("data", (chunk) => {
      body += chunk;
      if (Buffer.byteLength(body) > maxBytes) {
        reject(new Error("Request body too large"));
        request.destroy();
      }
    });

    request.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (error) {
        reject(new Error("Invalid JSON body"));
      }
    });

    request.on("error", reject);
  });
}

async function handleAdminData(request, response) {
  if (request.method === "GET") {
    sendJson(response, 200, {
      ok: true,
      data: await readSiteData()
    });
    return;
  }

  if (request.method !== "PUT" && request.method !== "POST") {
    sendJson(response, 405, { ok: false, error: "Method not allowed" });
    return;
  }

  try {
    const payload = await readJsonBody(request);
    if (!isAdminRequest(request)) {
      sendJson(response, 401, { ok: false, error: "Unauthorized" });
      return;
    }

    await writeSiteData(payload.data || {});
    sendJson(response, 200, { ok: true });
  } catch (error) {
    const isDatabaseAccessError = error.code === "ER_ACCESS_DENIED_ERROR" || /access denied/i.test(error.message);
    sendJson(response, 400, {
      ok: false,
      error: isDatabaseAccessError ? "Database UCP belum bisa login. Cek MYSQL_PASSWORD di Vercel." : error.message
    });
  }
}

async function handleAdminLogin(request, response) {
  if (request.method !== "POST") {
    sendJson(response, 405, { ok: false, error: "Method not allowed" });
    return;
  }

  try {
    const payload = await readJsonBody(request, 32 * 1024);
    const cookie = createAdminCookie(String(payload.username || ""), String(payload.password || ""));
    if (!cookie) {
      sendJson(response, 401, { ok: false, error: "Username atau password salah" });
      return;
    }

    response.setHeader("Set-Cookie", cookie);
    sendJson(response, 200, { ok: true });
  } catch (error) {
    sendJson(response, 400, { ok: false, error: error.message });
  }
}

function handleAdminLogout(response) {
  response.setHeader("Set-Cookie", clearAdminCookie());
  sendJson(response, 200, { ok: true });
}

async function handleCheckout(request, response) {
  if (request.method !== "POST") {
    sendJson(response, 405, { ok: false, error: "Method not allowed" });
    return;
  }

  try {
    const payload = await readJsonBody(request);
    const order = await createCheckoutOrder(payload);
    sendJson(response, 200, { ok: true, order });
  } catch (error) {
    sendJson(response, 400, { ok: false, error: error.message });
  }
}

async function handleOrders(request, response) {
  if (!isAdminRequest(request)) {
    sendJson(response, 401, { ok: false, error: "Unauthorized" });
    return;
  }

  try {
    if (request.method === "GET") {
      sendJson(response, 200, { ok: true, orders: await syncMidtransOrders() });
      return;
    }

    if (request.method === "PUT") {
      const payload = await readJsonBody(request);
      const order = await updateOrderStatus(String(payload.orderId || ""), String(payload.status || ""));
      sendJson(response, 200, { ok: true, order });
      return;
    }

    sendJson(response, 405, { ok: false, error: "Method not allowed" });
  } catch (error) {
    sendJson(response, 400, { ok: false, error: error.message });
  }
}

async function handleMidtransNotification(request, response) {
  if (request.method !== "POST") {
    sendJson(response, 405, { ok: false, error: "Method not allowed" });
    return;
  }

  try {
    const payload = await readJsonBody(request, 1024 * 1024);
    const order = await updateOrderFromMidtrans(payload);
    sendJson(response, 200, { ok: true, order });
  } catch (error) {
    sendJson(response, 400, { ok: false, error: error.message });
  }
}

async function handleUcp(request, response) {
  try {
    if (request.method === "POST") {
      const payload = await readJsonBody(request, 256 * 1024);
      const ucp = await createUcp(payload);
      sendJson(response, 200, { ok: true, ucp });
      return;
    }

      if (request.method === "GET") {
        if (!isAdminRequest(request)) {
          sendJson(response, 401, { ok: false, error: "Unauthorized" });
          return;
        }

      sendJson(response, 200, { ok: true, ucps: await listUcps() });
        return;
      }

      if (request.method === "DELETE") {
        if (!isAdminRequest(request)) {
          sendJson(response, 401, { ok: false, error: "Unauthorized" });
          return;
        }

        const payload = await readJsonBody(request, 32 * 1024);
        sendJson(response, 200, { ok: true, ucp: await deleteUcp(payload.id || payload.mysqlId) });
        return;
      }

      sendJson(response, 405, { ok: false, error: "Method not allowed" });
  } catch (error) {
    sendJson(response, 400, { ok: false, error: error.message });
  }
}

function serveStatic(request, response) {
  const url = new URL(request.url, `http://${request.headers.host}`);
  const requestedPath = decodeURIComponent(url.pathname === "/" ? "/index.html" : url.pathname);
  const absolutePath = path.normalize(path.join(ROOT, requestedPath));

  if (!absolutePath.startsWith(ROOT)) {
    response.writeHead(403);
    response.end("Forbidden");
    return;
  }

  fs.readFile(absolutePath, (error, content) => {
    if (error) {
      response.writeHead(404);
      response.end("Not found");
      return;
    }

    response.writeHead(200, {
      "Content-Type": mimeTypes[path.extname(absolutePath).toLowerCase()] || "application/octet-stream"
    });
    response.end(content);
  });
}

const server = http.createServer(async (request, response) => {
  if (request.url.startsWith("/api/admin-login")) {
    await handleAdminLogin(request, response);
    return;
  }

  if (request.url.startsWith("/api/admin-logout")) {
    handleAdminLogout(response);
    return;
  }

  if (request.url.startsWith("/api/admin-data")) {
    await handleAdminData(request, response);
    return;
  }

  if (request.url.startsWith("/api/checkout")) {
    await handleCheckout(request, response);
    return;
  }

  if (request.url.startsWith("/api/orders")) {
    await handleOrders(request, response);
    return;
  }

  if (request.url.startsWith("/api/midtrans-notification")) {
    await handleMidtransNotification(request, response);
    return;
  }

  if (request.url.startsWith("/api/ucp")) {
    await handleUcp(request, response);
    return;
  }

  if (request.url.startsWith("/api/server-status")) {
    const fallback = readServerConfig();
    try {
      const status = await querySampServer(SAMP_HOST, fallback.port || SAMP_PORT);
      sendJson(response, 200, {
        ...fallback,
        ...status,
        maxplayers: status.maxplayers || fallback.maxplayers,
        mapname: fallback.mapname || status.mapname
      });
    } catch (error) {
      sendJson(response, 200, {
        ...fallback,
        online: false,
        host: SAMP_HOST,
        port: fallback.port || SAMP_PORT,
        players: 0,
        error: error.message
      });
    }
    return;
  }

  serveStatic(request, response);
});

server.listen(WEB_PORT, () => {
  console.log(`Verscity website running at http://localhost:${WEB_PORT}`);
  console.log(`SA-MP query target ${SAMP_HOST}:${SAMP_PORT}`);
});
