const { createUcp, deleteUcp, listUcps } = require("../lib/ucp");
const { isAdminRequest } = require("../lib/admin-auth");
const { readJsonBody, sendJson } = require("../lib/http-utils");

module.exports = async function handler(request, response) {
  try {
    if (request.method === "POST") {
      const payload = await readJsonBody(request, 256 * 1024);
      if (payload.action === "delete") {
        if (!isAdminRequest(request)) {
          sendJson(response, 401, { ok: false, error: "Unauthorized" });
          return;
        }

        sendJson(response, 200, { ok: true, ucp: await deleteUcp(payload.id || payload.mysqlId) });
        return;
      }

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
    const isDatabaseAccessError = error.code === "ER_ACCESS_DENIED_ERROR" || /access denied/i.test(error.message);
    sendJson(response, 400, {
      ok: false,
      error: isDatabaseAccessError ? "Database UCP belum bisa login. Cek MYSQL_PASSWORD di Vercel." : error.message
    });
  }
};
