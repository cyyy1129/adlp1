// ============================================================
// Browser Web Speech API wrapper with a safe text-input fallback.
// ============================================================

import { useCallback, useEffect, useRef, useState } from 'react';

type SpeechStatus = 'idle' | 'listening' | 'transcribing';

interface UseSpeechRecognitionOptions {
  language: 'en' | 'ms';
  onTranscript: (transcript: string) => void;
}

function getRecognitionConstructor(): SpeechRecognitionConstructor | null {
  if (typeof window === 'undefined') return null;
  return window.SpeechRecognition ?? window.webkitSpeechRecognition ?? null;
}

export function useSpeechRecognition({ language, onTranscript }: UseSpeechRecognitionOptions) {
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const heardResultRef = useRef(false);
  const [status, setStatus] = useState<SpeechStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const supported = getRecognitionConstructor() !== null;

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
  }, []);

  const startListening = useCallback(() => {
    const Recognition = getRecognitionConstructor();
    if (!Recognition) {
      setError('Voice input is not available in this browser. Please type your answer instead.');
      return;
    }

    setError(null);
    heardResultRef.current = false;
    const recognition = new Recognition();
    recognitionRef.current = recognition;
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = language === 'ms' ? 'ms-MY' : 'en-MY';

    recognition.onstart = () => setStatus('listening');
    recognition.onresult = event => {
      const result = event.results[event.results.length - 1];
      const transcript = result?.[0]?.transcript.trim();
      if (!transcript) return;
      heardResultRef.current = true;
      setStatus('transcribing');
      onTranscript(transcript);
    };
    recognition.onerror = event => {
      if (event.error === 'aborted') return;
      const message = event.error === 'not-allowed' || event.error === 'service-not-allowed'
        ? 'Microphone access was blocked. Please allow it or type your answer instead.'
        : 'We could not understand that. Please try again or type your answer.';
      setError(message);
    };
    recognition.onend = () => {
      setStatus('idle');
      recognitionRef.current = null;
    };

    try {
      recognition.start();
    } catch {
      setError('Voice input could not start. Please type your answer instead.');
      setStatus('idle');
    }
  }, [language, onTranscript]);

  useEffect(() => {
    return () => recognitionRef.current?.abort();
  }, []);

  return { supported, status, error, startListening, stopListening };
}
