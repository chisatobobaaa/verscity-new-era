const { isAdminRequest } = require("../lib/admin-auth");
const { readSiteData, writeSiteData } = require("../lib/site-data-store");

function sendJson(response, statusCode, payload) {
  response.statusCode = statusCode;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("Cache-Control", "no-store");
  response.end(JSON.stringify(payload));
}

function readJsonBody(request, maxBytes = 8 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    if (request.body && typeof request.body === "object") {
      resolve(request.body);
      return;
    }

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

module.exports = async function handler(request, response) {
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
    sendJson(response, 400, { ok: false, error: error.message });
  }
};
