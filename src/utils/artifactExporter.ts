import PptxGenJS from 'pptxgenjs';
import { jsPDF } from 'jspdf';
import { AIInfographicData, AIResearchResponse, AISlideItem } from '../types';

export type InfographicPalette = 'gold' | 'emerald' | 'sepia';

function sanitizeFileName(raw: string): string {
  const cleaned = String(raw || 'الموسوعة-الإباضية')
    .replace(/[\\/:*?"<>|«»﴿﴾]/g, '')
    .replace(/\s+/g, '-')
    .slice(0, 45)
    .replace(/^-+|-+$/g, '');
  return cleaned || 'الموسوعة-الإباضية';
}

function triggerBlobDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

/**
 * Helper: Wrap RTL Arabic text onto canvas lines
 */
function wrapCanvasText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines = 10
): string[] {
  const clean = String(text || '').replace(/\s+/g, ' ').trim();
  if (!clean) return [];

  const words = clean.split(' ');
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    const metrics = ctx.measureText(testLine);
    if (metrics.width > maxWidth && currentLine) {
      lines.push(currentLine);
      currentLine = word;
      if (lines.length >= maxLines - 1) {
        break;
      }
    } else {
      currentLine = testLine;
    }
  }

  if (currentLine && lines.length < maxLines) {
    const usedWordsCount = lines.join(' ').split(' ').filter(Boolean).length + currentLine.split(' ').length;
    if (usedWordsCount < words.length) {
      lines.push(`${currentLine}...`);
    } else {
      lines.push(currentLine);
    }
  }

  return lines;
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
  ctx.lineTo(x + w - radius, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
  ctx.lineTo(x + radius, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

/**
 * 1. Render High-Resolution Arabic Infographic Poster on HTML5 Canvas (1200 x 1650)
 */
export function renderInfographicToCanvas(
  canvas: HTMLCanvasElement,
  data: AIInfographicData,
  palette: InfographicPalette = 'gold'
): void {
  const W = 1200;
  const H = 1650;
  canvas.width = W;
  canvas.height = H;

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  ctx.direction = 'rtl';
  ctx.textAlign = 'right';

  const themes = {
    gold: {
      bgTop: '#0d1522',
      bgBottom: '#070b12',
      cardBg: '#131d2e',
      cardBorder: '#c89d42',
      accentGold: '#dfbe6f',
      accentEmerald: '#10b981',
      textMain: '#f8fafc',
      textMuted: '#cbd5e1',
      badgeBg: '#272015',
      quoteBg: '#19221e',
    },
    emerald: {
      bgTop: '#06281e',
      bgBottom: '#03140f',
      cardBg: '#0b3529',
      cardBorder: '#10b981',
      accentGold: '#f59e0b',
      accentEmerald: '#34d399',
      textMain: '#f0fdf4',
      textMuted: '#a7f3d0',
      badgeBg: '#064e3b',
      quoteBg: '#112e26',
    },
    sepia: {
      bgTop: '#f5ead4',
      bgBottom: '#e9d8b8',
      cardBg: '#fdf8ee',
      cardBorder: '#8b5e15',
      accentGold: '#784f04',
      accentEmerald: '#065f46',
      textMain: '#140c04',
      textMuted: '#422c14',
      badgeBg: '#ebe0c9',
      quoteBg: '#efe4cc',
    },
  };

  const t = themes[palette];

  // Background gradient
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, t.bgTop);
  grad.addColorStop(1, t.bgBottom);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  // Decorative outer and inner frames
  ctx.strokeStyle = t.cardBorder;
  ctx.lineWidth = 3;
  drawRoundedRect(ctx, 28, 28, W - 56, H - 56, 26);
  ctx.stroke();

  ctx.strokeStyle = palette === 'sepia' ? 'rgba(120,79,4,0.25)' : 'rgba(223,190,111,0.22)';
  ctx.lineWidth = 1.5;
  drawRoundedRect(ctx, 40, 40, W - 80, H - 80, 20);
  ctx.stroke();

  // Header Badge
  ctx.textAlign = 'center';
  ctx.fillStyle = t.badgeBg;
  drawRoundedRect(ctx, W / 2 - 220, 68, 440, 46, 23);
  ctx.fill();
  ctx.strokeStyle = t.cardBorder;
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.fillStyle = t.accentGold;
  ctx.font = 'bold 21px "Amiri", "Traditional Arabic", serif';
  ctx.fillText(`✦ الموسوعة الإباضية الشاملة • ${data.badge} ✦`, W / 2, 98);

  // Main Title
  ctx.fillStyle = t.textMain;
  ctx.font = 'bold 42px "Amiri", "Traditional Arabic", serif';
  const titleLines = wrapCanvasText(ctx, data.title, W - 180, 2);
  let cursorY = 165;
  for (const line of titleLines) {
    ctx.fillText(line, W / 2, cursorY);
    cursorY += 54;
  }

  // Subtitle
  ctx.fillStyle = t.accentGold;
  ctx.font = 'bold 23px "Amiri", "Noto Naskh Arabic", serif';
  const subLines = wrapCanvasText(ctx, data.subtitle, W - 200, 2);
  for (const line of subLines) {
    ctx.fillText(line, W / 2, cursorY);
    cursorY += 36;
  }

  // Ornamental Divider
  cursorY += 10;
  ctx.strokeStyle = t.cardBorder;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(W / 2 - 260, cursorY);
  ctx.lineTo(W / 2 + 260, cursorY);
  ctx.stroke();

  cursorY += 35;

  // Render Nodes (Cards Grid: up to 6 nodes)
  const nodes = data.nodes.slice(0, 6);
  const isTwoCol = nodes.length >= 4;
  const cardGap = 24;

  if (isTwoCol) {
    const colW = (W - 140 - cardGap) / 2;
    const cardH = 265;
    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i];
      const row = Math.floor(i / 2);
      const isRightCol = i % 2 === 0;
      const cardX = isRightCol ? W - 70 - colW : 70;
      const cardY = cursorY + row * (cardH + cardGap);

      // Card Box
      ctx.fillStyle = t.cardBg;
      drawRoundedRect(ctx, cardX, cardY, colW, cardH, 18);
      ctx.fill();
      ctx.strokeStyle = t.cardBorder;
      ctx.lineWidth = 1.8;
      ctx.stroke();

      // Number Circle on Top-Right
      const badgeR = 24;
      const badgeCx = cardX + colW - 38;
      const badgeCy = cardY + 38;
      ctx.fillStyle = t.accentGold;
      ctx.beginPath();
      ctx.arc(badgeCx, badgeCy, badgeR, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = palette === 'sepia' ? '#ffffff' : '#090d16';
      ctx.textAlign = 'center';
      ctx.font = 'bold 20px "Amiri", sans-serif';
      ctx.fillText(node.number, badgeCx, badgeCy + 7);

      // Node Title
      ctx.textAlign = 'right';
      ctx.fillStyle = t.accentGold;
      ctx.font = 'bold 24px "Amiri", "Traditional Arabic", serif';
      const nTitleLines = wrapCanvasText(ctx, node.title, colW - 95, 1);
      ctx.fillText(nTitleLines[0] || node.title, cardX + colW - 74, cardY + 45);

      // Node Summary
      ctx.fillStyle = t.textMain;
      ctx.font = '21px "Amiri", "Noto Naskh Arabic", serif';
      const sumLines = wrapCanvasText(ctx, node.summary, colW - 44, 4);
      let textY = cardY + 86;
      for (const sLine of sumLines) {
        ctx.fillText(sLine, cardX + colW - 22, textY);
        textY += 32;
      }

      // Node Source Reference Footer
      ctx.fillStyle = t.accentEmerald;
      ctx.font = 'bold 17px "Amiri", sans-serif';
      const refLines = wrapCanvasText(ctx, `📚 ${node.sourceRef}`, colW - 44, 1);
      ctx.fillText(refLines[0] || '', cardX + colW - 22, cardY + cardH - 18);
    }
    const totalRows = Math.ceil(nodes.length / 2);
    cursorY += totalRows * (cardH + cardGap) + 10;
  } else {
    const fullW = W - 140;
    const cardH = 220;
    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i];
      const cardX = 70;
      const cardY = cursorY + i * (cardH + 22);

      ctx.fillStyle = t.cardBg;
      drawRoundedRect(ctx, cardX, cardY, fullW, cardH, 18);
      ctx.fill();
      ctx.strokeStyle = t.cardBorder;
      ctx.lineWidth = 1.8;
      ctx.stroke();

      const badgeCx = cardX + fullW - 42;
      const badgeCy = cardY + 42;
      ctx.fillStyle = t.accentGold;
      ctx.beginPath();
      ctx.arc(badgeCx, badgeCy, 24, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = palette === 'sepia' ? '#ffffff' : '#090d16';
      ctx.textAlign = 'center';
      ctx.font = 'bold 20px "Amiri", sans-serif';
      ctx.fillText(node.number, badgeCx, badgeCy + 7);

      ctx.textAlign = 'right';
      ctx.fillStyle = t.accentGold;
      ctx.font = 'bold 26px "Amiri", serif';
      ctx.fillText(node.title, cardX + fullW - 80, cardY + 48);

      ctx.fillStyle = t.textMain;
      ctx.font = '22px "Amiri", serif';
      const sumLines = wrapCanvasText(ctx, node.summary, fullW - 56, 3);
      let textY = cardY + 90;
      for (const sLine of sumLines) {
        ctx.fillText(sLine, cardX + fullW - 28, textY);
        textY += 34;
      }

      ctx.fillStyle = t.accentEmerald;
      ctx.font = 'bold 18px "Amiri", sans-serif';
      ctx.fillText(`📚 المرجع: ${node.sourceRef}`, cardX + fullW - 28, cardY + cardH - 18);
    }
    cursorY += nodes.length * (cardH + 22) + 10;
  }

  // Golden Quote Box at Bottom if space allows
  if (data.goldenQuote && cursorY < H - 230) {
    const qBoxH = Math.min(200, H - cursorY - 105);
    const qBoxX = 70;
    const qBoxW = W - 140;

    ctx.fillStyle = t.quoteBg;
    drawRoundedRect(ctx, qBoxX, cursorY, qBoxW, qBoxH, 18);
    ctx.fill();
    ctx.strokeStyle = t.accentEmerald;
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.textAlign = 'right';
    ctx.fillStyle = t.accentGold;
    ctx.font = 'bold 22px "Amiri", serif';
    ctx.fillText('❖ شاهد نصي موثق من الموسوعة:', qBoxX + qBoxW - 26, cursorY + 38);

    ctx.fillStyle = t.textMain;
    ctx.font = '21px "Amiri", serif';
    const qLines = wrapCanvasText(ctx, `«${data.goldenQuote.text}»`, qBoxW - 52, 3);
    let qY = cursorY + 74;
    for (const ql of qLines) {
      ctx.fillText(ql, qBoxX + qBoxW - 26, qY);
      qY += 31;
    }

    ctx.fillStyle = t.accentEmerald;
    ctx.font = 'bold 18px "Amiri", sans-serif';
    ctx.fillText(`— ${data.goldenQuote.source}`, qBoxX + qBoxW - 26, cursorY + qBoxH - 16);
  }

  // Footer
  ctx.textAlign = 'center';
  ctx.fillStyle = t.textMuted;
  ctx.font = 'bold 19px "Amiri", sans-serif';
  ctx.fillText(data.footerNote, W / 2, H - 52);
}

export function downloadInfographicPng(
  data: AIInfographicData,
  palette: InfographicPalette = 'gold'
): void {
  const canvas = document.createElement('canvas');
  renderInfographicToCanvas(canvas, data, palette);
  canvas.toBlob((blob) => {
    if (blob) {
      triggerBlobDownload(blob, `إنفوجرافيك-${sanitizeFileName(data.title)}.png`);
    }
  }, 'image/png');
}

/**
 * 2. Generate & Download Real Microsoft PowerPoint (.pptx) File
 */
export async function exportPowerPointPptx(response: AIResearchResponse): Promise<void> {
  const pptx = new PptxGenJS();
  pptx.layout = 'LAYOUT_16x9';
  pptx.rtlMode = true;
  pptx.author = 'الموسوعة الإباضية الشاملة';
  pptx.company = 'الموسوعة الإباضية';
  pptx.subject = response.coreTopic || response.question;
  pptx.title = response.coreTopic || response.question;

  const slides: AISlideItem[] =
    response.slidesData && response.slidesData.length > 0
      ? response.slidesData
      : [
          {
            slideNumber: 1,
            title: response.coreTopic || response.question,
            subtitle: response.modeLabel || 'عرض علمي موثق من الموسوعة الإباضية',
            bullets: response.answer
              .split('\n')
              .map((l) => l.trim())
              .filter((l) => l.length > 15)
              .slice(0, 5),
            sourceRef: 'الموسوعة الإباضية الشاملة',
          },
        ];

  slides.forEach((s, idx) => {
    const slide = pptx.addSlide();
    slide.background = { color: idx === 0 ? '0D1522' : 'FBF6EC' };

    const isCover = idx === 0;
    const titleColor = isCover ? 'DFBE6F' : '784F04';
    const bodyColor = isCover ? 'F8FAFC' : '140C04';
    const subColor = isCover ? '10B981' : '065F46';

    // Top Header Banner
    slide.addText(`الموسوعة الإباضية الشاملة • شريحة (${s.slideNumber} / ${slides.length})`, {
      x: 0.5,
      y: 0.25,
      w: 9.0,
      h: 0.35,
      align: 'right',
      rtlMode: true,
      fontSize: 11,
      bold: true,
      color: subColor,
      fontFace: 'Amiri',
    });

    // Slide Title
    slide.addText(s.title, {
      x: 0.5,
      y: isCover ? 1.2 : 0.7,
      w: 9.0,
      h: isCover ? 1.1 : 0.8,
      align: isCover ? 'center' : 'right',
      rtlMode: true,
      fontSize: isCover ? 26 : 20,
      bold: true,
      color: titleColor,
      fontFace: 'Amiri',
    });

    if (s.subtitle) {
      slide.addText(s.subtitle, {
        x: 0.5,
        y: isCover ? 2.35 : 1.45,
        w: 9.0,
        h: 0.45,
        align: isCover ? 'center' : 'right',
        rtlMode: true,
        fontSize: 14,
        bold: true,
        color: subColor,
        fontFace: 'Amiri',
      });
    }

    // Bullets
    const bulletText = s.bullets.map((b) => `• ${b}`).join('\n\n');
    slide.addText(bulletText, {
      x: 0.6,
      y: isCover ? 3.0 : 2.05,
      w: 8.8,
      h: s.quote ? 1.9 : 2.7,
      align: 'right',
      valign: 'top',
      rtlMode: true,
      fontSize: 14,
      color: bodyColor,
      fontFace: 'Amiri',
    });

    // Optional Quote Box
    if (s.quote && !isCover) {
      slide.addText(`«${s.quote}»`, {
        x: 0.6,
        y: 4.05,
        w: 8.8,
        h: 0.85,
        align: 'right',
        rtlMode: true,
        fontSize: 12,
        italic: true,
        color: '422C14',
        fill: { color: 'EFE4CC' },
        fontFace: 'Amiri',
      });
    }

    // Footer Reference
    if (s.sourceRef) {
      slide.addText(`📚 ${s.sourceRef}`, {
        x: 0.5,
        y: 5.05,
        w: 9.0,
        h: 0.35,
        align: 'right',
        rtlMode: true,
        fontSize: 11,
        bold: true,
        color: subColor,
        fontFace: 'Amiri',
      });
    }
  });

  await pptx.writeFile({
    fileName: `عرض-باوربوينت-${sanitizeFileName(response.coreTopic || response.question)}.pptx`,
  });
}

/**
 * 3. Generate & Download Authentic RTL Microsoft Word Document (.doc)
 */
export function exportWordDocument(response: AIResearchResponse): void {
  const title = response.coreTopic || response.question;
  const modeLabel = response.modeLabel || 'بحث ومستند علمي موثق';

  const escapeHtml = (str: string) =>
    String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

  const paragraphsHtml = response.answer
    .split('\n')
    .map((line) => {
      const trimmed = line.trim();
      if (!trimmed) return '<p style="margin:6pt 0;">&nbsp;</p>';
      if (
        trimmed.startsWith('📘') ||
        trimmed.startsWith('🕌') ||
        trimmed.startsWith('🎓') ||
        trimmed.startsWith('✒️') ||
        trimmed.startsWith('📖') ||
        trimmed.startsWith('📌') ||
        trimmed.startsWith('📄') ||
        trimmed.startsWith('🎨') ||
        trimmed.startsWith('📊') ||
        trimmed.startsWith('أولاً:') ||
        trimmed.startsWith('ثانياً:') ||
        trimmed.startsWith('ثالثاً:') ||
        trimmed.startsWith('رابعاً:') ||
        trimmed.startsWith('🎙️') ||
        trimmed.startsWith('▪')
      ) {
        return `<h2 style="color:#784f04; font-family:'Traditional Arabic','Amiri',serif; font-size:18pt; margin-top:14pt; margin-bottom:6pt; border-bottom:1px solid #d4b87a; padding-bottom:4pt;">${escapeHtml(
          trimmed
        )}</h2>`;
      }
      if (trimmed.startsWith('«') && trimmed.endsWith('»')) {
        return `<div style="background-color:#fdf8ee; border-right:4pt solid #c89d42; padding:10pt 14pt; margin:8pt 0; font-family:'Amiri','Traditional Arabic',serif; font-size:15pt; color:#140c04; line-height:1.9;">${escapeHtml(
          trimmed
        )}</div>`;
      }
      return `<p style="font-family:'Amiri','Traditional Arabic',serif; font-size:15pt; color:#140c04; line-height:1.85; margin:6pt 0; text-align:justify;">${escapeHtml(
        trimmed
      )}</p>`;
    })
    .join('\n');

  const sourcesTableRows = (response.sources || [])
    .map(
      (s, idx) => `
      <tr>
        <td style="border:1px solid #c89d42; padding:6pt; text-align:center;">${idx + 1}</td>
        <td style="border:1px solid #c89d42; padding:6pt; font-weight:bold;">${escapeHtml(s.book_name)}</td>
        <td style="border:1px solid #c89d42; padding:6pt;">${escapeHtml(s.author_name)}</td>
        <td style="border:1px solid #c89d42; padding:6pt; text-align:center;">ج ${escapeHtml(
          String(s.part || 1)
        )} / ص ${escapeHtml(String(s.page_number))}</td>
        <td style="border:1px solid #c89d42; padding:6pt;">${escapeHtml(
          s.numbering_declared || 'مفهرس'
        )}</td>
      </tr>`
    )
    .join('\n');

  const wordHtml = `<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40' dir='rtl' lang='ar'>
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(title)}</title>
  <!--[if gte mso 9]>
  <xml>
    <w:WordDocument>
      <w:View>Print</w:View>
      <w:Zoom>100</w:Zoom>
      <w:DoNotOptimizeForBrowser/>
    </w:WordDocument>
  </xml>
  <![endif]-->
  <style>
    @page {
      size: A4;
      margin: 2.2cm 2.2cm 2.2cm 2.2cm;
    }
    body {
      direction: rtl;
      text-align: right;
      font-family: 'Amiri', 'Traditional Arabic', 'Arial', serif;
      color: #140c04;
      background: #ffffff;
    }
  </style>
</head>
<body dir="rtl">
  <div style="border:2pt solid #c89d42; padding:16pt; background-color:#fbf6ec; text-align:center; margin-bottom:18pt;">
    <p style="margin:0; font-size:13pt; color:#065f46; font-weight:bold;">الموسوعة الإباضية الشاملة • ${escapeHtml(
      modeLabel
    )}</p>
    <h1 style="margin:8pt 0; font-size:24pt; color:#784f04;">${escapeHtml(title)}</h1>
    <p style="margin:0; font-size:12pt; color:#422c14;">السؤال/الطلب: ${escapeHtml(
      response.question
    )}</p>
  </div>

  ${paragraphsHtml}

  ${
    sourcesTableRows
      ? `<h2 style="color:#065f46; font-size:17pt; margin-top:20pt; border-bottom:1px solid #065f46; padding-bottom:4pt;">جدول المصادر المعتمدة من الموسوعة</h2>
      <table dir="rtl" style="width:100%; border-collapse:collapse; font-family:'Amiri','Traditional Arabic',serif; font-size:13pt; margin-top:8pt;">
        <thead>
          <tr style="background-color:#efe4cc; color:#140c04;">
            <th style="border:1px solid #c89d42; padding:6pt;">#</th>
            <th style="border:1px solid #c89d42; padding:6pt;">الكتاب</th>
            <th style="border:1px solid #c89d42; padding:6pt;">المؤلف</th>
            <th style="border:1px solid #c89d42; padding:6pt;">الجزء والصفحة</th>
            <th style="border:1px solid #c89d42; padding:6pt;">حالة الترقيم</th>
          </tr>
        </thead>
        <tbody>
          ${sourcesTableRows}
        </tbody>
      </table>`
      : ''
  }

  <hr style="margin-top:24pt; border:0; border-top:1px solid #c89d42;" />
  <p style="text-align:center; font-size:11pt; color:#5a4328;">تم التوليد والتوثيق الآلي عبر المساعد العلمي الشامل للموسوعة الإباضية</p>
</body>
</html>`;

  const blob = new Blob(['\ufeff', wordHtml], {
    type: 'application/msword;charset=utf-8',
  });
  triggerBlobDownload(blob, `مستند-وورد-${sanitizeFileName(title)}.doc`);
}

/**
 * 4. Generate & Download Multi-Page RTL Arabic PDF Document (.pdf)
 * Renders A4 pages on HTML5 Canvas using native browser Arabic shaping, then packs into jsPDF
 * (Works 100% inside iframes without window.open and preserves Arabic ligatures & Uthmani script!)
 */
export function exportPdfDocument(response: AIResearchResponse): void {
  const PAGE_W = 1240; // High-res A4 width
  const PAGE_H = 1754; // High-res A4 height
  const MARGIN_X = 95;
  const MAX_TEXT_W = PAGE_W - MARGIN_X * 2;

  const createPageCanvas = (pageNum: number) => {
    const c = document.createElement('canvas');
    c.width = PAGE_W;
    c.height = PAGE_H;
    const ctx = c.getContext('2d')!;
    ctx.direction = 'rtl';
    ctx.textAlign = 'right';

    // Warm scholarly paper background
    ctx.fillStyle = '#fcf9f2';
    ctx.fillRect(0, 0, PAGE_W, PAGE_H);

    // Page border
    ctx.strokeStyle = '#c89d42';
    ctx.lineWidth = 3;
    ctx.strokeRect(42, 42, PAGE_W - 84, PAGE_H - 84);

    // Top running header
    ctx.fillStyle = '#784f04';
    ctx.font = 'bold 20px "Amiri", "Traditional Arabic", serif';
    ctx.fillText(
      `الموسوعة الإباضية الشاملة • ${response.modeLabel || 'وثيقة علمية موثقة'}`,
      PAGE_W - MARGIN_X,
      88
    );

    ctx.textAlign = 'left';
    ctx.fillStyle = '#065f46';
    ctx.fillText(`صفحة ${pageNum}`, MARGIN_X, 88);
    ctx.textAlign = 'right';

    ctx.strokeStyle = '#dfd1b4';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(MARGIN_X, 105);
    ctx.lineTo(PAGE_W - MARGIN_X, 105);
    ctx.stroke();

    return { canvas: c, ctx };
  };

  const pages: HTMLCanvasElement[] = [];
  let currentPageNum = 1;
  let { canvas, ctx } = createPageCanvas(currentPageNum);
  pages.push(canvas);
  let cursorY = 160;

  // Document Title Box on Page 1
  ctx.fillStyle = '#f3ead8';
  drawRoundedRect(ctx, MARGIN_X, cursorY - 35, MAX_TEXT_W, 115, 14);
  ctx.fill();
  ctx.strokeStyle = '#c89d42';
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.textAlign = 'center';
  ctx.fillStyle = '#784f04';
  ctx.font = 'bold 34px "Amiri", "Traditional Arabic", serif';
  const titleLines = wrapCanvasText(ctx, response.coreTopic || response.question, MAX_TEXT_W - 60, 2);
  ctx.fillText(titleLines[0] || response.question, PAGE_W / 2, cursorY + 12);
  ctx.fillStyle = '#065f46';
  ctx.font = 'bold 21px "Amiri", serif';
  ctx.fillText(`الطلب: ${response.question.slice(0, 85)}`, PAGE_W / 2, cursorY + 55);
  ctx.textAlign = 'right';

  cursorY += 125;

  const ensureSpace = (neededH: number) => {
    if (cursorY + neededH > PAGE_H - 95) {
      currentPageNum++;
      const next = createPageCanvas(currentPageNum);
      canvas = next.canvas;
      ctx = next.ctx;
      pages.push(canvas);
      cursorY = 155;
    }
  };

  const rawParagraphs = response.answer.split('\n');
  for (const rawLine of rawParagraphs) {
    const trimmed = rawLine.trim();
    if (!trimmed) {
      cursorY += 16;
      continue;
    }

    const isHeading =
      trimmed.startsWith('📘') ||
      trimmed.startsWith('🕌') ||
      trimmed.startsWith('🎓') ||
      trimmed.startsWith('✒️') ||
      trimmed.startsWith('📖') ||
      trimmed.startsWith('📌') ||
      trimmed.startsWith('أولاً:') ||
      trimmed.startsWith('ثانياً:') ||
      trimmed.startsWith('ثالثاً:') ||
      trimmed.startsWith('رابعاً:') ||
      trimmed.startsWith('🎙️') ||
      trimmed.startsWith('▪');

    ctx.font = isHeading
      ? 'bold 26px "Amiri", "Traditional Arabic", serif'
      : '23px "Amiri", "Noto Naskh Arabic", serif';
    ctx.fillStyle = isHeading ? '#784f04' : '#140c04';

    const wrapped = wrapCanvasText(ctx, trimmed, MAX_TEXT_W, 25);
    const lineHeight = isHeading ? 40 : 36;

    if (isHeading) {
      ensureSpace(lineHeight + 20);
      cursorY += 10;
    }

    for (const wLine of wrapped) {
      ensureSpace(lineHeight);
      ctx.font = isHeading
        ? 'bold 26px "Amiri", "Traditional Arabic", serif'
        : '23px "Amiri", "Noto Naskh Arabic", serif';
      ctx.fillStyle = isHeading ? '#784f04' : '#140c04';
      ctx.fillText(wLine, PAGE_W - MARGIN_X, cursorY);
      cursorY += lineHeight;
    }
    cursorY += 6;
  }

  // Pack all pages into jsPDF
  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  pages.forEach((pCanvas, idx) => {
    if (idx > 0) {
      pdf.addPage();
    }
    const imgData = pCanvas.toDataURL('image/jpeg', 0.92);
    pdf.addImage(imgData, 'JPEG', 0, 0, 210, 297);
  });

  pdf.save(`وثيقة-علمية-${sanitizeFileName(response.coreTopic || response.question)}.pdf`);
}
