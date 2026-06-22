const crypto = require("crypto");
const { readSiteData, writeSiteData } = require("./site-data-store");
const { findMysqlUcp, findMysqlUcpByDiscordId, deleteMysqlUcp, insertMysqlUcp, listMysqlUcps, shouldUseMysql } = require("./ucp-mysql-store");

function cleanText(value, maxLength = 120) {
  return String(value || "").trim().slice(0, maxLength);
}

function normalizeKey(value) {
  return cleanText(value, 120).toLowerCase().replace(/\s+/g, "");
}

function normalizeUcps(ucps) {
  return Array.isArray(ucps) ? ucps : [];
}

function validateUcpName(name) {
  return /^[a-zA-Z0-9_]{4,22}$/.test(name);
}

function validateDiscordId(discordId) {
  return /^\d{17,20}$/.test(discordId);
}

function makeVerifyCode() {
  return crypto.randomInt(100000, 1000000);
}

async function createUcp(payload) {
  if (payload.action === "delete") {
    return deleteUcp(payload.id || payload.mysqlId);
  }

  const ucpName = cleanText(payload.ucpName, 22);
  const discordId = cleanText(payload.discordId || payload.DiscordID, 50);
  const ucpKey = normalizeKey(ucpName);

  if (!validateUcpName(ucpName)) {
    throw new Error("Nama UCP harus 4-22 karakter dan hanya huruf, angka, underscore.");
  }
  if (!validateDiscordId(discordId)) {
    throw new Error("Discord ID wajib diisi dengan angka 17-20 digit.");
  }

  if (shouldUseMysql()) {
    const existing = await findMysqlUcp(ucpName);
    if (existing) {
      throw new Error("Nama UCP sudah dipakai.");
    }
    const existingDiscord = await findMysqlUcpByDiscordId(discordId);
    if (existingDiscord) {
      throw new Error(`Discord ID ini sudah punya UCP: ${existingDiscord.ucp}. Satu Discord hanya boleh 1 UCP.`);
    }

    const verifycode = makeVerifyCode();
    return insertMysqlUcp({
      id: `UCP-${Date.now()}-${crypto.randomBytes(3).toString("hex").toUpperCase()}`,
      ucpName,
      ucp: ucpName,
      verifycode,
      verifyCode: String(verifycode),
      DiscordID: discordId,
      password: "",
      salt: "",
      extrac: 0,
      reedem: 0,
      status: "pending",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
  }

  const data = await readSiteData();
  const ucps = normalizeUcps(data.ucps);
  if (ucps.some((ucp) => normalizeKey(ucp.ucpName) === ucpKey)) {
    throw new Error("Nama UCP sudah dipakai.");
  }
  if (ucps.some((ucp) => cleanText(ucp.DiscordID || ucp.discordId, 50) === discordId)) {
    throw new Error("Discord ID ini sudah punya UCP. Satu Discord hanya boleh 1 UCP.");
  }

  const verifycode = makeVerifyCode();
  const ucp = {
    id: `UCP-${Date.now()}-${crypto.randomBytes(3).toString("hex").toUpperCase()}`,
    ucpName,
    ucp: ucpName,
    verifycode,
    verifyCode: String(verifycode),
    DiscordID: discordId,
    password: "",
    salt: "",
    extrac: 0,
    reedem: 0,
    status: "pending",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  data.ucps = [ucp, ...ucps].slice(0, 500);
  await writeSiteData(data);
  return ucp;
}

async function listUcps() {
  if (shouldUseMysql()) {
    return listMysqlUcps();
  }

  const data = await readSiteData();
  return normalizeUcps(data.ucps);
}

async function deleteUcp(ucpId) {
  const cleanId = cleanText(ucpId, 80);
  if (!cleanId) {
    throw new Error("ID UCP wajib diisi.");
  }

  if (shouldUseMysql()) {
    if (!/^\d+$/.test(cleanId)) {
      throw new Error("ID UCP MySQL tidak valid.");
    }
    const deleted = await deleteMysqlUcp(Number(cleanId));
    if (!deleted) {
      throw new Error("UCP tidak ditemukan.");
    }
    return { id: cleanId };
  }

  const data = await readSiteData();
  const ucps = normalizeUcps(data.ucps);
  const nextUcps = ucps.filter((ucp) => String(ucp.id) !== cleanId && String(ucp.mysqlId || "") !== cleanId);
  if (nextUcps.length === ucps.length) {
    throw new Error("UCP tidak ditemukan.");
  }
  data.ucps = nextUcps;
  await writeSiteData(data);
  return { id: cleanId };
}

module.exports = {
  deleteUcp,
  createUcp,
  listUcps
};
