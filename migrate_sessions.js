const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const { pool } = require('./db');

const migrate = async () => {
    const client = await pool.connect();
    try {
        console.log("Starting migration...");

        // Add question_text column
        await client.query(`
            ALTER TABLE sessions 
            ADD COLUMN IF NOT EXISTS question_text TEXT;
        `);
        console.log("Added question_text column.");

        // Make question_id nullable
        await client.query(`
            ALTER TABLE sessions 
            ALTER COLUMN question_id DROP NOT NULL;
        `);
        console.log("Made question_id nullable.");

        console.log("Migration complete.");
    } catch (err) {
        console.error("Migration failed:", err);
    } finally {
        client.release();
        pool.end();
    }
};

migrate();
