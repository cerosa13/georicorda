import { Spot } from '../types/spot';
import { formatAudioDuration, isSafeAudioDataUrl } from './audio';
import { formatDistance } from './geo';
import { isSafeImageDataUrl } from './image';

export interface InfographicResult {
  dataUrl: string;
  blob: Blob;
  filename: string;
  width: number;
  height: number;
}

interface CategoryPalette {
  gradStart: string;
  gradEnd: string;
  softBg: string;
  softBorder: string;
  accentText: string;
}

const CATEGORY_PALETTES: Record<string, CategoryPalette> = {
  'Toilet / Servizio': {
    gradStart: '#0d9488',
    gradEnd: '#06b6d4',
    softBg: '#f0fdfa',
    softBorder: '#99f6e4',
    accentText: '#0f766e',
  },
  'Bar / Prodotto': {
    gradStart: '#ea580c',
    gradEnd: '#f59e0b',
    softBg: '#fff7ed',
    softBorder: '#fed7aa',
    accentText: '#c2410c',
  },
  'Scorciatoia': {
    gradStart: '#7c3aed',
    gradEnd: '#a855f7',
    softBg: '#f5f3ff',
    softBorder: '#ddd6fe',
    accentText: '#6d28d9',
  },
  'Località': {
    gradStart: '#e11d48',
    gradEnd: '#f97316',
    softBg: '#fff1f2',
    softBorder: '#fecdd3',
    accentText: '#be123c',
  },
  'Spiaggia': {
    gradStart: '#06b6d4',
    gradEnd: '#0ea5e9',
    softBg: '#ecfeff',
    softBorder: '#a5f3fc',
    accentText: '#0e7490',
  },
  'Fiume': {
    gradStart: '#0284c7',
    gradEnd: '#14b8a6',
    softBg: '#f0f9ff',
    softBorder: '#bae6fd',
    accentText: '#0369a1',
  },
  'Funghi': {
    gradStart: '#16a34a',
    gradEnd: '#10b981',
    softBg: '#f0fdf4',
    softBorder: '#bbf7d0',
    accentText: '#15803d',
  },
  'Lavoro / Parcheggio': {
    gradStart: '#2563eb',
    gradEnd: '#4f46e5',
    softBg: '#eff6ff',
    softBorder: '#bfdbfe',
    accentText: '#1d4ed8',
  },
  'Altro': {
    gradStart: '#d97706',
    gradEnd: '#f59e0b',
    softBg: '#fffbeb',
    softBorder: '#fde68a',
    accentText: '#b45309',
  },
};

function getPalette(category: string): CategoryPalette {
  return CATEGORY_PALETTES[category] || CATEGORY_PALETTES['Altro'];
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines: number
): string[] {
  const paragraphs = text.replace(/\r\n/g, '\n').split('\n');
  const lines: string[] = [];

  for (const para of paragraphs) {
    const trimmed = para.trim();
    if (!trimmed) {
      if (lines.length > 0 && lines.length < maxLines) lines.push('');
      continue;
    }

    const words = trimmed.split(/\s+/);
    let currentLine = '';

    for (const word of words) {
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      if (ctx.measureText(testLine).width <= maxWidth) {
        currentLine = testLine;
      } else {
        if (currentLine) {
          lines.push(currentLine);
          if (lines.length >= maxLines) break;
          currentLine = word;
        } else {
          // Single very long token: force slice
          let chunk = '';
          for (const ch of word) {
            if (ctx.measureText(chunk + ch).width > maxWidth && chunk) {
              lines.push(chunk);
              if (lines.length >= maxLines) break;
              chunk = ch;
            } else {
              chunk += ch;
            }
          }
          currentLine = chunk;
        }
      }
      if (lines.length >= maxLines) break;
    }

    if (lines.length < maxLines && currentLine) {
      lines.push(currentLine);
    }
    if (lines.length >= maxLines) break;
  }

  if (lines.length > maxLines) {
    return lines.slice(0, maxLines);
  }
  return lines;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Impossibile caricare la foto'));
    img.src = src;
  });
}

function formatCardinalCoord(value: number, posLabel: string, negLabel: string): string {
  const hemi = value >= 0 ? posLabel : negLabel;
  return `${Math.abs(value).toFixed(5)}° ${hemi}`;
}

export function buildInfographicFilename(title: string): string {
  const slug = title
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
  return `segnaposto-${slug || 'scheda'}.png`;
}

export async function generateSpotInfographic(
  spot: Spot & { dist?: number | null }
): Promise<InfographicResult> {
  if (document.fonts?.ready) {
    try {
      await document.fonts.ready;
    } catch {
      // ignore font loading timeout
    }
  }

  const W = 1080;
  const PAD = 48;
  const INNER_W = W - PAD * 2;
  const palette = getPalette(spot.category);

  let loadedPhoto: HTMLImageElement | null = null;
  if (isSafeImageDataUrl(spot.photo) && spot.photo) {
    try {
      loadedPhoto = await loadImage(spot.photo);
    } catch {
      loadedPhoto = null;
    }
  }

  // Use a scratch canvas to accurately measure wrapped text heights
  const measureCanvas = document.createElement('canvas');
  const mCtx = measureCanvas.getContext('2d');
  if (!mCtx) {
    throw new Error('Canvas 2D non supportato dal browser.');
  }

  mCtx.font = '700 52px "Outfit", "Plus Jakarta Sans", system-ui, sans-serif';
  const titleLines = wrapText(mCtx, spot.title || 'Segnaposto', INNER_W - 64, 3);
  const titleHeight = titleLines.length * 62;

  const hasCity = Boolean(spot.city && spot.city.trim());
  const headerCardHeight = 160 + titleHeight + (hasCity ? 44 : 0) + 32;

  const photoHeight = loadedPhoto ? 400 : 0;
  const mapPanelHeight = 350;

  let noteLines: string[] = [];
  if (spot.note && spot.note.trim()) {
    mCtx.font = '500 28px "Plus Jakarta Sans", system-ui, sans-serif';
    noteLines = wrapText(mCtx, spot.note.trim(), INNER_W - 72, 6);
  }
  const noteCardHeight = noteLines.length > 0 ? 96 + noteLines.length * 40 : 0;

  const footerHeight = 96;
  const gap = 28;

  const totalHeight =
    PAD +
    headerCardHeight +
    (photoHeight > 0 ? gap + photoHeight : 0) +
    gap +
    mapPanelHeight +
    (noteCardHeight > 0 ? gap + noteCardHeight : 0) +
    gap +
    footerHeight +
    PAD * 0.6;

  const H = Math.round(totalHeight);
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Impossibile inizializzare il contesto grafico.');
  }

  // 1. Background Canvas
  ctx.fillStyle = '#f4f8fc';
  ctx.fillRect(0, 0, W, H);

  // Soft ambient corner glows
  const glowTop = ctx.createRadialGradient(W * 0.85, 120, 20, W * 0.85, 120, 480);
  glowTop.addColorStop(0, `${palette.gradEnd}26`);
  glowTop.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = glowTop;
  ctx.fillRect(0, 0, W, H);

  const glowBottom = ctx.createRadialGradient(W * 0.15, H - 140, 20, W * 0.15, H - 140, 500);
  glowBottom.addColorStop(0, `${palette.gradStart}20`);
  glowBottom.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = glowBottom;
  ctx.fillRect(0, 0, W, H);

  let cursorY = PAD;

  // 2. Hero Gradient Header Card
  ctx.save();
  drawRoundedRect(ctx, PAD, cursorY, INNER_W, headerCardHeight, 36);
  ctx.clip();

  const headerGrad = ctx.createLinearGradient(PAD, cursorY, PAD + INNER_W, cursorY + headerCardHeight);
  headerGrad.addColorStop(0, palette.gradStart);
  headerGrad.addColorStop(1, palette.gradEnd);
  ctx.fillStyle = headerGrad;
  ctx.fillRect(PAD, cursorY, INNER_W, headerCardHeight);

  // Procedural topographic contour rings in header
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.14)';
  ctx.lineWidth = 2.5;
  for (let r = 80; r <= 420; r += 62) {
    ctx.beginPath();
    ctx.arc(PAD + INNER_W - 70, cursorY + 60, r, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Top label row: Brand + Date
  const formattedDate = (() => {
    const parsed = new Date(spot.createdAt);
    if (Number.isNaN(parsed.getTime())) return '';
    return parsed.toLocaleDateString('it-IT', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  })();

  ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
  ctx.font = '700 20px "Outfit", "Plus Jakarta Sans", system-ui, sans-serif';
  ctx.fillText('SEGNAPOSTO RAPIDO', PAD + 36, cursorY + 52);

  if (formattedDate) {
    ctx.textAlign = 'right';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.88)';
    ctx.font = '600 22px "Plus Jakarta Sans", system-ui, sans-serif';
    ctx.fillText(formattedDate, PAD + INNER_W - 36, cursorY + 52);
    ctx.textAlign = 'left';
  }

  // Category tag badge inside header
  ctx.font = '700 22px "Plus Jakarta Sans", system-ui, sans-serif';
  const catText = spot.category.toUpperCase();
  const catWidth = ctx.measureText(catText).width + 44;
  ctx.fillStyle = 'rgba(255, 255, 255, 0.22)';
  drawRoundedRect(ctx, PAD + 36, cursorY + 80, catWidth, 42, 21);
  ctx.fill();

  ctx.fillStyle = '#ffffff';
  ctx.fillText(catText, PAD + 58, cursorY + 109);

  // Spot Title
  ctx.fillStyle = '#ffffff';
  ctx.font = '700 52px "Outfit", "Plus Jakarta Sans", system-ui, sans-serif';
  let titleY = cursorY + 186;
  for (const line of titleLines) {
    ctx.fillText(line, PAD + 36, titleY);
    titleY += 62;
  }

  // City / Locality subtitle
  if (hasCity) {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.92)';
    ctx.font = '600 28px "Plus Jakarta Sans", system-ui, sans-serif';
    ctx.fillText(`📍 ${spot.city.trim()}`, PAD + 36, titleY - 12);
  }

  ctx.restore();
  cursorY += headerCardHeight + gap;

  // 3. Optional Spot Photo
  if (loadedPhoto) {
    ctx.save();
    ctx.shadowColor = 'rgba(15, 23, 42, 0.10)';
    ctx.shadowBlur = 24;
    ctx.shadowOffsetY = 8;
    drawRoundedRect(ctx, PAD, cursorY, INNER_W, photoHeight, 32);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.restore();

    ctx.save();
    drawRoundedRect(ctx, PAD, cursorY, INNER_W, photoHeight, 32);
    ctx.clip();

    // Cover crop calculation
    const imgRatio = loadedPhoto.width / loadedPhoto.height;
    const boxRatio = INNER_W / photoHeight;
    let drawW = INNER_W;
    let drawH = photoHeight;
    let drawX = PAD;
    let drawY = cursorY;

    if (imgRatio > boxRatio) {
      drawH = photoHeight;
      drawW = photoHeight * imgRatio;
      drawX = PAD - (drawW - INNER_W) / 2;
    } else {
      drawW = INNER_W;
      drawH = INNER_W / imgRatio;
      drawY = cursorY - (drawH - photoHeight) / 2;
    }

    ctx.drawImage(loadedPhoto, drawX, drawY, drawW, drawH);
    ctx.restore();

    // Photo border
    ctx.strokeStyle = palette.softBorder;
    ctx.lineWidth = 3;
    drawRoundedRect(ctx, PAD, cursorY, INNER_W, photoHeight, 32);
    ctx.stroke();

    cursorY += photoHeight + gap;
  }

  // 4. Position & Map Radar Panel
  ctx.save();
  ctx.shadowColor = 'rgba(15, 23, 42, 0.08)';
  ctx.shadowBlur = 24;
  ctx.shadowOffsetY = 8;
  drawRoundedRect(ctx, PAD, cursorY, INNER_W, mapPanelHeight, 32);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.restore();

  ctx.strokeStyle = '#e2e8f0';
  ctx.lineWidth = 2;
  drawRoundedRect(ctx, PAD, cursorY, INNER_W, mapPanelHeight, 32);
  ctx.stroke();

  // Left: Stylized Vector Map Card
  const mapBoxX = PAD + 24;
  const mapBoxY = cursorY + 24;
  const mapBoxW = 360;
  const mapBoxH = mapPanelHeight - 48;

  ctx.save();
  drawRoundedRect(ctx, mapBoxX, mapBoxY, mapBoxW, mapBoxH, 24);
  ctx.clip();

  ctx.fillStyle = '#eaf4ff';
  ctx.fillRect(mapBoxX, mapBoxY, mapBoxW, mapBoxH);

  // Stylized map grid blocks & green park patches
  ctx.fillStyle = '#dcfce7';
  drawRoundedRect(ctx, mapBoxX + 24, mapBoxY + 28, 120, 88, 16);
  ctx.fill();
  drawRoundedRect(ctx, mapBoxX + 225, mapBoxY + 195, 110, 84, 16);
  ctx.fill();

  // Stylized roads
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 10;
  ctx.beginPath();
  ctx.moveTo(mapBoxX - 10, mapBoxY + 135);
  ctx.lineTo(mapBoxX + mapBoxW + 10, mapBoxY + 165);
  ctx.moveTo(mapBoxX + 165, mapBoxY - 10);
  ctx.lineTo(mapBoxX + 195, mapBoxY + mapBoxH + 10);
  ctx.moveTo(mapBoxX + 45, mapBoxY + mapBoxH + 10);
  ctx.lineTo(mapBoxX + 295, mapBoxY - 10);
  ctx.stroke();

  // Dashed coordinate crosshairs
  const pinCenterX = mapBoxX + mapBoxW / 2;
  const pinCenterY = mapBoxY + mapBoxH / 2 + 8;

  ctx.save();
  ctx.setLineDash([6, 6]);
  ctx.strokeStyle = `${palette.gradStart}55`;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(pinCenterX, mapBoxY);
  ctx.lineTo(pinCenterX, mapBoxY + mapBoxH);
  ctx.moveTo(mapBoxX, pinCenterY);
  ctx.lineTo(mapBoxX + mapBoxW, pinCenterY);
  ctx.stroke();
  ctx.restore();

  // Concentric radar rings around pin
  ctx.strokeStyle = `${palette.gradStart}38`;
  ctx.lineWidth = 2;
  [48, 92].forEach((radius) => {
    ctx.beginPath();
    ctx.arc(pinCenterX, pinCenterY, radius, 0, Math.PI * 2);
    ctx.stroke();
  });

  // Pin shadow
  ctx.fillStyle = 'rgba(15, 23, 42, 0.22)';
  ctx.beginPath();
  ctx.ellipse(pinCenterX, pinCenterY + 6, 18, 7, 0, 0, Math.PI * 2);
  ctx.fill();

  // Pin teardrop body
  ctx.fillStyle = palette.gradStart;
  ctx.beginPath();
  ctx.arc(pinCenterX, pinCenterY - 28, 26, Math.PI, 0, false);
  ctx.bezierCurveTo(
    pinCenterX + 26,
    pinCenterY - 10,
    pinCenterX + 6,
    pinCenterY - 2,
    pinCenterX,
    pinCenterY + 4
  );
  ctx.bezierCurveTo(
    pinCenterX - 6,
    pinCenterY - 2,
    pinCenterX - 26,
    pinCenterY - 10,
    pinCenterX - 26,
    pinCenterY - 28
  );
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 4;
  ctx.stroke();

  // Inner white dot of pin
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(pinCenterX, pinCenterY - 28, 9.5, 0, Math.PI * 2);
  ctx.fill();

  // North compass badge in top-right of mini map
  ctx.fillStyle = 'rgba(255, 255, 255, 0.92)';
  drawRoundedRect(ctx, mapBoxX + mapBoxW - 52, mapBoxY + 14, 38, 38, 12);
  ctx.fill();
  ctx.fillStyle = '#0f172a';
  ctx.font = '700 18px "Outfit", system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('N', mapBoxX + mapBoxW - 33, mapBoxY + 39);
  ctx.textAlign = 'left';

  ctx.restore();

  // Map border
  ctx.strokeStyle = '#bfdbfe';
  ctx.lineWidth = 2;
  drawRoundedRect(ctx, mapBoxX, mapBoxY, mapBoxW, mapBoxH, 24);
  ctx.stroke();

  // Right: Position Readout Info
  const infoX = mapBoxX + mapBoxW + 32;
  const infoW = PAD + INNER_W - 28 - infoX;

  ctx.fillStyle = palette.accentText;
  ctx.font = '700 20px "Outfit", "Plus Jakarta Sans", system-ui, sans-serif';
  ctx.fillText('POSIZIONE GPS', infoX, cursorY + 62);

  // Decimal coordinates pill box
  ctx.fillStyle = palette.softBg;
  drawRoundedRect(ctx, infoX, cursorY + 84, infoW, 74, 18);
  ctx.fill();
  ctx.strokeStyle = palette.softBorder;
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.fillStyle = '#0f172a';
  ctx.font = '600 32px "JetBrains Mono", monospace';
  ctx.fillText(`${spot.lat.toFixed(5)}, ${spot.lon.toFixed(5)}`, infoX + 20, cursorY + 132);

  // Cardinal lat/lon
  ctx.fillStyle = '#475569';
  ctx.font = '500 24px "JetBrains Mono", monospace';
  ctx.fillText(
    `${formatCardinalCoord(spot.lat, 'N', 'S')} · ${formatCardinalCoord(spot.lon, 'E', 'O')}`,
    infoX,
    cursorY + 198
  );

  // Distance or status info
  if (typeof spot.dist === 'number' && Number.isFinite(spot.dist)) {
    ctx.fillStyle = '#059669';
    ctx.font = '700 25px "Plus Jakarta Sans", system-ui, sans-serif';
    ctx.fillText(`Distanza attuale: ${formatDistance(spot.dist)}`, infoX, cursorY + 244);
  } else {
    ctx.fillStyle = '#64748b';
    ctx.font = '600 24px "Plus Jakarta Sans", system-ui, sans-serif';
    ctx.fillText('Coordinate pronte per navigatore', infoX, cursorY + 244);
  }

  // Maps URL hint
  ctx.fillStyle = '#64748b';
  ctx.font = '500 20px "JetBrains Mono", monospace';
  ctx.fillText(
    `maps.google.com/?q=${spot.lat.toFixed(4)},${spot.lon.toFixed(4)}`,
    infoX,
    cursorY + 296
  );

  cursorY += mapPanelHeight + gap;

  // 5. Notes Card (optional)
  if (noteLines.length > 0) {
    ctx.save();
    ctx.shadowColor = 'rgba(15, 23, 42, 0.06)';
    ctx.shadowBlur = 20;
    ctx.shadowOffsetY = 6;
    drawRoundedRect(ctx, PAD, cursorY, INNER_W, noteCardHeight, 28);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.restore();

    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 2;
    drawRoundedRect(ctx, PAD, cursorY, INNER_W, noteCardHeight, 28);
    ctx.stroke();

    ctx.fillStyle = palette.accentText;
    ctx.font = '700 20px "Outfit", "Plus Jakarta Sans", system-ui, sans-serif';
    ctx.fillText('NOTE & DETTAGLI', PAD + 36, cursorY + 48);

    ctx.fillStyle = '#1e293b';
    ctx.font = '500 28px "Plus Jakarta Sans", system-ui, sans-serif';
    let noteY = cursorY + 94;
    for (const line of noteLines) {
      ctx.fillText(line, PAD + 36, noteY);
      noteY += 40;
    }

    cursorY += noteCardHeight + gap;
  }

  // 6. Footer Summary Strip
  ctx.fillStyle = palette.softBg;
  drawRoundedRect(ctx, PAD, cursorY, INNER_W, footerHeight, 24);
  ctx.fill();
  ctx.strokeStyle = palette.softBorder;
  ctx.lineWidth = 2;
  ctx.stroke();

  const attachments: string[] = [];
  if (loadedPhoto) attachments.push('Foto inclusa');
  if (isSafeAudioDataUrl(spot.voiceMemo)) {
    const dur =
      typeof spot.voiceMemoDuration === 'number' && spot.voiceMemoDuration > 0
        ? ` (${formatAudioDuration(spot.voiceMemoDuration)})`
        : '';
    attachments.push(`Memo vocale${dur}`);
  }
  const leftFooter =
    attachments.length > 0 ? attachments.join(' · ') : 'Scheda posizione completa';

  ctx.fillStyle = palette.accentText;
  ctx.font = '700 23px "Plus Jakarta Sans", system-ui, sans-serif';
  ctx.fillText(leftFooter, PAD + 32, cursorY + 56);

  ctx.textAlign = 'right';
  ctx.fillStyle = '#64748b';
  ctx.font = '600 22px "Outfit", "Plus Jakarta Sans", system-ui, sans-serif';
  ctx.fillText('Segnaposto Rapido', PAD + INNER_W - 32, cursorY + 56);
  ctx.textAlign = 'left';

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (result) => {
        if (result) resolve(result);
        else reject(new Error('Errore nella generazione del file PNG.'));
      },
      'image/png',
      1
    );
  });

  const dataUrl = canvas.toDataURL('image/png');
  return {
    dataUrl,
    blob,
    width: W,
    height: H,
    filename: buildInfographicFilename(spot.title),
  };
}
