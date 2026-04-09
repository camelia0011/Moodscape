import os
import re
from vaderSentiment.vaderSentiment import SentimentIntensityAnalyzer

# Optional: Gemini for high-precision nuance/sarcasm detection
try:
    import google.generativeai as genai
except ImportError:
    genai = None

analyzer = SentimentIntensityAnalyzer()

# Words/phrases common in positive mood journaling that VADER underweights
_POSITIVE_CONTEXT_WORDS = {
    "grateful", "gratitude", "thankful", "blessed", "proud", "accomplished",
    "healing", "improving", "better", "hopeful", "motivated", "inspired",
    "peaceful", "calm", "content", "happy", "joyful", "excited", "thrilled",
    "relieved", "supported", "connected", "loved", "appreciated", "growing",
    "progress", "milestone", "achieved", "managed", "overcame", "recovered",
    "smile", "laugh", "strength", "courage", "brave", "resilient", "optimistic",
    "enjoying", "savoring", "cherishing", "refreshed", "energized", "uplifted",
}

def _context_boost(text: str) -> float:
    """Returns a small positive boost (0.0–0.15) for positive-context words."""
    words = set(re.findall(r"[a-z']+", text.lower()))
    matches = words & _POSITIVE_CONTEXT_WORDS
    return min(len(matches) * 0.03, 0.15)

def get_mood_score(text: str) -> dict:
    """Analyzes sentiment with VADER + context boosting."""
    if not text or not text.strip():
        return {"compound": 0.0, "mood": 5.0, "label": "neutral", "engine": "vader"}

    # --- NUANCE CHECK (Optional Gemini Integration) ---
    # If the text is short or likely sarcastic/slang-heavy, VADER fails.
    # For the hackathon, we show "Hybrid Analysis" transparency.
    
    gemini_key = os.getenv("GEMINI_API_KEY")
    if gemini_key and genai:
        try:
            genai.configure(api_key=gemini_key)
            model = genai.GenerativeModel("gemini-1.5-flash")
            prompt = (
                f"Analyze the sentiment of this journal entry: \"{text}\"\n"
                "Return JSON ONLY: {\"mood\": float(1.0-10.0), \"label\": \"positive\"|\"negative\"|\"neutral\", \"reason\": \"short explanation of nuance/sarcasm if detected\"}"
            )
            response = model.generate_content(prompt)
            import json
            # Cleanup common LLM formatting junk
            clean_text = response.text.strip().replace("```json", "").replace("```", "")
            data = json.loads(clean_text)
            return {
                "compound": (data["mood"] - 5.0) / 5.0,
                "mood": data["mood"],
                "label": data["label"],
                "reason": data.get("reason", "Analyzed with neural nuance detection"),
                "engine": "gemini-hybrid"
            }
        except Exception as e:
            print(f"Gemini mood analysis failed: {e}")

    # Fallback to VADER
    scores = analyzer.polarity_scores(text)
    raw_compound = scores["compound"]
    boost = _context_boost(text)
    compound = round(max(-1.0, min(1.0, raw_compound + boost)), 4)

    if compound >= 0:
        mood = round(5.0 + compound * 5.0, 1)
    else:
        mood = round(5.0 + compound * 4.0, 1)
    mood = max(1.0, min(10.0, mood))

    if compound >= 0.05:
        label = "positive"
    elif compound <= -0.15:
        label = "negative"
    else:
        label = "neutral"

    return {
        "compound": compound,
        "mood": mood,
        "label": label,
        "engine": "vader-heuristic",
        "boost_applied": round(boost, 4),
    }

def apply_contextual_score(raw_mood: float, raw_label: str, recent_entries: list) -> dict:
    """Adjusts mood score based on historical trajectory."""
    if not recent_entries:
        return {"mood": raw_mood, "label": raw_label, "context_adjustment": 0.0}

    recent_moods  = [e["mood"]  for e in recent_entries if "mood"  in e]
    recent_labels = [e["label"] for e in recent_entries if "label" in e]

    if not recent_moods:
        return {"mood": raw_mood, "label": raw_label, "context_adjustment": 0.0}

    # 1. Trajectory drag (25% weight)
    window = recent_moods[-5:]
    recent_avg = sum(window) / len(window)
    trajectory_drag = (recent_avg - raw_mood) * 0.25

    # 2. Streak compounding
    streak_adjustment = 0.0
    if len(recent_labels) >= 1:
        current_is_neg = raw_label == "negative"
        current_is_pos = raw_label == "positive"
        
        neg_streak = 0
        for lbl in reversed(recent_labels):
            if lbl == "negative": neg_streak += 1
            else: break

        pos_streak = 0
        for lbl in reversed(recent_labels):
            if lbl == "positive": pos_streak += 1
            else: break

        if current_is_neg and neg_streak >= 1:
            streak_adjustment = -min(neg_streak * 0.35, 1.8)
        elif current_is_pos and pos_streak >= 1:
            streak_adjustment = min(pos_streak * 0.20, 1.0)

    # 3. Reversion resistance
    reversion_res = 0.0
    if len(window) >= 3:
        if recent_avg < 4.5 and raw_mood > 6.5:
            reversion_res = -(raw_mood - recent_avg) * 0.15
        elif recent_avg > 7.0 and raw_mood < 4.5:
            reversion_res = (recent_avg - raw_mood) * 0.10

    total_adj = trajectory_drag + streak_adjustment + reversion_res
    adjusted_mood = round(max(1.0, min(10.0, raw_mood + total_adj)), 1)

    if adjusted_mood >= 6.0: adjusted_label = "positive"
    elif adjusted_mood <= 3.5: adjusted_label = "negative"
    else: adjusted_label = "neutral"

    return {
        "mood": adjusted_mood,
        "label": adjusted_label,
        "context_adjustment": round(total_adj, 3),
        "raw_mood": raw_mood,
        "raw_label": raw_label,
    }
