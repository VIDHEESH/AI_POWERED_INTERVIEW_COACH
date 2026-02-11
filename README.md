# 🤖 AI-Powered Interview Coach

An intelligent mock interview platform that helps candidates prepare for technical interviews using real-time AI feedback. This application combines computer vision, speech-to-text, and Generative AI to simulate a real interview environment.

## 🌟 Key Features

- **🎯 Smart Resume Analysis**: Instantly compares your Resume against a Job Description (JD) using TF-IDF algorithms to calculate a match percentage and identify missing keywords.
- **👁️ Eye Contact Monitoring**: Uses computer vision (OpenCV) to track your gaze in real-time and alert you if you are looking away from the camera.
- **😊 Emotion & Confidence Detection**: Analyzes facial expressions to gauge your confidence levels throughout the interview.
- **🗣️ Speech-to-Text Transcription**: Automatically transcribes your spoken answers using OpenAI's Whisper model (running locally).
- **🤖 AI Interviewer**: Generates 5 custom technical questions tailored specifically to your resume and the target role using Google's Gemini AI.
- **📊 Performance Feedback**: Provides detailed feedback on your answers (Relevance, Structure, Clarity) after the session.

## 🛠️ Tech Stack

**Frontend**
- HTML5, CSS3 (Modern Light Theme)
- Vanilla JavaScript
- Chart.js (for analytics)

**Backend (Core)**
- **Node.js**: Main application server.
- **Express.js**: REST API framwork.
- **PostgreSQL**: Database for storing users, sessions, and transcripts.

**AI Microservice**
- **Python (Flask)**: dedicated service for heavy AI processing.
- **OpenCV**: Video processing and gaze tracking.
- **TensorFlow / Keras**: Emotion detection models.
- **Whisper**: Local speech transcription.
- **Google Gemini API**: Generative interview questions.

---

## 🚀 Setup Instructions

### 1. Prerequisites
- **Node.js** (v16+)
- **Python** (v3.10+)
- **PostgreSQL** Database

### 2. Installation

**Clone the repository:**
```bash
git clone https://github.com/VIDHEESH/Projects.git
cd Projects/ML/AI_POWERED_INTERVIEW_COACH
```

**Install Node Dependencies:**
```bash
npm install
```

**Install Python Dependencies:**
```bash
cd python_services
pip install -r requirements.txt
cd ..
```

### 3. Database Configuration
1. Ensure PostgreSQL is running.
2. Create a database named `interview_coach`.
3. Update the `.env` file with your credentials (see below).
4. Run the database setup script:
   ```bash
   node setup_db.js
   ```

### 4. Environment Variables
Create a `.env` file in the root directory (files starting with `.` are hidden by default):
```env
PORT=3000
DATABASE_URL=postgresql://postgres:yourpassword@localhost:5432/interview_coach
JWT_SECRET=supersecretkey_change_this
API_KEY=your_google_gemini_api_key  <-- Put your key here
```

> **Note**: The `API_KEY` is required for generating interview questions. Other features work without it.

---

## ▶️ Running the Application

You need to run both the Python service (for AI) and the Node server (for the App).

**1. Start the Python AI Service:**
Open a terminal:
```bash
python python_services/app.py
```
*It will load the Whisper model (this may take a moment).*

**2. Start the Node.js Server:**
Open a **second** terminal:
```bash
npm run dev
# OR
node index.js
```

**3. Access the App:**
Open your browser and visit: `http://localhost:3000`

---

## 🔒 Privacy & Architecture
- **Locally Processed**: Video analysis, Gaze tracking, and Transcription happen **locally** on your machine. Your video feed is processed in real-time and is not sent to the cloud.
- **Secure**: User data is stored in your local PostgreSQL database.
- **Cloud Usage**: Only the text prompts (for generating questions) are sent to the Gemini API.
