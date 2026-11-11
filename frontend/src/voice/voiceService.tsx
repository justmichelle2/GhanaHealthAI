/**
 * Voice session management for Ghana Health Assistant.
 *
 * A single React context holds one Moonshine Voice provider instance and the
 * voice session state (listening, speaking, transcription, voice mode,
 * auto-speak, language support) so every voice component reads from the same
 * source of truth. Preferences persist in localStorage only.
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { MoonshineVoiceProvider } from './moonshineProvider'
import type { LanguageSupport, SpeechProvider, TranscriptionUpdate, VoiceActionResult, VoiceError, VoicePreferences, VoiceState } from './voiceTypes'

const PREFS_KEY = 'gha-voice-preferences'
const DEFAULT_PREFS: VoicePreferences = { voiceMode: false, autoSpeak: false, sttLanguage: 'en', ttsLanguage: 'en' }

export function loadVoicePreferences(): VoicePreferences {
  try {
    const raw = localStorage.getItem(PREFS_KEY)
    if (!raw) return { ...DEFAULT_PREFS }
    const parsed = JSON.parse(raw) as Partial<VoicePreferences>
    return {
      voiceMode: typeof parsed.voiceMode === 'boolean' ? parsed.voiceMode : DEFAULT_PREFS.voiceMode,
      autoSpeak: typeof parsed.autoSpeak === 'boolean' ? parsed.autoSpeak : DEFAULT_PREFS.autoSpeak,
      sttLanguage: typeof parsed.sttLanguage === 'string' ? parsed.sttLanguage : DEFAULT_PREFS.sttLanguage,
      ttsLanguage: typeof parsed.ttsLanguage === 'string' ? parsed.ttsLanguage : DEFAULT_PREFS.ttsLanguage,
    }
  } catch {
    return { ...DEFAULT_PREFS }
  }
}

export function saveVoicePreferences(prefs: VoicePreferences): void {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs))
  } catch {
    // localStorage may be unavailable in private mode; preferences won't persist.
  }
}

interface VoiceContextValue {
  state: VoiceState
  provider: SpeechProvider
  startSTT: (onFinal: (text: string) => void) => Promise<VoiceActionResult>
  stopSTT: () => Promise<void>
  speak: (text: string) => Promise<VoiceActionResult>
  stopSpeech: () => void
  toggleVoiceMode: () => void
  toggleAutoSpeak: () => void
  setSttLanguage: (language: string) => void
  setTtsLanguage: (language: string) => void
}

const VoiceContext = createContext<VoiceContextValue | null>(null)

/**
 * Provides voice session state and actions to the voice UI. Render once at the
 * top of the app (in App.tsx).
 */
export function VoiceProvider({ children, language }: { children: React.ReactNode; language: string }) {
  const prefs = loadVoicePreferences()
  const [state, setState] = useState<VoiceState>(() => ({
    voiceMode: prefs.voiceMode,
    autoSpeak: prefs.autoSpeak,
    sttLanguage: prefs.sttLanguage,
    ttsLanguage: prefs.ttsLanguage,
    language,
    listening: false,
    speaking: false,
    transcription: '',
    lastSpokenText: '',
    voiceSupported: false,
    supportReason: null,
    error: null,
  }))

  const providerRef = useRef<SpeechProvider | null>(null)
  if (!providerRef.current) {
    providerRef.current = new MoonshineVoiceProvider()
  }
  const p = providerRef.current

  const setError = useCallback((error: VoiceError | null) => {
    setState((current) => ({ ...current, error }))
  }, [])

  const setListening = useCallback((listening: boolean) => {
    setState((current) => ({ ...current, listening }))
  }, [])

  const setSpeaking = useCallback((speaking: boolean) => {
    setState((current) => ({ ...current, speaking }))
  }, [])

  const setTranscription = useCallback((text: string) => {
    setState((current) => ({ ...current, transcription: text }))
  }, [])

  const evaluateSupport = useCallback(() => {
    const sttSupport = p.sttSupported(state.sttLanguage)
    setState((current) => ({
      ...current,
      voiceSupported: sttSupport.supported,
      supportReason: sttSupport.supported ? null : sttSupport.reason ?? null,
    }))
  }, [p, state.sttLanguage])

  // Stop in-flight audio on unmount.
  useEffect(() => {
    return () => {
      void p.stopSTT()
      p.stopSpeech()
    }
  }, [p])

  // Re-evaluate support whenever the STT language changes.
  useEffect(() => {
    evaluateSupport()
  }, [language, state.sttLanguage, evaluateSupport])

  const startSTT = useCallback(
    async (onFinal: (text: string) => void): Promise<VoiceActionResult> => {
      if (!p.sttSupported(state.sttLanguage).supported) {
        const err: VoiceError = {
          message: `Voice recognition is not available for ${state.sttLanguage.toUpperCase()}.`,
          kind: 'unsupported',
          retryable: false,
        }
        setError(err)
        return { ok: false, error: err }
      }

      setListening(true)
      setError(null)
      setTranscription('')

      try {
        await p.startSTT({
          language: state.sttLanguage,
          onText: (update) => setTranscription(update.text),
          onLine: (text) => {
            setTranscription('')
            onFinal(text)
          },
          onError: (err) => {
            setListening(false)
            setError(err)
          },
        })
        return { ok: true, error: null }
      } catch (reason) {
        setListening(false)
        const err: VoiceError = {
          message: reason instanceof Error ? reason.message : 'Failed to start voice recognition.',
          kind: isPermissionError(reason) ? 'permission' : 'recognition',
          retryable: isPermissionError(reason),
        }
        setError(err)
        return { ok: false, error: err }
      }
    },
    [p, state.sttLanguage, setError, setListening, setTranscription],
  )

  const stopSTT = useCallback(async (): Promise<void> => {
    setListening(false)
    await p.stopSTT()
  }, [p, setListening])

  const speak = useCallback(
    async (text: string): Promise<VoiceActionResult> => {
      if (!text || !text.trim()) return { ok: true, error: null }
      if (!p.ttsSupported(state.ttsLanguage).supported) {
        const err: VoiceError = {
          message: `Voice playback is not available for ${state.ttsLanguage.toUpperCase()}.`,
          kind: 'unsupported',
          retryable: false,
        }
        setError(err)
        return { ok: false, error: err }
      }

      setSpeaking(true)
      setError(null)
      setState((current) => ({ ...current, lastSpokenText: text }))
      try {
        await p.speak(text)
        return { ok: true, error: null }
      } catch (reason) {
        const err: VoiceError = {
          message: reason instanceof Error ? reason.message : 'Failed to speak the response.',
          kind: 'synthesis',
          retryable: true,
        }
        setError(err)
        return { ok: false, error: err }
      } finally {
        setSpeaking(false)
      }
    },
    [p, state.ttsLanguage, setError, setSpeaking],
  )

  const stopSpeech = useCallback((): void => {
    p.stopSpeech()
    setSpeaking(false);
  }, [p, setSpeaking])

  const toggleVoiceMode = useCallback((): void => {
    setState((current) => {
      const next = { ...current, voiceMode: !current.voiceMode }
      saveVoicePreferences({ voiceMode: next.voiceMode, autoSpeak: current.autoSpeak, sttLanguage: current.sttLanguage, ttsLanguage: current.ttsLanguage })
      return next
    })
  }, [])

  const toggleAutoSpeak = useCallback((): void => {
    setState((current) => {
      const next = { ...current, autoSpeak: !current.autoSpeak }
      saveVoicePreferences({ voiceMode: current.voiceMode, autoSpeak: next.autoSpeak, sttLanguage: current.sttLanguage, ttsLanguage: current.ttsLanguage })
      return next
    })
  }, [])

  const setSttLanguage = useCallback((language: string): void => {
    setState((current) => {
      const next = { ...current, sttLanguage: language }
      saveVoicePreferences({ voiceMode: current.voiceMode, autoSpeak: current.autoSpeak, sttLanguage: language, ttsLanguage: current.ttsLanguage })
      return next
    })
  }, [])

  const setTtsLanguage = useCallback((language: string): void => {
    setState((current) => {
      const next = { ...current, ttsLanguage: language }
      saveVoicePreferences({ voiceMode: current.voiceMode, autoSpeak: current.autoSpeak, sttLanguage: current.sttLanguage, ttsLanguage: language })
      return next
    })
  }, [])

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
      setSttLanguage,
      setTtsLanguage,
    }),
    [state, p, startSTT, stopSTT, speak, stopSpeech, toggleVoiceMode, toggleAutoSpeak, setSttLanguage, setTtsLanguage],
  );

  return (
    <VoiceContext.Provider value={value}>{children}</VoiceContext.Provider>
  );
}

/**
 * Hook to consume voice session state and actions. Must be used within VoiceProvider.
 */
export function useVoice(): VoiceContextValue {
  const ctx = useContext(VoiceContext)
  if (!ctx) {
    throw new Error('useVoice must be used within a VoiceProvider.')
  }
  return ctx;
}

function isPermissionError(reason: unknown): boolean {
  const message = reason instanceof Error ? reason.message : String(reason)
  return /notallowed|permission|denied|microphone|notreadable/i.test(message);
}

export type { SpeechProvider, LanguageSupport, TranscriptionUpdate, VoiceError, VoicePreferences, VoiceState, VoiceActionResult }
