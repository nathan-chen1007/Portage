"""ElevenLabs text-to-speech.

eleven_multilingual_v2 speaks every language in our data (en, de, ja, ko, es, zh) in the same voice,
so a founder's cloned voice sounds like them in Japanese or German. apply_text_normalization="on"
makes it read numbers and units naturally ("500 g" -> "five hundred grams").
"""

import os

import httpx

API = "https://api.elevenlabs.io/v1"
MODEL_ID = os.getenv("ELEVENLABS_MODEL_ID", "eleven_multilingual_v2")
# "George", a stock ElevenLabs voice. Set ELEVENLABS_VOICE_ID to the founder's cloned voice.
DEFAULT_VOICE_ID = "JBFqnCBsd6RMkjVDRZzb"


class VoiceUnavailable(RuntimeError):
    pass


def _key() -> str:
    key = os.getenv("ELEVENLABS_API_KEY")
    if not key:
        raise VoiceUnavailable("ELEVENLABS_API_KEY is not set in backend/.env")
    return key


def is_configured() -> bool:
    return bool(os.getenv("ELEVENLABS_API_KEY"))


def synthesize(text: str) -> bytes:
    """Return MP3 bytes for the text in the configured voice."""
    voice_id = os.getenv("ELEVENLABS_VOICE_ID") or DEFAULT_VOICE_ID
    body = {
        "text": text,
        "model_id": MODEL_ID,
        "apply_text_normalization": "on",
        "voice_settings": {"stability": 0.5, "similarity_boost": 0.8},
    }
    r = httpx.post(
        f"{API}/text-to-speech/{voice_id}",
        params={"output_format": "mp3_44100_128"},
        headers={"xi-api-key": _key(), "accept": "audio/mpeg"},
        json=body,
        timeout=60,
    )
    if r.status_code != 200:
        raise VoiceUnavailable(f"ElevenLabs error {r.status_code}: {r.text[:300]}")
    return r.content


def list_voices() -> list[dict]:
    r = httpx.get(f"{API}/voices", headers={"xi-api-key": _key()}, timeout=30)
    r.raise_for_status()
    return [{"voice_id": v["voice_id"], "name": v["name"], "category": v.get("category", "")}
            for v in r.json().get("voices", [])]
