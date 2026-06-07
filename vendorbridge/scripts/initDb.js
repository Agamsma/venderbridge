// scripts/initDb.js — create the schema (no demo data). Usage: npm run db:init
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const config = require('../server/config');

(async () => {
  const schema = fs.readFileSync(path.join(__dirname, '..', 'database', 'schema.sql'), 'utf8');
  let conn;
  try {
    conn = await mysql.createConnection({
      host: config.db.host, port: config.db.port,
      user: config.db.user, password: config.db.password,
      multipleStatements: true,
    });
    console.log('→ Connected to MySQL. Building schema…');
    await conn.query(schema);
    console.log(`✓ Database "${config.db.name}" is ready (schema only — no demo data).`);
    console.log('  Next step → create your administrator account:');
    console.log('  ADMIN_NAME="Your Name" ADMIN_EMAIL=you@company.com ADMIN_PASSWORD=secret123 npm run create:admin');
  } catch (err) {
    console.error('✗ DB init failed:', err.message);
    console.error('  Check your .env credentials and that MySQL is running.');
    process.exit(1);
  } finally {
    if (conn) await conn.end();
  }
})();
