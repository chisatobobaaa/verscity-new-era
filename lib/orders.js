const crypto = require("crypto");
const { createSnapTransaction, getTransactionStatus, hasMidtransConfig, mapMidtransStatus, verifyMidtransSignature } = require("./midtrans");
const { fulfillDonationOrder } = require("./donation-fulfillment");
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

async function createCheckoutOrder(payload, discordUser = null) {
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
    discord: cleanText(discordUser?.globalName || discordUser?.username || payload.discord, 80),
    discordId: cleanText(discordUser?.id, 32),
    characterName: cleanText(payload.characterName, 80),
    note: cleanText(payload.note, 500),
    rewardTarget: cleanText(payload.rewardTarget, 160),
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

function applyMidtransPayloadToOrder(order, payload) {
  const nextStatus = mapMidtransStatus(payload);
  return {
    ...order,
    status: nextStatus === "paid" ? "paid" : nextStatus,
    paymentStatus: payload.transaction_status || nextStatus,
    paymentType: getMidtransPaymentName(payload) || order.paymentType || "",
    rawPaymentType: payload.payment_type || order.rawPaymentType || "",
    transactionId: payload.transaction_id || order.transactionId || "",
    fraudStatus: payload.fraud_status || order.fraudStatus || "",
    updatedAt: new Date().toISOString()
  };
}

async function applyFulfillment(order) {
  if (!["settlement", "capture"].includes(String(order.paymentStatus || "").toLowerCase())) return order;

  try {
    const fulfillment = await fulfillDonationOrder(order);
    return {
      ...order,
      fulfillmentStatus: fulfillment.status,
      fulfillmentDetails: fulfillment,
      fulfillmentError: "",
      fulfilledAt: fulfillment.status === "fulfilled" ? new Date().toISOString() : order.fulfilledAt || ""
    };
  } catch (error) {
    return {
      ...order,
      fulfillmentStatus: "failed",
      fulfillmentError: error.message,
      updatedAt: new Date().toISOString()
    };
  }
}

async function syncMidtransOrders() {
  if (!hasMidtransConfig()) return listOrders();

  const data = await readSiteData();
  const orders = normalizeOrders(data.orders);
  let changed = false;

  const syncedOrders = [];
  for (const order of orders) {
    const settled = ["settlement", "capture"].includes(String(order.paymentStatus || "").toLowerCase());
    if (settled && !["fulfilled", "queued"].includes(order.fulfillmentStatus)) {
      const fulfilledOrder = await applyFulfillment(order);
      changed = changed || JSON.stringify(fulfilledOrder) !== JSON.stringify(order);
      syncedOrders.push(fulfilledOrder);
      continue;
    }

    const shouldSync = order.paymentMethod === "midtrans_snap" && ["pending", "challenge"].includes(String(order.paymentStatus || order.status).toLowerCase());
    if (!shouldSync) {
      syncedOrders.push(order);
      continue;
    }

    const statusPayload = await getTransactionStatus(order.id);
    if (!statusPayload || !statusPayload.transaction_status) {
      syncedOrders.push(order);
      continue;
    }

    const updatedOrder = await applyFulfillment(applyMidtransPayloadToOrder(order, statusPayload));
    changed = changed || JSON.stringify(updatedOrder) !== JSON.stringify(order);
    syncedOrders.push(updatedOrder);
  }

  if (changed) {
    data.orders = syncedOrders;
    await writeSiteData(data);
  }

  return syncedOrders;
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
  let updatedOrder = null;

  data.orders = normalizeOrders(data.orders).map((order) => {
    if (order.id !== payload.order_id) return order;
    updatedOrder = applyMidtransPayloadToOrder(order, payload);
    return updatedOrder;
  });

  if (!updatedOrder) {
    throw new Error("Order Midtrans tidak ditemukan.");
  }

  updatedOrder = await applyFulfillment(updatedOrder);
  data.orders = normalizeOrders(data.orders).map((order) => order.id === updatedOrder.id ? updatedOrder : order);
  await writeSiteData(data);
  return updatedOrder;
}

module.exports = {
  createCheckoutOrder,
  listOrders,
  syncMidtransOrders,
  updateOrderFromMidtrans,
  updateOrderStatus
};
