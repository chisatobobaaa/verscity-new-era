const crypto = require("crypto");
const { createSnapTransaction, hasMidtransConfig, mapMidtransStatus, verifyMidtransSignature } = require("./midtrans");
const { readSiteData, writeSiteData } = require("./site-data-store");

const allowedStatuses = new Set(["pending", "paid", "processing", "done", "cancelled"]);

function cleanText(value, maxLength = 160) {
  return String(value || "").trim().slice(0, maxLength);
}

function parsePrice(price) {
  const value = String(price || "").replace(/[^\d]/g, "");
  return value ? Number(value) : 0;
}

function findPackage(data, packageId) {
  return (data.donationPackages || []).find((pkg) => pkg.id === packageId);
}

function packageFromPayload(payload) {
  const packageId = cleanText(payload.packageId, 80);
  const packageName = cleanText(payload.packageName, 120);
  if (!packageId || !packageName) return null;

  return {
    id: packageId,
    name: packageName,
    group: cleanText(payload.packageGroup, 80),
    tier: cleanText(payload.tier, 80),
    price: cleanText(payload.price, 40)
  };
}

function normalizeOrders(orders) {
  return Array.isArray(orders) ? orders : [];
}

function statusToPaymentStatus(status, currentPaymentStatus = "pending") {
  if (status === "paid" || status === "processing" || status === "done") return "settlement";
  if (status === "cancelled") return "cancelled";
  return currentPaymentStatus || "pending";
}

function getMidtransPaymentName(payload) {
  return (
    payload.payment_type ||
    payload.issuer ||
    payload.acquirer ||
    payload.store ||
    payload.va_numbers?.[0]?.bank ||
    payload.permata_va_number && "permata_va" ||
    ""
  );
}

async function createCheckoutOrder(payload) {
  const data = await readSiteData();
  const pkg = findPackage(data, cleanText(payload.packageId, 80)) || packageFromPayload(payload);

  if (!pkg) {
    throw new Error("Paket donation tidak ditemukan.");
  }

  const order = {
    id: `VR-${Date.now()}-${crypto.randomBytes(3).toString("hex").toUpperCase()}`,
    packageId: pkg.id,
    packageName: pkg.name,
    packageGroup: pkg.group,
    tier: pkg.tier,
    price: pkg.price,
    amount: parsePrice(pkg.price),
    buyerName: cleanText(payload.buyerName, 80),
    whatsapp: cleanText(payload.whatsapp, 32),
    discord: cleanText(payload.discord, 80),
    characterName: cleanText(payload.characterName, 80),
    note: cleanText(payload.note, 500),
    status: "pending",
    paymentMethod: hasMidtransConfig() ? "midtrans_snap" : "manual",
    paymentStatus: "pending",
    paymentUrl: "",
    snapToken: "",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  if (!order.buyerName || !order.whatsapp || !order.characterName) {
    throw new Error("Nama, WhatsApp, dan nama karakter wajib diisi.");
  }

  if (hasMidtransConfig()) {
    const snap = await createSnapTransaction(order);
    order.snapToken = snap.token || "";
    order.paymentUrl = snap.redirectUrl || "";
  }

  data.orders = [order, ...normalizeOrders(data.orders)].slice(0, 300);
  await writeSiteData(data);
  return order;
}

async function listOrders() {
  const data = await readSiteData();
  return normalizeOrders(data.orders);
}

async function updateOrderStatus(orderId, status) {
  if (!allowedStatuses.has(status)) {
    throw new Error("Status order tidak valid.");
  }

  const data = await readSiteData();
  let updatedOrder = null;
  data.orders = normalizeOrders(data.orders).map((order) => {
    if (order.id !== orderId) return order;
    updatedOrder = {
      ...order,
      status,
      paymentStatus: statusToPaymentStatus(status, order.paymentStatus),
      updatedAt: new Date().toISOString()
    };
    return updatedOrder;
  });

  if (!updatedOrder) {
    throw new Error("Order tidak ditemukan.");
  }

  await writeSiteData(data);
  return updatedOrder;
}

async function updateOrderFromMidtrans(payload) {
  if (!verifyMidtransSignature(payload)) {
    throw new Error("Signature Midtrans tidak valid.");
  }

  const data = await readSiteData();
  const nextStatus = mapMidtransStatus(payload);
  let updatedOrder = null;

  data.orders = normalizeOrders(data.orders).map((order) => {
    if (order.id !== payload.order_id) return order;
    updatedOrder = {
      ...order,
      status: nextStatus === "paid" ? "paid" : nextStatus,
      paymentStatus: payload.transaction_status || nextStatus,
      paymentType: getMidtransPaymentName(payload) || order.paymentType || "",
      rawPaymentType: payload.payment_type || order.rawPaymentType || "",
      transactionId: payload.transaction_id || order.transactionId || "",
      fraudStatus: payload.fraud_status || order.fraudStatus || "",
      updatedAt: new Date().toISOString()
    };
    return updatedOrder;
  });

  if (!updatedOrder) {
    throw new Error("Order Midtrans tidak ditemukan.");
  }

  await writeSiteData(data);
  return updatedOrder;
}

module.exports = {
  createCheckoutOrder,
  listOrders,
  updateOrderFromMidtrans,
  updateOrderStatus
};
