/**
 * Moonshine Voice WebAssembly speech provider.
 *
 * Runs entirely in the patient's browser. No audio is uploaded to the backend
 * and the backend never touches the patient's microphone. The Moonshine
 * WebAssembly module is loaded from the CDN at runtime (the documented web
 * usage) so Vite never bundles the worker files as IIFE, which would break the
 * module's top-level await.
 *
 * Moonshine Voice currently supports English for both STT and TTS among the
 * product's target languages (en, tw, ee, gaa, ha); every other language is
 * reported as unsupported so the UI can offer an honest text fallback.
 */

import type { TranscriptLine } from '@moonshine-ai/moonshine-wasm';
import type {
  LanguageSupport,
  SpeechProvider,
  TranscriptionUpdate,
  VoiceError,
} from './types';

const CDN_URL = 'https://cdn.jsdelivr.net/npm/@moonshine-ai/moonshine-wasm@0.1.6/dist/index.js';
const STT_LANGUAGE = 'en';
const TTS_LANGUAGE = 'en_us';
const TTS_VOICE = 'kokoro_af_heart';

let moonshineModule: any = null;

async function loadMoonshineBrowser(): Promise<any> {
  if (!moonshineModule) {
    moonshineModule = await import(CDN_URL);
  }
  return moonshineModule;
}

function voiceError(
  message: string,
  kind: VoiceError['kind'],
  retryable: boolean,
): VoiceError {
  return { message, kind, retryable };
}

function isPermissionError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /notallowed|permission|denied|microphone|notreadable/i.test(message);
}

function isNetworkError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /download|network|fetch|failed to fetch|timeout/i.test(message);
}

export class MoonshineVoiceProvider implements SpeechProvider {
  private mic?: any;
  private tts?: any;
  private micLoaded = false;
  private lastSpokenText = '';
  private listeners = new Set<(update: TranscriptionUpdate) => void>();
  private lineListeners = new Set<(text: string) => void>();
  private errorListeners = new Set<(error: VoiceError) => void>();

  sttSupported(language: string): LanguageSupport {
    if (language === STT_LANGUAGE) {
      return { supported: true, language: STT_LANGUAGE };
    }
    return {
      supported: false,
      language,
      reason: `Speech recognition is not available for "${language}". Moonshine Voice supports English only; ${language} transcription falls back to text input.`,
    };
  }

  ttsSupported(language: string): LanguageSupport {
    if (language === STT_LANGUAGE) {
      return { supported: true, language: TTS_LANGUAGE };
    }
    return {
      supported: false,
      language,
      reason: `Speech playback is not available for "${language}". Moonshine Voice supports English only; ${language} responses fall back to text.`,
    };
  }

  isListening(): boolean {
    return this.mic?.isRunning ?? false;
  }

  isSpeaking(): boolean {
    return this.tts?.isTalking ?? false;
  }

  private micError(error: unknown): void {
    const err = error instanceof Error ? error : new Error(String(error));
    const kind = isPermissionError(err) ? 'permission' : isNetworkError(err) ? 'network' : 'recognition';
    const vErr = voiceError(
      kind === 'permission'
        ? 'Microphone access was denied. Enable microphone permission to use voice input, or type your message instead.'
        : kind === 'network'
          ? 'The voice model could not be downloaded. Check your internet connection, or type your message instead.'
          : 'Speech recognition encountered an error. You can still type and send messages.',
      kind,
      kind === 'network',
    );
    this.errorListeners.forEach((cb) => cb(vErr));
  }

  async startSTT(opts: {
    language: string;
    onText: (update: TranscriptionUpdate) => void;
    onLine: (text: string) => void;
    onError: (error: VoiceError) => void;
  }): Promise<void> {
    const support = this.sttSupported(opts.language);
    if (!support.supported) {
      const err = voiceError(support.reason ?? 'Voice recognition unavailable for this language.', 'unsupported', false);
      opts.onError(err);
      return;
    }

    this.listeners.add(opts.onText);
    this.lineListeners.add(opts.onLine);
    this.errorListeners.add(opts.onError);

    try {
      const mod = await loadMoonshineBrowser();
      if (!this.mic) {
        const MicTranscriber = mod.MicTranscriber;
        const ModelArch = mod.ModelArch;
        this.mic = new MicTranscriber()
          .language(STT_LANGUAGE)
          .modelArch(ModelArch.MediumStreaming)
          .onText((text: string) => {
            const update: TranscriptionUpdate = { text, isFinal: false };
            this.listeners.forEach((cb) => cb(update));
          })
          .onLine((line: TranscriptLine) => {
            const text = line.text.trim();
            if (text) {
              this.lineListeners.forEach((cb) => cb(text));
            }
          })
          .onError((error: unknown) => this.micError(error));
      }
      if (!this.micLoaded) {
        await this.mic.load();
        this.micLoaded = true;
      }
      await this.mic.start();
    } catch (error) {
      this.micError(error);
      throw error;
    }
  }

  async stopSTT(): Promise<void> {
    try {
      if (this.mic) {
        await this.mic.stop();
      }
    } catch {
      // Stopping should not fail the UI; ignore teardown errors.
    }
    this.listeners.clear();
    this.lineListeners.clear();
    this.errorListeners.clear();
  }

  async speak(text: string): Promise<void> {
    const support = this.ttsSupported(STT_LANGUAGE);
    if (!support.supported) {
      const err = voiceError(support.reason ?? 'Speech playback unavailable for this language.', 'unsupported', false);
      this.errorListeners.forEach((cb) => cb(err));
      return;
    }

    if (!text || !text.trim()) return;

    try {
      const mod = await loadMoonshineBrowser();
      if (!this.tts) {
        const TextToSpeech = mod.TextToSpeech;
        this.tts = new TextToSpeech()
          .language(TTS_LANGUAGE)
          .voice(TTS_VOICE);
        await this.tts.load();
      }
      this.lastSpokenText = text;
      await this.tts.say(text);
    } catch (error) {
      this.micError(error);
      throw error;
    }
  }

  stopSpeech(): void {
    try {
      this.tts?.stop();
    } catch {
      // Ignore teardown errors.
    }
  }

  /** Replay the last spoken assistant response, if any. */
  replayLast(): void {
    if (this.lastSpokenText) {
      void this.speak(this.lastSpokenText);
    }
  }

  getLastSpokenText(): string {
    return this.lastSpokenText;
  }

  close(): void {
    this.stopSpeech();
    try {
      this.mic?.close();
    } catch {
      // Ignore.
    }
    try {
      this.tts?.close();
    } catch {
      // Ignore.
    }
    this.mic = undefined;
    this.tts = undefined;
    this.micLoaded = false;
    this.listeners.clear();
    this.lineListeners.clear();
    this.errorListeners.clear();
  }
}
