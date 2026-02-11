const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const { pool } = require('./db');

const checkTranscript = async () => {
    try {
        const query = `
            SELECT id, user_id, length(transcript) as char_len, transcript
            FROM sessions 
            WHERE transcript IS NOT NULL
            ORDER BY created_at DESC
            LIMIT 1
        `;
        const res = await pool.query(query);
        if (res.rows.length > 0) {
            const r = res.rows[0];
            console.log(`Session ID: ${r.id}`);
            console.log(`Total Length: ${r.char_len}`);
            console.log(`Start: ${r.transcript.substring(0, 100)}`);
            console.log(`End: ${r.transcript.substring(r.char_len - 100)}`);
        } else {
            console.log("No transcripts found.");
        }
    } catch (err) {
        console.error(err);
    } finally {
        pool.end();
    }
};

checkTranscript();
