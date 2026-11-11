"""Voice capability metadata for the Ghana Health Assistant frontend.

Speech recognition and synthesis run on the patient's device through the
Moonshine Voice WebAssembly binding, so no audio ever leaves the browser and
the backend never touches the patient's microphone. This endpoint only reports
which languages Moonshine actually supports so the frontend can show an honest
language-compatibility indicator and fall back to text input where voice is
unsupported (for example Twi, Ewe, Ga and Hausa, which Moonshine does not yet
cover).
"""

from fastapi import APIRouter

router = APIRouter(prefix="/voice", tags=["voice"])

# Languages Moonshine Voice actually supports, verified against the project
# documentation. Kept here so the frontend does not hard-code model coverage.
SUPPORTED_STT_LANGUAGES = ["en"]
SUPPORTED_TTS_LANGUAGES = ["en"]
DEFAULT_STT_LANGUAGE = "en"
DEFAULT_TTS_LANGUAGE = "en_us"
DEFAULT_TTS_VOICE = "kokoro_af_heart"

# Target product languages that Moonshine does not yet cover. Reported so the
# UI can surface an honest, per-language message instead of pretending English
# recognition is Twi, Ewe, Ga or Hausa recognition.
UNSUPPORTED_TARGET_LANGUAGES = ["tw", "ee", "gaa", "ha"]


@router.get("/capabilities")
def voice_capabilities() -> dict:
    """Report voice capabilities without exposing secrets or model internals."""
    return {
        "voice_enabled": True,
        "stt": {
            "supported_languages": list(SUPPORTED_STT_LANGUAGES),
            "default_language": DEFAULT_STT_LANGUAGE,
            "provider": "moonshine-voice",
            "runs_on_device": True,
        },
        "tts": {
            "supported_languages": list(SUPPORTED_TTS_LANGUAGES),
            "default_language": DEFAULT_TTS_LANGUAGE,
            "default_voice": DEFAULT_TTS_VOICE,
            "provider": "moonshine-voice",
            "runs_on_device": True,
        },
        "unsupported_target_languages": list(UNSUPPORTED_TARGET_LANGUAGES),
        "note": "Voice recognition and playback run in your browser. Twi, Ewe, Ga and Hausa are not yet supported by Moonshine; use text input for those languages.",
    }
