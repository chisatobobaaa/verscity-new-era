const fs = require("fs");
const path = require("path");
const mysql = require("mysql2/promise");

const sqlFile = process.argv[2] || "C:\\Users\\mardi\\Downloads\\rayyzix (8).sql";
const resetDatabase = process.argv.includes("--reset");

function requireEnv(name, fallback = "") {
  const value = process.env[name] || fallback;
  if (!value) {
    throw new Error(`Env ${name} belum diisi.`);
  }
  return value;
}

async function main() {
  const absoluteSqlFile = path.resolve(sqlFile);
  const sql = fs.readFileSync(absoluteSqlFile, "utf8");

  const connection = await mysql.createConnection({
    host: requireEnv("MYSQL_HOST", "verscity-mysql-verscity-new-era.j.aivencloud.com"),
    port: Number(requireEnv("MYSQL_PORT", "11354")),
    user: requireEnv("MYSQL_USER", "avnadmin"),
    password: requireEnv("MYSQL_PASSWORD"),
    database: requireEnv("MYSQL_DATABASE", "rayyzix"),
    ssl: {
      rejectUnauthorized: false
    },
    multipleStatements: true
  });

  try {
    await connection.query("SET SESSION sql_require_primary_key = 0");
    if (resetDatabase) {
      console.log("Resetting database objects...");
      const [tables] = await connection.query("SHOW FULL TABLES WHERE Table_type = 'BASE TABLE'");
      const tableColumn = `Tables_in_${requireEnv("MYSQL_DATABASE", "rayyzix")}`;
      await connection.query("SET FOREIGN_KEY_CHECKS = 0");
      for (const row of tables) {
        const tableName = row[tableColumn];
        if (tableName) {
          await connection.query(`DROP TABLE IF EXISTS \`${tableName}\``);
        }
      }
      await connection.query("SET FOREIGN_KEY_CHECKS = 1");
    }

    console.log(`Importing ${absoluteSqlFile}...`);
    await connection.query(sql);
    const [rows] = await connection.query("SHOW TABLES LIKE 'playerucp'");
    console.log(rows.length ? "Import selesai. Tabel playerucp ditemukan." : "Import selesai, tapi tabel playerucp belum ditemukan.");
  } finally {
    await connection.end();
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
