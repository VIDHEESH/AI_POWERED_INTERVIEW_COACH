const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const { pool } = require('./db');

const migrate = async () => {
    try {
        console.log("Adding analysis_results column...");
        await pool.query(`
            ALTER TABLE sessions 
            ADD COLUMN IF NOT EXISTS analysis_results JSONB;
        `);
        console.log("Migration successful.");
    } catch (err) {
        console.error("Migration failed:", err);
    } finally {
        pool.end();
    }
};

migrate();
