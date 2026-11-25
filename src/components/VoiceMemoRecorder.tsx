import { useCallback, useEffect, useRef, useState } from 'react';
import { Mic, Square, Trash2, X } from 'lucide-react';
import {
  MAX_VOICE_MEMO_SECONDS,
  blobToBase64DataUrl,
  formatAudioDuration,
  getSupportedAudioMimeType,
} from '../utils/audio';
import { VoiceMemoPlayer } from './VoiceMemoPlayer';

interface VoiceMemoRecorderProps {
  voiceMemo: string | null;
  voiceMemoDuration: number | null;
  onChange: (audioDataUrl: string | null, durationSeconds: number | null) => void;
  onError: (message: string) => void;
}

export function VoiceMemoRecorder({
  voiceMemo,
  voiceMemoDuration,
  onChange,
  onError,
}: VoiceMemoRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [processing, setProcessing] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);
  const cancelledRef = useRef<boolean>(false);

  const cleanupStream = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    mediaRecorderRef.current = null;
  }, []);

  useEffect(() => {
    return () => {
      cancelledRef.current = true;
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        try {
          mediaRecorderRef.current.stop();
        } catch {
          // ignore
        }
      }
      cleanupStream();
    };
  }, [cleanupStream]);

  const stopRecording = useCallback((cancel = false) => {
    cancelledRef.current = cancel;
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== 'inactive') {
      recorder.stop();
    } else {
      cleanupStream();
      setIsRecording(false);
    }
  }, [cleanupStream]);

  const startRecording = async () => {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      onError('Registrazione audio non supportata da questo browser.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];
      cancelledRef.current = false;

      const mimeType = getSupportedAudioMimeType();
      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);

      mediaRecorderRef.current = recorder;
      startTimeRef.current = Date.now();
      setElapsedSeconds(0);
      setIsRecording(true);

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      recorder.onerror = () => {
        cleanupStream();
        setIsRecording(false);
        onError('Errore durante la registrazione vocale.');
      };

      recorder.onstop = async () => {
        const finalDuration = Math.max(
          1,
          Math.min(MAX_VOICE_MEMO_SECONDS, Math.round((Date.now() - startTimeRef.current) / 1000))
        );
        const wasCancelled = cancelledRef.current;
        const recordedMime = recorder.mimeType || mimeType || 'audio/webm';
        const blobs = [...chunksRef.current];

        cleanupStream();
        setIsRecording(false);

        if (wasCancelled || blobs.length === 0) {
          return;
        }

        setProcessing(true);
        try {
          const audioBlob = new Blob(blobs, { type: recordedMime });
          const base64Url = await blobToBase64DataUrl(audioBlob);
          onChange(base64Url, finalDuration);
        } catch (err) {
          onError(
            err instanceof Error ? err.message : 'Impossibile salvare il memo vocale.'
          );
        } finally {
          setProcessing(false);
        }
      };

      recorder.start(250);

      timerRef.current = window.setInterval(() => {
        const secs = Math.floor((Date.now() - startTimeRef.current) / 1000);
        setElapsedSeconds(secs);
        if (secs >= MAX_VOICE_MEMO_SECONDS) {
          stopRecording(false);
        }
      }, 250);
    } catch {
      cleanupStream();
      setIsRecording(false);
      onError('Permesso microfono negato o non disponibile.');
    }
  };

  if (isRecording) {
    return (
      <div className="rounded-xl border border-rose-300 dark:border-rose-500/40 bg-rose-50/80 dark:bg-rose-500/15 p-3 flex items-center justify-between gap-2.5">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="flex h-3 w-3 shrink-0 rounded-full bg-rose-600 animate-pulse" />
          <div className="min-w-0">
            <p className="text-xs font-semibold text-rose-700 dark:text-rose-300">
              Registrazione in corso
            </p>
            <p className="text-[11px] font-mono tabular-nums text-rose-600/85 dark:text-rose-300/85">
              {formatAudioDuration(elapsedSeconds)} / {formatAudioDuration(MAX_VOICE_MEMO_SECONDS)}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => stopRecording(true)}
            aria-label="Annulla registrazione"
            className="min-h-[38px] min-w-[38px] flex items-center justify-center rounded-lg border border-rose-200 dark:border-rose-800/70 bg-white dark:bg-[#111b27] text-slate-600 dark:text-slate-300 hover:bg-rose-50 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => stopRecording(false)}
            className="min-h-[38px] px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap shadow-xs"
          >
            <Square className="w-3.5 h-3.5 fill-current" />
            <span>Stop</span>
          </button>
        </div>
      </div>
    );
  }

  if (voiceMemo) {
    return (
      <div className="flex items-center gap-2">
        <div className="flex-1 min-w-0">
          <VoiceMemoPlayer src={voiceMemo} duration={voiceMemoDuration} />
        </div>
        <button
          type="button"
          onClick={() => onChange(null, null)}
          aria-label="Rimuovi memo vocale"
          title="Rimuovi memo vocale"
          className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl border border-rose-200 dark:border-rose-500/40 bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-500/20 transition-colors shrink-0"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={startRecording}
      disabled={processing}
      className="w-full min-h-[46px] flex items-center justify-center gap-2 rounded-xl border border-dashed border-amber-300 dark:border-amber-500/40 bg-amber-50/70 dark:bg-amber-500/10 hover:bg-amber-100/70 dark:hover:bg-amber-500/15 px-3.5 py-2.5 text-xs font-semibold text-amber-800 dark:text-amber-200 transition-colors disabled:opacity-50"
    >
      <Mic className="w-4 h-4 text-amber-600 dark:text-amber-400" />
      <span>{processing ? 'Elaborazione audio...' : 'Registra memo vocale (max 60s)'}</span>
    </button>
  );
}
