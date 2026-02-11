require('dotenv').config();
const { pool } = require('./db');

const migrate = async () => {
    try {
        console.log("Adding interview_group_id to sessions table...");
        await pool.query('ALTER TABLE sessions ADD COLUMN IF NOT EXISTS interview_group_id VARCHAR(50)');
        console.log("Migration successful.");
    } catch (err) {
        console.error("Migration failed:", err);
    } finally {
        await pool.end();
    }
};

migrate();
