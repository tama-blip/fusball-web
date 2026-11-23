/**
 * Export every table (structure + rows) using mysql2, without mysqldump.
 * Usage from project root:
 *   node backend/backup-database.js          # reads .env
 *   node backend/backup-database.js --cloud  # reads .env.cloud
 * The generated SQL file is written to the project root and is git-ignored.
 */
const fs = require("fs");
const path = require("path");
const mysql = require("mysql2/promise");

const envPath = process.argv.includes("--cloud") ? ".env.cloud" : ".env";
require("dotenv").config({ path: envPath });

function sqlValue(mysqlDriver, value) {
  if (value === null || value === undefined) return "NULL";
  if (Buffer.isBuffer(value)) return `X'${value.toString("hex")}'`;
  if (value instanceof Date) {
    const pad = n => String(n).padStart(2, "0");
    const date = `${value.getUTCFullYear()}-${pad(value.getUTCMonth() + 1)}-${pad(value.getUTCDate())}`;
    const time = `${pad(value.getUTCHours())}:${pad(value.getUTCMinutes())}:${pad(value.getUTCSeconds())}`;
    return mysqlDriver.escape(`${date} ${time}`);
  }
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "NULL";
  if (typeof value === "bigint") return value.toString();
  if (typeof value === "object") return mysqlDriver.escape(JSON.stringify(value));
  return mysqlDriver.escape(String(value));
}

async function main() {
  const required = ["DB_HOST", "DB_USER", "DB_NAME"];
  const missing = required.filter(key => !process.env[key]);
  if (missing.length) throw new Error(`Environment belum lengkap (${envPath}): ${missing.join(", ")}`);

  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD || "",
    database: process.env.DB_NAME,
    charset: "utf8mb4",
    timezone: "Z",
    supportBigNumbers: true,
    bigNumberStrings: true,
    dateStrings: false,
    connectTimeout: 15000
  });

  const header = [
    "-- FusballID database backup generated with mysql2",
    `-- Database: ${String(process.env.DB_NAME).replace(/[\r\n]/g, "")}`,
    `-- Created: ${new Date().toISOString()}`,
    "SET NAMES utf8mb4;",
    "SET FOREIGN_KEY_CHECKS=0;",
    ""
  ];
  let totalRows = 0;
  const orderedTables = [];
  try {
    const [tableRows] = await connection.query("SHOW FULL TABLES WHERE Table_type = 'BASE TABLE'");
    const tableNames = tableRows.map(row => String(Object.values(row)[0]));
    if (!tableNames.length) throw new Error("Tidak ada tabel pada database target.");

    const dependencies = new Map(tableNames.map(table => [table, []]));
    const [foreignKeys] = await connection.query(
      `SELECT TABLE_NAME, REFERENCED_TABLE_NAME
       FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
       WHERE TABLE_SCHEMA = DATABASE() AND REFERENCED_TABLE_NAME IS NOT NULL`
    );
    for (const relation of foreignKeys) {
      if (dependencies.has(relation.TABLE_NAME) && dependencies.has(relation.REFERENCED_TABLE_NAME)) {
        dependencies.get(relation.TABLE_NAME).push(relation.REFERENCED_TABLE_NAME);
      }
    }

    const visiting = new Set();
    const visited = new Set();
    function visit(table) {
      if (visited.has(table)) return;
      if (visiting.has(table)) return; // Cyclic references are handled by FOREIGN_KEY_CHECKS=0.
      visiting.add(table);
      for (const parent of dependencies.get(table) || []) visit(parent);
      visiting.delete(table);
      visited.add(table);
      orderedTables.push(table);
    }
    for (const table of tableNames) visit(table);

    const drops = [];
    const creates = [];
    const inserts = [];
    for (const table of orderedTables) {
      const identifier = `\`${table.replace(/`/g, "``")}\``;
      const [createRows] = await connection.query(`SHOW CREATE TABLE ${identifier}`);
      const createSql = createRows[0]["Create Table"] || Object.values(createRows[0])[1];
      drops.push(`DROP TABLE IF EXISTS ${identifier};`);
      creates.push(`\n-- Structure: ${table}\n${createSql};\n`);

      const [rows] = await connection.query(`SELECT * FROM ${identifier}`);
      totalRows += rows.length;
      if (!rows.length) continue;
      const columns = Object.keys(rows[0]).map(name => `\`${name.replace(/`/g, "``")}\``).join(",");
      inserts.push(`-- Data: ${table} (${rows.length} rows)`);
      const batchSize = 100;
      for (let rowStart = 0; rowStart < rows.length; rowStart += batchSize) {
        const batch = rows.slice(rowStart, rowStart + batchSize);
        const values = batch.map(item => `(${Object.values(item).map(value => sqlValue(mysql, value)).join(",")})`).join(",\n");
        inserts.push(`INSERT INTO ${identifier} (${columns}) VALUES\n${values};`);
      }
    }
    header.push("-- Drop all tables first", drops.join("\n"), "-- Recreate tables with referenced parent tables first", creates.join("\n"), "-- Restore rows", inserts.join("\n"));
  } finally {
    await connection.end();
  }

  header.push("", "SET FOREIGN_KEY_CHECKS=1;", "");
  const timestamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
  const output = path.resolve(process.cwd(), `fusball_id_backup_${timestamp}.sql`);
  fs.writeFileSync(output, header.join("\n"), { encoding: "utf8", flag: "wx" });
  console.log(`BACKUP BERHASIL: ${output}`);
  console.log(`Tabel: ${orderedTables.length} | Baris data: ${totalRows}`);
  console.log("Simpan file ini di lokasi aman. Jangan commit atau unggah backup ke repository publik.");
}

main().catch(error => {
  console.error("BACKUP GAGAL:", error.code || error.message);
  process.exit(1);
});
