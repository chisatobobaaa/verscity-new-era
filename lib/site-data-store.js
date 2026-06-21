const fs = require("fs").promises;
const path = require("path");

const DATA_KEY = "verscity:site-data";
const DATA_FILE = process.env.SITE_DATA_FILE || path.join(process.cwd(), "data", "site-data.json");

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
  if (hasRedisConfig()) {
    const result = await redisCommand(["GET", DATA_KEY]);
    return result ? JSON.parse(result) : {};
  }

  return readLocalData();
}

async function writeSiteData(data) {
  if (hasRedisConfig()) {
    await redisCommand(["SET", DATA_KEY, JSON.stringify(data)]);
    return;
  }

  await writeLocalData(data);
}

module.exports = {
  readSiteData,
  writeSiteData
};
