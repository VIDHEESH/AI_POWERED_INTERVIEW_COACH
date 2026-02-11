# 🤖 AI-Powered Interview Coach

An intelligent mock interview platform that helps candidates prepare for technical interviews with **real-time AI feedback**. The system combines Computer Vision, Natural Language Processing, Speech Recognition, and Generative AI to simulate a realistic interview environment — all running primarily on the user's local machine.

---

## 📌 Table of Contents

- [Approach](#-approach)
- [Features Implemented](#-features-implemented)
- [System Architecture](#-system-architecture)
- [Project Structure](#-project-structure)
- [Tech Stack](#-tech-stack)
- [Setup Instructions](#-setup-instructions)
- [Environment Variables](#-environment-variables)
- [Running the Application](#️-running-the-application)
- [Privacy & Security](#-privacy--security)

---

## 🎯 Approach

The project follows a **microservice-based architecture** with two independent servers working together:

1. **Node.js Server (Port 3000)** — Handles user authentication, session management, database operations, serves the frontend, and communicates with Google's Gemini API for question generation.

2. **Python Flask Server (Port 5000)** — Handles all heavy AI/ML processing: video analysis (gaze detection, emotion recognition), audio transcription (Whisper), resume-JD matching (TF-IDF), and audio quality analysis.

### Design Philosophy

| Principle | Implementation |
|---|---|
| **Privacy-First** | Video, audio, and transcription are processed **locally** — nothing is sent to the cloud except text prompts for question generation. |
| **Modular** | Each AI capability (Gaze, Emotion, Transcription, JD Matching) is a separate Python module that can be tested and improved independently. |
| **Real-Time Feedback** | Eye contact warnings, emotion badges, and live transcription update **during** the interview, not just after. |
| **Seamless Flow** | The user flow is linear: Register → Login → Dashboard → Analyze JD/Resume → Start Interview → Review Results. |

### How It Works (User Flow)

```
[Register/Login] → [Dashboard] → [Paste JD + Upload Resume]
        ↓
[TF-IDF Match Score + Missing Keywords]
        ↓
[Proceed to Interview] → [AI generates 5 tailored questions]
        ↓
[Real-time Interview Session]
  • Camera records video per question
  • OpenCV tracks eye contact + emotion
  • Browser Speech API captures answers
  • Whisper transcribes audio locally
        ↓
[Results Dashboard]
  • Per-question transcript
  • NLP scoring (Relevance, Structure, Clarity, Correctness)
  • Video playback with analysis overlay
```

---

## 🌟 Features Implemented

### 1. User Authentication
- Secure **Register** and **Login** system using JWT tokens.
- Passwords hashed with **bcrypt**.
- Protected routes using authentication middleware.

### 2. Resume vs Job Description Matching
- Uses **TF-IDF Vectorization** and **Cosine Similarity** to calculate a percentage match.
- Identifies **missing keywords** from the JD that are absent in the resume.
- Supports both **PDF** and **text** input for resumes.
- Runs entirely locally using Python's `scikit-learn`.

### 3. AI-Powered Question Generation
- Sends JD and Resume context to **Google Gemini API**.
- Generates **5 tailored technical questions** specific to the role and candidate.
- Falls back to default generic questions if the API is unavailable.

### 4. Real-Time Eye Contact Monitoring
- Uses **OpenCV Haar Cascades** for face and eye detection.
- Calculates **face center position** and **head pose** to determine gaze direction.
- Displays a **"LOOK AT CAMERA"** warning overlay when the candidate looks away.
- Configurable thresholds to minimize false positives.

### 5. Emotion & Confidence Detection
- Uses the **FER (Facial Expression Recognition)** library for real-time emotion analysis.
- Displays a floating **emotion badge** (e.g., Happy, Neutral, Sad) on the video feed.
- Emotion data is saved per question for post-interview review.

### 6. Speech-to-Text Transcription
- Uses **OpenAI Whisper** (base model) running **locally** on the user's machine.
- Transcribes each answer after recording stops.
- Full transcript is saved to the database per question.

### 7. NLP Answer Analysis
- Each transcribed answer is scored by **Gemini AI** on four dimensions:
  - **Relevance** (1–10): Did the answer address the question?
  - **Structure** (1–10): Was it logically organized (e.g., STAR method)?
  - **Clarity** (1–10): Was it easy to understand?
  - **Correctness** (1–10): Was it technically accurate?
- Includes a **Key Feedback** summary sentence.

### 8. Per-Question Video Recording
- Records video/audio **per question** (not one long recording).
- Each recording is saved as a `.webm` file linked to the specific question.
- Playback is available on the dashboard with analysis overlay.

### 9. Dashboard & Session History
- Displays all past interview sessions with:
  - Question text, transcript, and video playback.
  - NLP scores visualized with charts.
  - Eye contact and emotion summary.
- **Batch processing**: Can re-analyze all past recordings in one click.

### 10. Audio Quality Analysis
- Analyzes recorded audio for:
  - **Speaking pace** (words per minute).
  - **Filler word detection** (um, uh, like, etc.).
  - **Volume consistency**.

---

## 🏗️ System Architecture

```
┌─────────────────────────────────────────────────┐
│                   BROWSER                       │
│  index.html │ dashboard.html │ interview.html   │
│         public/js/app.js (Frontend Logic)       │
│         public/css/style.css (Styling)          │
└──────────────┬──────────────────────────────────┘
               │ HTTP Requests
               ▼
┌──────────────────────────────┐    ┌──────────────────────────────┐
│   NODE.JS SERVER (:3000)     │    │  PYTHON FLASK SERVER (:5000) │
│                              │    │                              │
│  /auth/* → Authentication    │    │  /compare-jd → TF-IDF Match  │
│  /interview/chat → Gemini AI │    │  /gaze-detect → OpenCV       │
│  /interview/upload → Save    │    │  /transcribe → Whisper       │
│  /interview/sessions → Read  │    │  /analyze-audio → Audio QA   │
│  /interview/compare-jd →  ───┼───→│  /extract-text → PDF Parse   │
│                              │    │                              │
│  Database: PostgreSQL        │    │  Models: Whisper, FER, Haar  │
└──────────────────────────────┘    └──────────────────────────────┘
```

---

## 📂 Project Structure

```
AI_POWERED_INTERVIEW_COACH/
│
├── index.js                    # Main Node.js server entry point
├── db.js                       # PostgreSQL database connection & schema
├── setup_db.js                 # Database initialization script
├── package.json                # Node.js dependencies
├── .env                        # Environment variables (API keys, DB URL)
├── .gitignore                  # Git ignore rules
├── README.md                   # This file
│
├── authentication/             # Auth Module (MVC)
│   ├── route/auth.js           #   Routes: /register, /login
│   ├── model/user.js           #   Database queries for users
│   ├── middleWares/auth.js     #   JWT verification middleware
│   └── validation/validate.js  #   Input validation
│
├── interview/                  # Interview Module (MVC)
│   ├── route/interview.js      #   Routes: /chat, /upload, /sessions, /compare-jd
│   └── model/interview.js      #   Database queries for sessions & questions
│
├── public/                     # Frontend (Served as static files)
│   ├── index.html              #   Login page
│   ├── register.html           #   Registration page
│   ├── dashboard.html          #   User dashboard & session history
│   ├── jd-compare.html         #   JD vs Resume analysis page
│   ├── interview.html          #   Main interview interface
│   ├── eye-tracking.html       #   Standalone eye tracking test page
│   ├── css/style.css           #   Global stylesheet (Light theme)
│   └── js/app.js               #   Core frontend logic (1300+ lines)
│
├── python_services/            # Python AI Microservice
│   ├── app.py                  #   Flask server entry point
│   ├── model_jd.py             #   TF-IDF resume matching logic
│   ├── model_gaze.py           #   Eye contact & gaze detection
│   ├── video_analysis.py       #   Video processing & emotion detection
│   ├── audio_analysis.py       #   Audio quality analysis
│   └── requirements.txt        #   Python dependencies
│
└── uploads/                    # Stored interview recordings (.webm)
```

---

## 🛠️ Tech Stack

| Layer | Technology | Purpose |
|---|---|---|
| **Frontend** | HTML5, CSS3, JavaScript | User interface |
| **Charts** | Chart.js | Score visualization |
| **Backend** | Node.js, Express.js | API server, routing |
| **Database** | PostgreSQL | User data, sessions, transcripts |
| **Auth** | JWT, bcrypt | Secure authentication |
| **AI Chat** | Google Gemini API | Question generation & NLP scoring |
| **AI Server** | Python, Flask | ML model serving |
| **Vision** | OpenCV, Haar Cascades | Face & eye detection |
| **Emotion** | FER (TensorFlow/Keras) | Facial expression recognition |
| **Transcription** | OpenAI Whisper | Local speech-to-text |
| **Text Analysis** | scikit-learn (TF-IDF) | Resume-JD matching |

---

## 🚀 Setup Instructions

### 1. Prerequisites
- **Node.js** (v16+) and npm
- **Python** (v3.10+) and pip
- **PostgreSQL** database server

### 2. Installation

**Clone the repository:**
```bash
git clone https://github.com/VIDHEESH/AI_POWERED_INTERVIEW_COACH.git
cd AI_POWERED_INTERVIEW_COACH
```

**Install Node.js dependencies:**
```bash
npm install
```

**Install Python dependencies:**
```bash
cd python_services
pip install -r requirements.txt
cd ..
```

### 3. Database Setup
1. Ensure PostgreSQL is running.
2. Create a database: `CREATE DATABASE interview_coach;`
3. Configure your `.env` file (see below).
4. Initialize the tables:
   ```bash
   node setup_db.js
   ```

---

## 🔑 Environment Variables

Create a `.env` file in the project root:

```env
PORT=3000
DATABASE_URL=postgresql://postgres:your_password@localhost:5432/interview_coach
JWT_SECRET=your_secret_key
API_KEY=your_google_gemini_api_key
```

| Variable | Required | Description |
|---|---|---|
| `PORT` | Yes | Port for the Node.js server (default: 3000) |
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `JWT_SECRET` | Yes | Secret key for signing JWT tokens |
| `API_KEY` | For AI Chat | Google Gemini API key for question generation |

> **Note**: The `API_KEY` is only needed for generating interview questions and NLP scoring. All other features (JD matching, eye tracking, transcription) work without it.

---

## ▶️ Running the Application

Open **two terminals** side by side:

**Terminal 1 — Start the Python AI Service:**
```bash
python python_services/app.py
```
*Loads Whisper model on startup (may take 30–60 seconds the first time).*

**Terminal 2 — Start the Node.js Server:**
```bash
node index.js
```

**Open your browser:**
```
http://localhost:3000
```

---

## 🔒 Privacy & Security

- **Local Processing**: All video analysis (gaze, emotion), audio transcription (Whisper), and resume matching (TF-IDF) happen **entirely on your machine**. No video or audio data leaves your computer.
- **Minimal Cloud Usage**: Only text-based prompts (JD + Resume text) are sent to the Gemini API for generating questions.
- **Secure Auth**: Passwords are hashed with bcrypt. Sessions use JWT tokens.
- **Data Isolation**: All user data is stored in your local PostgreSQL database.
