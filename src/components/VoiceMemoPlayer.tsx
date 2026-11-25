import { useEffect, useRef, useState } from 'react';
import { Pause, Play, Volume2 } from 'lucide-react';
import { formatAudioDuration } from '../utils/audio';

interface VoiceMemoPlayerProps {
  src: string;
  duration?: number | null;
  compact?: boolean;
}

export function VoiceMemoPlayer({ src, duration, compact = false }: VoiceMemoPlayerProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [resolvedDuration, setResolvedDuration] = useState<number>(duration ?? 0);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    setIsPlaying(false);
    setCurrentTime(0);
    setLoadError(false);
    setResolvedDuration(duration ?? 0);
  }, [src, duration]);

  const togglePlay = async () => {
    const audio = audioRef.current;
    if (!audio || loadError) return;

    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      try {
        await audio.play();
        setIsPlaying(true);
      } catch {
        setLoadError(true);
        setIsPlaying(false);
      }
    }
  };

  const handleLoadedMetadata = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (Number.isFinite(audio.duration) && audio.duration > 0) {
      setResolvedDuration(audio.duration);
    }
  };

  const handleTimeUpdate = () => {
    const audio = audioRef.current;
    if (!audio) return;
    setCurrentTime(audio.currentTime);
    if (Number.isFinite(audio.duration) && audio.duration > 0) {
      setResolvedDuration(audio.duration);
    }
  };

  const handleEnded = () => {
    setIsPlaying(false);
    setCurrentTime(0);
  };

  const progressPct =
    resolvedDuration > 0 ? Math.min(100, (currentTime / resolvedDuration) * 100) : 0;

  return (
    <div
      className={`flex items-center gap-2.5 rounded-xl border border-amber-200/80 dark:border-amber-500/25 bg-amber-50/60 dark:bg-amber-500/10 ${
        compact ? 'px-2.5 py-1.5' : 'px-3 py-2'
      }`}
    >
      <audio
        ref={audioRef}
        src={src}
        preload="metadata"
        onLoadedMetadata={handleLoadedMetadata}
        onTimeUpdate={handleTimeUpdate}
        onEnded={handleEnded}
        onError={() => {
          setLoadError(true);
          setIsPlaying(false);
        }}
      />

      <button
        type="button"
        onClick={togglePlay}
        disabled={loadError}
        aria-label={isPlaying ? 'Metti in pausa memo vocale' : 'Riproduci memo vocale'}
        className={`${
          compact ? 'min-h-[36px] min-w-[36px]' : 'min-h-[40px] min-w-[40px]'
        } flex items-center justify-center rounded-lg bg-gradient-to-br from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 disabled:opacity-50 text-white shadow-xs transition-all shrink-0`}
      >
        {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
      </button>

      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-center justify-between gap-2 text-xs">
          <span className="inline-flex items-center gap-1 font-semibold text-amber-900 dark:text-amber-200 truncate">
            <Volume2 className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
            <span>{loadError ? 'Audio non riproducibile' : 'Memo vocale'}</span>
          </span>
          <span className="font-mono text-[11px] tabular-nums text-amber-800/80 dark:text-amber-300/85 shrink-0">
            {isPlaying || currentTime > 0
              ? `${formatAudioDuration(currentTime)} / ${formatAudioDuration(resolvedDuration)}`
              : formatAudioDuration(resolvedDuration)}
          </span>
        </div>

        <div className="h-1.5 w-full rounded-full bg-amber-200/70 dark:bg-slate-800 overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-amber-500 to-orange-500 transition-[width] duration-100"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>
    </div>
  );
}
