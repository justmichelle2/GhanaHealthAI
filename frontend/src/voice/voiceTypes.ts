/**
 * Voice interaction types for Ghana Health Assistant.
 *
 * The speech-provider boundary is provider-neutral so additional STT/TTS
 * models (for example Twi, Ewe, Ga or Hausa) can be added later without
 * touching the UI. Moonshine Voice currently covers only English among the
 * product's target languages; unsupported languages fall back to text input.
 */

export type VoiceLanguage = 'en' | 'tw' | 'ee' | 'gaa' | 'ha'

/** Result of checking whether a language can be spoken/transcribed by a provider. */
export interface LanguageSupport {
  readonly supported: boolean
  readonly language: string
  readonly reason?: string
}

/** A live transcription line produced while the patient is speaking. */
export interface TranscriptionUpdate {
  readonly text: string
  readonly isFinal: boolean
  readonly latencyMs?: number
}

/** Errors raised by a speech provider, surfaceable to the patient. */
export interface VoiceError {
  readonly message: string
  readonly kind: 'permission' | 'recognition' | 'synthesis' | 'unsupported' | 'network'
  readonly retryable: boolean
}

/** Provider-neutral contract for speech recognition and synthesis. */
export interface SpeechProvider {
  readonly sttSupported: (language: string) => LanguageSupport
  readonly ttsSupported: (language: string) => LanguageSupport
  readonly supportedSttLanguages: () => string[]
  readonly supportedTtsLanguages: () => string[]
  readonly isListening: () => boolean
  readonly isSpeaking: () => boolean
  startSTT: (opts: {
    language: string
    onText: (update: TranscriptionUpdate) => void
    onLine: (text: string) => void
    onError: (error: VoiceError) => void
  }) => Promise<void>
  stopSTT: () => Promise<void>
  speak: (text: string) => Promise<void>
  stopSpeech: () => void
  replayLast: () => void
  getLastSpokenText: () => string
  close: () => void
}

/** Persisted voice preferences. Stored in localStorage, never sent to the backend. */
export interface VoicePreferences {
  readonly voiceMode: boolean
  readonly autoSpeak: boolean
  readonly sttLanguage: string
  readonly ttsLanguage: string
}

/** Runtime voice session state owned by the UI layer. */
export interface VoiceState {
  readonly voiceMode: boolean
  readonly autoSpeak: boolean
  readonly sttLanguage: string
  readonly ttsLanguage: string
  readonly listening: boolean
  readonly speaking: boolean
  readonly transcription: string
  readonly lastSpokenText: string
  readonly voiceSupported: boolean
  readonly supportReason: string | null
  readonly error: VoiceError | null
}

/** Action result returned by voice service mutations. */
export interface VoiceActionResult {
  readonly ok: boolean
  readonly error: VoiceError | null
}
