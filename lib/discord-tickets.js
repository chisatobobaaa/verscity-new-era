const DISCORD_API = "https://discord.com/api/v10";
const VIEW_CHANNEL = 1n << 10n;
const SEND_MESSAGES = 1n << 11n;
const READ_MESSAGE_HISTORY = 1n << 16n;

function getConfig() {
  return {
    token: process.env.DISCORD_BOT_TOKEN || "",
    guildId: process.env.DISCORD_GUILD_ID || "",
    categoryId: process.env.DISCORD_TICKET_CATEGORY_ID || "",
    adminRoleId: process.env.DISCORD_ADMIN_ROLE_ID || ""
  };
}

async function discordRequest(path, options = {}) {
  const { token } = getConfig();
  if (!token) throw new Error("DISCORD_BOT_TOKEN belum diisi.");
  const response = await fetch(`${DISCORD_API}${path}`, {
    ...options,
    headers: {
      Authorization: `Bot ${token}`,
      "Content-Type": "application/json",
      ...(options.headers || {})
    }
  });
  const payload = response.status === 204 ? null : await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.message || `Discord API gagal (${response.status}).`);
  return payload;
}

function channelName(order) {
  const safeName = String(order.characterName || "customer")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return `donasi-${safeName}-${String(order.id).slice(-6).toLowerCase()}`;
}

async function createPrivateDonationTicket(order) {
  const { guildId, categoryId, adminRoleId } = getConfig();
  if (!guildId || !adminRoleId) {
    throw new Error("DISCORD_GUILD_ID dan DISCORD_ADMIN_ROLE_ID wajib diisi.");
  }
  if (!order.discordId) throw new Error("Discord ID customer tidak tersedia.");

  const channel = await discordRequest(`/guilds/${guildId}/channels`, {
    method: "POST",
    body: JSON.stringify({
      name: channelName(order),
      type: 0,
      parent_id: categoryId || undefined,
      topic: `Order ${order.id} | ${order.packageName} | ${order.characterName}`,
      permission_overwrites: [
        { id: guildId, type: 0, deny: VIEW_CHANNEL.toString(), allow: "0" },
        {
          id: adminRoleId,
          type: 0,
          allow: (VIEW_CHANNEL | SEND_MESSAGES | READ_MESSAGE_HISTORY).toString(),
          deny: "0"
        },
        {
          id: order.discordId,
          type: 1,
          allow: (VIEW_CHANNEL | READ_MESSAGE_HISTORY).toString(),
          deny: SEND_MESSAGES.toString()
        }
      ]
    })
  });

  await discordRequest(`/channels/${channel.id}/messages`, {
    method: "POST",
    body: JSON.stringify({
      content: `<@${order.discordId}> <@&${adminRoleId}>`,
      embeds: [{
        title: "Donation menunggu admin",
        description: "Customer belum dapat chat. Admin tekan **Ambil Ticket** untuk membuka percakapan.",
        color: 16362558,
        fields: [
          { name: "Order", value: order.id, inline: true },
          { name: "Paket", value: order.packageName, inline: true },
          { name: "Karakter", value: order.characterName, inline: true },
          { name: "Catatan", value: order.note || "-", inline: false }
        ]
      }],
      components: [{
        type: 1,
        components: [{
          type: 2,
          style: 3,
          label: "Ambil Ticket",
          custom_id: `claim_donation:${order.id}`
        }]
      }],
      allowed_mentions: {
        users: [order.discordId],
        roles: [adminRoleId]
      }
    })
  });

  return { channelId: channel.id, channelName: channel.name };
}

async function unlockDonationTicket(channelId, customerId) {
  await discordRequest(`/channels/${channelId}/permissions/${customerId}`, {
    method: "PUT",
    body: JSON.stringify({
      type: 1,
      allow: (VIEW_CHANNEL | SEND_MESSAGES | READ_MESSAGE_HISTORY).toString(),
      deny: "0"
    })
  });
}

module.exports = {
  createPrivateDonationTicket,
  getConfig,
  unlockDonationTicket
};
