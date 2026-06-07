// server/config.js — environment configuration with production safety guards
require('dotenv').config({ quiet: true });

const env = process.env.NODE_ENV || 'development';
const isProd = env === 'production';

const config = {
  env,
  isProd,
  port: Number(process.env.PORT || 4000),
  corsOrigin: process.env.CORS_ORIGIN || '*',
  jwt: {
    secret: process.env.JWT_SECRET || (isProd ? '' : 'dev-insecure-secret-not-for-production'),
    expires: process.env.JWT_EXPIRES || '7d',
  },
  bcryptRounds: Number(process.env.BCRYPT_ROUNDS || 10),
  db: {
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    name: process.env.DB_NAME || 'vendorbridge',
  },
};

// Fail fast in production if critical secrets are weak/missing.
if (isProd) {
  const problems = [];
  if (!config.jwt.secret || config.jwt.secret.length < 24)
    problems.push('JWT_SECRET must be set to a strong value (>= 24 chars)');
  if (!process.env.DB_HOST || !process.env.DB_NAME)
    problems.push('DB_HOST and DB_NAME must be set');
  if (problems.length) {
    console.error('\n[FATAL] Invalid production configuration:\n  - ' + problems.join('\n  - ') + '\n');
    process.exit(1);
  }
}

module.exports = config;
