/**
 * Voice settings: conversation mode, auto-speak, and language support.
 * Preferences persist in localStorage only. Only languages genuinely supported
 * by the configured Moonshine models are offered.
 */

import { useVoice } from '../../voice/voiceService'

interface VoiceLanguageOption {
  value: string
  label: string
}

export function VoiceSettings() {
  const { state, provider, toggleVoiceMode, toggleAutoSpeak, setSttLanguage, setTtsLanguage } = useVoice()
  const supportedStt = provider.supportedSttLanguages()
  const supportedTts = provider.supportedTtsLanguages()

  const sttOptions: VoiceLanguageOption[] = supportedStt.map((value) => ({ value, label: value.toUpperCase() }))
  const ttsOptions: VoiceLanguageOption[] = supportedTts.map((value) => ({ value, label: value.toUpperCase() }))

  const unsupported = ['tw', 'ee', 'gaa', 'ha'].filter((lang) => lang !== state.sttLanguage)

  return (
    <section className="voice-settings-card settings-card">
      <h2>Voice settings</h2>
      <p className="panel-lead">Voice input and playback run on your device. No audio is sent to a server.</p>

      <div className="voice-setting-row">
        <div>
          <strong>Voice conversation mode</strong>
          <p>Speak your messages instead of typing. The assistant reads replies aloud when auto-speak is on.</p>
        </div>
        <button
          className="consent-switch"
          type="button"
          role="switch"
          aria-label="Voice conversation mode"
          aria-checked={state.voiceMode}
          onClick={toggleVoiceMode}
        >
          <span />
        </button>
      </div>

      <div className="voice-setting-row">
        <div>
          <strong>Speak assistant replies</strong>
          <p>Read each assistant response aloud automatically. You can still play or replay any reply manually.</p>
        </div>
        <button
          className="consent-switch"
          type="button"
          role="switch"
          aria-label="Speak assistant replies"
          aria-checked={state.autoSpeak}
          onClick={toggleAutoSpeak}
        >
          <span />
        </button>
      </div>

      <div className="voice-setting-row">
        <div>
          <strong>Speech recognition language</strong>
          <p>Language used to transcribe what you say.</p>
        </div>
        <select
          value={state.sttLanguage}
          onChange={(event) => setSttLanguage((event.target as HTMLSelectElement).value)}
          aria-label="Speech recognition language"
        >
          {sttOptions.map((item) => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </select>
      </div>

      <div className="voice-setting-row">
        <div>
          <strong>Speech playback language</strong>
          <p>Language used to read assistant replies aloud.</p>
        </div>
        <select
          value={state.ttsLanguage}
          onChange={(event) => setTtsLanguage((event.target as HTMLSelectElement).value)}
          aria-label="Speech playback language"
        >
          {ttsOptions.map((item) => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </select>
      </div>

      <div className="voice-language-compat">
        <strong>Voice language support</strong>
        {state.voiceSupported ? (
          <span className="pill pill-done">English voice supported</span>
        ) : (
          <span className="pill pill-waiting">Voice not available for {state.sttLanguage.toUpperCase()}</span>
        )}
        <p className="voice-compat-hint">
          {state.voiceSupported
            ? 'Speech recognition and playback work in English.'
            : 'Twi, Ewe, Ga and Hausa are not yet supported by Moonshine. Use text input for those languages.'}
        </p>
      </div>

      {!state.voiceSupported && unsupported.length > 0 && (
        <p className="voice-fallback-note">
          Voice controls are limited for {unsupported.map((lang) => lang.toUpperCase()).join(', ')}. Switch the
          recognition language to English to use voice input and playback.
        </p>
      )}
    </section>
  );
}
