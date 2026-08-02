import pkg from "pg";
const { Pool } = pkg;

// channel_binding=require conflicts with rejectUnauthorized: false (Neon + pg driver)
const dbUrl = process.env.DATABASE_URL?.replace(
  /[&?]channel_binding=require/g,
  "",
);

const pool = new Pool({
  connectionString: dbUrl,
  ssl:
    process.env.NODE_ENV === "production"
      ? { rejectUnauthorized: false }
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
