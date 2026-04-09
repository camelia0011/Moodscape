# MoodScape 

An intelligent student wellness platform that combines mood journaling, real-time sentiment analysis, and AI-driven support to help users understand, manage, and improve their emotional well-being. Featuring personalized insights MoodScape transforms everyday reflections into meaningful mental health support.
## Live Demo
https://moodscape-seven.vercel.app/

## Architecture

```
moodtracker/
├── backend/          ← Single Python Flask server (port 5000)
│   ├── app.py        ← All routes: auth + journal + NLP + TTS
│   ├── nlp.py        ← VADER sentiment analysis
│   ├── trend.py      ← Mood trend detection
│   ├── chatbot.py    ← Gemini AI support messages
│   ├── tts.py        ← ElevenLabs text-to-speech
│   ├── requirements.txt
│   └── .env          ← All secrets go here
└── frontend/         ← React + Vite (port 5173)
    └── src/
        ├── App.jsx             ← Routes + PrivateRoute guard
        └── components/
            ├── api.js          ← apiRequest + authFetch + authFetchBlob
            ├── Login.jsx
            ├── Register.jsx
            ├── Forgot.jsx      ← Two-step OTP password reset
            └── Dashboard.jsx   ← Journal + chart + TTS playback
```

## Prerequisites

- Python 3.11+
- Node.js 18+
- PostgreSQL running locally

## Database Setup

```sql
-- Run once in psql
CREATE DATABASE moodtracker;
-- Tables (users, journal_entries) are auto-created when Flask starts
```

If migrating from the old `jwt_auth` database, update `DATABASE_URL` in `backend/.env`.

## Backend Setup

```bash
cd backend
cp .env.example .env      # if .env doesn't exist yet
# Fill in your keys (see .env section below)

pip install -r requirements.txt
python app.py
# → 🚀 Starting MoodTracker unified backend on http://localhost:5000
# → ✅ Database tables ready.
```

## Frontend Setup

```bash
cd frontend
npm install
npm run dev
# → http://localhost:5173
```

## Environment Variables (`backend/.env`)

| Variable | Description |
|---|---|
| `PORT` | Flask port (default 5000) |
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_SECRET` | Secret key for signing tokens |
| `JWT_EXPIRES_IN_SECONDS` | Token lifetime (default 3600 = 1h) |
| `EMAIL` | Gmail address for OTP emails |
| `EMAIL_PASS` | Gmail App Password (not your login password) |
| `GEMINI_API_KEY` | Google Gemini API key for support messages |
| `ELEVENLABS_API_KEY` | ElevenLabs key for TTS (optional) |

> **Gmail App Password:** Go to Google Account → Security → 2-Step Verification → App passwords

## API Reference

### Auth (no token required)
| Method | Route | Body |
|---|---|---|
| POST | `/api/auth/register` | `{username, email, password}` |
| POST | `/api/auth/login` | `{username, password}` → returns `{token}` |
| POST | `/api/auth/forgot-password` | `{email}` |
| POST | `/api/auth/reset-password` | `{email, otp, newPassword}` |

### Protected (requires `Authorization: Bearer <token>`)
| Method | Route | Description |
|---|---|---|
| POST | `/api/journal` | Submit journal entry, get mood + trend + AI alert |
| GET | `/api/history` | Fetch all entries for logged-in user |
| POST | `/api/speak` | TTS — body `{text}`, returns MP3 stream |
| POST | `/api/clear` | Dev: wipe all entries for logged-in user |
| GET | `/health` | Health check |
