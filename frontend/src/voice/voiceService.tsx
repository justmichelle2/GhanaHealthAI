/**
 * Voice session management for Ghana Health Assistant.
 *
 * A single React context holds one Moonshine Voice provider instance and the
 * voice session state (listening, speaking, transcription, voice mode,
 * auto-speak, language support) so every voice component reads from the same
 * source of truth. Preferences persist in localStorage only.
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { MoonshineVoiceProvider } from './moonshineProvider';
import type {
  LanguageSupport,
  SpeechProvider,
  TranscriptionUpdate,
  VoiceActionResult,
  VoiceError,
  VoicePreferences,
  VoiceState,
} from './types';

const CAPABILITIES_URL = '/api/voice/capabilities';
const PREFS_KEY = 'gha-voice-preferences';
const DEFAULT_PREFS: VoicePreferences = { voiceMode: false, autoSpeak: false };

export function loadVoicePreferences(): VoicePreferences {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (!raw) return { ...DEFAULT_PREFS };
    const parsed = JSON.parse(raw) as Partial<VoicePreferences>;
    return {
      voiceMode: typeof parsed.voiceMode === 'boolean' ? parsed.voiceMode : DEFAULT_PREFS.voiceMode,
      autoSpeak: typeof parsed.autoSpeak === 'boolean' ? parsed.autoSpeak : DEFAULT_PREFS.autoSpeak,
    };
  } catch {
    return { ...DEFAULT_PREFS };
  }
}

export function saveVoicePreferences(prefs: VoicePreferences): void {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  } catch {
    // localStorage may be unavailable in private mode; preferences won't persist.
  }
}

async function fetchCapabilities(): Promise<{ stt: string[]; tts: string[] } | null> {
  try {
    const response = await fetch(CAPABILITIES_URL, { credentials: 'include' });
    if (!response.ok) return null;
    const body = (await response.json()) as {
      stt?: { supported_languages?: string[] };
      tts?: { supported_languages?: string[] };
    };
    return {
      stt: body.stt?.supported_languages ?? [],
      tts: body.tts?.supported_languages ?? [],
    };
  } catch {
    return null;
  }
}

interface VoiceContextValue {
  state: VoiceState;
  provider: SpeechProvider;
  startSTT: (onFinal: (text: string) => void) => Promise<VoiceActionResult>;
  stopSTT: () => Promise<void>;
  speak: (text: string) => Promise<VoiceActionResult>;
  stopSpeech: () => void;
  toggleVoiceMode: () => void;
  toggleAutoSpeak: () => void;
  replayLast: () => void;
}

const VoiceContext = createContext<VoiceContextValue | null>(null);

/**
 * Provides voice session state and actions to the voice UI. Render once at the
 * top of the app (for example in App.tsx) with the patient's current language.
 */
export function VoiceProvider({ children, language }: { children: React.ReactNode; language: string }) {
  const prefs = loadVoicePreferences();
  const [state, setState] = useState<VoiceState>(() => ({
    voiceMode: prefs.voiceMode,
    autoSpeak: prefs.autoSpeak,
    language,
    listening: false,
    speaking: false,
    transcription: '',
    lastSpokenText: '',
    voiceSupported: false,
    supportReason: null,
    error: null,
  }));

  const providerRef = useRef<SpeechProvider | null>(null);
  if (!providerRef.current) {
    providerRef.current = new MoonshineVoiceProvider();
  }
  const p = providerRef.current;

  const setError = useCallback((error: VoiceError | null) => {
    setState((current) => ({ ...current, error }));
  }, []);

  const setListening = useCallback((listening: boolean) => {
    setState((current) => ({ ...current, listening }));
  }, []);

  const setSpeaking = useCallback((speaking: boolean) => {
    setState((current) => ({ ...current, speaking }));
  }, []);

  const setTranscription = useCallback((text: string) => {
    setState((current) => ({ ...current, transcription: text }));
  }, []);

  const evaluateSupport = useCallback(() => {
    const sttSupport = p.sttSupported(state.language);
    setState((current) => ({
      ...current,
      voiceSupported: sttSupport.supported,
      supportReason: sttSupport.supported ? null : sttSupport.reason ?? null,
    }));
  }, [p, state.language]);

  // Initialize: fetch metadata, then evaluate support for the current language.
  useEffect(() => {
    let active = true;
    async function init() {
      await fetchCapabilities();
      if (active) evaluateSupport();
    }
    void init();
    return () => { active = false; };
  }, [evaluateSupport]);

  // Re-evaluate support whenever the language changes.
  useEffect(() => {
    setState((current) => ({ ...current, language }));
    evaluateSupport();
  }, [language, evaluateSupport]);

  // Stop in-flight audio on unmount.
  useEffect(() => {
    return () => {
      void p.stopSTT();
      p.stopSpeech();
    };
  }, [p]);

  const startSTT = useCallback(
    async (onFinal: (text: string) => void): Promise<VoiceActionResult> => {
      if (!p.sttSupported(state.language).supported) {
        const err: VoiceError = {
          message: `Voice recognition is not available for ${state.language}.`,
          kind: 'unsupported',
          retryable: false,
        };
        setError(err);
        return { ok: false, error: err };
      }

      setListening(true);
      setError(null);
      setTranscription('');

      try {
        await p.startSTT({
          language: state.language,
          onText: (update) => setTranscription(update.text),
          onLine: (text) => {
            setTranscription('');
            onFinal(text);
          },
          onError: (err) => {
            setListening(false);
            setError(err);
          },
        });
        return { ok: true, error: null };
      } catch (reason) {
        setListening(false);
        const err: VoiceError = {
          message: reason instanceof Error ? reason.message : 'Failed to start voice recognition.',
          kind: isPermissionError(reason) ? 'permission' : 'recognition',
          retryable: isPermissionError(reason),
        };
        setError(err);
        return { ok: false, error: err };
      }
    },
    [p, state.language, setError, setListening, setTranscription],
  );

  const stopSTT = useCallback(async (): Promise<void> => {
    setListening(false);
    await p.stopSTT();
  }, [p, setListening]);

  const speak = useCallback(
    async (text: string): Promise<VoiceActionResult> => {
      if (!text || !text.trim()) return { ok: true, error: null };
      if (!p.ttsSupported(state.language).supported) {
        const err: VoiceError = {
          message: `Voice playback is not available for ${state.language}.`,
          kind: 'unsupported',
          retryable: false,
        };
        setError(err);
        return { ok: false, error: err };
      }

      setSpeaking(true);
      setError(null);
      setState((current) => ({ ...current, lastSpokenText: text }));
      try {
        await p.speak(text);
        return { ok: true, error: null };
      } catch (reason) {
        const err: VoiceError = {
          message: reason instanceof Error ? reason.message : 'Failed to speak the response.',
          kind: 'synthesis',
          retryable: true,
        };
        setError(err);
        return { ok: false, error: err };
      } finally {
        setSpeaking(false);
      }
    },
    [p, state.language, setError, setSpeaking],
  );

  const stopSpeech = useCallback((): void => {
    p.stopSpeech();
    setSpeaking(false);
  }, [p, setSpeaking]);

  const replayLast = useCallback((): void => {
    if (state.lastSpokenText) {
      void speak(state.lastSpokenText);
    }
  }, [state.lastSpokenText, speak]);

  const toggleVoiceMode = useCallback((): void => {
    setState((current) => {
      const next = { ...current, voiceMode: !current.voiceMode };
      saveVoicePreferences({ voiceMode: next.voiceMode, autoSpeak: current.autoSpeak });
      return next;
    });
  }, []);

  const toggleAutoSpeak = useCallback((): void => {
    setState((current) => {
      const next = { ...current, autoSpeak: !current.autoSpeak };
      saveVoicePreferences({ voiceMode: current.voiceMode, autoSpeak: next.autoSpeak });
      return next;
    });
  }, []);

  const value = useMemo<VoiceContextValue>(
    () => ({
      state,
      provider: p,
      startSTT,
      stopSTT,
      speak,
      stopSpeech,
      toggleVoiceMode,
      toggleAutoSpeak,
      replayLast,
    }),
    [state, p, startSTT, stopSTT, speak, stopSpeech, toggleVoiceMode, toggleAutoSpeak, replayLast],
  );

  return (
    <VoiceContext.Provider value={value}>{children}</VoiceContext.Provider>
  );
}

/**
 * Hook to consume voice session state and actions. Must be used within
 * VoiceProvider.
 */
export function useVoice(): VoiceContextValue {
  const ctx = useContext(VoiceContext);
  if (!ctx) {
    throw new Error('useVoice must be used within a VoiceProvider.');
  }
  return ctx;
}

function isPermissionError(reason: unknown): boolean {
  const message = reason instanceof Error ? reason.message : String(reason);
  return /notallowed|permission|denied|microphone|notreadable/i.test(message);
}

export type { SpeechProvider, LanguageSupport, TranscriptionUpdate, VoiceError, VoicePreferences, VoiceState, VoiceActionResult };
