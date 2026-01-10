// import mysql from "mysql2/promise";

// const connection = mysql.createconnection({
//   host: process.env.DATABASE_HOST,
//   user: process.env.DATABASE_USER,
//   password: process.env.DATABASE_PASSWORD,
//   database: process.env.DATABASE_NAME,
// });

// export default connection;


// import mysql from "mysql2/promise";

// const connection = mysql.createconnection({
//   host: process.env.DATABASE_HOST,
//   user: process.env.DATABASE_USER,
//   password: process.env.DATABASE_PASSWORD,
//   database: process.env.DATABASE_NAME,
//   waitForConnections: true,
//   connectionLimit: 10,
//   queueLimit: 0
// });

// export default connection;


import mysql from "mysql2/promise";

const pool = mysql.createPool({
  host: process.env.DATABASE_HOST,
  user: process.env.DATABASE_USER,
  password: process.env.DATABASE_PASSWORD,
  database: process.env.DATABASE_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
    maxPreparedStatements: 0 // <--- add this

});

// TEST CONNECTION
export async function testConnection() {
  try {
    const conn = await pool.getConnection();
    console.log("Database connected successfully!");
    conn.release();
  } catch (error) {
    console.error("Database connection failed:", error);
  }
}

export async function dbQuery(sql, params = []) {
  const conn = await pool.getConnection();
  try {
    const [rows] = await conn.query(sql, params);
    return rows;
  } finally {
    conn.release();
  }
}

export default pool;
