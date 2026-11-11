/**
 * Live transcription display shown while the patient is speaking.
 *
 * Displays the in-progress recognition text and lets the patient cancel the
 * current utterance without sending it.
 */

import { useCallback } from 'react';
import { useVoice } from '../../voice/voiceService';

export function LiveTranscription() {
  const { state, stopSTT } = useVoice();

  const cancel = useCallback(async () => {
    await stopSTT();
  }, [stopSTT]);

  if (!state.listening && !state.transcription) return null;

  return (
    <div className="live-transcription" role="status" aria-live="polite">
      <span className="live-transcription-label">Transcribing…</span>
      <span className="live-transcription-text">{state.transcription}</span>
      {state.listening && (
        <button
          className="button button-outline button-small"
          type="button"
          onClick={cancel}
          aria-label="Cancel transcription"
        >
          Cancel
        </button>
      )}
    </div>
  );
}
