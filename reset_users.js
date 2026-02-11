require('dotenv').config();
const { pool } = require('./db');

const resetUsers = async () => {
    try {
        console.log("Deleting all users...");
        // Assuming ON DELETE CASCADE is set for sessions. If not, we might error or need to delete sessions first.
        // But let's try users first.
        const res = await pool.query('DELETE FROM users');
        console.log(`Deleted ${res.rowCount} users.`);
    } catch (err) {
        console.error("Error deleting users:", err);
        if (err.code === '23503') { // Foreign key violation
            console.log("Foreign key violation detected. Trying to delete sessions first...");
            await pool.query('DELETE FROM sessions');
            await pool.query('DELETE FROM users');
            console.log("Deleted users and sessions.");
        }
    } finally {
        await pool.end();
    }
};

resetUsers();
