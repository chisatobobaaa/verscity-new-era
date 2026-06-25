const mysql = require("mysql2/promise");

const VIP_SECONDS = 30 * 24 * 60 * 60;
const VIP_LEVELS = {
  "vip-silver": 1,
  "vip-gold": 2,
  "vip-platinum": 3
};

function getMysqlConfig() {
  const host = process.env.MYSQL_HOST || "127.0.0.1";
  const config = {
    host,
    port: Number(process.env.MYSQL_PORT || 3306),
    user: process.env.MYSQL_USER || "root",
    password: process.env.MYSQL_PASSWORD || "",
    database: process.env.MYSQL_DATABASE || "rayyzix"
  };

  if (process.env.MYSQL_SSL === "true" || (host !== "127.0.0.1" && host !== "localhost")) {
    config.ssl = { rejectUnauthorized: false };
  }

  return config;
}

async function ensureFulfillmentTable(connection) {
  await connection.execute(`
    CREATE TABLE IF NOT EXISTS website_donation_fulfillments (
      order_id varchar(80) NOT NULL,
      package_id varchar(80) NOT NULL,
      character_name varchar(80) NOT NULL,
      fulfillment_type varchar(32) NOT NULL,
      status varchar(32) NOT NULL,
      details text NULL,
      created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
      fulfilled_at timestamp NULL DEFAULT NULL,
      PRIMARY KEY (order_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
}

async function applyVip(connection, order, vipLevel) {
  const [characters] = await connection.execute(
    "SELECT pID, Char_Name, Char_Vip, Char_VipTime FROM player_characters WHERE LOWER(Char_Name) = LOWER(?) LIMIT 1 FOR UPDATE",
    [order.characterName]
  );

  const character = characters[0];
  if (!character) {
    throw new Error(`Karakter ${order.characterName} tidak ditemukan di database game.`);
  }

  const now = Math.floor(Date.now() / 1000);
  const currentLevel = Number(character.Char_Vip || 0);
  const currentVipTime = Number(character.Char_VipTime || 0);
  const isPermanent = currentLevel > 0 && currentVipTime === 0;
  const nextLevel = Math.max(currentLevel, vipLevel);
  const nextVipTime = isPermanent ? 0 : Math.max(currentVipTime, now) + VIP_SECONDS;

  await connection.execute(
    "UPDATE player_characters SET Char_Vip = ?, Char_VipTime = ? WHERE pID = ? LIMIT 1",
    [nextLevel, nextVipTime, character.pID]
  );

  return {
    type: "vip",
    characterId: character.pID,
    vipLevel: nextLevel,
    vipTime: nextVipTime,
    durationDays: 30
  };
}

async function fulfillDonationOrder(order) {
  if (!order || !["settlement", "capture"].includes(String(order.paymentStatus || "").toLowerCase())) {
    return { status: "skipped", reason: "payment_not_settled" };
  }

  const connection = await mysql.createConnection(getMysqlConfig());
  try {
    await ensureFulfillmentTable(connection);
    await connection.beginTransaction();

    const [existingRows] = await connection.execute(
      "SELECT status, details FROM website_donation_fulfillments WHERE order_id = ? LIMIT 1 FOR UPDATE",
      [order.id]
    );

    if (existingRows[0]?.status === "fulfilled") {
      await connection.commit();
      return {
        status: "fulfilled",
        alreadyProcessed: true,
        details: existingRows[0].details || ""
      };
    }

    const vipLevel = VIP_LEVELS[order.packageId];
    let result;
    if (vipLevel) {
      result = await applyVip(connection, order, vipLevel);
    } else {
      result = {
        type: "queue",
        reason: "Paket memerlukan target item, stock, kendaraan, atau lokasi yang valid."
      };
    }

    const fulfillmentStatus = vipLevel ? "fulfilled" : "queued";
    const details = JSON.stringify(result);
    await connection.execute(
      `INSERT INTO website_donation_fulfillments
        (order_id, package_id, character_name, fulfillment_type, status, details, fulfilled_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
        package_id = VALUES(package_id),
        character_name = VALUES(character_name),
        fulfillment_type = VALUES(fulfillment_type),
        status = VALUES(status),
        details = VALUES(details),
        fulfilled_at = VALUES(fulfilled_at)`,
      [
        order.id,
        order.packageId,
        order.characterName,
        result.type,
        fulfillmentStatus,
        details,
        vipLevel ? new Date() : null
      ]
    );

    await connection.commit();
    return { status: fulfillmentStatus, ...result };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    await connection.end();
  }
}

module.exports = {
  fulfillDonationOrder
};
