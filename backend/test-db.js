const pool = require("./db");

async function testConnection() {
    try {
        const connection = await pool.getConnection();
        console.log("MySQL connection successful!");
        connection.release();
        process.exit(0);
    } catch (error) {
        console.error("MySQL connection failed:", error.message);
        process.exit(1);
    }
}

testConnection();