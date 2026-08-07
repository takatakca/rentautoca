import { useCallback, useEffect, useRef, useState } from "react";

type SpeechRecognitionLike = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((e: any) => void) | null;
  onerror: ((e: any) => void) | null;
  onend: (() => void) | null;
};

function getRecognitionCtor(): (new () => SpeechRecognitionLike) | null {
  if (typeof window === "undefined") return null;
  const w = window as any;
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

/**
 * Browser-native speech-to-text. No audio ever leaves the device beyond the
 * browser's own speech engine — we never upload audio to a third party.
 */
export function useVoiceSearch(onResult: (transcript: string) => void) {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  const [error, setError] = useState<string | null>(null);
  const recRef = useRef<SpeechRecognitionLike | null>(null);
  const callbackRef = useRef(onResult);
  callbackRef.current = onResult;

  useEffect(() => {
    setSupported(!!getRecognitionCtor());
    return () => {
      try {
        recRef.current?.abort();
      } catch {
        /* noop */
      }
    };
  }, []);

  const stop = useCallback(() => {
    try {
      recRef.current?.stop();
    } catch {
      /* noop */
    }
    setListening(false);
  }, []);

  const start = useCallback(() => {
    const Ctor = getRecognitionCtor();
    if (!Ctor) {
      setError("Voice search isn't supported in this browser.");
      return;
    }
    setError(null);
    setInterim("");
    const rec = new Ctor();
    recRef.current = rec;
    rec.lang = navigator.language?.startsWith("fr") ? "fr-CA" : "en-CA";
    rec.interimResults = true;
    rec.continuous = false;

    rec.onresult = (e: any) => {
      let finalText = "";
      let interimText = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) finalText += r[0].transcript;
        else interimText += r[0].transcript;
      }
      setInterim(interimText);
      if (finalText.trim()) {
        setInterim("");
        setListening(false);
        callbackRef.current(finalText.trim());
      }
    };
    rec.onerror = (e: any) => {
      setListening(false);
      setError(
        e?.error === "not-allowed"
          ? "Microphone access was blocked. Enable it in your browser settings."
          : "Voice search stopped. Try again or type your search."
      );
    };
    rec.onend = () => setListening(false);

    try {
      rec.start();
      setListening(true);
    } catch {
      setListening(false);
    }
  }, []);

  const toggle = useCallback(() => (listening ? stop() : start()), [listening, start, stop]);

  return { supported, listening, interim, error, start, stop, toggle };
}
