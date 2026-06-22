const crypto = require("crypto");
const { readSiteData, writeSiteData } = require("./site-data-store");
const { findMysqlUcp, insertMysqlUcp, listMysqlUcps, shouldUseMysql } = require("./ucp-mysql-store");

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

function makeVerifyCode() {
  return crypto.randomInt(100000, 1000000);
}

async function createUcp(payload) {
  const ucpName = cleanText(payload.ucpName, 22);
  const ucpKey = normalizeKey(ucpName);

  if (!validateUcpName(ucpName)) {
    throw new Error("Nama UCP harus 4-22 karakter dan hanya huruf, angka, underscore.");
  }

  if (shouldUseMysql()) {
    const existing = await findMysqlUcp(ucpName);
    if (existing) {
      throw new Error("Nama UCP sudah dipakai.");
    }

    const verifycode = makeVerifyCode();
    return insertMysqlUcp({
      id: `UCP-${Date.now()}-${crypto.randomBytes(3).toString("hex").toUpperCase()}`,
      ucpName,
      ucp: ucpName,
      verifycode,
      verifyCode: String(verifycode),
      DiscordID: "",
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

  const verifycode = makeVerifyCode();
  const ucp = {
    id: `UCP-${Date.now()}-${crypto.randomBytes(3).toString("hex").toUpperCase()}`,
    ucpName,
    ucp: ucpName,
    verifycode,
    verifyCode: String(verifycode),
    DiscordID: "",
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

module.exports = {
  createUcp,
  listUcps
};
