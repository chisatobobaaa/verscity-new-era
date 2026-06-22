const mysql = require("mysql2/promise");

const ucpName = process.argv[2] || "";

async function main() {
  if (!ucpName) {
    throw new Error("Isi nama UCP. Contoh: node scripts/check-aiven-ucp.js Magiavander");
  }

  const connection = await mysql.createConnection({
    host: process.env.MYSQL_HOST || "verscity-mysql-verscity-new-era.j.aivencloud.com",
    port: Number(process.env.MYSQL_PORT || 11354),
    user: process.env.MYSQL_USER || "avnadmin",
    password: process.env.MYSQL_PASSWORD,
    database: process.env.MYSQL_DATABASE || "rayyzix",
    ssl: {
      rejectUnauthorized: false
    }
  });

  try {
    const [rows] = await connection.execute(
      "SELECT ID, ucp, verifycode, DiscordID, password, salt, extrac, reedem FROM playerucp WHERE LOWER(ucp) = LOWER(?) ORDER BY ID DESC",
      [ucpName]
    );
    console.log(rows.length ? JSON.stringify(rows, null, 2) : "UCP tidak ditemukan di Aiven.");
  } finally {
    await connection.end();
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
