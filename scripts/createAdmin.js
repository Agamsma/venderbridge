// scripts/createAdmin.js — create (or reset) the owner/admin account.
// Usage: ADMIN_NAME=".." ADMIN_EMAIL=".." ADMIN_PASSWORD=".." npm run create:admin
//    or: node scripts/createAdmin.js "Name" email@x.com password
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const config = require('../server/config');

(async () => {
  const name = process.env.ADMIN_NAME || process.argv[2];
  const email = process.env.ADMIN_EMAIL || process.argv[3];
  const password = process.env.ADMIN_PASSWORD || process.argv[4];

  if (!name || !email || !password) {
    console.error('Usage: ADMIN_NAME=".." ADMIN_EMAIL=".." ADMIN_PASSWORD=".." npm run create:admin');
    process.exit(1);
  }
  if (String(password).length < 8) { console.error('✗ Password must be at least 8 characters'); process.exit(1); }

  const conn = await mysql.createConnection({
    host: config.db.host, port: config.db.port,
    user: config.db.user, password: config.db.password, database: config.db.name,
  });
  try {
    const hash = bcrypt.hashSync(password, config.bcryptRounds);
    const [ex] = await conn.execute('SELECT id FROM users WHERE email = ?', [email]);
    if (ex.length) {
      await conn.execute("UPDATE users SET name = ?, password_hash = ?, role = 'admin' WHERE email = ?", [name, hash, email]);
      console.log('✓ Existing account promoted/updated to admin:', email);
    } else {
      await conn.execute("INSERT INTO users (name, email, password_hash, role) VALUES (?,?,?,'admin')", [name, email, hash]);
      console.log('✓ Admin account created:', email);
    }
  } catch (e) {
    console.error('✗', e.message); process.exit(1);
  } finally {
    await conn.end();
  }
})();
