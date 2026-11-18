/**
 * RD4.3 | PART A | DATABASE CONNECTION
 *
 * LESSON: What is a connection pool?
 * A connection pool reuses database connections instead
 * of creating a new connection for every SQL query.
 *
 * PURPOSE: Share one database connection pool across
 * the application.
 *
 * SEARCH KEYWORDS: MariaDB, mysql2, connection pool, SQL
 */

require('dotenv').config();
const mysql = require('mysql2/promise');

const db = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: Number(process.env.DB_PORT || 3306),
  waitForConnections: true,
  connectionLimit: 10
});

module.exports = db;
