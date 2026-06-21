const fs = require("fs").promises;
const path = require("path");

const DATA_KEY = "verscity:site-data";
const DATA_FILE = process.env.SITE_DATA_FILE || path.join(process.cwd(), "data", "site-data.json");
const SUPABASE_TABLE = process.env.SUPABASE_TABLE || "site_data";

function isVercelRuntime() {
  return Boolean(process.env.VERCEL);
}

function getSupabaseConfig() {
  const url = process.env.SUPABASE_URL || "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  return { url: url.replace(/\/$/, ""), key };
}

function hasSupabaseConfig() {
  const { url, key } = getSupabaseConfig();
  return Boolean(url && key);
}

function getRedisConfig() {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || "";
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || "";
  return { url: url.replace(/\/$/, ""), token };
}

function hasRedisConfig() {
  const { url, token } = getRedisConfig();
  return Boolean(url && token);
}

async function redisCommand(command) {
  const { url, token } = getRedisConfig();
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(command)
  });

  if (!response.ok) {
    throw new Error(`Redis request failed: ${response.status}`);
  }

  const payload = await response.json();
  if (payload.error) {
    throw new Error(payload.error);
  }
  return payload.result;
}

async function readSupabaseData() {
  const { url, key } = getSupabaseConfig();
  const endpoint = `${url}/rest/v1/${SUPABASE_TABLE}?key=eq.${encodeURIComponent(DATA_KEY)}&select=data&limit=1`;
  const response = await fetch(endpoint, {
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`
    }
  });

  if (!response.ok) {
    throw new Error(`Supabase read failed: ${response.status}`);
  }

  const rows = await response.json();
  return rows[0]?.data || {};
}

async function writeSupabaseData(data) {
  const { url, key } = getSupabaseConfig();
  const endpoint = `${url}/rest/v1/${SUPABASE_TABLE}?on_conflict=key`;
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates"
    },
    body: JSON.stringify({
      key: DATA_KEY,
      data,
      updated_at: new Date().toISOString()
    })
  });

  if (!response.ok) {
    throw new Error(`Supabase write failed: ${response.status}`);
  }
}

async function readLocalData() {
  try {
    const text = await fs.readFile(DATA_FILE, "utf8");
    return JSON.parse(text);
  } catch (error) {
    if (error.code === "ENOENT") return {};
    throw error;
  }
}

async function writeLocalData(data) {
  await fs.mkdir(path.dirname(DATA_FILE), { recursive: true });
  await fs.writeFile(DATA_FILE, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

async function readSiteData() {
  if (hasSupabaseConfig()) {
    return readSupabaseData();
  }

  if (hasRedisConfig()) {
    const result = await redisCommand(["GET", DATA_KEY]);
    return result ? JSON.parse(result) : {};
  }

  return readLocalData();
}

async function writeSiteData(data) {
  if (hasSupabaseConfig()) {
    await writeSupabaseData(data);
    return;
  }

  if (hasRedisConfig()) {
    await redisCommand(["SET", DATA_KEY, JSON.stringify(data)]);
    return;
  }

  if (isVercelRuntime()) {
    throw new Error("Storage global belum dikonfigurasi. Isi SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY di Vercel.");
  }

  await writeLocalData(data);
}

module.exports = {
  readSiteData,
  writeSiteData
};
