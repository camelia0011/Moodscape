"""
MoodTracker - Unified Flask Backend
=====================================
Merges:
  - Node.js JWT auth (register, login, forgot/reset password via OTP)
  - Flask NLP/mood journal (VADER, trend detection, Gemini chatbot, ElevenLabs TTS)

All protected routes require:  Authorization: Bearer <token>
"""

import io
import os
import smtplib
import random
import time
from email.mime.text import MIMEText
from functools import wraps
from datetime import datetime, timezone

import psycopg2
import psycopg2.extras
import bcrypt
import jwt
from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
from dotenv import load_dotenv

from nlp import get_mood_score, apply_contextual_score
from trend import check_trend
from chatbot import get_support_message
from tts import text_to_speech_bytes

load_dotenv()

app = Flask(__name__)
CORS(app)

# ─── Config ────────────────────────────────────────────────────────────────────
JWT_SECRET     = os.getenv("JWT_SECRET", "supersecret")
JWT_EXPIRES_IN = int(os.getenv("JWT_EXPIRES_IN_SECONDS", 3600))   # default 1h
DATABASE_URL   = os.getenv("DATABASE_URL")
EMAIL_USER     = os.getenv("EMAIL")
EMAIL_PASS     = os.getenv("EMAIL_PASS")
EMAIL_HOST     = os.getenv("EMAIL_HOST", "smtp.gmail.com")
EMAIL_PORT     = int(os.getenv("EMAIL_PORT", 587))

# ─── DB helpers ────────────────────────────────────────────────────────────────

def get_db():
    """Return a new psycopg2 connection (call inside a request)."""
    return psycopg2.connect(DATABASE_URL, cursor_factory=psycopg2.extras.RealDictCursor)


def init_db():
    """Create tables if they don't exist yet."""
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                CREATE TABLE IF NOT EXISTS users (
                    id         SERIAL PRIMARY KEY,
                    username   VARCHAR(100) UNIQUE NOT NULL,
                    email      VARCHAR(200) UNIQUE NOT NULL,
                    password   TEXT NOT NULL,
                    otp        VARCHAR(10),
                    otp_expiry BIGINT
                );
            """)
            cur.execute("""
                CREATE TABLE IF NOT EXISTS journal_entries (
                    id         SERIAL PRIMARY KEY,
                    user_id    INTEGER REFERENCES users(id) ON DELETE CASCADE,
                    text       TEXT NOT NULL,
                    mood       REAL,
                    compound   REAL,
                    label      VARCHAR(20),
                    created_at TIMESTAMPTZ DEFAULT NOW()
                );
            """)
            cur.execute("""
                CREATE TABLE IF NOT EXISTS community_comments (
                    id SERIAL PRIMARY KEY,
                    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                    text TEXT NOT NULL,
                    sentiment_label VARCHAR(20),
                    likes INTEGER DEFAULT 0,
                    created_at TIMESTAMPTZ DEFAULT NOW()
                );
            """)
        conn.commit()
    print("✅ Database tables ready.")


# ─── JWT helpers ───────────────────────────────────────────────────────────────

def create_token(user_id: int) -> str:
    payload = {
        "id":  user_id,
        "iat": int(time.time()),
        "exp": int(time.time()) + JWT_EXPIRES_IN,
    }
    return jwt.encode(payload, JWT_SECRET, algorithm="HS256")


def require_auth(f):
    """Decorator — validates Bearer JWT and injects request.user_id."""
    @wraps(f)
    def wrapper(*args, **kwargs):
        auth_header = request.headers.get("Authorization", "")
        parts = auth_header.split(" ")
        if len(parts) != 2 or parts[0].lower() != "bearer":
            return jsonify({"msg": "No token provided"}), 401
        try:
            decoded = jwt.decode(parts[1], JWT_SECRET, algorithms=["HS256"])
            request.user_id = decoded["id"]
        except jwt.ExpiredSignatureError:
            return jsonify({"msg": "Token expired"}), 401
        except jwt.InvalidTokenError:
            return jsonify({"msg": "Invalid token"}), 401
        return f(*args, **kwargs)
    return wrapper


# ─── Email helper ──────────────────────────────────────────────────────────────

def send_otp_email(to_email: str, otp: str):
    msg = MIMEText(f"Your MoodTracker password reset OTP is: {otp}\n\nExpires in 5 minutes.")
    msg["Subject"] = "MoodTracker — Password Reset OTP"
    msg["From"]    = EMAIL_USER
    msg["To"]      = to_email

    with smtplib.SMTP(EMAIL_HOST, EMAIL_PORT) as server:
        server.starttls()
        server.login(EMAIL_USER, EMAIL_PASS)
        server.sendmail(EMAIL_USER, [to_email], msg.as_string())


# ═══════════════════════════════════════════════════════════════════════════════
# AUTH ROUTES  (previously Node.js)
# ═══════════════════════════════════════════════════════════════════════════════

@app.route("/api/auth/register", methods=["POST"])
def register():
    data     = request.get_json(force=True)
    username = (data.get("username") or "").strip()
    email    = (data.get("email") or "").strip()
    password = data.get("password", "")

    if not username or not email or not password:
        return jsonify({"msg": "All fields required"}), 400

    hashed = bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()

    try:
        with get_db() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "INSERT INTO users(username, email, password) VALUES(%s,%s,%s)",
                    (username, email, hashed)
                )
            conn.commit()
        return jsonify({"msg": "✅ Registered successfully"})
    except psycopg2.errors.UniqueViolation:
        return jsonify({"msg": "Username or email already exists"}), 400
    except Exception as e:
        print("❌ Register error:", e)
        return jsonify({"msg": "Registration failed"}), 500


@app.route("/api/auth/login", methods=["POST"])
def login():
    data     = request.get_json(force=True)
    username = (data.get("username") or "").strip()
    password = data.get("password", "")

    try:
        with get_db() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT * FROM users WHERE username=%s", (username,))
                user = cur.fetchone()

        if not user:
            return jsonify({"msg": "User not found"}), 400

        if not bcrypt.checkpw(password.encode(), user["password"].encode()):
            return jsonify({"msg": "Invalid credentials"}), 400

        token = create_token(user["id"])
        return jsonify({"token": token, "msg": "✅ Login successful"})
    except Exception as e:
        print("❌ Login error:", e)
        return jsonify({"msg": "Server error"}), 500


@app.route("/api/auth/forgot-password", methods=["POST"])
def forgot_password():
    data  = request.get_json(force=True)
    email = (data.get("email") or "").strip()

    try:
        with get_db() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT id FROM users WHERE email=%s", (email,))
                user = cur.fetchone()

            if not user:
                return jsonify({"msg": "Email not found"}), 400

            otp    = str(random.randint(100000, 999999))
            expiry = int(time.time() * 1000) + 5 * 60 * 1000  # 5 min in ms

            with conn.cursor() as cur:
                cur.execute(
                    "UPDATE users SET otp=%s, otp_expiry=%s WHERE email=%s",
                    (otp, expiry, email)
                )
            conn.commit()

        send_otp_email(email, otp)
        return jsonify({"msg": "✅ OTP sent to email"})
    except Exception as e:
        print("❌ Forgot password error:", e)
        return jsonify({"msg": "Failed to send OTP"}), 500


@app.route("/api/auth/reset-password", methods=["POST"])
def reset_password():
    data        = request.get_json(force=True)
    email       = (data.get("email") or "").strip()
    otp         = (data.get("otp") or "").strip()
    new_password = data.get("newPassword", "")

    try:
        with get_db() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT * FROM users WHERE email=%s", (email,))
                user = cur.fetchone()

            if not user:
                return jsonify({"msg": "User not found"}), 400

            if user["otp"] != otp or (user["otp_expiry"] or 0) < int(time.time() * 1000):
                return jsonify({"msg": "Invalid or expired OTP"}), 400

            hashed = bcrypt.hashpw(new_password.encode(), bcrypt.gensalt()).decode()
            with conn.cursor() as cur:
                cur.execute(
                    "UPDATE users SET password=%s, otp=NULL, otp_expiry=NULL WHERE email=%s",
                    (hashed, email)
                )
            conn.commit()

        return jsonify({"msg": "✅ Password reset successful"})
    except Exception as e:
        print("❌ Reset error:", e)
        return jsonify({"msg": "Reset failed"}), 500


# ═══════════════════════════════════════════════════════════════════════════════
# MOOD / JOURNAL ROUTES  (previously Flask backend) — now JWT-protected
# ═══════════════════════════════════════════════════════════════════════════════

@app.route("/api/journal", methods=["POST"])
@require_auth
def journal():
    """
    Submit a journal entry. Runs NLP with contextual scoring, stores in DB,
    checks trend.

    Body: { "text": "..." }
    Returns contextually-adjusted mood score, trend analysis, optional AI alert.

    Contextual scoring: back-to-back negative entries compound downward;
    the score is not purely keyword-based but shaped by recent history.
    """
    data = request.get_json(force=True)
    text = data.get("text", "").strip()
    user_id = request.user_id

    if not text:
        return jsonify({"error": "No text provided."}), 400

    # Step 1: raw VADER analysis
    mood_result = get_mood_score(text)

    try:
        with get_db() as conn:
            with conn.cursor() as cur:
                # Step 2: fetch PRIOR entries to compute context BEFORE inserting
                cur.execute(
                    "SELECT mood, label FROM journal_entries "
                    "WHERE user_id=%s ORDER BY created_at DESC LIMIT 10",
                    (user_id,)
                )
                prior_rows = cur.fetchall()
                # Reverse so they're oldest→newest for the contextual model
                prior_entries = list(reversed([dict(r) for r in prior_rows]))

                # Step 3: apply contextual sequential scoring
                ctx = apply_contextual_score(
                    raw_mood=mood_result["mood"],
                    raw_label=mood_result["label"],
                    recent_entries=prior_entries,
                )

                # Step 4: save the ADJUSTED score to the DB
                cur.execute(
                    """INSERT INTO journal_entries(user_id, text, mood, compound, label)
                       VALUES(%s, %s, %s, %s, %s)""",
                    (user_id, text, ctx["mood"], mood_result["compound"], ctx["label"])
                )

                # Step 5: fetch all entries (including the new one) for trend
                cur.execute(
                    "SELECT mood, compound, label, text FROM journal_entries "
                    "WHERE user_id=%s ORDER BY created_at",
                    (user_id,)
                )
                entries = [dict(r) for r in cur.fetchall()]
            conn.commit()
    except Exception as e:
        print("❌ Journal DB error:", e)
        return jsonify({"error": "Database error"}), 500

    trend = check_trend(entries)

    alert = None
    if trend["triggered"]:
        alert = get_support_message(avg_mood=trend["avg_mood"], reason=trend["reason"])

    return jsonify({
        "mood":               ctx["mood"],
        "label":              ctx["label"],
        "compound":           mood_result["compound"],
        "raw_mood":           mood_result["mood"],
        "raw_label":          mood_result["label"],
        "context_adjustment": ctx.get("context_adjustment", 0.0),
        "context_note":       ctx.get("context_note", ""),
        "entry_count":        len(entries),
        "trend":              trend,
        "alert":              alert,
    })


@app.route("/api/history", methods=["GET"])
@require_auth
def history():
    """Return all journal entries for the authenticated user."""
    user_id = request.user_id

    try:
        with get_db() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT text, mood, compound, label, created_at FROM journal_entries "
                    "WHERE user_id=%s ORDER BY created_at",
                    (user_id,)
                )
                entries = [dict(r) for r in cur.fetchall()]
    except Exception as e:
        print("❌ History DB error:", e)
        return jsonify({"error": "Database error"}), 500

    return jsonify({
        "user_id":     user_id,
        "entry_count": len(entries),
        "entries":     entries,
    })


@app.route("/api/speak", methods=["POST"])
@require_auth
def speak():
    """Convert text to speech using ElevenLabs. Returns MP3 audio stream."""
    data = request.get_json(force=True)
    text = data.get("text", "").strip()

    if not text:
        return jsonify({"error": "No text provided."}), 400

    audio_bytes = text_to_speech_bytes(text)

    if audio_bytes is None:
        return jsonify({"error": "TTS not configured. Set ELEVENLABS_API_KEY."}), 503

    return send_file(
        io.BytesIO(audio_bytes),
        mimetype="audio/mpeg",
        as_attachment=False,
        download_name="response.mp3",
    )


@app.route("/api/clear", methods=["POST"])
@require_auth
def clear():
    """Dev helper — wipes all journal entries for the authenticated user."""
    user_id = request.user_id
    try:
        with get_db() as conn:
            with conn.cursor() as cur:
                cur.execute("DELETE FROM journal_entries WHERE user_id=%s", (user_id,))
            conn.commit()
    except Exception as e:
        print("❌ Clear error:", e)
        return jsonify({"error": "Database error"}), 500
    return jsonify({"status": "cleared", "user_id": user_id})


@app.route("/api/community", methods=["GET"])
@require_auth
def get_community_posts():
    try:
        with get_db() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT c.id, c.text, c.likes, c.created_at "
                    "FROM community_comments c "
                    "WHERE c.sentiment_label != 'negative' "
                    "ORDER BY c.created_at DESC LIMIT 50"
                )
                posts = [dict(r) for r in cur.fetchall()]
        return jsonify(posts)
    except Exception as e:
        print("❌ Get community error:", e)
        return jsonify({"error": "Database error"}), 500

@app.route("/api/community", methods=["POST"])
@require_auth
def add_community_post():
    data = request.get_json(force=True)
    text = data.get("text", "").strip()
    user_id = request.user_id

    if not text:
        return jsonify({"error": "No text provided"}), 400

    result = get_mood_score(text)
    sentiment_label = result["label"]
    compound = result["compound"]

    # Relaxed but safe moderation logic:
    # We encourage reflection. If a post is technically 'negative' by NLP standards,
    # we give the user a chance to rephrase it as a 'growth' or 'support-seeking' message.
    if sentiment_label == "negative" or compound < 0.05:
        return jsonify({
            "error": "Community space is for uplifting or support-seeking messages. ",
            "suggestion": "It sounds like you're going through something. Try sharing what might help you today, or a small win you're proud of, so the community can support you better! 💙"
        }), 400

    try:
        with get_db() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "INSERT INTO community_comments(user_id, text, sentiment_label) "
                    "VALUES(%s, %s, %s) RETURNING id",
                    (user_id, text, sentiment_label)
                )
                post_id = cur.fetchone()["id"]
            conn.commit()
        return jsonify({"id": post_id, "msg": "Post added successfully"}), 201
    except Exception as e:
        print("❌ Add community error:", e)
        return jsonify({"error": "Database error"}), 500


@app.route("/api/community/<int:post_id>/like", methods=["POST"])
@require_auth
def like_community_post(post_id):
    try:
        with get_db() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "UPDATE community_comments SET likes = likes + 1 WHERE id = %s RETURNING likes",
                    (post_id,)
                )
                res = cur.fetchone()
            conn.commit()
        if res:
            return jsonify({"likes": res["likes"]})
        return jsonify({"error": "Post not found"}), 404
    except Exception as e:
        print("❌ Like community error:", e)
        return jsonify({"error": "Database error"}), 500

# ─── Coping Chatbot endpoint ───────────────────────────────────────────────────



CHAT_SYSTEM_INSTRUCTION = """You are Sage, a warm and emotionally intelligent companion inside a mental wellness app called MoodScape.

You have real conversations — not scripted therapy sessions. Think of yourself as a caring, thoughtful friend who genuinely listens and responds to what the person actually says.

HOW TO BEHAVE:
- Respond to what the person ACTUALLY said. If they say "I'm tired", don't say "Here are 3 tips for exhaustion." Ask them about it — "Tired like physically drained, or more like mentally worn out?"
- Match the energy. If they're casual, be casual. If they're hurting, be tender.
- Ask ONE follow-up question at a time. Don't overwhelm.
- Validate feelings before offering anything. "That sounds really hard" before "have you tried..."
- Use natural conversational language. Contractions, short sentences, even a little humour when appropriate.
- You can share perspective gently: "A lot of people feel that way when..." but never prescribe.
- If someone seems in real distress (suicidal thoughts, crisis), compassionately encourage them to reach out to a counsellor or crisis line. Don't panic — just care.

WHEN THEY ASK FOR SOLUTIONS OR "HOW" QUESTIONS:
- If someone asks "how do I..." or "what should I do about..." or "any tips for..." or "can you suggest...", GIVE THEM a real, practical answer.
- Offer 2-3 concrete, actionable suggestions in a conversational tone — not a numbered list, just weave them naturally.
- For example: "One thing that helps a lot of people is... You could also try... And honestly, sometimes just... can make a real difference."
- Be specific and practical. Don't just say "talk to someone" — suggest what to say, when to do it, how to start.
- If they ask how to handle a specific situation (conflict, stress, sleep, motivation, etc.), give thoughtful, tailored advice.
- Always pair advice with warmth. "Here's what I'd try..." not "You should do X."

WHAT YOU ARE NOT:
- Not a therapist. Don't diagnose. Don't over-analyze.
- Not clinical. No jargon.

Keep responses short — 2-4 sentences usually. Longer only if you're answering a "how" question or giving suggestions they asked for."""


@app.route("/api/chat", methods=["POST"])
@require_auth
def coping_chat():
    """
    Multi-turn conversational chatbot powered by Gemini's native chat session.
    Body: { "messages": [{"role": "user"|"assistant", "text": "..."}] }
    Returns: { "reply": "..." }
    """
    data = request.get_json(force=True)
    messages = data.get("messages", [])

    # Filter to actual user/assistant turns (skip the initial bot greeting)
    conversation = [m for m in messages if m.get("text", "").strip()]

    if not conversation:
        return jsonify({"reply": "Hey, I'm here. What's on your mind?"}), 200

    GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")

    if not GEMINI_API_KEY or GEMINI_API_KEY.startswith("your_"):
        # Smart rule-based fallback when no API key is configured
        return jsonify({"reply": _smart_fallback(conversation)}), 200

    try:
        import google.generativeai as genai

        genai.configure(api_key=GEMINI_API_KEY)

        # Use system_instruction for a truly shaped personality
        chat_model = genai.GenerativeModel(
            model_name="gemini-1.5-flash",
            system_instruction=CHAT_SYSTEM_INSTRUCTION,
        )

        # Build proper Gemini chat history (all turns except the last user message)
        history = []
        for m in conversation[:-1]:
            role = "user" if m.get("role") == "user" else "model"
            history.append({"role": role, "parts": [m.get("text", "")]})

        # Start a chat session with the history
        chat = chat_model.start_chat(history=history)

        # Send the latest user message
        last_msg = conversation[-1].get("text", "")
        response = chat.send_message(last_msg)

        reply = response.text.strip()
        return jsonify({"reply": reply})

    except Exception as e:
        print(f"❌ Coping chat error: {e}")
        return jsonify({"reply": _smart_fallback(conversation)}), 200


def _smart_fallback(conversation: list) -> str:
    """
    Rule-based conversational fallback when Gemini is unavailable.
    Gives a different response based on what the user last said.
    Handles solution-seeking and "how" questions with practical advice.
    """
    import random
    last_text = conversation[-1].get("text", "").lower() if conversation else ""

    # Detect "how" questions and solution-seeking
    if any(w in last_text for w in ["how do i", "how can i", "how to", "what should i", "any tips", "suggest", "advice", "help me with", "what can i do"]):
        if any(w in last_text for w in ["sleep", "insomnia", "can't sleep", "sleeping"]):
            return random.choice([
                "For better sleep, try putting your phone away 30 minutes before bed and doing something calming like reading or stretching. A cool, dark room helps a lot too. If your mind races, try writing down tomorrow's worries on paper so your brain can let go of them.",
                "One thing that really helps is keeping a consistent bedtime — even on weekends. You could also try the 4-7-8 breathing technique: breathe in for 4 seconds, hold for 7, out for 8. It activates your body's relaxation response.",
            ])
        elif any(w in last_text for w in ["stress", "stressed", "overwhelm", "pressure"]):
            return random.choice([
                "When stress piles up, try breaking things into tiny steps — just the very next thing you need to do, nothing else. Taking a short walk outside helps reset your nervous system. And honestly, even 5 minutes of slow breathing can bring your stress levels way down.",
                "Start by writing down everything stressing you out — getting it out of your head helps. Then pick the ONE thing that matters most today and focus just on that. Give yourself permission to let the rest wait.",
            ])
        elif any(w in last_text for w in ["anxious", "anxiety", "worried", "panic", "nervous"]):
            return random.choice([
                "For anxiety, grounding techniques work really well. Try the 5-4-3-2-1 method: notice 5 things you can see, 4 you can touch, 3 you can hear, 2 you can smell, 1 you can taste. It pulls your mind back to the present moment.",
                "When anxiety hits, try splashing cold water on your face or holding ice cubes — it activates your dive reflex and calms your nervous system fast. Then take slow breaths, making your exhale longer than your inhale.",
            ])
        elif any(w in last_text for w in ["motivat", "productive", "procrastinat", "lazy", "stuck"]):
            return random.choice([
                "The trick with motivation is to start ridiculously small — tell yourself you'll just do 2 minutes of the task. Once you start, momentum usually kicks in. Also, try removing distractions before you begin — put your phone in another room.",
                "Try pairing something you need to do with something you enjoy — like listening to your favorite playlist while working. And break big tasks into the smallest possible steps so nothing feels overwhelming.",
            ])
        elif any(w in last_text for w in ["focus", "concentrate", "distract"]):
            return random.choice([
                "For better focus, try working in 25-minute blocks with 5-minute breaks — it's called the Pomodoro Technique. Also, having just one tab or task visible at a time reduces mental clutter.",
                "Try putting your phone on Do Not Disturb in another room, and set a specific intention before starting — like 'I'm going to write one paragraph.' Having a clear, tiny goal helps your brain lock in.",
            ])
        elif any(w in last_text for w in ["sad", "depressed", "down", "low", "unhappy"]):
            return random.choice([
                "When you're feeling low, gentle movement helps a lot — even a 10-minute walk outside. Reaching out to one person, even just texting 'hey,' can break the isolation cycle. And try to do one small thing that used to bring you joy, even if you don't feel like it.",
                "Something that helps is changing your physical state — take a warm shower, step outside for fresh air, or put on music that matches your mood first, then gradually shift to something uplifting. Small shifts add up.",
            ])
        elif any(w in last_text for w in ["friend", "social", "people", "relationship", "conflict", "argument", "fight"]):
            return random.choice([
                "With relationship conflicts, try using 'I feel' statements instead of 'you always' — it keeps things from getting defensive. Something like 'I feel hurt when...' opens up real conversation. Give each other space to cool down first if things are heated.",
                "The best approach is usually to listen first before responding. Try repeating back what you heard them say — 'So you're feeling...' — before sharing your side. It makes people feel heard and lowers the temperature.",
            ])
        else:
            return random.choice([
                "That's a great question. One thing that often helps is starting with the smallest possible step — just tiny progress builds momentum. You could also try writing it out to get clear on what you actually need.",
                "Here's what I'd suggest: take a step back and break the problem into pieces. Focus on just one piece at a time. And don't be afraid to ask someone you trust for their perspective — sometimes a fresh pair of eyes makes all the difference.",
            ])

    # Detect common emotional keywords and respond contextually
    if any(w in last_text for w in ["sad", "depressed", "hopeless", "awful", "terrible", "hate"]):
        return random.choice([
            "That sounds really heavy. Want to tell me more about what's been going on?",
            "I hear you — that sounds genuinely tough. How long have you been feeling this way?",
            "That must be exhausting to carry. What's been the hardest part?",
        ])
    elif any(w in last_text for w in ["anxious", "worried", "scared", "nervous", "panic", "stress"]):
        return random.choice([
            "Anxiety can be so overwhelming. Is there something specific weighing on you, or is it more of a general feeling?",
            "That unsettled feeling is so uncomfortable. What's been going through your head?",
            "Feeling on edge like that takes a lot out of you. Want to talk through what's triggering it?",
        ])
    elif any(w in last_text for w in ["tired", "exhausted", "drained", "burnout", "no energy"]):
        return random.choice([
            "Tired like physically worn out, or more like mentally drained — or both?",
            "That kind of exhaustion runs deep. Are you getting any time to rest for real?",
            "Burnout hits differently than just being sleepy. How long has it been building up?",
        ])
    elif any(w in last_text for w in ["happy", "good", "great", "better", "amazing", "grateful"]):
        return random.choice([
            "That's genuinely good to hear. What's been going well?",
            "Glad things are looking up! What shifted for you?",
            "That's lovely — hold onto that feeling. What made today different?",
        ])
    elif any(w in last_text for w in ["lonely", "alone", "isolated", "no one", "nobody"]):
        return random.choice([
            "Feeling that disconnected is one of the hardest feelings. Is this something new, or has it been building?",
            "Loneliness hits different when you're surrounded by people but still feel unseen. Does that resonate?",
            "You're not alone right now, even if it feels that way. What's been making you feel disconnected?",
        ])
    elif "?" in last_text:
        return random.choice([
            "That's a thoughtful question. I'm still learning — but I'm curious what made you think of that.",
            "Hmm, I want to sit with that for a second. Tell me more about why you're asking.",
        ])
    else:
        return random.choice([
            "Tell me more — I'm listening.",
            "I want to understand better. What else is going on?",
            "Yeah, I hear you. How's that been sitting with you?",
            "Thanks for sharing that. How are you feeling about it right now?",
        ])




# ─── Health check ──────────────────────────────────────────────────────────────

@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok", "message": "MoodTracker unified backend running."})


@app.route("/api/sentiment", methods=["POST"])
@require_auth
def sentiment():
    """Classifies sentiment of text using VADER without saving to DB."""
    data = request.get_json(force=True)
    text = data.get("text", "").strip()
    if not text:
        return jsonify({"sentiment": "NEUTRAL", "reason": "No text provided"}), 400
    
    result = get_mood_score(text)
    sentiment_map = {"positive": "POSITIVE", "negative": "NEGATIVE", "neutral": "NEUTRAL"}
    sentiment_label = sentiment_map.get(result["label"], "NEUTRAL")
    return jsonify({"sentiment": sentiment_label, "reason": "Evaluated by NLP system"})


# ─── Startup ───────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    init_db()
    port = int(os.getenv("PORT", 5000))
    print(f"🚀 Starting MoodTracker unified backend on http://localhost:{port}")
    app.run(debug=True, port=port)


# ═══════════════════════════════════════════════════════════════════════════════
# ENHANCED ROUTES — Emotion Canvas & Gamification
# ═══════════════════════════════════════════════════════════════════════════════

@app.route("/api/emotion-insight", methods=["POST"])
@require_auth
def emotion_insight():
    """
    Receives emotion canvas data and returns AI-generated insight.
    Body: { "emotions": [{"type": "anxiety", "count": 3}, ...] }
    """
    data    = request.get_json(force=True)
    emotions = data.get("emotions", [])

    if not emotions:
        return jsonify({"insight": "Place some emotions on the canvas to receive insights."}), 200

    # Build summary for Gemini
    summary = ", ".join(f"{e['count']}x {e['type']}" for e in emotions)
    prompt  = (
        f"A user's emotion canvas shows: {summary}. "
        "In 1-2 sentences, give a warm, insightful observation about what this emotional "
        "pattern might mean and one gentle suggestion. Be supportive, not clinical."
    )

    try:
        msg = get_support_message(avg_mood=5.0, reason=prompt)
        return jsonify({"insight": msg})
    except Exception as e:
        print("❌ Emotion insight error:", e)
        return jsonify({"insight": "Your emotional landscape tells a rich story. Take a moment to reflect on what feels most prominent."}), 200


@app.route("/api/gamification", methods=["GET"])
@require_auth
def gamification():
    """Return user's XP, streak and achievement data."""
    user_id = request.user_id
    try:
        with get_db() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT COUNT(*) as cnt FROM journal_entries WHERE user_id=%s",
                    (user_id,)
                )
                row = cur.fetchone()
        count = row["cnt"] if row else 0
        xp    = count * 5
        return jsonify({"xp": xp, "entry_count": count})
    except Exception as e:
        print("❌ Gamification error:", e)
        return jsonify({"xp": 0, "entry_count": 0}), 500
