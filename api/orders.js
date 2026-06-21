const { isAdminRequest } = require("../lib/admin-auth");
const { listOrders, updateOrderStatus } = require("../lib/orders");
const { readJsonBody, sendJson } = require("../lib/http-utils");

module.exports = async function handler(request, response) {
  if (!isAdminRequest(request)) {
    sendJson(response, 401, { ok: false, error: "Unauthorized" });
    return;
  }

  try {
    if (request.method === "GET") {
      sendJson(response, 200, { ok: true, orders: await listOrders() });
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
};
