import { useEffect } from 'react';
import { X } from 'lucide-react';

interface ImageModalProps {
  src: string | null;
  title?: string;
  onClose: () => void;
}

export function ImageModal({ src, title, onClose }: ImageModalProps) {
  useEffect(() => {
    if (!src) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [src, onClose]);

  if (!src) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-xs p-4"
      role="dialog"
      aria-modal="true"
      aria-label={title || 'Anteprima foto'}
      onClick={onClose}
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Chiudi immagine"
        className="fixed top-4 right-4 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-full bg-white/15 text-white hover:bg-white/25 transition-colors"
      >
        <X className="w-5 h-5" />
      </button>

      <div
        className="max-w-3xl w-full flex flex-col items-center gap-3"
        onClick={(e) => e.stopPropagation()}
      >
        <img
          src={src}
          alt={title || 'Foto segnaposto'}
          referrerPolicy="no-referrer"
          className="max-h-[80vh] w-auto max-w-full rounded-2xl object-contain shadow-2xl border border-white/10"
        />
        {title && (
          <p className="text-sm font-medium text-slate-200 text-center max-w-lg truncate">
            {title}
          </p>
        )}
      </div>
    </div>
  );
}
