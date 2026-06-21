const { createCheckoutOrder } = require("../lib/orders");
const { readJsonBody, sendJson } = require("../lib/http-utils");

module.exports = async function handler(request, response) {
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
};
