require("dotenv").config();
const { Pool } = require("pg");

const pool = new Pool({
  connectionString:
    process.env.DATABASE_URL ||
    "postgresql://toolcustody:toolcustody@127.0.0.1:5432/toolcustody",
});

async function query(text, params) {
  return pool.query(text, params);
}

module.exports = { pool, query };
