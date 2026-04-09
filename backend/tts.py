import os
from elevenlabs.client import ElevenLabs

ELEVENLABS_API_KEY = os.getenv("ELEVENLABS_API_KEY", "")
VOICE_ID = "JBFqnCBsd6RMkjVDRZzb"   # "George" — calm, warm male voice
MODEL_ID = "eleven_multilingual_v2"

client = ElevenLabs(api_key=ELEVENLABS_API_KEY) if ELEVENLABS_API_KEY else None


def text_to_speech_bytes(text: str) -> bytes | None:
    """
    Converts text to speech using ElevenLabs API.
    Returns raw MP3 bytes, or None if API key is missing.
    """
    if not client:
        print("[tts] ELEVENLABS_API_KEY not set — skipping TTS.")
        return None

    if not text or not text.strip():
        return None

    try:
        audio_generator = client.text_to_speech.convert(
            voice_id=VOICE_ID,
            text=text,
            model_id=MODEL_ID,
            output_format="mp3_44100_128"
        )
        # Generator → bytes
        return b"".join(audio_generator)
    except Exception as e:
        print(f"[tts] ElevenLabs error: {e}")
        return None


# Quick test — saves a sample MP3 locally
if __name__ == "__main__":
    sample = "Hey, it looks like you've been having a tough few days. You're not alone, and it's okay to reach out."
    data = text_to_speech_bytes(sample)
    if data:
        with open("test_output.mp3", "wb") as f:
            f.write(data)
        print("Saved test_output.mp3 — play it to verify.")
    else:
        print("No audio generated (check your API key).")
