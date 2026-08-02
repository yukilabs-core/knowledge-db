import pkg from "pg";
const { Pool } = pkg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl:
    process.env.NODE_ENV === "production"
      ? { rejectUnauthorized: true }
      : false,
});

pool.on("error", (err) => {
  console.error("Unexpected error on idle client", err);
});

export const query = async (text, params) => {
  try {
    return await pool.query(text, params);
  } catch (err) {
    throw err;
  }
};

export const getClient = async () => {
  return await pool.connect();
};

export default pool;
