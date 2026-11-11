/**
 * Voice settings: conversation mode, auto-speak preference, and language
 * compatibility indicator. Preferences persist in localStorage only.
 */

import { useVoice } from '../../voice/voiceService';

export function VoiceSettings() {
  const { state, toggleVoiceMode, toggleAutoSpeak } = useVoice();

  const supported = state.voiceSupported;

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

      <div className="voice-language-compat">
        <strong>Voice language support</strong>
        {supported ? (
          <span className="pill pill-done">English voice supported</span>
        ) : (
          <span className="pill pill-waiting">Voice not available for {state.language.toUpperCase()}</span>
        )}
        <p className="voice-compat-hint">
          {supported
            ? 'Speech recognition and playback work in English.'
            : 'Twi, Ewe, Ga and Hausa are not yet supported by Moonshine. Use text input for those languages.'}
        </p>
      </div>

      {!supported && (
        <p className="voice-fallback-note">
          Voice controls are hidden for this language. Switch your preferred language to English to use voice input and playback.
        </p>
      )}
    </section>
  );
}
