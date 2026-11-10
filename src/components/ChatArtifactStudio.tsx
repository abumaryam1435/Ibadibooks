import React, { useEffect, useRef, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Download,
  FileSpreadsheet,
  FileText,
  Image as ImageIcon,
  Layers,
  Palette,
  Presentation,
  Sparkles,
} from 'lucide-react';
import { AIResearchResponse, ThemeMode } from '../types';
import {
  downloadInfographicPng,
  exportPdfDocument,
  exportPowerPointPptx,
  exportWordDocument,
  InfographicPalette,
  renderInfographicToCanvas,
} from '../utils/artifactExporter';

interface ChatArtifactStudioProps {
  response: AIResearchResponse;
  themeMode: ThemeMode;
}

export const ChatArtifactStudio: React.FC<ChatArtifactStudioProps> = ({
  response,
  themeMode,
}) => {
  const isLightMode = themeMode === 'day' || themeMode === 'sepia';

  // Auto-open Infographic or Slides if the user asked for them in their prompt
  const [showInfographic, setShowInfographic] = useState<boolean>(
    response.requestedArtifact === 'infographic' || response.modeUsed === 'infographic'
  );
  const [showSlides, setShowSlides] = useState<boolean>(
    response.requestedArtifact === 'pptx' || response.modeUsed === 'presentation'
  );
  const [infographicPalette, setInfographicPalette] = useState<InfographicPalette>(
    themeMode === 'sepia' ? 'sepia' : 'gold'
  );
  const [activeSlideIndex, setActiveSlideIndex] = useState<number>(0);
  const [downloadingFormat, setDownloadingFormat] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (showInfographic && canvasRef.current && response.infographicData) {
      renderInfographicToCanvas(canvasRef.current, response.infographicData, infographicPalette);
    }
  }, [showInfographic, response.infographicData, infographicPalette]);

  const handleDownloadInfographic = () => {
    if (!response.infographicData) return;
    setDownloadingFormat('png');
    try {
      downloadInfographicPng(response.infographicData, infographicPalette);
    } finally {
      setTimeout(() => setDownloadingFormat(null), 800);
    }
  };

  const handleDownloadPptx = async () => {
    setDownloadingFormat('pptx');
    try {
      await exportPowerPointPptx(response);
    } finally {
      setTimeout(() => setDownloadingFormat(null), 900);
    }
  };

  const handleDownloadWord = () => {
    setDownloadingFormat('word');
    try {
      exportWordDocument(response);
    } finally {
      setTimeout(() => setDownloadingFormat(null), 800);
    }
  };

  const handleDownloadPdf = () => {
    setDownloadingFormat('pdf');
    try {
      exportPdfDocument(response);
    } finally {
      setTimeout(() => setDownloadingFormat(null), 900);
    }
  };

  const slides = response.slidesData || [];
  const currentSlide = slides[activeSlideIndex] || slides[0];

  const isDocHighlighted =
    response.requestedArtifact === 'word' ||
    response.requestedArtifact === 'pdf' ||
    response.modeUsed === 'document';

  return (
    <div className="mt-4 space-y-3">
      {/* Highlighted Ready Card when user specifically asked for Word or PDF */}
      {isDocHighlighted && (
        <div
          className={`p-3.5 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
            isLightMode
              ? 'bg-emerald-50/90 border-emerald-600/35 text-slate-900'
              : 'bg-emerald-950/35 border-emerald-500/35 text-emerald-100'
          }`}
        >
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-sm">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs sm:text-sm font-bold">
                تم تجهيز المستند العلمي الموثق (Word و PDF)
              </div>
              <div className="text-[11px] opacity-80">
                منسق بالكامل باللغة العربية مع جدول المصادر والأجزاء والصفحات
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 sm:flex items-center gap-2 w-full sm:w-auto">
            <button
              onClick={handleDownloadWord}
              className="px-3 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm transition-all cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 shrink-0" />
              <span>ملف Word (.doc)</span>
            </button>
            <button
              onClick={handleDownloadPdf}
              className="px-3 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm transition-all cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 shrink-0" />
              <span>ملف PDF (.pdf)</span>
            </button>
          </div>
        </div>
      )}

      {/* Studio Action Bar on Every AI Response */}
      <div
        className={`p-2.5 sm:p-3 rounded-2xl border ${
          isLightMode
            ? 'bg-black/[0.03] border-black/15'
            : 'bg-white/[0.03] border-white/10'
        }`}
      >
        <div className="flex items-center justify-between gap-2 mb-2 px-1">
          <span className="text-[11px] font-bold gold-accent-text flex items-center gap-1.5 leading-snug">
            <Sparkles className="w-3.5 h-3.5 shrink-0" />
            <span>تحويل وتصدير هذه الإجابة فوراً (إنفوجرافيك • باوربوينت • وورد • PDF):</span>
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {/* 1. Infographic Button */}
          <button
            onClick={() => setShowInfographic((v) => !v)}
            className={`px-2.5 py-2.5 min-h-[40px] rounded-xl text-[11px] sm:text-xs font-bold border flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              showInfographic
                ? 'bg-[#d4af37] text-[#111215] border-[#d4af37] shadow-sm'
                : isLightMode
                ? 'bg-white hover:bg-amber-50 border-black/15 text-slate-900'
                : 'bg-white/5 hover:bg-white/10 border-white/10 text-gray-200'
            }`}
          >
            <ImageIcon className="w-3.5 h-3.5 text-amber-500 shrink-0" />
            <span className="truncate">{showInfographic ? 'إخفاء الإنفوجرافيك' : 'صورة إنفوجرافيك'}</span>
          </button>

          {/* 2. PowerPoint Presentation Button */}
          <button
            onClick={() => setShowSlides((v) => !v)}
            className={`px-2.5 py-2.5 min-h-[40px] rounded-xl text-[11px] sm:text-xs font-bold border flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              showSlides
                ? 'bg-orange-600 text-white border-orange-500 shadow-sm'
                : isLightMode
                ? 'bg-white hover:bg-orange-50 border-black/15 text-slate-900'
                : 'bg-white/5 hover:bg-white/10 border-white/10 text-gray-200'
            }`}
          >
            <Presentation className="w-3.5 h-3.5 text-orange-500 shrink-0" />
            <span className="truncate">{showSlides ? 'إخفاء الشرائح' : 'عرض باوربوينت'}</span>
          </button>

          {/* 3. Word File Button */}
          <button
            onClick={handleDownloadWord}
            disabled={downloadingFormat === 'word'}
            className={`px-2.5 py-2.5 min-h-[40px] rounded-xl text-[11px] sm:text-xs font-bold border flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              isLightMode
                ? 'bg-white hover:bg-blue-50 border-black/15 text-slate-900'
                : 'bg-white/5 hover:bg-white/10 border-white/10 text-gray-200'
            }`}
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-blue-500 shrink-0" />
            <span className="truncate">
              {downloadingFormat === 'word' ? 'جاري التحميل...' : 'ملف وورد (Word)'}
            </span>
          </button>

          {/* 4. PDF File Button */}
          <button
            onClick={handleDownloadPdf}
            disabled={downloadingFormat === 'pdf'}
            className={`px-2.5 py-2.5 min-h-[40px] rounded-xl text-[11px] sm:text-xs font-bold border flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              isLightMode
                ? 'bg-white hover:bg-rose-50 border-black/15 text-slate-900'
                : 'bg-white/5 hover:bg-white/10 border-white/10 text-gray-200'
            }`}
          >
            <FileText className="w-3.5 h-3.5 text-rose-500 shrink-0" />
            <span className="truncate">{downloadingFormat === 'pdf' ? 'جاري التجهيز...' : 'ملف PDF'}</span>
          </button>
        </div>
      </div>

      {/* Interactive Infographic Poster Studio */}
      {showInfographic && response.infographicData && (
        <div
          className={`p-3.5 sm:p-4 rounded-2xl border space-y-3 ${
            isLightMode
              ? 'bg-[#fbf6ec] border-[#8b5e15]/35'
              : 'bg-[#0b111b] border-[#d4af37]/35'
          }`}
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <div className="flex items-center gap-2">
              <ImageIcon className="w-4 h-4 text-[#d4af37] shrink-0" />
              <span className="text-xs sm:text-sm font-bold gold-accent-text">
                لوحة الإنفوجرافيك العلمية عالية الدقة (PNG)
              </span>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
              <div className="grid grid-cols-3 sm:flex items-center gap-1.5">
                {(
                  [
                    { id: 'gold', label: 'تراثي ذهبي' },
                    { id: 'emerald', label: 'زمردي داكن' },
                    { id: 'sepia', label: 'ورق نهاري' },
                  ] as const
                ).map((p) => (
                  <button
                    key={p.id}
                    onClick={() => setInfographicPalette(p.id)}
                    className={`px-2 py-1.5 rounded-lg text-[11px] font-bold border text-center transition-all cursor-pointer ${
                      infographicPalette === p.id
                        ? 'bg-[#d4af37] text-[#111215] border-[#d4af37]'
                        : 'bg-white/5 border-white/10 reader-muted'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>

              <button
                onClick={handleDownloadInfographic}
                className="w-full sm:w-auto px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm transition-all cursor-pointer"
              >
                <Download className="w-3.5 h-3.5 shrink-0" />
                <span>تحميل الصورة (PNG)</span>
              </button>
            </div>
          </div>

          {/* Live High-Res Canvas Preview */}
          <div className="w-full flex justify-center bg-black/20 rounded-xl p-1.5 sm:p-2 overflow-hidden border border-white/10">
            <canvas
              ref={canvasRef}
              className="w-full max-w-[520px] h-auto rounded-lg shadow-xl border border-[#d4af37]/30"
            />
          </div>
        </div>
      )}

      {/* Interactive PowerPoint Slide Deck Studio */}
      {showSlides && slides.length > 0 && currentSlide && (
        <div
          className={`p-3 sm:p-4 rounded-2xl border space-y-3 ${
            isLightMode
              ? 'bg-[#fbf6ec] border-orange-700/30'
              : 'bg-[#10131a] border-orange-500/35'
          }`}
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-orange-500 shrink-0" />
              <span className="text-xs sm:text-sm font-bold">
                معاينة شرائح العرض التقديمي ({activeSlideIndex + 1} من {slides.length})
              </span>
            </div>

            <button
              onClick={handleDownloadPptx}
              disabled={downloadingFormat === 'pptx'}
              className="w-full sm:w-auto px-3.5 py-2 rounded-xl bg-orange-600 hover:bg-orange-500 text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm transition-all cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 shrink-0" />
              <span>
                {downloadingFormat === 'pptx'
                  ? 'جاري توليد العرض...'
                  : 'تحميل عرض باوربوينت (.pptx)'}
              </span>
            </button>
          </div>

          {/* Slide Card Preview (16:9 feel) */}
          <div
            className={`rounded-2xl p-4 sm:p-6 border min-h-[230px] flex flex-col justify-between ${
              activeSlideIndex === 0
                ? 'bg-gradient-to-br from-[#0d1726] to-[#070b12] text-white border-[#d4af37]/40'
                : isLightMode
                ? 'bg-white text-slate-900 border-black/15'
                : 'bg-[#161a24] text-gray-100 border-white/10'
            }`}
          >
            <div>
              <div className="flex items-center justify-between text-[11px] opacity-75 mb-2">
                <span>الموسوعة الإباضية الشاملة</span>
                <span>
                  شريحة {currentSlide.slideNumber} / {slides.length}
                </span>
              </div>
              <h4
                className={`text-base sm:text-lg font-bold font-amiri mb-1 ${
                  activeSlideIndex === 0 ? 'text-[#dfbe6f]' : 'gold-accent-text'
                }`}
              >
                {currentSlide.title}
              </h4>
              {currentSlide.subtitle && (
                <p className="text-xs font-bold text-emerald-500 mb-3">
                  {currentSlide.subtitle}
                </p>
              )}

              <ul className="space-y-2 my-3">
                {currentSlide.bullets.map((b, i) => (
                  <li
                    key={i}
                    className="text-xs sm:text-sm font-naskh leading-relaxed flex items-start gap-2"
                  >
                    <span className="text-[#d4af37] font-bold mt-0.5">•</span>
                    <span>{b}</span>
                  </li>
                ))}
              </ul>

              {currentSlide.quote && (
                <div className="mt-3 p-2.5 rounded-xl bg-black/15 border-r-4 border-[#d4af37] text-xs font-naskh italic">
                  «{currentSlide.quote}»
                </div>
              )}
            </div>

            {currentSlide.sourceRef && (
              <div className="mt-4 pt-2 border-t border-white/10 text-[11px] font-bold text-emerald-500">
                📚 {currentSlide.sourceRef}
              </div>
            )}
          </div>

          {/* Slide Navigation Controls */}
          <div className="flex items-center justify-between gap-2">
            <button
              onClick={() => setActiveSlideIndex((prev) => Math.max(0, prev - 1))}
              disabled={activeSlideIndex === 0}
              className="px-2.5 sm:px-3 py-1.5 rounded-xl border border-white/15 text-xs font-bold disabled:opacity-40 flex items-center gap-1 shrink-0 cursor-pointer"
            >
              <ChevronRight className="w-4 h-4 shrink-0" />
              <span className="sm:hidden">السابقة</span>
              <span className="hidden sm:inline">الشريحة السابقة</span>
            </button>

            <div className="flex items-center gap-1.5 overflow-x-auto py-1 no-scrollbar">
              {slides.map((s, idx) => (
                <button
                  key={idx}
                  onClick={() => setActiveSlideIndex(idx)}
                  className={`w-6 h-6 rounded-lg text-[11px] font-bold shrink-0 transition-all cursor-pointer ${
                    idx === activeSlideIndex
                      ? 'bg-orange-600 text-white'
                      : 'bg-white/10 opacity-70 hover:opacity-100'
                  }`}
                >
                  {idx + 1}
                </button>
              ))}
            </div>

            <button
              onClick={() =>
                setActiveSlideIndex((prev) => Math.min(slides.length - 1, prev + 1))
              }
              disabled={activeSlideIndex === slides.length - 1}
              className="px-2.5 sm:px-3 py-1.5 rounded-xl border border-white/15 text-xs font-bold disabled:opacity-40 flex items-center gap-1 shrink-0 cursor-pointer"
            >
              <span className="sm:hidden">التالية</span>
              <span className="hidden sm:inline">الشريحة التالية</span>
              <ChevronLeft className="w-4 h-4 shrink-0" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
