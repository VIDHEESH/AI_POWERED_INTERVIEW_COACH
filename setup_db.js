const { Client } = require('pg');

const setup = async () => {
    // Connect to the default 'postgres' database to create the new database
    const client = new Client({
        connectionString: 'postgresql://postgres:post@localhost:5432/postgres'
    });

    try {
        await client.connect();

        // Check if database exists
        const res = await client.query("SELECT 1 FROM pg_database WHERE datname = 'interview_coach'");
        if (res.rowCount === 0) {
            console.log("Database 'interview_coach' not found. Creating...");
            await client.query('CREATE DATABASE interview_coach');
            console.log("Database 'interview_coach' created successfully.");
        } else {
            console.log("Database 'interview_coach' already exists.");
        }
    } catch (err) {
        console.error("Error creating database:", err);
    } finally {
        await client.end();
    }
};

setup();
