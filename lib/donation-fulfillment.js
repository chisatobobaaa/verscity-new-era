const mysql = require("mysql2/promise");
const { createPrivateDonationTicket } = require("./discord-tickets");

const VIP_SECONDS = 30 * 24 * 60 * 60;
const VIP_LEVELS = {
  "vip-silver": 1,
  "vip-gold": 2,
  "vip-platinum": 3
};
const MANUAL_NAMES = ["private garage", "gate", "atm", "garasi kota", "helipad"];
const VEHICLE_MODELS = {
  "nrg-500": 522, "quar bike": 471, quad: 471, elegy: 562, infernus: 411,
  banshee: 429, comet: 480, bullet: 541, turismo: 451, "super-gt": 506,
  "super gt": 506, cheetah: 415, uranus: 558, jester: 559, patriot: 470,
  kart: 571, speeder: 452, jetmax: 493, dinghy: 473, shamal: 519, dodo: 593,
  raidance: 563, raindance: 563, maverick: 487, seasparrow: 447
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

function isManualPackage(order) {
  const name = String(order.packageName || "").toLowerCase();
  return ["house", "apartments", "bisnis"].includes(order.packageGroup) ||
    MANUAL_NAMES.some((manualName) => name.includes(manualName));
}

async function getCharacter(connection, characterName) {
  const [rows] = await connection.execute(
    "SELECT pID, Char_Name FROM player_characters WHERE LOWER(Char_Name) = LOWER(?) LIMIT 1",
    [characterName]
  );
  if (!rows[0]) throw new Error(`Karakter ${characterName} tidak ditemukan di database game.`);
  return rows[0];
}

function vehicleModelFromOrder(order) {
  const name = String(order.packageName || "").toLowerCase().trim();
  return VEHICLE_MODELS[name] || 0;
}

async function applyAutomaticReward(connection, order) {
  const character = await getCharacter(connection, order.characterName);
  const name = String(order.packageName || "").toLowerCase();
  const target = String(order.rewardTarget || "").trim();
  const vehicleModel = vehicleModelFromOrder(order);

  if (vehicleModel) {
    const [result] = await connection.execute(
      `INSERT INTO player_vehicles
        (PVeh_OwnerID, PVeh_ModelID, PVeh_Color1, PVeh_Color2, PVeh_Plate, PVeh_Price,
         PVeh_Health, PVeh_Fuel, PVeh_Parked, PVeh_Faction, PVeh_Donation)
       VALUES (?, ?, 1, 1, 'None', ?, 1000, 100, -2, 0, 1)`,
      [character.pID, vehicleModel, order.amount || 0]
    );
    return { type: "vehicle", vehicleId: result.insertId, modelId: vehicleModel, characterId: character.pID };
  }

  if (name === "level") {
    await connection.execute(
      "UPDATE player_characters SET Char_Level = LEAST(Char_Level + 1, 100) WHERE pID = ? LIMIT 1",
      [character.pID]
    );
    return { type: "level", amount: 1, characterId: character.pID };
  }

  if (name.includes("tambah slot kendaraan")) {
    await connection.execute(
      "UPDATE player_characters SET Char_VehicleSlotPlus = Char_VehicleSlotPlus + 1 WHERE pID = ? LIMIT 1",
      [character.pID]
    );
    return { type: "vehicle_slot", amount: 1, characterId: character.pID };
  }

  if (name.includes("tambah slot rumah")) {
    await connection.execute(
      "UPDATE player_characters SET Char_HouseSlotPlus = Char_HouseSlotPlus + 1 WHERE pID = ? LIMIT 1",
      [character.pID]
    );
    return { type: "house_slot", amount: 1, characterId: character.pID };
  }

  if (name.includes("custom nama ic")) {
    if (!/^[A-Za-z]{2,}_[A-Za-z]{2,}$/.test(target)) throw new Error("Nama IC baru harus berformat Nama_Belakang.");
    const [duplicates] = await connection.execute(
      "SELECT pID FROM player_characters WHERE LOWER(Char_Name) = LOWER(?) LIMIT 1",
      [target]
    );
    if (duplicates.length) throw new Error("Nama IC baru sudah digunakan.");
    await connection.execute("UPDATE player_characters SET Char_Name = ? WHERE pID = ? LIMIT 1", [target, character.pID]);
    return { type: "character_name", value: target, characterId: character.pID };
  }

  if (order.packageId === "lainnya-tag" || name.includes("custom tag")) {
    if (!target || target.length > 50) throw new Error("Custom tag wajib diisi, maksimal 50 karakter.");
    await connection.execute(
      "UPDATE player_characters SET custom_tag = ?, custom_tag_expire = 0 WHERE pID = ? LIMIT 1",
      [target, character.pID]
    );
    return { type: "custom_tag", value: target, characterId: character.pID };
  }

  if (name.includes("nomor hp")) {
    if (!/^\d{4,12}$/.test(target)) throw new Error("Nomor HP custom tidak valid.");
    const [duplicates] = await connection.execute("SELECT pID FROM player_characters WHERE Char_PhoneNum = ? LIMIT 1", [target]);
    if (duplicates.length) throw new Error("Nomor HP sudah digunakan.");
    await connection.execute("UPDATE player_characters SET Char_PhoneNum = ? WHERE pID = ? LIMIT 1", [target, character.pID]);
    return { type: "phone", value: target, characterId: character.pID };
  }

  if (name.includes("nomor rekening")) {
    if (!/^\d{3,6}$/.test(target)) throw new Error("Nomor rekening custom tidak valid.");
    const [duplicates] = await connection.execute("SELECT pID FROM player_characters WHERE Char_BankRek = ? LIMIT 1", [target]);
    if (duplicates.length) throw new Error("Nomor rekening sudah digunakan.");
    await connection.execute("UPDATE player_characters SET Char_BankRek = ? WHERE pID = ? LIMIT 1", [target, character.pID]);
    return { type: "bank_number", value: target, characterId: character.pID };
  }

  if (name.includes("custom plat")) {
    const match = target.match(/^\s*(\d+)\s*\|\s*(.{1,50})\s*$/);
    if (!match) throw new Error("Format plat harus: ID kendaraan | PLAT.");
    const vehicleId = Number(match[1]);
    const plate = match[2];
    const [result] = await connection.execute(
      "UPDATE player_vehicles SET PVeh_Plate = ?, PVeh_PlateOwned = 1 WHERE id = ? AND PVeh_OwnerID = ? LIMIT 1",
      [plate, vehicleId, character.pID]
    );
    if (!result.affectedRows) throw new Error("Kendaraan tidak ditemukan atau bukan milik karakter.");
    return { type: "plate", vehicleId, value: plate, characterId: character.pID };
  }

  if (name.includes("bagasi")) {
    const vehicleId = Number(target);
    if (!Number.isInteger(vehicleId) || vehicleId < 1) throw new Error("ID kendaraan tidak valid.");
    const [result] = await connection.execute(
      "UPDATE player_vehicles SET PVeh_CustomWeight = 100 WHERE id = ? AND PVeh_OwnerID = ? LIMIT 1",
      [vehicleId, character.pID]
    );
    if (!result.affectedRows) throw new Error("Kendaraan tidak ditemukan atau bukan milik karakter.");
    return { type: "vehicle_weight", vehicleId, weight: 100, characterId: character.pID };
  }

  throw new Error("Paket belum memiliki aturan pengiriman otomatis.");
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

    if (["fulfilled", "queued", "processing"].includes(existingRows[0]?.status)) {
      await connection.commit();
      return {
        status: existingRows[0].status,
        alreadyProcessed: true,
        details: existingRows[0].details || ""
      };
    }

    const vipLevel = VIP_LEVELS[order.packageId];
    let result;
    if (isManualPackage(order)) {
      result = { type: "ticket", ...(await createPrivateDonationTicket(order)) };
    } else if (vipLevel) {
      result = await applyVip(connection, order, vipLevel);
    } else {
      result = await applyAutomaticReward(connection, order);
    }

    const fulfillmentStatus = result.type === "ticket" ? "queued" : "fulfilled";
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
        fulfillmentStatus === "fulfilled" ? new Date() : null
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
