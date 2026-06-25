const crypto = require("crypto");
const { readSiteData, writeSiteData } = require("../lib/site-data-store");
const { editInteractionMessage, getConfig, unlockDonationTicket } = require("../lib/discord-tickets");

function sendJson(response, payload) {
  response.statusCode = 200;
  response.setHeader("Content-Type", "application/json");
  response.end(JSON.stringify(payload));
}

function readRawBody(request) {
  if (Buffer.isBuffer(request.body)) {
    return Promise.resolve(request.body.toString("utf8"));
  }
  if (typeof request.body === "string") {
    return Promise.resolve(request.body);
  }
  if (request.body && typeof request.body === "object") {
    return Promise.resolve(JSON.stringify(request.body));
  }

  return new Promise((resolve, reject) => {
    let body = "";
    request.on("data", (chunk) => { body += chunk; });
    request.on("end", () => resolve(body));
    request.on("error", reject);
  });
}

let cachedDiscordPublicKey = "";

async function getDiscordPublicKey() {
  if (process.env.DISCORD_PUBLIC_KEY) return process.env.DISCORD_PUBLIC_KEY;
  if (cachedDiscordPublicKey) return cachedDiscordPublicKey;

  const botToken = process.env.DISCORD_BOT_TOKEN || "";
  if (!botToken) return "";
  const response = await fetch("https://discord.com/api/v10/oauth2/applications/@me", {
    headers: { Authorization: `Bot ${botToken}` }
  });
  const application = await response.json().catch(() => ({}));
  cachedDiscordPublicKey = application.verify_key || "";
  return cachedDiscordPublicKey;
}

async function verifyDiscordRequest(request, body) {
  const signature = request.headers["x-signature-ed25519"];
  const timestamp = request.headers["x-signature-timestamp"];
  const publicKey = await getDiscordPublicKey();
  if (!signature || !timestamp || !publicKey) return false;
  const key = crypto.createPublicKey({
    key: Buffer.concat([Buffer.from("302a300506032b6570032100", "hex"), Buffer.from(publicKey, "hex")]),
    format: "der",
    type: "spki"
  });
  return crypto.verify(null, Buffer.from(`${timestamp}${body}`), key, Buffer.from(signature, "hex"));
}

module.exports = async function handler(request, response) {
  try {
    const rawBody = await readRawBody(request);
    if (!(await verifyDiscordRequest(request, rawBody))) {
      response.statusCode = 401;
      response.end("Invalid request signature");
      return;
    }

    const interaction = JSON.parse(rawBody || "{}");
    if (interaction.type === 1) {
      sendJson(response, { type: 1 });
      return;
    }

    const customId = interaction.data?.custom_id || "";
    if (interaction.type !== 3 || !customId.startsWith("claim_donation:")) {
      sendJson(response, { type: 4, data: { content: "Interaksi tidak dikenali.", flags: 64 } });
      return;
    }

    const { adminRoleId } = getConfig();
    if (!interaction.member?.roles?.includes(adminRoleId)) {
      sendJson(response, { type: 4, data: { content: "Hanya admin yang dapat mengambil ticket.", flags: 64 } });
      return;
    }

    // Acknowledge immediately so Discord does not mark the interaction as failed.
    sendJson(response, { type: 6 });

    const orderId = customId.slice("claim_donation:".length);
    const data = await readSiteData();
    const order = (data.orders || []).find((item) => item.id === orderId);
    if (!order || !order.discordId) {
      await editInteractionMessage(interaction.application_id, interaction.token, {
        content: "Order tidak ditemukan. Coba refresh order di admin panel.",
        components: []
      });
      return;
    }

    await unlockDonationTicket(interaction.channel_id, order.discordId);
    order.ticketClaimedBy = interaction.member.user.id;
    order.ticketClaimedAt = new Date().toISOString();
    order.fulfillmentStatus = "processing";
    await writeSiteData(data);

    await editInteractionMessage(interaction.application_id, interaction.token, {
      content: `<@${order.discordId}> ticket sudah diambil oleh <@${interaction.member.user.id}>. Customer sekarang bisa chat.`,
      embeds: [],
      components: [{
        type: 1,
        components: [{ type: 2, style: 2, label: "Ticket Diambil", custom_id: customId, disabled: true }]
      }],
      allowed_mentions: { users: [order.discordId, interaction.member.user.id] }
    });
  } catch (error) {
    if (!response.writableEnded) {
      response.statusCode = 500;
      response.end(error.message);
    }
    console.error("Discord interaction failed:", error);
  }
};
