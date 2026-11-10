import React, { useState, useEffect } from 'react';
import {
  X,
  MessageSquareQuote,
  UserCheck,
  Bookmark,
  Copy,
  Check,
  Loader2,
  Tag,
  AlertTriangle,
} from 'lucide-react';
import { FatwaItem } from '../types';
import { copyTextToClipboard } from '../utils/clipboard';
import { proofreadAndVocalizeArabic } from '../utils/arabicProofreader';
import { apiFetch } from '../utils/netlifyClientBridge';


interface FatwaReaderModalProps {
  fatwaId: number | null;
  onClose: () => void;
  onToggleBookmark: (item: {
    id: string;
    type: 'fatwa';
    title: string;
    subtitle: string;
    fatwaId: number;
    snippet?: string;
  }) => void;
  isBookmarked: (id: string) => boolean;
  themeMode: 'night' | 'oled' | 'sepia' | 'day';
}

export const FatwaReaderModal: React.FC<FatwaReaderModalProps> = ({
  fatwaId,
  onClose,
  onToggleBookmark,
  isBookmarked,
  themeMode,
}) => {
  const [fatwa, setFatwa] = useState<FatwaItem | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [enableTashkeel, setEnableTashkeel] = useState(true);

  useEffect(() => {
    if (fatwaId) {
      fetchFatwa(fatwaId);
    }
  }, [fatwaId]);

  const fetchFatwa = async (id: number) => {
    setLoading(true);
    try {
      const res = await apiFetch(`/api/fatwa/${id}`);
      if (res.ok) {
        const data = await res.json();
        setFatwa(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (!fatwaId) return null;

  const bookmarkKey = `fatwa-${fatwaId}`;
  const saved = isBookmarked(bookmarkKey);

  const processedQuestion = proofreadAndVocalizeArabic(fatwa?.question || '', {
    fixTypos: true,
    applyTashkeel: enableTashkeel,
  });
  const processedAnswer = proofreadAndVocalizeArabic(fatwa?.answer || '', {
    fixTypos: true,
    applyTashkeel: enableTashkeel,
  });

  const renderTextWithQuran = (text: string) => {
    const segments = text.split(/(﴿[^﴾]+﴾)/g);
    return segments.map((seg, i) =>
      seg.startsWith('﴿') && seg.endsWith('﴾') ? (
        <span
          key={i}
          className="font-amiri text-[#d4af37] font-bold px-1 rounded bg-[#d4af37]/10 border border-[#d4af37]/25 inline"
        >
          {seg}
        </span>
      ) : (
        <React.Fragment key={i}>{seg}</React.Fragment>
      )
    );
  };

  const handleCopy = async () => {
    if (!fatwa) return;
    const text = `فتوى: ${fatwa.title}\nالمفتي: ${fatwa.mufti?.name || 'غير محدد'}\n\nالسؤال:\n${
      processedQuestion.text
    }\n\nالجواب:\n${processedAnswer.text}\n\n[المصدر: خزانة الفتاوى — الموسوعة الإباضية، فتوى رقم ${
      fatwa.fatwa_id
    }]`;
    await copyTextToClipboard(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const themeBg =
    themeMode === 'oled'
      ? 'bg-black text-gray-100 border-white/15 theme-oled'
      : themeMode === 'sepia'
      ? 'bg-[#f4ecd8] text-[#1a1107] border-[#b8a278] theme-sepia'
      : themeMode === 'day'
      ? 'bg-white text-[#0f1419] border-gray-300 theme-day'
      : 'bg-[#16181d] text-[#e3ded4] border-white/15 theme-night';

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/75 backdrop-blur-sm p-0 sm:p-4">
      <div
        className={`w-full max-w-2xl max-h-[92dvh] overflow-y-auto rounded-t-3xl sm:rounded-3xl border shadow-2xl flex flex-col ${themeBg}`}
      >
        {/* Header (Full-width Fatwa title on mobile so long titles never get squeezed) */}
        <div className="sticky top-0 z-10 px-4 sm:px-5 py-3 border-b border-white/10 bg-inherit flex flex-col gap-2">
          <div className="flex items-start justify-between gap-2.5">
            <div className="flex items-start gap-2.5 min-w-0 flex-1">
              <div className="w-9 h-9 rounded-xl bg-[#d4af37]/15 border border-[#d4af37]/40 flex items-center justify-center text-[#d4af37] shrink-0 mt-0.5">
                <MessageSquareQuote className="w-5 h-5" />
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="font-extrabold text-sm sm:text-base leading-snug break-words">
                  {fatwa?.title || `فتوى رقم #${fatwaId}`}
                </h2>
                <p className="text-xs opacity-80 break-words mt-0.5">
                  {fatwa?.mufti?.name || 'خزانة الفتاوى بالموسوعة'}
                </p>
              </div>
            </div>
            <button onClick={onClose} className="p-2 rounded-xl hover:bg-white/10 opacity-80 shrink-0">
              <X className="w-5 h-5" />
            </button>
          </div>

          {fatwa && (
            <div className="flex items-center justify-end gap-1.5 pt-1 border-t border-white/10">
              <button
                type="button"
                onClick={() => setEnableTashkeel((p) => !p)}
                className={`px-2.5 py-1.5 rounded-xl text-[11px] font-bold border transition ${
                  enableTashkeel
                    ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400'
                    : 'border-white/10 opacity-70'
                }`}
              >
                {enableTashkeel ? 'التشكيل مفعّل' : 'تفعيل التشكيل'}
              </button>
              <button
                onClick={() =>
                  onToggleBookmark({
                    id: bookmarkKey,
                    type: 'fatwa',
                    title: fatwa.title,
                    subtitle: `المفتي: ${fatwa.mufti?.name || ''}`,
                    fatwaId: fatwa.fatwa_id,
                    snippet: fatwa.answer?.slice(0, 160),
                  })
                }
                className={`px-2.5 py-1.5 rounded-xl text-[11px] font-bold border flex items-center gap-1 transition ${
                  saved
                    ? 'text-[#d4af37] bg-[#d4af37]/15 border-[#d4af37]/40'
                    : 'border-white/10 opacity-80 hover:bg-white/10'
                }`}
                title="حفظ في المفضلة"
              >
                <Bookmark className="w-3.5 h-3.5 fill-current" />
                <span>{saved ? 'محفوظة' : 'حفظ'}</span>
              </button>
              <button
                onClick={handleCopy}
                className="px-2.5 py-1.5 rounded-xl text-[11px] font-bold bg-[#d4af37]/15 border border-[#d4af37]/30 text-[#d4af37] flex items-center gap-1"
                title="نسخ الفتوى كاملة"
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span>تم النسخ</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>نسخ الفتوى</span>
                  </>
                )}
              </button>
            </div>
          )}
        </div>

        {/* Body */}
        <div className="p-4 sm:p-5 space-y-5">
          {loading ? (
            <div className="py-16 flex flex-col items-center justify-center gap-3 opacity-70">
              <Loader2 className="w-8 h-8 animate-spin text-[#d4af37]" />
              <span className="text-xs">جاري جلب نص الفتوى من الموسوعة...</span>
            </div>
          ) : fatwa ? (
            <>
              {/* Mufti & Meta */}
              <div className="flex flex-wrap items-center gap-2 text-xs">
                {fatwa.mufti?.name && (
                  <span className="px-3 py-1 rounded-full bg-[#d4af37]/15 text-[#d4af37] font-bold flex items-center gap-1.5">
                    <UserCheck className="w-3.5 h-3.5" />
                    <span>{fatwa.mufti.name}</span>
                  </span>
                )}
                {fatwa.content_type_label && (
                  <span className="px-2.5 py-1 rounded-full bg-white/10 opacity-80">
                    {fatwa.content_type_label}
                  </span>
                )}
                <span className="px-2.5 py-1 rounded-full bg-white/5 opacity-60">
                  فتوى #{fatwa.fatwa_id}
                </span>
              </div>

              {/* Question */}
              {fatwa.question && (
                <div className="p-4 rounded-2xl bg-[#d4af37]/10 border border-[#d4af37]/25 space-y-1.5">
                  <span className="text-xs font-bold text-[#d4af37] block">السؤال:</span>
                  <p className="font-naskh text-base leading-relaxed font-semibold">
                    {renderTextWithQuran(processedQuestion.text)}
                  </p>
                </div>
              )}

              {/* Answer */}
              <div className="space-y-2">
                <span className="text-xs font-bold text-emerald-400 block">الجواب:</span>
                <div className="font-naskh text-base sm:text-lg leading-[2.0] sm:leading-[2.1] text-right sm:text-justify break-words whitespace-pre-line">
                  {renderTextWithQuran(processedAnswer.text)}
                </div>
              </div>

              {/* Auto transcript note if video */}
              {(fatwa as any).auto_transcript_note && (
                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{(fatwa as any).auto_transcript_note}</span>
                </div>
              )}

              {/* Topics */}
              {fatwa.topics && fatwa.topics.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-white/10">
                  <Tag className="w-3.5 h-3.5 text-[#d4af37]" />
                  {fatwa.topics.map((t, i) => (
                    <span
                      key={i}
                      className="px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 text-xs opacity-80"
                    >
                      {t}
                    </span>
                  ))}
                </div>
              )}
            </>
          ) : (
            <p className="text-center py-12 text-xs opacity-60">تعذر العثور على الفتوى.</p>
          )}
        </div>
      </div>
    </div>
  );
};
