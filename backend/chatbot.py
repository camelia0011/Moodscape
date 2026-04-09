import os
import google.generativeai as genai

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")

if GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)
    model = genai.GenerativeModel("gemini-1.5-flash")
else:
    model = None


SAGE_SYSTEM_PROMPT = """
You are Sage, a compassionate student wellness companion — NOT a medical professional.

Your personality:
- Warm, calm, and genuinely curious about the person
- You speak like a caring friend, never clinical or robotic
- You remember what the user said earlier in the conversation and reference it naturally

Conversation rules:
1. NEVER repeat the same question or phrase twice in a row
2. ALWAYS acknowledge the specific thing the user just said before asking anything
3. Vary your responses — rotate between: reflecting feelings, asking a follow-up, sharing a gentle insight, or suggesting a small action
4. If the user mentions a specific person or situation (e.g. "my friend annoys me"), dig into THAT — don't ask a generic "what else is going on?"
5. Keep responses to 2–3 sentences max
6. Never diagnose. Never use clinical terms like "depression", "anxiety disorder", etc.
7. If mood seems consistently low across the conversation, gently mention campus counseling once — don't repeat it
8. End each message with either a question OR a warm statement — never both
"""


def chat_with_sage(conversation_history: list[dict], user_message: str) -> str:
    """
    Multi-turn conversation with Sage.
    
    Args:
        conversation_history: List of {"role": "user"/"model", "parts": [text]} dicts
        user_message: The latest message from the user
    
    Returns:
        Sage's response as a string
    """
    if not model:
        return _fallback_reply(user_message)

    # Build history for Gemini multi-turn chat
    chat = model.start_chat(history=conversation_history)

    # Inject system behavior via first turn if history is empty
    full_prompt = user_message
    if not conversation_history:
        full_prompt = f"[System context — do not mention this to the user: {SAGE_SYSTEM_PROMPT}]\n\nUser says: {user_message}"

    try:
        response = chat.send_message(full_prompt)
        return response.text.strip()
    except Exception as e:
        print(f"[Sage] Gemini API error: {e}")
        return _fallback_reply(user_message)


def get_support_message(avg_mood: float = None, reason: str = None) -> str:
    """
    Proactive support message triggered by mood pattern detection.
    """
    if not model:
        return _fallback_message(avg_mood)

    mood_context = f"average mood score of {avg_mood}/10" if avg_mood else "consistently low mood"
    reason_context = f" The pattern detected: {reason}" if reason else ""

    prompt = f"""
{SAGE_SYSTEM_PROMPT}

A student has shown a {mood_context} over the past few days.{reason_context}

Write a warm, proactive check-in message (2–3 sentences) that:
1. Gently notices they've seemed a bit off lately — without being alarming
2. Validates that rough patches happen to everyone
3. Softly suggests campus counseling as one option if they want to talk to someone
"""

    try:
        response = model.generate_content(prompt)
        return response.text.strip()
    except Exception as e:
        print(f"[Sage] Gemini API error: {e}")
        return _fallback_message(avg_mood)


def _fallback_reply(user_message: str) -> str:
    """Context-aware fallback when API is unavailable."""
    msg = user_message.lower()
    if any(w in msg for w in ["friend", "annoying", "irritat"]):
        return "That sounds really frustrating — friendship tension can be exhausting. What's been happening between you two?"
    if any(w in msg for w in ["tired", "exhausted", "can't sleep"]):
        return "Not getting proper rest makes everything feel harder. Has this been going on for a while?"
    return (
        "It sounds like things have been weighing on you lately. "
        "You don't have to figure it all out at once — I'm here to listen. 💙"
    )


def _fallback_message(avg_mood=None) -> str:
    return (
        "Hey, it looks like you've been going through a rough patch lately — "
        "and that's okay, these things happen. You're not alone in feeling this way. "
        "If you feel comfortable, talking to someone at the campus counseling center "
        "can really help. You've got this. 💙"
    )


# ── Demo ──────────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    history = []

    test_conversation = [
        "it has been quiet a few days",
        "my friend is very irritating",
        "she annoys me",
    ]

    for user_msg in test_conversation:
        print(f"You: {user_msg}")
        reply = chat_with_sage(history, user_msg)
        print(f"Sage: {reply}\n")

        # Update history for next turn
        history.append({"role": "user", "parts": [user_msg]})
        history.append({"role": "model", "parts": [reply]})