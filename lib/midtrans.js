const crypto = require("crypto");

function getMidtransConfig() {
  const serverKey = process.env.MIDTRANS_SERVER_KEY || "";
  const isProduction = String(process.env.MIDTRANS_IS_PRODUCTION || "false").toLowerCase() === "true";
  return {
    serverKey,
    isProduction,
    apiBaseUrl: isProduction ? "https://api.midtrans.com" : "https://api.sandbox.midtrans.com",
    snapBaseUrl: isProduction ? "https://app.midtrans.com" : "https://app.sandbox.midtrans.com"
  };
}

function hasMidtransConfig() {
  return Boolean(getMidtransConfig().serverKey);
}

function basicAuth(serverKey) {
  return Buffer.from(`${serverKey}:`).toString("base64");
}

function snapErrorMessage(payload) {
  if (Array.isArray(payload?.error_messages)) return payload.error_messages.join(" ");
  return payload?.status_message || "Midtrans request failed.";
}

async function createSnapTransaction(order) {
  const config = getMidtransConfig();
  if (!config.serverKey) return null;
  if (!order.amount || order.amount < 1) {
    throw new Error("Harga paket harus angka untuk checkout Midtrans.");
  }

  const response = await fetch(`${config.snapBaseUrl}/snap/v1/transactions`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basicAuth(config.serverKey)}`,
      "Content-Type": "application/json",
      Accept: "application/json"
    },
    body: JSON.stringify({
      transaction_details: {
        order_id: order.id,
        gross_amount: order.amount
      },
      item_details: [
        {
          id: order.packageId,
          price: order.amount,
          quantity: 1,
          name: order.packageName
        }
      ],
      customer_details: {
        first_name: order.buyerName,
        phone: order.whatsapp
      },
      custom_field1: order.characterName,
      custom_field2: order.discord || "",
      callbacks: {
        finish: process.env.MIDTRANS_FINISH_URL || ""
      }
    })
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(snapErrorMessage(payload));
  }

  return {
    token: payload.token,
    redirectUrl: payload.redirect_url
  };
}

async function getTransactionStatus(orderId) {
  const config = getMidtransConfig();
  if (!config.serverKey) return null;

  const response = await fetch(`${config.apiBaseUrl}/v2/${encodeURIComponent(orderId)}/status`, {
    headers: {
      Authorization: `Basic ${basicAuth(config.serverKey)}`,
      Accept: "application/json"
    }
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    return null;
  }
  return payload;
}

function verifyMidtransSignature(payload) {
  const config = getMidtransConfig();
  if (!config.serverKey) return false;
  const input = `${payload.order_id || ""}${payload.status_code || ""}${payload.gross_amount || ""}${config.serverKey}`;
  const signature = crypto.createHash("sha512").update(input).digest("hex");
  return signature === payload.signature_key;
}

function mapMidtransStatus(payload) {
  const transactionStatus = String(payload.transaction_status || "").toLowerCase();
  const fraudStatus = String(payload.fraud_status || "").toLowerCase();

  if (transactionStatus === "settlement") return "paid";
  if (transactionStatus === "capture") return fraudStatus === "challenge" ? "pending" : "paid";
  if (transactionStatus === "pending") return "pending";
  if (["deny", "cancel", "expire", "failure"].includes(transactionStatus)) return "cancelled";
  return "pending";
}

module.exports = {
  createSnapTransaction,
  getTransactionStatus,
  hasMidtransConfig,
  mapMidtransStatus,
  verifyMidtransSignature
};
