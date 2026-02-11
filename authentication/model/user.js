const { pool } = require('../../db');

const createUser = async (name, email, passwordHash) => {
    const query = `
        INSERT INTO users (name, email, password)
        VALUES ($1, $2, $3)
        RETURNING id, name, email, created_at
    `;
    const values = [name, email, passwordHash];
    const result = await pool.query(query, values);
    return result.rows[0];
};

const findUserByEmail = async (email) => {
    const query = 'SELECT * FROM users WHERE email = $1';
    const result = await pool.query(query, [email]);
    return result.rows[0];
};

const findUserById = async (id) => {
    const query = 'SELECT id, name, email, created_at FROM users WHERE id = $1';
    const result = await pool.query(query, [id]);
    return result.rows[0];
};

const updateUserProfile = async (id, name) => {
    const query = `
        UPDATE users
        SET name = $1
        WHERE id = $2
        RETURNING id, name, email
    `;
    const result = await pool.query(query, [name, id]);
    return result.rows[0];
};

module.exports = {
    createUser,
    findUserByEmail,
    findUserById,
    updateUserProfile
};
