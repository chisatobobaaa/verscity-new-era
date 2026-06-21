const { readJsonBody, sendJson } = require("../lib/http-utils");
const { updateOrderFromMidtrans } = require("../lib/orders");

module.exports = async function handler(request, response) {
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
};
