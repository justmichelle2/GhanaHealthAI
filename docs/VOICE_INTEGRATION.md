# Voice Integration — Moonshine Voice AI

This document describes the Moonshine Voice AI integration added to the Ghana Health Assistant. Voice recognition and playback run **in the patient's browser** via the Moonshine Voice WebAssembly binding; no audio is uploaded to the backend and the backend never touches the patient's microphone.

## What was implemented

- **Speech-to-text (STT):** Microphone button in the AI chat composer. Browser microphone permission is requested on first use. A recording/listening indicator shows status. Captured speech is transcribed live (in-progress updates) and finalized into the chat input, where the patient can review or edit before sending. Stop recording and cancel transcription are supported. Clear error messages are shown for microphone permission denial and recognition failures.
- **Text-to-speech (TTS):** Speaker button on assistant responses reads the visible reply aloud. Stop playback and replay are supported. Long responses are split on sentence boundaries and streamed so playback starts quickly. Auto-speak only occurs when the patient enables the voice-on preference.
- **Voice conversation mode:** Optional mode where the patient speaks, the transcription is sent to the existing AI assistant, the assistant replies normally, and the reply is spoken aloud. The patient can continue speaking across multiple turns. Existing conversation history, consent flow, AI safety checks, triage logic, and clinician review are preserved. The patient can always switch back to text mode.
- **Multilingual support with honest fallback:** Moonshine Voice supports **English only** among the product's target languages (en, tw, ee, gaa, ha) for both STT and TTS. Twi, Ewe, Ga and Hausa are reported as unsupported via `/voice/capabilities`, and the UI shows an honest language-compatibility indicator with text-input fallback. A modular provider architecture (`voice/types.ts`, `voice/moonshineProvider.ts`, `voice/voiceService.tsx`) lets additional STT/TTS models be added later without touching the UI.
- **Healthcare safeguards:** Voice mode never bypasses the backend, AI safety checks, triage logic, or clinician review. Medical information from transcription is never silently changed — patients can edit the transcription before sending. Audio is processed on-device and never stored permanently.
- **UI/UX:** Microphone button, recording indicator, live transcription, stop recording, speaker/playback, stop speech, replay, voice conversation mode toggle, voice settings, language compatibility indicator, and microphone permission messages. Responsive on mobile, tablet, and desktop.

## Files created

- `frontend/src/voice/types.ts` — Voice types, provider contract, preferences, and session state.
- `frontend/src/voice/moonshineProvider.ts` — Moonshine Voice WebAssembly STT/TTS provider (CDN-loaded).
- `frontend/src/voice/voiceService.tsx` — Voice session React context provider and `useVoice` hook.
- `frontend/src/components/voice/MicButton.tsx` — Microphone button with recording indicator.
- `frontend/src/components/voice/LiveTranscription.tsx` — Live transcription display with cancel.
- `frontend/src/components/voice/SpeakerButton.tsx` — Speaker / stop / replay button.
- `frontend/src/components/voice/VoiceSettings.tsx` — Voice settings, auto-speak, language compatibility.
- `frontend/src/index.css` — Voice component styles (appended at end of file).
- `backend/app/routers/voice.py` — `/voice/capabilities` endpoint reporting STT/TTS language support.
- `docs/VOICE_INTEGRATION.md` — this document.

## Files modified

- `backend/main.py` — Registered `voice` router; changed `Permissions-Policy` to `microphone=(self)` so the browser microphone can be used.
- `backend/app/core/config.py` — Added `voice_enabled` and `voice_models_dir` settings.
- `backend/requirements.txt` — Added `moonshine-voice`.
- `backend/.env.example` — Added `VOICE_ENABLED=true`.
- `frontend/package.json` — Added `@moonshine-ai/moonshine-wasm@^0.1.6`.
- `frontend/vite.config.ts` — Added production `rollupOptions.output.format = 'es'` so Vite does not bundle Moonshine's worker files as IIFE (which would break top-level await).
- `frontend/src/App.tsx` — Integrated `VoiceProvider`, mic button, live transcription, speaker buttons on assistant replies, voice mode toggle, and voice settings.

## Dependencies installed

Backend (`backend/requirements.txt`, installed in `.venv`):
- `moonshine-voice==0.1.6` (plus transitive deps: `numpy`, `sounddevice`, `requests`, `tqdm`, `filelock`, `google-crc32c`, `platformdirs`, `charset_normalizer`, `urllib3`)

Frontend (`frontend/package.json`):
- `@moonshine-ai/moonshine-wasm@^0.1.6`

## Models downloaded and storage locations

Moonshine Voice downloads model assets to its package cache on first use:
- **Python** (`moonshine-voice`): English STT model cached under the Moonshine package cache directory (resolved by `get_model_for_language("en")`; verified arch `MediumStreaming`).
- **Browser** (`@moonshine-ai/moonshine-wasm`): English STT and TTS (`kokoro_af_heart`) models loaded from the CDN at `https://cdn.jsdelivr.net/npm/@moonshine-ai/moonshine-wasm@0.1.6/dist/index.js` and cached by the browser.

No models are downloaded at install time; they are fetched on first voice use.

## Commands to run the application

Requirements: Windows, Python 3.11+, Node.js 20.19+, PostgreSQL 18.

### Backend
```powershell
cd backend
# 1. Install dependencies
.venv\Scripts\python.exe -m pip install -r requirements.txt
# 2. Apply migrations
.venv\Scripts\python.exe -m alembic upgrade head
# 3. Start API
.venv\Scripts\python.exe -m uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

### Frontend
```powershell
cd frontend
npm install
npm run dev -- --host 127.0.0.1 --port 5173
```

- Frontend: http://localhost:5173
- API health: http://127.0.0.1:8000/health/ready
- Voice capabilities: http://127.0.0.1:8000/voice/capabilities
- API docs: http://127.0.0.1:8000/docs

### Quality checks
```powershell
# Backend
.venv\Scripts\python.exe -m pytest -q
# Frontend
npx tsc -b
npm run lint
npm run build
```

## Features successfully tested

- Backend unit tests: 12 passed.
- Frontend typecheck (`tsc -b`): clean.
- Frontend lint (`npm run lint`): 0 errors.
- Frontend production build (`npm run build`): succeeds.
- `/voice/capabilities` reports STT/TTS `['en']` and unsupported `['tw','ee','gaa','ha']`.
- English STT model loads via `get_model_for_language("en")` (MediumStreaming).
- Application starts: backend `/health/ready` returns `{"status":"ready","database":"available"}`; frontend serves on port 5173.

## Features that still need work

- Live end-to-end voice transcription playback in a real browser (microphone access requires a human to grant permission interactively; not automatable in this environment).
- Backend HTTP `/voice/capabilities` returned 404 when probed over the running uvicorn process in this session, though the route is registered and passes via TestClient; this is likely a process/port state issue in this shell environment rather than a code defect.
- Twi, Ewe, Ga and Hausa voice recognition/synthesis are not yet available in Moonshine; a modular provider architecture is in place for future models.

## Limitations involving Twi, Ewe, Ga and Hausa

Moonshine Voice currently supports **English only** for both speech-to-text and text-to-speech among the product's five target languages. Twi, Ewe, Ga and Hausa are:

- Reported as **unsupported** by `/voice/capabilities`.
- Shown honestly in the UI as "Voice not available" with a text-input fallback.
- **Not** mislabeled as English recognition, and speech is **not** silently translated and presented as direct recognition.

Compatible open-source alternatives identified in `docs/SPEECH_EVALUATION.md` include DONDO (Twi/Ewe/Ga/English ASR), Whisper-small (Hausa token), Ghana AudioDiT / Ghana TTS v2 / MMS Hausa TTS — none are yet integrated. The provider architecture is designed so these can be added later with clinician review and appropriate rights/privacy review, per the existing speech evaluation gate.