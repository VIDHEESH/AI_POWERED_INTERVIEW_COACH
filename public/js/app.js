// API Config
const API_URL = 'http://localhost:3000/auth';

// Utilities
const $ = (selector) => document.querySelector(selector);
const showAlert = (message, type = 'error', actionBtn = null) => {
    const alert = $('#alert');
    if (alert) {
        alert.innerHTML = message; // Allow HTML for lists/buttons
        alert.className = `alert alert-${type}`;
        alert.style.display = 'block';
        if (actionBtn) {
            alert.appendChild(actionBtn);
        } else {
            setTimeout(() => alert.style.display = 'none', 15000); // 15s to read errors
        }
    }
};

// Auth State
const getToken = () => localStorage.getItem('token');
const setToken = (token) => localStorage.setItem('token', token);
const removeToken = () => localStorage.removeItem('token');
const isAuthenticated = () => !!getToken();

// Redirect logic
const checkAuth = (protectedRoute = false) => {
    const isAuth = isAuthenticated();
    if (protectedRoute && !isAuth) {
        window.location.href = '/index.html';
    } else if (!protectedRoute && isAuth && (window.location.pathname.includes('index') || window.location.pathname.includes('register') || window.location.pathname === '/')) {
        window.location.href = '/dashboard.html';
    }
};

// API Calls
async function register(e) {
    e.preventDefault();
    const name = $('#name').value;
    const email = $('#email').value;
    const password = $('#password').value;

    try {
        const res = await fetch(`${API_URL}/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, email, password })
        });
        const data = await res.json();

        if (res.ok) {
            showAlert('Registration successful! Redirecting...', 'success');
            setTimeout(() => window.location.href = '/index.html', 1500);
        } else {
            showAlert(data.error);
        }
    } catch (err) {
        showAlert('Something went wrong. Please try again.');
    }
}

async function login(e) {
    e.preventDefault();
    const email = $('#email').value;
    const password = $('#password').value;

    try {
        const res = await fetch(`${API_URL}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        const data = await res.json();

        if (res.ok) {
            setToken(data.token);
            window.location.href = '/dashboard.html';
        } else {
            showAlert(data.error);
        }
    } catch (err) {
        showAlert('Connection error');
    }
}

async function loadProfile() {
    try {
        const res = await fetch(`${API_URL}/profile`, {
            headers: { 'Authorization': `Bearer ${getToken()}` }
        });

        if (res.status === 401) {
            logout();
            return;
        }

        const user = await res.json();
        const userName = $('#userName');
        if (userName) userName.textContent = user.name;
        const userEmail = $('#userEmail');
        if (userEmail) userEmail.textContent = user.email;
        const editName = $('#editName');
        if (editName) editName.value = user.name;
    } catch (err) {
        console.error(err);
    }
}

async function updateProfile(e) {
    e.preventDefault();
    const name = $('#editName').value;

    try {
        const res = await fetch(`${API_URL}/profile`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${getToken()}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ name })
        });
        const data = await res.json();

        if (res.ok) {
            showAlert('Profile updated successfully', 'success');
            loadProfile(); // Refresh display
        } else {
            showAlert(data.error);
        }
    } catch (err) {
        showAlert('Failed to update.');
    }
}

function logout() {
    removeToken();
    window.location.href = '/index.html';
}

// --- Dashboard History ---
let allSessions = []; // Store for detail view
let speechChart = null; // Chart.js instance

async function loadSessions() {
    const list = $('#interviewList');
    if (!list) return;

    try {
        const res = await fetch('http://localhost:3000/interview/sessions', {
            headers: { 'Authorization': `Bearer ${getToken()}` }
        });
        allSessions = await res.json();

        // Group sessions by interview_group_id (or date if no group)
        const groups = {};
        allSessions.forEach(session => {
            const groupKey = session.interview_group_id || `single_${session.id}`;
            if (!groups[groupKey]) {
                groups[groupKey] = {
                    id: groupKey,
                    date: session.created_at,
                    sessions: []
                };
            }
            groups[groupKey].sessions.push(session);
        });

        const groupList = Object.values(groups);

        if (groupList.length === 0) {
            list.innerHTML = '<p style="color: var(--text-muted);">No interviews yet. Start your first mock interview!</p>';
            return;
        }

        list.innerHTML = groupList.map((group, index) => `
            <div class="interview-card" onclick="showInterviewDetail('${group.id}')" 
                 style="background: rgba(255,255,255,0.05); padding: 1.25rem; margin-bottom: 1rem; border-radius: 10px; border: 1px solid var(--border); cursor: pointer; transition: all 0.2s; display: flex; justify-content: space-between; align-items: center;"
                 onmouseover="this.style.background='rgba(99,102,241,0.1)'; this.style.borderColor='var(--primary)'"
                 onmouseout="this.style.background='rgba(255,255,255,0.05)'; this.style.borderColor='var(--border)'">
                <div>
                    <div style="font-weight: 600; font-size: 1.1rem; color: var(--text);">
                        Interview #${groupList.length - index}
                    </div>
                    <div style="font-size: 0.85rem; color: var(--text-muted); margin-top: 0.25rem;">
                        ${new Date(group.date).toLocaleDateString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}
                    </div>
                </div>
                <div style="text-align: right;">
                    <div style="font-size: 0.85rem; color: var(--primary);">${group.sessions.length} Questions</div>
                    <div style="font-size: 0.75rem; color: var(--text-muted);">Click to view feedback →</div>
                </div>
            </div>
        `).join('');

    } catch (err) {
        console.error(err);
        list.innerHTML = '<p style="color: var(--error);">Failed to load interviews.</p>';
    }
}

function showInterviewDetail(groupId) {
    const masterView = $('#masterView');
    const detailView = $('#detailView');

    // Get sessions for this group
    const sessions = allSessions.filter(s =>
        (s.interview_group_id || `single_${s.id}`) === groupId
    );

    if (sessions.length === 0) return;

    // Calculate metrics
    const metrics = calculateMetrics(sessions);

    // Update UI
    $('#detailTitle').textContent = `Interview Feedback (${sessions.length} Questions)`;
    $('#confidenceScore').textContent = metrics.confidence + '%';
    $('#contentQuality').textContent = metrics.contentQuality + '%';

    // Render Speech Chart
    renderSpeechChart(sessions);

    // Render Expression Timeline
    renderExpressionTimeline(sessions);

    // Render Question Breakdown
    renderQuestionBreakdown(sessions);

    // Show detail view
    masterView.style.display = 'none';
    detailView.style.display = 'block';

    // Back button handler
    $('#backToListBtn').onclick = () => {
        detailView.style.display = 'none';
        masterView.style.display = 'block';
    };
}

function calculateMetrics(sessions) {
    let totalConfidence = 0;
    let totalContent = 0;
    let validCount = 0;

    sessions.forEach(s => {
        if (s.analysis_results) {
            const a = s.analysis_results;

            // Confidence from delivery metrics (clarity, fluency, WPM normalization)
            let conf = 0;
            let confParts = 0;
            if (a.clarity_score !== undefined) { conf += a.clarity_score; confParts++; }
            if (a.fluency_score !== undefined) { conf += a.fluency_score; confParts++; }
            if (a.wpm !== undefined) {
                // Ideal WPM is 120-150, score it
                const wpmScore = Math.max(0, 100 - Math.abs(135 - a.wpm));
                conf += wpmScore; confParts++;
            }
            if (a.filler_count !== undefined) {
                // Fewer fillers = better, max penalty at 10 fillers
                const fillerScore = Math.max(0, 100 - (a.filler_count * 10));
                conf += fillerScore; confParts++;
            }
            if (confParts > 0) totalConfidence += conf / confParts;

            // Content quality from NLP metrics
            let content = 0;
            let contentParts = 0;
            if (a.Relevance !== undefined) { content += a.Relevance * 10; contentParts++; }
            if (a.Structure !== undefined) { content += a.Structure * 10; contentParts++; }
            if (a.Clarity !== undefined) { content += a.Clarity * 10; contentParts++; }
            if (a.Correctness !== undefined) { content += a.Correctness * 10; contentParts++; }
            if (contentParts > 0) totalContent += content / contentParts;

            validCount++;
        }
    });

    return {
        confidence: validCount > 0 ? Math.round(totalConfidence / validCount) : 0,
        contentQuality: validCount > 0 ? Math.round(totalContent / validCount) : 0
    };
}

function renderSpeechChart(sessions) {
    const ctx = document.getElementById('speechChart');
    if (!ctx) return;

    // Destroy old chart
    if (speechChart) speechChart.destroy();

    const labels = sessions.map((s, i) => `Q${i + 1}`);
    const wpmData = sessions.map(s => s.analysis_results?.wpm || 0);
    const clarityData = sessions.map(s => s.analysis_results?.clarity_score || 0);

    speechChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels,
            datasets: [
                {
                    label: 'WPM',
                    data: wpmData,
                    borderColor: 'rgba(99, 102, 241, 1)',
                    backgroundColor: 'rgba(99, 102, 241, 0.1)',
                    tension: 0.3,
                    yAxisID: 'y'
                },
                {
                    label: 'Clarity',
                    data: clarityData,
                    borderColor: 'rgba(34, 197, 94, 1)',
                    backgroundColor: 'rgba(34, 197, 94, 0.1)',
                    tension: 0.3,
                    yAxisID: 'y1'
                }
            ]
        },
        options: {
            responsive: true,
            interaction: { mode: 'index', intersect: false },
            scales: {
                y: { type: 'linear', position: 'left', title: { display: true, text: 'WPM' } },
                y1: { type: 'linear', position: 'right', title: { display: true, text: 'Clarity %' }, grid: { drawOnChartArea: false } }
            }
        }
    });
}

function renderExpressionTimeline(sessions) {
    const container = $('#expressionTimeline');
    if (!container) return;

    const emotionColors = {
        'happy': 'var(--success)',
        'neutral': 'var(--primary)',
        'sad': 'var(--error)',
        'angry': '#dc2626',
        'fear': '#f59e0b',
        'surprise': '#8b5cf6',
        'disgust': '#6b7280'
    };

    container.innerHTML = sessions.map((s, i) => {
        const a = s.analysis_results || {};
        const emotion = a.dominant_emotion || a.emotion || 'neutral';
        const eyeContact = a.eye_contact_percent;
        const color = emotionColors[emotion.toLowerCase()] || 'var(--text-muted)';
        return `
            <div style="display: flex; flex-direction: column; align-items: center; gap: 0.25rem;">
                <div style="background: ${color}; padding: 0.5rem 1rem; border-radius: 20px; font-size: 0.8rem; color: white;">
                    Q${i + 1}: ${emotion}
                </div>
                ${eyeContact !== undefined ? `<span style="font-size: 0.7rem; color: var(--text-muted);">👁 ${eyeContact}%</span>` : ''}
            </div>
        `;
    }).join('');
}

function renderQuestionBreakdown(sessions) {
    const container = $('#questionBreakdown');
    if (!container) return;

    container.innerHTML = sessions.map((s, i) => {
        const a = s.analysis_results || {};
        return `
            <div style="background: rgba(0,0,0,0.2); padding: 1rem; margin-bottom: 0.75rem; border-radius: 8px;">
                <div style="font-weight: 600; margin-bottom: 0.5rem; color: var(--text);">Q${i + 1}: ${s.question_text || 'Question'}</div>
                <div style="display: flex; gap: 1rem; flex-wrap: wrap; font-size: 0.85rem;">
                    ${a.Relevance !== undefined ? `<span>Relevance: <strong>${a.Relevance}/10</strong></span>` : ''}
                    ${a.Structure !== undefined ? `<span>Structure: <strong>${a.Structure}/10</strong></span>` : ''}
                    ${a.Clarity !== undefined ? `<span>Clarity: <strong>${a.Clarity}/10</strong></span>` : ''}
                    ${a.Correctness !== undefined ? `<span>Correctness: <strong>${a.Correctness}/10</strong></span>` : ''}
                    ${a.wpm !== undefined ? `<span>WPM: <strong>${a.wpm}</strong></span>` : ''}
                </div>
                ${a.Key_Feedback ? `<div style="margin-top: 0.5rem; font-size: 0.85rem; color: var(--text-muted); font-style: italic;">"${a.Key_Feedback}"</div>` : ''}
            </div>
        `;
    }).join('');
}

// --- Interview Logic ---
let isProcessingResponse = false;

let isFirstStart = true;

// --- Queue State ---
let questionQueue = [];
let currentQIndex = 0;
let interviewGroupId = null; // Group ID for the full interview
let isUploadingAnswer = false; // Flag to trigger upload on stop
let lastUserText = ""; // Store text to send to AI after upload
let currentQuestionEmotions = []; // Track emotions during current question
let currentQuestionGazeAway = 0; // Count of "away" gaze detections
let currentQuestionGazeTotal = 0; // Total gaze detections for this question

// Send to AI (Queue Logic)
async function sendToAI(text, isInit = false) {
    if ((!text && !isInit) || isProcessingResponse) return;

    try { recognition.stop(); } catch (e) { }
    isProcessingResponse = true;

    if (!isInit) {
        const tDiv = $('#transcript');
        tDiv.innerHTML = `<strong>You:</strong> ${text}`;
    }

    try {
        const currentQ = questionQueue[currentQIndex] || "";

        const res = await fetch('http://localhost:3000/interview/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}` },
            body: JSON.stringify({
                userText: text,
                jd: finalJD,
                resume: finalResume,
                isInit: isInit,
                currentQuestion: currentQ
            })
        });

        if (!res.ok) {
            const errData = await res.json();
            throw new Error(errData.error || `API Error: ${res.status}`);
        }

        const data = await res.json();

        if (isInit) return data.reply; // Return JSON string

        // Standard Flow: Feedback -> Next Question
        const feedback = data.reply;
        const tDiv = $('#transcript');
        tDiv.innerHTML += `<br/><br/><strong>AI Feedback:</strong> ${feedback}`;

        // Speak Feedback
        speak(feedback, () => {
            proceedToNextQuestion();
        });

    } catch (err) {
        console.error("Chat error", err);
        const tDiv = $('#transcript');
        tDiv.innerHTML += `<br/><br/><em>(AI Connection Issue - Moving to next question...)</em>`;
        // Fallback: Move to next question anyway so interview doesn't stall
        speak("Let's move to the next question.", () => {
            proceedToNextQuestion();
        });
    }
}

function proceedToNextQuestion() {
    currentQIndex++;
    if (currentQIndex < questionQueue.length) {
        const nextQ = questionQueue[currentQIndex];
        $('#questionText').innerText = nextQ;
        const tDiv = $('#transcript');
        tDiv.innerHTML += `<br/><br/><strong>Next Question:</strong> ${nextQ}`;

        speak(nextQ, () => {
            isProcessingResponse = false;
            recordedChunks = []; // Clear for next Q

            // Start Speech Rec (Robust)
            try {
                recognition.start();
            } catch (e) {
                // Ignore if already started
                if (e.name !== 'InvalidStateError') console.error("Rec Start Error", e);
            }

            // Start Video Rec (Ensure this always runs)
            try {
                mediaRecorder.start();
                recIndicator.classList.add('active');
            } catch (e) {
                console.error("Media Start Error", e);
                showAlert("Failed to start video recording next question.", 'error');
            }
        });
    } else {
        $('#questionText').innerText = "Interview Complete!";
        speak("That concludes the interview. We will now process your answers.", async () => {
            // Call Batch Processing
            await processInterviewBatch();
        });
    }
}

let mediaRecorder;
let recordedChunks = [];
let currentQuestionId = null;
let stream = null;
let mockCanvas = null;

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
let recognition = null;
let gazeInterval = null;

// --- Global DOM Elements ---
let preview, playback, startBtn, stopBtn, submitBtn, retryBtn, recIndicator;
let finalJD = "";
let finalResume = "";

// --- Speak Function (Global to prevent GC) ---
let currentUtterance = null; // Keep reference alive

function speak(text, onEndCallback = null) {
    if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();

        currentUtterance = new SpeechSynthesisUtterance(text);

        // Safety timeout in case onEnd never fires
        const safetyTimeout = setTimeout(() => {
            if (onEndCallback) onEndCallback();
        }, (text.length * 100) + 2000); // Rough estimate: 100ms per char + 2s buffer

        currentUtterance.onend = () => {
            clearTimeout(safetyTimeout);
            if (onEndCallback) onEndCallback();
        };

        currentUtterance.onerror = (e) => {
            console.error("Speech Error", e);
            clearTimeout(safetyTimeout);
            if (onEndCallback) onEndCallback();
        };

        currentUtterance.rate = 1.1; // Slightly faster for efficiency
        window.speechSynthesis.speak(currentUtterance);
    } else {
        if (onEndCallback) onEndCallback();
    }
}

async function loadRandomQuestion() {
    try {
        const res = await fetch('http://localhost:3000/interview/questions', {
            headers: { 'Authorization': `Bearer ${getToken()}` }
        });
        const questions = await res.json();
        if (questions && questions.length > 0) {
            const q = questions[0];
            currentQuestionId = q.id;
            const qText = $('#questionText');
            if (qText) {
                qText.textContent = q.text;
                speak(q.text); // TTS
            }
        }
    } catch (err) {
        console.error(err);
    }
}

// MOCK CAMERA LOGIC
function createMockStream() {
    if (!mockCanvas) {
        mockCanvas = document.createElement('canvas');
        mockCanvas.width = 640;
        mockCanvas.height = 480;
    }
    const ctx = mockCanvas.getContext('2d');

    // Animation loop
    const draw = () => {
        ctx.fillStyle = '#1e1e1e';
        ctx.fillRect(0, 0, mockCanvas.width, mockCanvas.height);

        // Draw moving circle
        const time = Date.now() / 1000;
        const x = mockCanvas.width / 2 + Math.sin(time) * 100;
        const y = mockCanvas.height / 2 + Math.cos(time * 2) * 50;

        ctx.fillStyle = '#ef4444';
        ctx.beginPath();
        ctx.arc(x, y, 20, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#fff';
        ctx.font = '20px sans-serif';
        ctx.fillText('MOCK CAMERA - RECORDING', 20, 40);
        ctx.fillText(new Date().toLocaleTimeString(), 20, 80);

        requestAnimationFrame(draw);
    };
    draw();

    return mockCanvas.captureStream(30); // 30 FPS
}

async function initInterview() {
    checkAuth(true); // Ensure logged in
    // loadRandomQuestion(); // Disabled for AI Flow

    preview = $('#preview');
    playback = $('#playback');
    startBtn = $('#startBtn');
    stopBtn = $('#stopBtn');
    submitBtn = $('#submitBtn');
    retryBtn = $('#retryBtn');
    recIndicator = $('#recIndicator');

    // Attach functionality to these elements
    bindInterviewEvents();
    attachListeners();

    // --- Auto Start Logic ---
    // --- Auto Start Logic ---
    // Always auto-start if we are on this page, as setup is removed.
    const jd = localStorage.getItem('interview_jd');
    const resume = localStorage.getItem('interview_resume');

    if (!jd) {
        alert("No interview context found. Please start from the Dashboard.");
        window.location.href = 'jd-compare.html';
        return;
    }

    console.log("Auto-starting interview with stored context...");
    finalJD = jd;
    finalResume = resume || "";

    // Directly call the API to generate questions
    (async function autoStartInterview() {
        try {
            console.log("Calling interview/chat API for questions...");
            const res = await fetch('http://localhost:3000/interview/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer ' + localStorage.getItem('token')
                },
                body: JSON.stringify({
                    userText: "",
                    jd: finalJD,
                    resume: finalResume,
                    isInit: true
                })
            });

            if (!res.ok) {
                const errData = await res.json();
                throw new Error(errData.error || 'Init API Error: ' + res.status);
            }

            const data = await res.json();

            // Parse Questions
            try {
                questionQueue = JSON.parse(data.reply);
                currentQIndex = 0;
            } catch (e) {
                console.error("Failed to parse questions, using defaults", e);
                questionQueue = ["Tell me about yourself.", "What are your strengths?", "Describe a challenge you faced.", "Why this role?", "Do you have questions for us?"];
                currentQIndex = 0;
            }

            // Setup First Question
            const firstQ = questionQueue[0];
            const qText = document.getElementById('questionText');
            if (qText) qText.innerText = firstQ;
            const tDiv = document.getElementById('transcript');
            if (tDiv) tDiv.innerHTML = `<strong>Question 1:</strong> ${firstQ}`;

            // Show "Ready" Button to bypass Audio Autoplay Policy
            const loadingEl = document.getElementById('loadingSection');
            if (loadingEl) {
                loadingEl.innerHTML = `
                    <div style="text-align: center; padding: 4rem 2rem;">
                        <h2>🚀 Interview Ready!</h2>
                        <p style="color: var(--text-muted); margin-bottom: 2rem;">Questions generated. Click Start to begin.</p>
                        <button id="realStartBtn" class="btn-proceed" style="max-width: 300px; margin: 0 auto; display: block;">
                            <i class="fas fa-play"></i> Start Interview
                        </button>
                    </div>
                `;

                const realStartBtn = document.getElementById('realStartBtn');
                if (realStartBtn) {
                    realStartBtn.onclick = () => {
                        // visuals
                        loadingEl.style.display = 'none';
                        const interviewEl = document.getElementById('interviewSection');
                        if (interviewEl) interviewEl.style.display = 'block';

                        // triggers
                        isProcessingResponse = true; // Important: Block rec input while AI speaks Q1
                        const sBtn = document.getElementById('startBtn');
                        if (sBtn) sBtn.click(); // Start Rec

                        // audio
                        speak(firstQ, () => {
                            isProcessingResponse = false;
                            try { if (recognition) recognition.start(); } catch (e) { }
                        });
                    };
                }
            } else {
                // Fallback if loadingEl missing for some reason
                const interviewEl = document.getElementById('interviewSection');
                if (interviewEl) interviewEl.style.display = 'block';
                speak(firstQ);
            }

        } catch (err) {
            console.error("Auto Start Error", err);
            showAlert("Failed to initialize interview: " + err.message, 'error');
            setTimeout(() => { window.location.href = 'jd-compare.html'; }, 3000);
        }
    })();
}

// --- Gaze Monitoring ---
const startGazeMonitoring = () => {
    const video = $('#preview');
    if (!video) return; // Exit if no video (Audio Mode)

    // Setup Visualization Canvas
    const trackingCanvas = $('#trackingCanvas');
    let overlayCtx = null;
    let tracePoints = []; // Store points for fading trail

    if (trackingCanvas) {
        // Match canvas resolution to display size (or fixed internal res)
        // We'll use the video's intrinsic size or a fixed size that matches the CSS aspect ratio
        trackingCanvas.width = video.videoWidth || 640;
        trackingCanvas.height = video.videoHeight || 480;
        overlayCtx = trackingCanvas.getContext('2d');
    }

    gazeInterval = setInterval(async () => {
        if (video.paused || video.ended) return;

        if (!mockCanvas) {
            mockCanvas = document.createElement('canvas');
            mockCanvas.width = 300; // Low res for speed
            mockCanvas.height = 200;
        }
        const ctx = mockCanvas.getContext('2d');
        ctx.drawImage(video, 0, 0, mockCanvas.width, mockCanvas.height);
        const dataURL = mockCanvas.toDataURL('image/jpeg', 0.5);

        try {
            const res = await fetch('http://localhost:5000/gaze-detect', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ image: dataURL })
            });
            const data = await res.json();

            const warning = $('#gazeWarning');
            const emotionBadge = $('#emotionBadge');

            // Update Warning
            if (data.status === 'AWAY') {
                warning.style.display = 'block';
            } else {
                warning.style.display = 'none';
            }

            // Update Emotion Badge
            if (emotionBadge && data.emotion) {
                emotionBadge.textContent = `${data.emotion} (${data.gaze_state || 'Gen'})`;
                // Color coding for FER emotions
                const e = data.emotion.toLowerCase();
                if (e.includes('happy')) emotionBadge.style.background = 'var(--success)';
                else if (e.includes('sad') || e.includes('fear') || e.includes('angry') || e.includes('disgust')) emotionBadge.style.background = 'var(--error)';
                else if (e.includes('surprise')) emotionBadge.style.background = '#f59e0b'; // Orange
                else emotionBadge.style.background = 'var(--primary)'; // Neutral/Unknown

                // Store emotion for this question
                currentQuestionEmotions.push(data.emotion);
                currentQuestionGazeTotal++;
                if (data.status === 'AWAY') currentQuestionGazeAway++;
            }

            // Draw Eye Trace - DISABLED PER USER REQUEST (Only show warnings)
            if (overlayCtx && trackingCanvas) {
                // Clear previous frame entirely
                overlayCtx.clearRect(0, 0, trackingCanvas.width, trackingCanvas.height);

                // Trace logic removed to hide "green dots"
                // logic for tracePoints array and drawing loop removed
            }

        } catch (e) {
            // console.warn("Gaze service error", e);
        }
    }, 200); // 5 FPS
};

// --- Global Speech State ---
let finalTranscript = '';
let silenceTimer = null;
const SILENCE_LIMIT = 5000; // 5 Seconds

// Attach listeners function
// Attach listeners function
const attachListeners = async () => {
    // --- Camera/Audio Access ---
    const hasVideo = !!$('#preview');
    const constraints = { video: hasVideo, audio: true };

    const requestMediaAccess = async () => {
        try {
            console.log(`Requesting access (Video: ${hasVideo})...`);
            stream = await navigator.mediaDevices.getUserMedia(constraints);
            if (hasVideo) {
                $('#preview').srcObject = stream;
            } else {
                console.log("Audio-only mode initialized.");
            }
            showAlert("Camera and microphone access granted!", 'success');
            return true;
        } catch (err) {
            console.warn("Access failed:", err);

            // Provide specific error messages based on error type
            let errorMsg = "Media access failed. ";
            if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
                errorMsg = "Permission denied. Please allow camera/microphone access in your browser settings, then click Retry.";
            } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
                // Fallback to mock stream so interview can still proceed
                console.warn("No physical device found. Using mock stream as fallback.");
                try {
                    stream = createMockStream();
                    if (hasVideo && $('#preview')) {
                        $('#preview').srcObject = stream;
                    }
                    showAlert("No camera found — using mock video. Interview will proceed normally.", 'warning');
                    return true;
                } catch (mockErr) {
                    console.error("Mock stream also failed:", mockErr);
                    errorMsg = "No camera/microphone found and mock fallback failed.";
                }
            } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
                errorMsg = "Camera/microphone is in use by another application. Close other apps and click Retry.";
            } else if (err.name === 'OverconstrainedError') {
                errorMsg = "Camera constraints not supported. Trying with defaults...";
                // Try again with relaxed constraints
                try {
                    stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
                    if (hasVideo) $('#preview').srcObject = stream;
                    showAlert("Access granted with default settings!", 'success');
                    return true;
                } catch (e) {
                    errorMsg = "Could not access media devices.";
                }
            }

            // Create retry button
            const retryBtn = document.createElement('button');
            retryBtn.className = 'btn btn-primary';
            retryBtn.style.marginLeft = '10px';
            retryBtn.textContent = 'Retry Access';
            retryBtn.onclick = async () => {
                await requestMediaAccess();
            };

            showAlert(errorMsg, 'error', retryBtn);
            return false;
        }
    };

    await requestMediaAccess();

    // --- Speech Recognition with 5s Silence Trigger ---
    if ('webkitSpeechRecognition' in window) {
        if (!recognition) {
            recognition = new webkitSpeechRecognition();
            recognition.continuous = true;
            recognition.interimResults = true;
            recognition.lang = 'en-US';

            recognition.onresult = (event) => {
                if (isProcessingResponse) {
                    // If AI is speaking, ignore input and clear buffer
                    finalTranscript = '';
                    return;
                }

                let interimTranscript = '';
                for (let i = event.resultIndex; i < event.results.length; ++i) {
                    if (event.results[i].isFinal) {
                        finalTranscript += event.results[i][0].transcript + ' ';
                    } else {
                        interimTranscript += event.results[i][0].transcript;
                    }
                }

                const tDiv = $('#transcript');
                // Show Timer Status if waiting
                let status = silenceTimer ? " <small style='color:orange'>(Waiting for 5s silence...)</small>" : "";
                tDiv.innerHTML = `<strong>You:</strong> ${finalTranscript} <span style="color:#999">${interimTranscript}</span>${status}`;

                // Reset Silence Timer on any speech input
                if (silenceTimer) {
                    console.log("Speech detected, resetting timer");
                    clearTimeout(silenceTimer);
                    silenceTimer = null;
                }

                // If we have some input (and not just silence), start timer
                const hasContent = finalTranscript.trim().length > 0 || interimTranscript.trim().length > 0;

                if (hasContent) {
                    silenceTimer = setTimeout(async () => {
                        console.log("5s Silence Detected -> Stopping and Uploading Answer...");
                        $('#transcript').innerHTML += " <small style='color:green'>(Saving Answer...)</small>";

                        // Stop Recording Logic for this Question
                        if (mediaRecorder && mediaRecorder.state !== 'inactive') {
                            mediaRecorder.stop();
                            // The onstop event will handle the upload if we flag it properly
                            isUploadingAnswer = true; // Flag to tell onstop to upload
                        }

                        const fullText = finalTranscript + interimTranscript;
                        finalTranscript = ''; // Reset for next turn

                        // We will call sendToAI AFTER upload is complete in the onstop handler
                        // So we store the text to send
                        lastUserText = fullText;

                        silenceTimer = null;

                    }, SILENCE_LIMIT);
                }
            };

            recognition.onerror = (e) => {
                console.error("Rec Error", e);
                if (e.error === 'no-speech') {
                    // Ignore no-speech errors, just keep listening
                }
            };

            recognition.onend = () => {
                if (isProcessingResponse && $('#setupSection').style.display === 'none') {
                    // If AI is speaking, we don't restart immediately effectively,
                    // but standard logic is to restart.
                    // Logic: onend calls start() if setup is done.
                    console.log("Rec ended, restarting...");
                    try { recognition.start(); } catch (e) { }
                }
            };
        }
    } else {
        alert("Web Speech API not supported in this browser.");
    }

    // Toggle Mic Function (no longer used directly but good to have)
    // ...
};

// Start Button Logic (Moved outside attachListeners)
// --- Bind Events (Safe to call after init) ---
const bindInterviewEvents = () => {
    // Start Button Logic
    startBtn.onclick = () => {
        if (!stream) {
            showAlert("No video stream available.", 'error');
            return;
        }
        recordedChunks = [];

        if (recognition) {
            try { recognition.start(); } catch (e) { }
            $('#transcript').innerHTML += "<br/><em>Listening...</em>";
        }

        // Start Gaze Monitoring (Will skip if no video)
        startGazeMonitoring();

        try {
            // Ensure audio track if available, else just video for mock
            mediaRecorder = new MediaRecorder(stream);
        } catch (e) {
            showAlert(`MediaRecorder error: ${e.message}`, 'error');
            return;
        }

        mediaRecorder.ondataavailable = (e) => {
            if (e.data.size > 0) recordedChunks.push(e.data);
        };

        mediaRecorder.onstop = async () => {
            const blob = new Blob(recordedChunks, { type: 'video/webm' });

            if (isUploadingAnswer) {
                // Auto-Upload Logic
                isUploadingAnswer = false;
                // Run upload in background
                await uploadAnswer(blob, lastUserText).catch(e => console.error("BG Upload error", e));

                // If user clicked Stop, finish session instead of next question
                if (window.isEndingInterview) {
                    processInterviewBatch();
                    return;
                }

                // Proceed to AI Feedback immediately for better UX
                await sendToAI(lastUserText);
            } else {
                // Manual Stop (e.g. End of Interview or Cancel)
                if (preview) preview.style.display = 'none';
                if (playback) {
                    playback.src = URL.createObjectURL(blob);
                    playback.style.display = 'block';
                }
                if (stopBtn) stopBtn.style.display = 'none';
                if (submitBtn) submitBtn.style.display = 'none'; // No manual submit in this flow
                if (retryBtn) retryBtn.style.display = 'none';
                if (recIndicator) recIndicator.classList.remove('active');
            }
        };

        mediaRecorder.start();
        if (startBtn) startBtn.style.display = 'none';
        if (stopBtn) {
            stopBtn.style.display = 'block';
            stopBtn.disabled = false;
        }
        if (preview) preview.style.display = 'block';
        if (playback) playback.style.display = 'none';
        if (recIndicator) recIndicator.classList.add('active');
    };

    if (stopBtn) stopBtn.onclick = () => {
        // User wants to END the interview immediately.
        // We want to save the current answer (if any) and then process results.
        window.isEndingInterview = true;

        if (mediaRecorder && mediaRecorder.state !== 'inactive') {
            // Signal onstop to upload this last segment
            isUploadingAnswer = true;
            mediaRecorder.stop();
        } else {
            // Not recording, just finish
            processInterviewBatch();
        }

        if (recognition) recognition.stop();
        if (gazeInterval) clearInterval(gazeInterval);
        $('#gazeWarning').style.display = 'none';

        // visual feedback
        stopBtn.disabled = true;
        stopBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Finishing...';
    };

    retryBtn.onclick = () => {
        playback.style.display = 'none';
        preview.style.display = 'block';
        submitBtn.style.display = 'none';
        retryBtn.style.display = 'none';
        startBtn.style.display = 'block';
        preview.srcObject = stream; // Re-attach stream
    };

    submitBtn.onclick = async () => {
        const blob = new Blob(recordedChunks, { type: 'video/webm' });
        const formData = new FormData();
        formData.append('video', blob, 'session.webm');
        formData.append('questionId', currentQuestionId);

        // If it's an AI interview, send the questions asked
        const qText = $('#questionText').innerText;
        formData.append('questionText', qText);

        submitBtn.textContent = 'Uploading...';
        submitBtn.disabled = true;

        try {
            const res = await fetch('http://localhost:3000/interview/upload', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${getToken()}`
                },
                body: formData
            });

            if (res.ok) {
                showAlert('Session saved!', 'success');
                setTimeout(() => window.location.href = '/dashboard.html', 1000);
            } else {
                showAlert('Upload failed.', 'error');
                submitBtn.textContent = 'Submit Answer';
                submitBtn.disabled = false;
            }
        } catch (err) {
            console.error(err);
            showAlert('Upload error', 'error');
        }
    };
};


// Attach listeners immediately
// Attach listeners immediately (REMOVED - Called in initInterview)
// attachListeners();

const startMockMode = () => {
    stream = createMockStream();
    preview.srcObject = stream;
    showAlert('Using Mock Camera Mode', 'success');
};




async function uploadAnswer(blob, text) {
    const formData = new FormData();
    formData.append('video', blob, `question-${currentQIndex}.webm`);
    const qText = $('#questionText').innerText;
    formData.append('questionText', qText);

    // Pass Group ID
    if (!interviewGroupId) {
        interviewGroupId = Date.now().toString(); // Generate ID on first upload
    }
    formData.append('interviewGroupId', interviewGroupId);
    formData.append('skip_transcription', 'true'); // Defer analysis

    // Calculate dominant emotion for this question
    const emotionCounts = {};
    currentQuestionEmotions.forEach(e => {
        emotionCounts[e] = (emotionCounts[e] || 0) + 1;
    });
    const dominantEmotion = Object.keys(emotionCounts).reduce((a, b) =>
        emotionCounts[a] > emotionCounts[b] ? a : b, 'neutral');

    // Calculate eye contact percentage
    const eyeContactPercent = currentQuestionGazeTotal > 0
        ? Math.round(((currentQuestionGazeTotal - currentQuestionGazeAway) / currentQuestionGazeTotal) * 100)
        : 0;

    // Include video analysis data
    formData.append('videoAnalysis', JSON.stringify({
        dominant_emotion: dominantEmotion,
        emotion_samples: currentQuestionEmotions.length,
        eye_contact_percent: eyeContactPercent,
        gaze_away_count: currentQuestionGazeAway
    }));

    // Reset for next question
    currentQuestionEmotions = [];
    currentQuestionGazeAway = 0;
    currentQuestionGazeTotal = 0;

    try {
        const res = await fetch('http://localhost:3000/interview/upload', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${getToken()}`
            },
            body: formData
        });

        if (res.ok) {
            console.log("Answer uploaded successfully.");
            // Decoupled: sendToAI is called separately in onstop
        } else {
            console.error("Upload failed.");
            showAlert('Failed to save answer.', 'error');
        }
    } catch (err) {
        console.error("Upload error", err);
        showAlert('Upload network error.', 'error');
    }
}

// Batch Process Logic
async function processInterviewBatch() {
    // Clear auto-start context to prevent loops
    localStorage.removeItem('interview_jd');
    localStorage.removeItem('interview_resume');

    if (!interviewGroupId) return;

    const qText = $('#questionText');
    qText.innerHTML = '<i class="fas fa-cog fa-spin"></i> Processing your answers...<br><small>This may take a minute.</small>';

    // Hide controls
    $('#recIndicator').style.display = 'none';
    if (preview) preview.style.display = 'none';

    try {
        const res = await fetch('http://localhost:3000/interview/process-batch', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${getToken()}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                interviewGroupId,
                jd: finalJD  // Pass JD for context-aware analysis
            })
        });

        const data = await res.json();

        if (res.ok) {
            console.log("Batch processing complete", data);
            qText.innerHTML = '<i class="fas fa-check-circle" style="color:var(--success)"></i> Interview Analyzed!';
            showAlert('All answers processed successfully!', 'success');

            // Display Results
            if (data.results && data.results.length > 0) {
                displayBatchResults(data.results);
            } else {
                setTimeout(() => window.location.href = '/dashboard.html', 2000);
            }

        } else {
            console.error("Batch failed", data);
            showAlert('Some answers failed to process.', 'warning');
            setTimeout(() => window.location.href = '/dashboard.html', 3000);
        }

    } catch (e) {
        console.error("Batch Network Error", e);
        showAlert('Error connecting to processing server.', 'error');
    }
}

function displayBatchResults(results) {
    const container = document.getElementById('interviewSection');
    // Clear current interview UI
    container.innerHTML = `
        <div class="results-container" style="max-width: 900px; margin: 0 auto; padding: 20px;">
            <h2 style="color: var(--primary); text-align: center; margin-bottom: 30px;">
                <i class="fas fa-clipboard-check"></i> Interview Results
            </h2>
            
            ${results.map((r, index) => {
        // Separate NLP from Audio/Video
        const nlpKeys = ['Relevance', 'Structure', 'Clarity', 'Correctness', 'Key_Feedback'];
        const nlpData = {};
        const otherData = {};

        if (r.analysis) {
            for (const [k, v] of Object.entries(r.analysis)) {
                if (nlpKeys.includes(k)) nlpData[k] = v;
                else otherData[k] = v;
            }
        }

        return `
                <div class="result-card" style="background: var(--card-bg); border-radius: 12px; padding: 25px; margin-bottom: 30px; box-shadow: 0 4px 15px rgba(0,0,0,0.2);">
                    <h3 style="color: var(--text-color); margin-bottom: 15px; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 10px;">
                        <span style="color: var(--primary); opacity: 0.8;">Q${index + 1}:</span> ${r.question || 'Question ' + (index + 1)}
                    </h3>
                    
                    <div style="display:grid; grid-template-columns: 1fr 1fr; gap: 20px; text-align: left;">
                        <!-- Left: Answer & NLP Scores -->
                        <div>
                            <strong style="display: block; margin-bottom: 8px; color: var(--text-muted);"><i class="fas fa-comment-dots"></i> Transcript:</strong>
                            <p style="background: rgba(255,255,255,0.05); padding: 15px; border-radius: 8px; font-size: 0.95em; height: 150px; overflow-y: auto;">
                                ${r.transcript || '<em>No transcript available.</em>'}
                            </p>

                            ${nlpData.Key_Feedback ? `
                                <div style="margin-top: 15px; background: rgba(var(--primary-rgb), 0.15); padding: 15px; border-left: 4px solid var(--primary); border-radius: 4px;">
                                    <strong style="color: var(--primary);"><i class="fas fa-lightbulb"></i> AI Feedback:</strong>
                                    <p style="margin: 5px 0 0 0; font-size: 0.9em;">${nlpData.Key_Feedback}</p>
                                </div>
                            ` : ''}
                        </div>

                        <!-- Right: Analysis Metrics -->
                        <div>
                            ${Object.keys(nlpData).length > 0 ? `
                                <strong style="display: block; margin-bottom: 10px; color: var(--text-muted);"><i class="fas fa-brain"></i> Content Score (1-10):</strong>
                                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 20px;">
                                    ${['Relevance', 'Structure', 'Clarity', 'Correctness'].map(k => `
                                        <div style="background: rgba(0,0,0,0.2); padding: 10px; border-radius: 8px; text-align: center;">
                                            <div style="font-size: 0.8em; color: var(--text-muted);">${k}</div>
                                            <div style="font-size: 1.2em; font-weight: bold; color: ${getScoreColor(nlpData[k])};">${nlpData[k] || '-'}</div>
                                        </div>
                                    `).join('')}
                                </div>
                            ` : ''}

                            ${Object.keys(otherData).length > 0 ? `
                                <strong style="display: block; margin-bottom: 10px; color: var(--text-muted);"><i class="fas fa-video"></i> Delivery & audio:</strong>
                                <div style="display: flex; flex-wrap: wrap; gap: 8px;">
                                    ${Object.entries(otherData).map(([key, value]) => `
                                        <div style="background: rgba(255,255,255,0.1); padding: 6px 12px; border-radius: 20px; font-size: 0.85em;">
                                            <span style="opacity: 0.7;">${key}:</span> <strong>${typeof value === 'object' ? JSON.stringify(value) : value}</strong>
                                        </div>
                                    `).join('')}
                                </div>
                            ` : ''}
                        </div>
                    </div>
                </div>
            `}).join('')}

            <div style="text-align: center; margin-top: 40px;">
                <button onclick="window.location.href='/dashboard.html'" class="btn btn-primary" style="padding: 12px 30px; font-size: 1.1em; cursor:pointer;">
                    <i class="fas fa-arrow-left"></i> Return to Dashboard
                </button>
            </div>
        </div>
    `;
}

function getScoreColor(score) {
    if (!score) return 'var(--text-color)';
    if (score >= 8) return 'var(--success)'; // Green
    if (score >= 5) return '#f59e0b'; // Orange
    return 'var(--error)'; // Red
}

// --- Eye Tracking Page Logic ---
async function initEyeTracking() {
    checkAuth(false); // Public-ish but usually from dashboard

    preview = $('#preview');
    startBtn = $('#startBtn');
    stopBtn = $('#stopBtn');

    // Simple Start Logic for just tracking (no recording/AI interview)
    startBtn.onclick = async () => {
        try {
            stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
            preview.srcObject = stream;

            startBtn.style.display = 'none';
            stopBtn.style.display = 'inline-block';

            startGazeMonitoring();
        } catch (err) {
            showAlert("Camera access denied.", 'error');
            console.error(err);
        }
    };

    stopBtn.onclick = () => {
        if (stream) {
            stream.getTracks().forEach(track => track.stop());
            stream = null;
        }
        if (gazeInterval) clearInterval(gazeInterval);

        startBtn.style.display = 'inline-block';
        stopBtn.style.display = 'none';
        $('#gazeWarning').style.display = 'none';
    };
}

// Event Listeners Initialization
document.addEventListener('DOMContentLoaded', () => {
    const path = window.location.pathname;

    if (path.includes('dashboard')) {
        checkAuth(true); // Protected
        loadProfile();
        loadSessions();
        $('#logoutBtn').addEventListener('click', logout);
        if ($('#profileForm')) $('#profileForm').addEventListener('submit', updateProfile);
    } else if (path.includes('interview')) {
        // Init handled by inline script or could be here
    } else if (path.includes('eye-tracking')) {
        initEyeTracking();
    } else {
        checkAuth(false); // Public
        if ($('#loginForm')) $('#loginForm').addEventListener('submit', login);
        if ($('#registerForm')) $('#registerForm').addEventListener('submit', register);
    }
});
