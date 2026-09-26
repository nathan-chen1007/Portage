"""Check the ElevenLabs key, list voices, and write test MP3s.  Run from backend/:  python scripts/smoke_elevenlabs.py"""
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from dotenv import load_dotenv

load_dotenv()

from app.services import voice  # noqa: E402

print("Voices on this account (cloned ones show category 'cloned'):")
for v in voice.list_voices()[:20]:
    print(f"  {v['voice_id']}  {v['name']}  ({v['category']})")
print("\nUsing voice:", os.getenv("ELEVENLABS_VOICE_ID") or f"{voice.DEFAULT_VOICE_ID} (stock George; set ELEVENLABS_VOICE_ID)")

out = Path(__file__).resolve().parent / "out"
out.mkdir(exist_ok=True)
samples = {
    "en": "Hello! We're a family beekeeping farm from Alberta, and we'd love to send you a sample of our clover honey.",
    "ja": "こんにちは。カナダ・アルバータ州の家族経営の養蜂場です。ぜひクローバーはちみつのサンプルをお送りしたいと思います。",
    "de": "Guten Tag! Wir sind ein Imkereibetrieb aus Alberta in Kanada und würden Ihnen gern eine Probe unseres Kleehonigs schicken.",
}
for lang, text in samples.items():
    path = out / f"test_{lang}.mp3"
    path.write_bytes(voice.synthesize(text))
    print("wrote", path)
print("\nOK: ElevenLabs works. Play the files in scripts/out/ to hear the voice.")
