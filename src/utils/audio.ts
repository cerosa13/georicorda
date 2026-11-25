export const MAX_VOICE_MEMO_SECONDS = 60;

export function isSafeAudioDataUrl(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  return /^data:audio\/[a-z0-9.+-]+(?:;\s*codecs=[a-z0-9.,+\s"-]+)?;\s*base64,[A-Za-z0-9+/=]+$/i.test(
    value.trim()
  );
}

export function getSupportedAudioMimeType(): string | undefined {
  if (typeof MediaRecorder === 'undefined') return undefined;
  const candidates = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/mp4',
    'audio/ogg;codecs=opus',
    'audio/ogg',
  ];
  for (const type of candidates) {
    if (MediaRecorder.isTypeSupported(type)) {
      return type;
    }
  }
  return undefined;
}

export function blobToBase64DataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Impossibile convertire la registrazione audio.'));
    reader.onloadend = () => {
      if (typeof reader.result === 'string' && reader.result.startsWith('data:audio/')) {
        resolve(reader.result);
      } else {
        reject(new Error('Formato audio non supportato.'));
      }
    };
    reader.readAsDataURL(blob);
  });
}

export function formatAudioDuration(seconds: number | null | undefined): string {
  if (seconds == null || !Number.isFinite(seconds) || seconds < 0) {
    return '0:00';
  }
  const total = Math.round(seconds);
  const mins = Math.floor(total / 60);
  const secs = total % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}
