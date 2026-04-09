from typing import List, Dict, Any
import statistics

TREND_WINDOW = 7          # rolling window for averages
LOW_AVG_THRESHOLD = 4.0   # avg mood below this triggers alert
DECLINE_MIN_STEPS = 3     # consecutive declining entries to trigger


def check_trend(entries: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Heuristic mood trend analysis.

    Returns a rich dict with:
      - triggered / reason  (alert system)
      - avg_mood, recent_moods
      - rolling_avg         (rolling TREND_WINDOW average per entry)
      - momentum            ('rising' | 'falling' | 'stable')
      - velocity            (avg change per step over recent window)
      - volatility          (std-dev of recent moods; how erratic)
      - best_mood / worst_mood  (all-time)
      - positive_streak     (consecutive positive-label entries from latest)
      - negative_streak     (consecutive negative-label entries from latest)
      - impression          (human-readable summary string)
    """
    all_moods = [e["mood"] for e in entries if "mood" in e]

    if len(all_moods) < 1:
        return _no_trigger(entries)

    # ── Rolling average (one value per entry) ──────────────────────────────────
    rolling_avg = []
    for i in range(len(all_moods)):
        window = all_moods[max(0, i - TREND_WINDOW + 1): i + 1]
        rolling_avg.append(round(sum(window) / len(window), 2))

    recent_moods = all_moods[-TREND_WINDOW:]
    avg = round(sum(recent_moods) / len(recent_moods), 2)

    # ── Momentum: compare last half vs first half of recent window ─────────────
    momentum = "stable"
    if len(recent_moods) >= 4:
        mid = len(recent_moods) // 2
        first_half = sum(recent_moods[:mid]) / mid
        second_half = sum(recent_moods[mid:]) / (len(recent_moods) - mid)
        diff = second_half - first_half
        if diff > 0.4:
            momentum = "rising"
        elif diff < -0.4:
            momentum = "falling"

    # ── Velocity: average step-change over recent window ──────────────────────
    velocity = 0.0
    if len(recent_moods) >= 2:
        changes = [recent_moods[i] - recent_moods[i-1] for i in range(1, len(recent_moods))]
        velocity = round(sum(changes) / len(changes), 3)

    # ── Volatility: std-dev of recent moods ────────────────────────────────────
    volatility = 0.0
    if len(recent_moods) >= 2:
        volatility = round(statistics.stdev(recent_moods), 3)

    # ── All-time best / worst ───────────────────────────────────────────────────
    best_mood  = round(max(all_moods), 1)
    worst_mood = round(min(all_moods), 1)

    # ── Positive / negative streaks from the most recent entry ─────────────────
    labels = [e.get("label", "neutral") for e in entries]
    positive_streak = 0
    negative_streak = 0
    for lbl in reversed(labels):
        if lbl == "positive":
            positive_streak += 1
        else:
            break
    for lbl in reversed(labels):
        if lbl == "negative":
            negative_streak += 1
        else:
            break

    # ── Human-readable impression ───────────────────────────────────────────────
    if avg >= 7.0 and momentum == "rising":
        impression = "You're on a great upswing! 🌟"
    elif avg >= 7.0:
        impression = "Your mood is healthy and stable. 😊"
    elif avg >= 5.0 and momentum == "rising":
        impression = "Things are looking up — keep going. 💪"
    elif avg >= 5.0 and momentum == "falling":
        impression = "Your mood has dipped recently — be gentle with yourself. 💙"
    elif avg >= 5.0:
        impression = "You're doing okay. Small steps count. ✨"
    elif avg < 4.0:
        impression = "Your mood has been low lately. Consider reaching out for support. 💙"
    else:
        impression = "Hang in there — you're tracking and that matters. 🤍"

    # ── Alert triggers ──────────────────────────────────────────────────────────
    triggered = False
    reason = None

    if avg < LOW_AVG_THRESHOLD:
        triggered = True
        reason = f"Average mood is {avg}/10 over the last {len(recent_moods)} entries."
    elif len(recent_moods) >= DECLINE_MIN_STEPS:
        declining_streak = 1
        for i in range(len(recent_moods) - 1, 0, -1):
            if recent_moods[i] < recent_moods[i - 1]:
                declining_streak += 1
            else:
                break
        if declining_streak >= DECLINE_MIN_STEPS:
            triggered = True
            reason = f"Mood has declined consistently for {declining_streak} entries."

    return {
        # Alert system (unchanged contract)
        "triggered":       triggered,
        "reason":          reason,
        "avg_mood":        avg,
        "recent_moods":    recent_moods,
        # Rich heuristics (new)
        "rolling_avg":     rolling_avg,
        "momentum":        momentum,
        "velocity":        velocity,
        "volatility":      volatility,
        "best_mood":       best_mood,
        "worst_mood":      worst_mood,
        "positive_streak": positive_streak,
        "negative_streak": negative_streak,
        "impression":      impression,
        "total_entries":   len(all_moods),
    }


def _no_trigger(entries):
    moods = [e["mood"] for e in entries if "mood" in e]
    return {
        "triggered": False,
        "reason": None,
        "avg_mood": round(sum(moods) / len(moods), 2) if moods else None,
        "recent_moods": moods,
        "rolling_avg": [round(m, 2) for m in moods],
        "momentum": "stable",
        "velocity": 0.0,
        "volatility": 0.0,
        "best_mood": round(max(moods), 1) if moods else None,
        "worst_mood": round(min(moods), 1) if moods else None,
        "positive_streak": 0,
        "negative_streak": 0,
        "impression": "Start journaling to see your mood insights. ✨",
        "total_entries": len(moods),
    }


# Quick test
if __name__ == "__main__":
    test_entries = [
        {"mood": 7.0, "label": "positive"},
        {"mood": 6.2, "label": "positive"},
        {"mood": 5.1, "label": "neutral"},
        {"mood": 4.3, "label": "neutral"},
        {"mood": 3.5, "label": "negative"},
    ]
    import json
    print("Declining trend test:")
    print(json.dumps(check_trend(test_entries), indent=2))

    healthy = [
        {"mood": 5.0, "label": "neutral"},
        {"mood": 6.5, "label": "positive"},
        {"mood": 7.2, "label": "positive"},
        {"mood": 8.0, "label": "positive"},
    ]
    print("\nRising trend test:")
    print(json.dumps(check_trend(healthy), indent=2))
