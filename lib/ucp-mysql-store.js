const mysql = require("mysql2/promise");

const UCP_TABLE = process.env.UCP_MYSQL_TABLE || "playerucp";

function isVercelRuntime() {
  return Boolean(process.env.VERCEL);
}

function hasExplicitMysqlConfig() {
  return Boolean(process.env.MYSQL_HOST || process.env.MYSQL_DATABASE || process.env.MYSQL_USER || process.env.MYSQL_PASSWORD);
}

function shouldUseMysql() {
  return process.env.UCP_STORAGE === "mysql" || hasExplicitMysqlConfig() || !isVercelRuntime();
}

function getMysqlConfig() {
  return {
    host: process.env.MYSQL_HOST || "127.0.0.1",
    port: Number(process.env.MYSQL_PORT || 3306),
    user: process.env.MYSQL_USER || "root",
    password: process.env.MYSQL_PASSWORD || "",
    database: process.env.MYSQL_DATABASE || "rayyzix"
  };
}

async function withConnection(task) {
  const connection = await mysql.createConnection(getMysqlConfig());
  try {
    return await task(connection);
  } finally {
    await connection.end();
  }
}

async function findMysqlUcp(ucpName) {
  return withConnection(async (connection) => {
    const [rows] = await connection.execute(
      `SELECT ID, ucp, verifycode, DiscordID, password, salt, extrac, reedem FROM \`${UCP_TABLE}\` WHERE LOWER(ucp) = LOWER(?) LIMIT 1`,
      [ucpName]
    );
    return rows[0] || null;
  });
}

async function insertMysqlUcp(ucp) {
  return withConnection(async (connection) => {
    const [result] = await connection.execute(
      `INSERT INTO \`${UCP_TABLE}\` (ucp, verifycode, DiscordID, password, salt, extrac, reedem) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [ucp.ucpName, ucp.verifycode, "", "", "", 0, 0]
    );
    return {
      ...ucp,
      mysqlId: result.insertId || null
    };
  });
}

async function listMysqlUcps() {
  return withConnection(async (connection) => {
    const [rows] = await connection.execute(
      `SELECT ID, ucp, verifycode, DiscordID, password, salt, extrac, reedem FROM \`${UCP_TABLE}\` ORDER BY ID DESC LIMIT 500`
    );
    return rows.map((row) => ({
      id: row.ID,
      mysqlId: row.ID,
      ucpName: row.ucp,
      ucp: row.ucp,
      verifycode: row.verifycode,
      verifyCode: String(row.verifycode || ""),
      DiscordID: row.DiscordID || "",
      password: row.password || "",
      salt: row.salt || "",
      extrac: row.extrac || 0,
      reedem: row.reedem || 0,
      status: "mysql"
    }));
  });
}

module.exports = {
  findMysqlUcp,
  insertMysqlUcp,
  listMysqlUcps,
  shouldUseMysql
};
