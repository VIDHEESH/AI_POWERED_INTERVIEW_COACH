const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});

const initDb = async () => {
    const client = await pool.connect();
    try {
        console.log("Connected to database. Initializing table...");
        const queryText = `
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                name VARCHAR(100),
                email VARCHAR(100) UNIQUE NOT NULL,
                password VARCHAR(255) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS questions (
                id SERIAL PRIMARY KEY,
                category VARCHAR(50),
                text TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS sessions (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id),
                question_id INTEGER REFERENCES questions(id),
                video_url TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `;
        await client.query(queryText);

        // Seed questions if empty
        const countRes = await client.query('SELECT COUNT(*) FROM questions');
        if (parseInt(countRes.rows[0].count) === 0) {
            console.log("Seeding questions...");
            await client.query(`
                INSERT INTO questions (category, text) VALUES
                ('Behavioral', 'Tell me about yourself.'),
                ('Behavioral', 'What is your greatest strength?'),
                ('Behavioral', 'Describe a challenging situation you faced and how you handled it.'),
                ('Technical', 'Explain the concept of RESTful APIs.'),
                ('Technical', 'What is the difference between SQL and NoSQL databases?')
            `);
        }

        console.log("Database tables verified/created.");
    } catch (err) {
        console.error("Error initializing database:", err);
        throw err;
    } finally {
        client.release();
    }
};

module.exports = {
    pool,
    initDb
};
