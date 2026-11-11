/**
 * Speaker button for assistant responses: play, stop, replay.
 *
 * Reads only the visible assistant message text — never internal JSON,
 * metadata, or hidden system information.
 */

import { useCallback, useState } from 'react';
import { useVoice } from '../../voice/voiceService';

interface SpeakerButtonProps {
  /** Visible assistant message text to speak. */
  text: string;
}

export function SpeakerButton({ text }: SpeakerButtonProps) {
  const { state, speak, stopSpeech, replayLast } = useVoice();
  const [hasSpoken, setHasSpoken] = useState(false);

  const isSpeaking = state.speaking;

  const play = useCallback(async () => {
    if (!text.trim()) return;
    await speak(text);
    setHasSpoken(true);
  }, [text, speak]);

  const stop = useCallback(() => {
    stopSpeech();
  }, [stopSpeech]);

  const replay = useCallback(() => {
    replayLast();
    setHasSpoken(true);
  }, [replayLast]);

  return (
    <div className="speaker-control" role="group" aria-label="Voice playback">
      {isSpeaking ? (
        <button
          className="speaker-button speaker-button-speaking"
          type="button"
          onClick={stop}
          aria-label="Stop speech"
          title="Stop speech"
        >
          <span aria-hidden="true">⏹</span>
        </button>
      ) : hasSpoken && state.voiceSupported ? (
        <>
          <button
            className="speaker-button"
            type="button"
            onClick={replay}
            aria-label="Replay response"
            title="Replay response"
          >
            <span aria-hidden="true">↻</span>
          </button>
          <button
            className="speaker-button"
            type="button"
            onClick={play}
            aria-label="Read response aloud"
            title="Read response aloud"
          >
            <span aria-hidden="true">🔊</span>
          </button>
        </>
      ) : (
        <button
          className="speaker-button"
          type="button"
          onClick={play}
          disabled={!state.voiceSupported}
          aria-label={
            !state.voiceSupported
              ? 'Voice playback unavailable for this language'
              : 'Read response aloud'
          }
          title={
            !state.voiceSupported
              ? 'Voice playback unavailable for this language'
              : 'Read response aloud'
          }
        >
          <span aria-hidden="true">🔊</span>
        </button>
      )}
      {state.autoSpeak && !isSpeaking && state.voiceSupported && <span className="voice-note">Speaking…</span>}
    </div>
  );
}
