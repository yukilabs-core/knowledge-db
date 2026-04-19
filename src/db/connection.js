import pkg from 'pg';
const { Pool } = pkg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
});

export const query = async (text, params) => {
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    console.log(`[DB] ${text.substring(0, 50)}... (${duration}ms)`);
    return res;
  } catch (err) {
    console.error(`[DB ERROR] ${text.substring(0, 50)}...`, err);
    throw err;
  }
};

export const getClient = async () => {
  return await pool.connect();
};

export default pool;
