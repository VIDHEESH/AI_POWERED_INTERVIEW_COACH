const { pool } = require('../../db');

const getQuestions = async () => {
    const query = 'SELECT * FROM questions ORDER BY RANDOM() LIMIT 5';
    const result = await pool.query(query);
    return result.rows;
};

const createSession = async (userId, questionId, videoUrl, questionText = null, interviewGroupId = null, videoAnalysis = null) => {
    const query = `
        INSERT INTO sessions (user_id, question_id, video_url, question_text, interview_group_id, analysis_results)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id, created_at
    `;
    const result = await pool.query(query, [userId, questionId, videoUrl, questionText, interviewGroupId, videoAnalysis]);
    return result.rows[0];
};

const getUserSessions = async (userId) => {
    const query = `
        SELECT s.id, s.video_url, s.created_at, s.transcript, s.analysis_results,
               s.interview_group_id,
               COALESCE(q.text, s.question_text) as question_text, 
               COALESCE(q.category, 'AI Interview') as category
        FROM sessions s
        LEFT JOIN questions q ON s.question_id = q.id
        WHERE s.user_id = ($1)
        ORDER BY s.created_at DESC
    `;
    const result = await pool.query(query, [userId]);
    return result.rows;
};

const updateSessionTranscript = async (id, transcript, analysis = null) => {
    const query = 'UPDATE sessions SET transcript = $1, analysis_results = $2 WHERE id = $3 RETURNING *';
    const result = await pool.query(query, [transcript, analysis, id]);
    return result.rows[0];
};

module.exports = {
    getQuestions,
    createSession,
    getUserSessions,
    updateSessionTranscript
};
