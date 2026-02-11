const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const { pool } = require('./db');

const migrate = async () => {
    const client = await pool.connect();
    try {
        console.log("Starting transcript migration...");

        await client.query(`
            ALTER TABLE sessions 
            ADD COLUMN IF NOT EXISTS transcript TEXT;
        `);
        console.log("Added transcript column.");

    } catch (err) {
        console.error("Migration failed:", err);
    } finally {
        client.release();
        pool.end();
    }
};

migrate();
