const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const pdf = require('pdf-parse');
const { GoogleGenerativeAI } = require("@google/generative-ai");
const router = express.Router();
const auth = require('../../authentication/middleWares/auth');
const { getQuestions, createSession, getUserSessions, updateSessionTranscript } = require('../model/interview');

// Configure Multer for video uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/');
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({ storage: storage });

// Get Random Questions
router.get('/questions', auth, async (req, res) => {
    try {
        const questions = await getQuestions();
        res.json(questions);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

// Upload Video Session
router.post('/upload', auth, upload.single('video'), async (req, res) => {
    try {
        if (!req.file) {
            console.error("Upload failed: No file received");
            return res.status(400).json({ error: 'No video file uploaded' });
        }
        console.log("File uploaded successfully:", req.file.path, "Size:", req.file.size);

        const { questionId, questionText, interviewGroupId, videoAnalysis } = req.body;
        if (!questionId && !questionText) {
            return res.status(400).json({ error: 'Question data is required' });
        }

        // Create session in DB
        // File path needs to be accessible via static route (e.g. /uploads/filename.webm)
        const videoUrl = `/uploads/${req.file.filename}`;

        // Handle "null" string from FormData if present, or actual null
        const qId = (questionId && questionId !== 'null') ? questionId : null;
        const gId = (interviewGroupId && interviewGroupId !== 'null') ? interviewGroupId : null;

        // Parse video analysis data if present
        let videoAnalysisData = null;
        if (videoAnalysis) {
            try {
                videoAnalysisData = JSON.parse(videoAnalysis);
                console.log(`Video analysis for question: emotion=${videoAnalysisData.dominant_emotion}, eye_contact=${videoAnalysisData.eye_contact_percent}%`);
            } catch (e) {
                console.warn("Failed to parse videoAnalysis:", e);
            }
        }

        const session = await createSession(req.user.id, qId, videoUrl, questionText, gId, videoAnalysisData);

        // Check for deferred transcription
        if (req.body.skip_transcription === 'true') {
            return res.status(201).json({ message: 'Session saved. Transcription deferred.', session });
        }

        res.status(201).json({ message: 'Session saved successfully. Transcription started.', session });

        // Trigger Async Transcription (Only if NOT skipped)
        (async () => {
            try {
                const formData = new FormData();
                const absolutePath = path.resolve(req.file.path);
                formData.append('filePath', absolutePath);
                console.log("Requesting transcription for:", absolutePath);

                const pyRes = await fetch('http://localhost:5000/transcribe', {
                    method: 'POST',
                    body: formData
                });
                const pyData = await pyRes.json();

                if (pyData.text) {
                    console.log(`Transcribed Session ${session.id}:`, pyData.text.substring(0, 50) + "...");
                    await updateSessionTranscript(session.id, pyData.text, pyData.analysis || null);
                }
            } catch (err) {
                console.error("Transcription Failed:", err);
            }
        })();

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

// Process Batch Transcription (End of Interview)
router.post('/process-batch', auth, async (req, res) => {
    try {
        const { interviewGroupId } = req.body;
        if (!interviewGroupId) return res.status(400).json({ error: 'Group ID required' });

        const sessions = await getUserSessions(req.user.id);
        const groupSessions = sessions.filter(s => s.interview_group_id === interviewGroupId);

        console.log(`Processing batch for group ${interviewGroupId}: ${groupSessions.length} sessions.`);

        // Process sequentially to avoid overwhelming Python service
        const results = [];
        for (const session of groupSessions) {
            // Only process if no transcript yet
            if (!session.transcript) {
                try {
                    // Extract filename from URL (remove /uploads/)
                    const filename = session.video_url.replace('/uploads/', '');
                    const absolutePath = path.resolve(req.user.id ? 'uploads' : 'uploads', filename); // Simple resolve
                    // Better verify path exists
                    const realPath = path.join(__dirname, '../../uploads', filename);

                    if (fs.existsSync(realPath)) {
                        console.log(`Transcribing deferred session ${session.id}...`);
                        const formData = new FormData();
                        formData.append('filePath', realPath);

                        const pyRes = await fetch('http://localhost:5000/transcribe', { method: 'POST', body: formData });
                        const pyData = await pyRes.json();

                        if (pyData.text) {
                            // --- Step 6: NLP Content Analysis ---
                            let nlpAnalysis = {};
                            try {
                                console.log(`Analyzing content for Session ${session.id}...`);
                                nlpAnalysis = await analyzeAnswerWithAI(
                                    session.question_text || "General Question",
                                    pyData.text,
                                    req.body.jd || ""
                                );
                            } catch (nlpErr) {
                                console.error("NLP Analysis Failed:", nlpErr);
                            }

                            const finalAnalysis = { ...pyData.analysis, ...nlpAnalysis };

                            await updateSessionTranscript(session.id, pyData.text, finalAnalysis);
                            results.push({
                                id: session.id,
                                status: 'success',
                                question: session.question_text || "Question " + session.question_id,
                                transcript: pyData.text,
                                analysis: finalAnalysis
                            });
                        }
                    } else {
                        console.warn(`File not found for session ${session.id}: ${realPath}`);
                    }
                } catch (e) {
                    console.error(`Batch error for session ${session.id}`, e);
                    results.push({ id: session.id, status: 'failed', error: e.message });
                }
            }
        }

        res.json({ message: 'Batch processing complete', results });

    } catch (err) {
        console.error("Batch Process Error", err);
        res.status(500).json({ error: 'Processing failed' });
    }
});

// Helper: NLP Analysis
async function analyzeAnswerWithAI(question, answer, jd) {
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
        console.error("Gemini NLP Error:", e);
        return { "Error": "NLP Analysis Unavailable" };
    }
}

// Get User Sessions
router.get('/sessions', auth, async (req, res) => {
    try {
        const sessions = await getUserSessions(req.user.id);
        res.json(sessions);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

// Compare JD Route (Proxies to Python Service)
router.post('/compare-jd', auth, upload.single('cv'), async (req, res) => {
    try {
        console.log("Analyzing JD match (via Python)...");
        if (!req.file || !req.body.jobDescription) {
            return res.status(400).json({ error: 'CV file and Job Description are required' });
        }

        const formData = new FormData();
        const fileBuffer = fs.readFileSync(req.file.path);
        const blob = new Blob([fileBuffer]);

        formData.append('cv', blob, req.file.originalname);
        formData.append('jobDescription', req.body.jobDescription);

        const pyResponse = await fetch('http://localhost:5000/compare-jd', {
            method: 'POST',
            body: formData
        });

        const data = await pyResponse.json();

        // Cleanup
        try { fs.unlinkSync(req.file.path); } catch (e) { }

        if (!pyResponse.ok) throw new Error(data.error || 'Python Service Error');

        console.log("Analysis success (Python). Score:", data.score);
        res.json(data);

    } catch (err) {
        console.error("JD Compare Global Error:", err);
        res.status(500).json({ error: 'Processing failed on server (Ensure Python Service is running).' });
    }
});

// Gemini Chat Route
router.post('/chat', auth, async (req, res) => {
    try {
        const genAI = new GoogleGenerativeAI(process.env.API_KEY);
        const model = genAI.getGenerativeModel({ model: "gemini-flash-latest" });

        const { userText, jd, resume, isInit, currentQuestion } = req.body;

        // Log incoming context for debugging
        if (isInit) {
            console.log(`[Init Interview] JD Length: ${jd ? jd.length : 0}, Resume Length: ${resume ? resume.length : 0}`);
            if (!jd || jd === 'General') console.warn("[Init Interview] Warning: No JD provided (or 'General'). Questions may be generic.");
        }

        let prompt;
        if (isInit) {
            prompt = `You are an experienced technical interviewer. 
             CONTEXT:
             - JD: "${jd && jd.length > 10 ? jd : 'Software Engineering Role (General)'}"
             - Resume: "${resume || 'Not provided'}"
             
             TASK: Create a list of 5 technical interview questions to ask this candidate based SPECIFICALLY on the JD and Resume.
             - If the JD is specific, ask specific questions about those technologies.
             - If the Resume lists specific skills, challenge them on those.
             - If the JD is generic, ask standard but challenging engineering questions.
             
             OUTPUT FORMAT: 
             - Return ONLY a raw JSON array of strings. 
             - DO NOT use markdown code blocks (no \`\`\`json). 
             - DO NOT include any introductory or concluding text.
             
             Example: ["Question 1?", "Question 2?", "Question 3?", "Question 4?", "Question 5?"]`;
        } else {
            prompt = `You are a technical interviewer.
             Context:
             - JD: "${jd}"
             - Resume: "${resume}"
             - Current Question: "${currentQuestion}"
             - Candidate Answer: "${userText}"
             
             Task: Provide brief, constructive feedback on the answer.
             - Did they miss key concepts?
             - Was it good?
             - IMPORTANT: Keep it VERY SHORT (max 1 sentence). 
             - Do NOT ask a new question. Just feedback.`;
        }

        // Retry Logic for Rate Limits (429)
        const generateWithRetry = async (retries = 3, delay = 5000) => {
            try {
                return await model.generateContent(prompt);
            } catch (err) {
                if (retries > 0 && (err.status === 429 || err.message.includes('429'))) {
                    console.log(`Rate limited. Waiting ${delay / 1000}s...`);
                    await new Promise(res => setTimeout(res, delay));
                    return generateWithRetry(retries - 1, delay * 3); // Exponential x3 (5s, 15s, 45s)
                }
                throw err;
            }
        };

        const result = await generateWithRetry();
        const response = await result.response;
        let text = response.text();

        // Cleanup JSON (Robust Regex Extraction)
        if (isInit) {
            console.log("--- Raw Gemini Response ---");
            console.log(text.substring(0, 500) + "..."); // Log first 500 chars

            // Remove markdown formatting if present
            text = text.replace(/```json/g, '').replace(/```/g, '').trim();

            const jsonMatch = text.match(/\[[\s\S]*\]/);
            if (jsonMatch) {
                try {
                    // Validate JSON
                    JSON.parse(jsonMatch[0]);
                    text = jsonMatch[0];
                } catch (e) {
                    console.error("JSON Validation Error:", e);
                    // Fallback handled below
                }
            } else {
                // Fallback: If no array found, force a basic list from text
                console.error("No JSON array found in response:", text);
                text = '["Could you describe your relevant experience?", "What interests you about this role?", "Explain a technical challenge you solved.", "How do you handle deadlines?", "Do you have questions for us?"]';
            }
        }

        res.json({ reply: text });
    } catch (err) {
        console.error("Gemini Error:", err);
        res.status(500).json({ error: 'AI Error' });
    }
});


module.exports = router;
