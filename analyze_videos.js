/**
 * Analyze Uploaded Videos
 * 
 * This script processes all uploaded video sessions that haven't been analyzed yet.
 * It performs: Transcription, Audio Analysis, and NLP Content Analysis
 * 
 * Usage: node analyze_videos.js
 */

require('dotenv').config();
const { pool } = require('./db');
const path = require('path');
const fs = require('fs');
const { GoogleGenerativeAI } = require("@google/generative-ai");

const PYTHON_SERVICE = 'http://127.0.0.1:5000';

async function analyzeAnswerWithAI(question, answer, jd = "") {
    try {
        const genAI = new GoogleGenerativeAI(process.env.API_KEY);
        const model = genAI.getGenerativeModel({ model: "gemini-flash-latest" });

        const prompt = `
        Role: Senior Technical Interviewer.
        Task: Evaluate the candidate's answer based on the Job Description (JD).
        
        Context:
        - JD: "${jd.substring(0, 1000)}..." 
        - Question: "${question}"
        - Answer: "${answer}"

        Analyze specifically for:
        1. Relevance (1-10): Did they answer the specific question asked?
        2. Structure (1-10): Was it logical (e.g. STAR method)?
        3. Clarity (1-10): Was it easy to understand?
        4. Correctness (1-10): Technical accuracy based on the JD.

        Output strictly valid JSON:
        {
            "Relevance": 0,
            "Structure": 0,
            "Clarity": 0,
            "Correctness": 0,
            "Key_Feedback": "One sentence summary."
        }
        `;

        const result = await model.generateContent(prompt);
        const text = result.response.text().replace(/```json/g, '').replace(/```/g, '').trim();
        return JSON.parse(text);

    } catch (e) {
        console.error("Gemini NLP Error:", e.message);
        return { "Error": "NLP Analysis Unavailable" };
    }
}

async function transcribeVideo(videoPath) {
    try {
        const formData = new FormData();
        formData.append('filePath', videoPath);

        const res = await fetch(`${PYTHON_SERVICE}/transcribe`, {
            method: 'POST',
            body: formData
        });

        if (!res.ok) {
            throw new Error(`Transcription failed: ${res.status}`);
        }

        return await res.json();
    } catch (e) {
        console.error("Transcription Error:", e.message);
        return null;
    }
}

async function main() {
    console.log("=== Video Analysis Script ===\n");

    // Skip health check - just test with actual request later
    console.log(`Python service URL: ${PYTHON_SERVICE}\n`);

    // Get sessions needing analysis
    const query = `
        SELECT s.id, s.video_url, s.transcript, s.analysis_results, s.question_text,
               s.interview_group_id
        FROM sessions s
        WHERE s.transcript IS NULL 
           OR s.analysis_results IS NULL
           OR s.analysis_results->>'Relevance' IS NULL
        ORDER BY s.created_at DESC
    `;

    const result = await pool.query(query);
    const sessions = result.rows;

    console.log(`Found ${sessions.length} sessions to analyze\n`);

    if (sessions.length === 0) {
        console.log("All videos have been analyzed!");
        process.exit(0);
    }

    let successCount = 0;
    let failCount = 0;

    for (const session of sessions) {
        console.log(`\n--- Processing Session ${session.id} ---`);
        console.log(`Question: ${(session.question_text || "N/A").substring(0, 50)}...`);

        const filename = session.video_url.replace('/uploads/', '');
        const videoPath = path.join(__dirname, 'uploads', filename);

        if (!fs.existsSync(videoPath)) {
            console.log(`✗ Video file not found: ${videoPath}`);
            failCount++;
            continue;
        }

        console.log(`Video: ${filename}`);

        // Step 1: Transcription + Audio Analysis
        let transcript = session.transcript;
        let audioAnalysis = session.analysis_results || {};

        if (!transcript) {
            console.log("Transcribing...");
            const transcribeResult = await transcribeVideo(videoPath);

            if (transcribeResult && transcribeResult.text) {
                transcript = transcribeResult.text;
                audioAnalysis = { ...audioAnalysis, ...transcribeResult.analysis };
                console.log(`✓ Transcript: "${transcript.substring(0, 50)}..."`);
            } else {
                console.log("✗ Transcription failed");
                failCount++;
                continue;
            }
        } else {
            console.log("✓ Already has transcript");
        }

        // Step 2: NLP Content Analysis (if missing)
        if (!audioAnalysis.Relevance) {
            console.log("Analyzing content with AI...");

            // Rate limit protection
            await new Promise(r => setTimeout(r, 1000));

            const nlpResult = await analyzeAnswerWithAI(
                session.question_text || "Interview Question",
                transcript,
                "" // Could load JD from somewhere if stored
            );

            audioAnalysis = { ...audioAnalysis, ...nlpResult };
            console.log(`✓ NLP Scores: R=${nlpResult.Relevance}, S=${nlpResult.Structure}, C=${nlpResult.Clarity}, Cr=${nlpResult.Correctness}`);
        } else {
            console.log("✓ Already has NLP analysis");
        }

        // Step 3: Update Database
        try {
            await pool.query(
                'UPDATE sessions SET transcript = $1, analysis_results = $2 WHERE id = $3',
                [transcript, audioAnalysis, session.id]
            );
            console.log("✓ Database updated");
            successCount++;
        } catch (dbErr) {
            console.error("✗ Database update failed:", dbErr.message);
            failCount++;
        }
    }

    console.log("\n=== Analysis Complete ===");
    console.log(`✓ Success: ${successCount}`);
    console.log(`✗ Failed: ${failCount}`);

    process.exit(0);
}

main().catch(err => {
    console.error("Fatal error:", err);
    process.exit(1);
});
