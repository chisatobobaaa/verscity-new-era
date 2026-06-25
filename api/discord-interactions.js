const crypto = require("crypto");
const { readSiteData, writeSiteData } = require("../lib/site-data-store");
const { getConfig, unlockDonationTicket } = require("../lib/discord-tickets");

function sendJson(response, payload) {
  response.statusCode = 200;
  response.setHeader("Content-Type", "application/json");
  response.end(JSON.stringify(payload));
}

function readRawBody(request) {
  return new Promise((resolve, reject) => {
    let body = "";
    request.on("data", (chunk) => { body += chunk; });
    request.on("end", () => resolve(body));
    request.on("error", reject);
  });
}

function verifyDiscordRequest(request, body) {
  const signature = request.headers["x-signature-ed25519"];
  const timestamp = request.headers["x-signature-timestamp"];
  const publicKey = process.env.DISCORD_PUBLIC_KEY || "";
  if (!signature || !timestamp || !publicKey) return false;
  const key = crypto.createPublicKey({
    key: Buffer.concat([Buffer.from("302a300506032b6570032100", "hex"), Buffer.from(publicKey, "hex")]),
    format: "der",
    type: "spki"
  });
  return crypto.verify(null, Buffer.from(`${timestamp}${body}`), key, Buffer.from(signature, "hex"));
}

module.exports = async function handler(request, response) {
  const rawBody = await readRawBody(request);
  if (!verifyDiscordRequest(request, rawBody)) {
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

  const orderId = customId.slice("claim_donation:".length);
  const data = await readSiteData();
  const order = (data.orders || []).find((item) => item.id === orderId);
  if (!order || !order.discordId) {
    sendJson(response, { type: 4, data: { content: "Order tidak ditemukan.", flags: 64 } });
    return;
  }

  await unlockDonationTicket(interaction.channel_id, order.discordId);
  order.ticketClaimedBy = interaction.member.user.id;
  order.ticketClaimedAt = new Date().toISOString();
  order.fulfillmentStatus = "processing";
  await writeSiteData(data);

  sendJson(response, {
    type: 7,
    data: {
      content: `<@${order.discordId}> ticket sudah diambil oleh <@${interaction.member.user.id}>. Customer sekarang bisa chat.`,
      components: [{
        type: 1,
        components: [{ type: 2, style: 2, label: "Ticket Diambil", custom_id: customId, disabled: true }]
      }],
      allowed_mentions: { users: [order.discordId, interaction.member.user.id] }
    }
  });
};
