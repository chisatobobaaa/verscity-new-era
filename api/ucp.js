const { createUcp, listUcps } = require("../lib/ucp");
const { isAdminRequest } = require("../lib/admin-auth");
const { readJsonBody, sendJson } = require("../lib/http-utils");

module.exports = async function handler(request, response) {
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

    sendJson(response, 405, { ok: false, error: "Method not allowed" });
  } catch (error) {
    sendJson(response, 400, { ok: false, error: error.message });
  }
};
