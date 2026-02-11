const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const { pool } = require('./db');

const cleanupUsers = async () => {
    try {
        console.log("Listing users...");
        const res = await pool.query('SELECT * FROM users');
        res.rows.forEach(u => console.log(`Found User: ${u.email} (ID: ${u.id})`));

        if (res.rows.length > 0) {
            console.log("Deleting all users and sessions...");
            await pool.query('DELETE FROM sessions'); // Clear sessions first
            await pool.query('DELETE FROM users');    // Clear users
            console.log("All users deleted.");
        } else {
            console.log("No users found.");
        }

    } catch (err) {
        console.error("Cleanup failed:", err);
    } finally {
        pool.end();
    }
};

cleanupUsers();
