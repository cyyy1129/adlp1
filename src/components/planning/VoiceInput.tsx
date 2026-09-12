import { useSpeechRecognition } from '../../hooks/useSpeechRecognition';

interface VoiceInputProps {
  language: 'en' | 'ms';
  onTranscript: (transcript: string) => void;
  disabled?: boolean;
}

export default function VoiceInput({ language, onTranscript, disabled = false }: VoiceInputProps) {
  const { supported, status, error, startListening, stopListening } = useSpeechRecognition({ language, onTranscript });

  if (!supported) {
    return <p className="voice-fallback">Voice input is not available here. You can continue with text.</p>;
  }

  const isListening = status === 'listening';
  const label = status === 'transcribing' ? 'Transcribing…' : isListening ? 'Listening… tap to stop' : 'Speak your answer';

  return (
    <div className="voice-control">
      <button
        type="button"
        className={`voice-button ${isListening ? 'voice-button-listening' : ''}`}
        onClick={isListening ? stopListening : startListening}
        disabled={disabled || status === 'transcribing'}
        aria-label={label}
      >
        <span aria-hidden="true">🎙️</span>
      </button>
      <span className="voice-status" aria-live="polite">{label}</span>
      {error && <p className="voice-error" role="alert">{error}</p>}
    </div>
  );
}
