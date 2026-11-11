/**
 * Microphone button with recording/listening indicator and stop control.
 *
 * Visible beside the chat input on desktop and mobile. Delegates to the
 * shared voice service and surfaces honest permission / recognition errors.
 */

import { useCallback } from 'react'
import { useVoice } from '../../voice/voiceService'

interface MicButtonProps {
  /** Called when a finalized transcription line is ready to insert into the draft. */
  onTranscription: (text: string) => void
  /** Disabled when the chat is busy. */
  disabled?: boolean
}

export function MicButton({ onTranscription, disabled = false }: MicButtonProps) {
  const { state, startSTT, stopSTT } = useVoice()

  const start = useCallback(async () => {
    if (state.listening || disabled) return
    await startSTT(onTranscription)
  }, [state.listening, disabled, startSTT, onTranscription])

  const stop = useCallback(async () => {
    await stopSTT()
  }, [stopSTT])

  if (!state.voiceSupported) {
    return (
      <button
        className="mic-button mic-button-unsupported"
        type="button"
        disabled
        aria-label="Voice recognition unavailable for this language"
        title={state.supportReason || 'Voice recognition unavailable for this language'}
      >
        <span aria-hidden="true">🎤</span>
      </button>
    )
  }

  return (
    <div className="mic-control" role="group" aria-label="Voice input">
      {state.listening ? (
        <button
          className="mic-button mic-button-recording"
          type="button"
          onClick={stop}
          aria-label="Stop recording"
          title="Stop recording"
          aria-pressed="true"
        >
          <span className="mic-dot" aria-hidden="true"></span>
          <span aria-hidden="true">⏹</span>
        </button>
      ) : (
        <button
          className="mic-button"
          type="button"
          onClick={start}
          disabled={disabled}
          aria-label="Start voice input"
          title="Start voice input"
        >
          <span aria-hidden="true">🎤</span>
        </button>
      )}
      {state.error && <p className="mic-error" role="alert">{state.error.message}</p>}
    </div>
  );
}
