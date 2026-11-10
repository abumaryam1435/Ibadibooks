import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  ChevronRight,
  ChevronLeft,
  ChevronUp,
  BookOpen,
  ListTree,
  Search,
  Bookmark,
  Copy,
  Check,
  Loader2,
  ZoomIn,
  ZoomOut,
  Info,
  Sparkles,
  Hand,
  Hash,
  ShieldCheck,
} from 'lucide-react';
import { BookPageData, PageSearchResult, AIChatMode } from '../types';
import { copyTextToClipboard } from '../utils/clipboard';
import { getLocalBookById } from '../services/localCatalog';
import { proofreadAndVocalizeArabic } from '../utils/arabicProofreader';
import { BookCover } from './BookCover';

interface BookReaderModalProps {
  bookId: number | null;
  initialPageId?: number;
  highlightTerm?: string;
  onClose: () => void;
  onToggleBookmark: (item: {
    id: string;
    type: 'book' | 'page';
    title: string;
    subtitle: string;
    bookId: number;
    pageId: number;
    pageNumber: number;
    snippet?: string;
  }) => void;
  isBookmarked: (id: string) => boolean;
  onAskAiAboutBook?: (
    bookId: number,
    bookName: string,
    initialPrompt?: string,
    initialMode?: AIChatMode
  ) => void;
  themeMode: 'night' | 'oled' | 'sepia' | 'day';
}

export const BookReaderModal: React.FC<BookReaderModalProps> = ({
  bookId,
  initialPageId = 1,
  highlightTerm = '',
  onClose,
  onToggleBookmark,
  isBookmarked,
  onAskAiAboutBook,
  themeMode,
}) => {
  const [activeTab, setActiveTab] = useState<'read' | 'toc' | 'search' | 'info'>('read');
  const [currentPageId, setCurrentPageId] = useState<number>(initialPageId || 1);
  const [pageData, setPageData] = useState<BookPageData | null>(null);
  const [bookDetails, setBookDetails] = useState<any>(null);
  const [loadingPage, setLoadingPage] = useState(false);
  const [loadingMeta, setLoadingMeta] = useState(false);
  const [fontSize, setFontSize] = useState<number>(21);
  const [copiedCitation, setCopiedCitation] = useState(false);

  // Classical Arabic Tashkeel, Confirmed Typo Proofreading & Quranic Mushaf Preservation State (100% Local & Free)
  const [enableTashkeel, setEnableTashkeel] = useState<boolean>(true);

  // Interactive Mobile Page Picker Sheet / Dropdown State
  const [isPagePickerOpen, setIsPagePickerOpen] = useState(false);
  const [pageSearchInput, setPageSearchInput] = useState('');
  const [selectedRangeStart, setSelectedRangeStart] = useState<number>(1);

  // Client-side page cache for 0ms instant page flipping
  const pageCacheRef = useRef<Map<string, BookPageData>>(new Map());
  const contentScrollRef = useRef<HTMLDivElement | null>(null);

  // Touch Swipe State with real-time finger synchronization & correct RTL direction:
  // - Swiping LEFT (dx < 0): Moves towards next page (التالية - زر اليسار)
  // - Swiping RIGHT (dx > 0): Moves towards previous page (السابقة - زر اليمين)
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);
  const touchStartTime = useRef<number>(0);
  const isHorizontalDrag = useRef<boolean>(false);
  const [swipeOffset, setSwipeOffset] = useState<number>(0);
  const [isTouchDragging, setIsTouchDragging] = useState<boolean>(false);
  const [pageTransitionDir, setPageTransitionDir] = useState<'next' | 'prev' | null>(null);

  // In-book fast search state
  const [inBookQuery, setInBookQuery] = useState(highlightTerm || '');
  const [inBookMatch, setInBookMatch] = useState<'all' | 'phrase'>('all');
  const [inBookMorphology, setInBookMorphology] = useState<boolean>(false);
  const [inBookSearchField, setInBookSearchField] = useState<'both' | 'body' | 'foot'>('both');
  const [inBookResults, setInBookResults] = useState<PageSearchResult[]>([]);
  const [inBookTotal, setInBookTotal] = useState<number>(0);
  const [searchingBook, setSearchingBook] = useState(false);
  const [hasSearchedBook, setHasSearchedBook] = useState(false);

  useEffect(() => {
    if (bookId) {
      setCurrentPageId(initialPageId || 1);
      setActiveTab('read');
      setIsPagePickerOpen(false);
      fetchBookMeta(bookId);
    }
  }, [bookId, initialPageId]);

  useEffect(() => {
    if (bookId && currentPageId) {
      fetchPage(bookId, currentPageId);
      // Sync range bucket (1..100, 101..200, etc.)
      const bucket = Math.floor((currentPageId - 1) / 100) * 100 + 1;
      setSelectedRangeStart(Math.max(1, bucket));
    }
  }, [bookId, currentPageId]);

  // Keyboard arrow navigation (Right arrow = Previous page in RTL, Left arrow = Next page in RTL)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (activeTab !== 'read' || !pageData || isPagePickerOpen) return;
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === 'ArrowLeft' && pageData.next_page_id) {
        goToPage(pageData.next_page_id, 'next');
      } else if (e.key === 'ArrowRight' && pageData.prev_page_id) {
        goToPage(pageData.prev_page_id, 'prev');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  });

  const fetchBookMeta = async (id: number) => {
    setLoadingMeta(true);
    const localBook = getLocalBookById(id);
    try {
      const res = await fetch(`/api/book/${id}`);
      if (res.ok) {
        const data = await res.json();
        setBookDetails({ ...data, local: data.local || localBook });
      } else if (localBook) {
        setBookDetails({ bookId: id, local: localBook });
      }
    } catch {
      if (localBook) {
        setBookDetails({ bookId: id, local: localBook });
      }
    } finally {
      setLoadingMeta(false);
    }
  };

  const prefetchAdjacentPage = async (bId: number, pId: number | null) => {
    if (!pId) return;
    const key = `${bId}:${pId}`;
    if (pageCacheRef.current.has(key)) return;
    try {
      const res = await fetch(`/api/page/${bId}/${pId}`);
      if (res.ok) {
        const data = await res.json();
        pageCacheRef.current.set(key, data);
      }
    } catch {
      // ignore prefetch errors
    }
  };

  const fetchPage = async (bId: number, pId: number) => {
    const cacheKey = `${bId}:${pId}`;
    const cached = pageCacheRef.current.get(cacheKey);
    if (cached) {
      setPageData(cached);
      setPageSearchInput(String(cached.page_id || pId));
      contentScrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
      prefetchAdjacentPage(bId, cached.next_page_id);
      prefetchAdjacentPage(bId, cached.prev_page_id);
      return;
    }

    setLoadingPage(true);
    try {
      const res = await fetch(`/api/page/${bId}/${pId}`);
      if (res.ok) {
        const data = await res.json();
        pageCacheRef.current.set(cacheKey, data);
        setPageData(data);
        setPageSearchInput(String(data.page_id || pId));
        contentScrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
        prefetchAdjacentPage(bId, data.next_page_id);
        prefetchAdjacentPage(bId, data.prev_page_id);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingPage(false);
    }
  };

  const goToPage = (targetPageId: number | null, dir: 'next' | 'prev' = 'next') => {
    if (!targetPageId || targetPageId < 1 || loadingPage) return;
    setPageTransitionDir(dir);
    setCurrentPageId(targetPageId);
    setIsPagePickerOpen(false);
    setTimeout(() => setPageTransitionDir(null), 200);
  };

  // Real-time Synchronized Touch Swipe Handlers (حركة الصفحة تتزامن مع حركة اللمس بالاتجاه الصحيح)
  // - Swiping LEFT (dx < 0): Page translates left in real-time -> turns forward to NEXT page (التالية)
  // - Swiping RIGHT (dx > 0): Page translates right in real-time -> turns backward to PREVIOUS page (السابقة)
  const handleTouchStart = (e: React.TouchEvent) => {
    if (activeTab !== 'read' || isPagePickerOpen || loadingPage) return;
    const selection = window.getSelection();
    if (selection && selection.toString().length > 0) return;

    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
    touchStartTime.current = Date.now();
    isHorizontalDrag.current = false;
    setIsTouchDragging(false);
    setSwipeOffset(0);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (
      activeTab !== 'read' ||
      isPagePickerOpen ||
      loadingPage ||
      touchStartX.current === null ||
      touchStartY.current === null
    )
      return;

    const dx = e.touches[0].clientX - touchStartX.current;
    const dy = e.touches[0].clientY - touchStartY.current;

    // Detect if this is an intentional horizontal page swipe rather than a vertical scroll
    if (!isHorizontalDrag.current) {
      if (Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy) * 1.15) {
        isHorizontalDrag.current = true;
        setIsTouchDragging(true);
      } else if (Math.abs(dy) > 12) {
        // User is scrolling vertically through text
        return;
      }
    }

    if (isHorizontalDrag.current) {
      // 1:1 Real-time page movement synchronized with finger touch
      let effectiveOffset = dx;

      // Gentle rubber-band resistance when at boundaries of book
      if (dx < 0 && !pageData?.next_page_id) {
        effectiveOffset = dx * 0.22;
      } else if (dx > 0 && !pageData?.prev_page_id) {
        effectiveOffset = dx * 0.22;
      }

      setSwipeOffset(effectiveOffset);
    }
  };

  const handleTouchEnd = () => {
    if (activeTab !== 'read' || touchStartX.current === null) return;

    const dx = swipeOffset;
    const elapsed = Math.max(1, Date.now() - touchStartTime.current);
    const velocity = Math.abs(dx) / elapsed; // px per ms
    const threshold = 48; // minimum drag distance in px
    const isFlick = velocity > 0.35 && Math.abs(dx) > 22;

    setIsTouchDragging(false);

    // Direction:
    // dx < 0 (Swiped Left): advances to NEXT page (التالية)
    if ((dx <= -threshold || (dx < -22 && isFlick)) && pageData?.next_page_id) {
      goToPage(pageData.next_page_id, 'next');
    }
    // dx > 0 (Swiped Right): goes back to PREVIOUS page (السابقة)
    else if ((dx >= threshold || (dx > 22 && isFlick)) && pageData?.prev_page_id) {
      goToPage(pageData.prev_page_id, 'prev');
    }

    touchStartX.current = null;
    touchStartY.current = null;
    isHorizontalDrag.current = false;
    setSwipeOffset(0);
  };

  const executeInBookSearch = async (
    queryOverride?: string,
    matchOverride?: 'all' | 'phrase',
    fieldOverride?: 'both' | 'body' | 'foot',
    morphOverride?: boolean
  ) => {
    const q = (queryOverride !== undefined ? queryOverride : inBookQuery).trim();
    if (!bookId || !q) return;
    const m = matchOverride !== undefined ? matchOverride : inBookMatch;
    const f = fieldOverride !== undefined ? fieldOverride : inBookSearchField;
    const morph = morphOverride !== undefined ? morphOverride : inBookMorphology;

    setSearchingBook(true);
    setHasSearchedBook(true);
    try {
      const res = await fetch(
        `/api/search/pages?q=${encodeURIComponent(
          q
        )}&book_id=${bookId}&match=${m}&search_in=${f}&morphology=${morph}&limit=30`
      );
      if (res.ok) {
        const data = await res.json();
        setInBookResults(data.results || []);
        setInBookTotal(data.total_hits || 0);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSearchingBook(false);
    }
  };

  const handleInBookSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    await executeInBookSearch();
  };

  if (!bookId) return null;

  const bookTitle =
    pageData?.book_name ||
    bookDetails?.details?.book_name ||
    bookDetails?.local?.title ||
    `كتاب رقم ${bookId}`;
  const authorName =
    pageData?.author_name ||
    bookDetails?.details?.main_author?.name ||
    bookDetails?.local?.author ||
    '';

  const totalBookPages: number = Math.max(
    bookDetails?.toc?.pages_total || 0,
    bookDetails?.local?.pagesCount || 0,
    currentPageId,
    pageData?.next_page_id || 100
  );

  const isPrintedMatch =
    pageData?.numbering === 'printed' ||
    pageData?.citable === true ||
    pageData?.numbering_declared === 'موافق للمطبوع';

  const handleCopyCitation = async () => {
    const numberingTag = isPrintedMatch ? 'موافق للمطبوع' : 'ترقيم آلي متسلسل';
    const citation = `${bookTitle} — ${authorName}، ج ${pageData?.part || 1}، ص ${
      pageData?.page_number || currentPageId
    } (${numberingTag}) — الموسوعة الإباضية: https://ibadi.net/book/${bookId}`;
    const fullText = pageData?.body
      ? `«${pageData.body.slice(0, 500)}${pageData.body.length > 500 ? '...' : ''}»\n\n[المصدر: ${citation}]`
      : citation;
    await copyTextToClipboard(fullText);
    setCopiedCitation(true);
    setTimeout(() => setCopiedCitation(false), 2000);
  };

  // Process page text locally in 0ms without any API consumption (fixes confirmed typos like الحج المبروز -> الحج المبرور
  // and protects Quranic verses ﴿...﴾ in Mushaf script)
  const processedBody = proofreadAndVocalizeArabic(pageData?.body || '', {
    fixTypos: true,
    applyTashkeel: enableTashkeel,
  });

  const processedFoot = proofreadAndVocalizeArabic(pageData?.foot || '', {
    fixTypos: true,
    applyTashkeel: enableTashkeel,
  });

  const allCorrections = processedBody.corrections;

  const bookmarkKey = `page-${bookId}-${currentPageId}`;
  const saved = isBookmarked(bookmarkKey);

  // Build 100-page range buckets for the mobile dropdown selector
  const rangeBuckets: { start: number; end: number; label: string }[] = [];
  const maxP = Math.max(totalBookPages, 1);
  for (let start = 1; start <= maxP; start += 100) {
    const end = Math.min(maxP, start + 99);
    rangeBuckets.push({
      start,
      end,
      label: `الصفحات ${start} – ${end}`,
    });
  }

  // Pages to display inside the mobile page picker grid
  const searchNumFilter = parseInt(pageSearchInput.trim(), 10);
  const pagesInCurrentBucket = Array.from(
    { length: Math.min(100, Math.max(1, maxP - selectedRangeStart + 1)) },
    (_, i) => selectedRangeStart + i
  );

  // Diacritic-aware search highlight pattern so vocalized words (e.g. الصَّلَاةُ) still highlight when searching unvocalized (الصلاة)
  const buildDiacriticAwarePattern = (word: string) => {
    const cleanWord = word.replace(/[\u064B-\u0652\u0670]/g, '');
    return cleanWord
      .split('')
      .map((ch) => {
        const escapedCh = ch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        if ('اأإآ'.includes(ch)) return '[اأإآ][\u064B-\u0652\u0670]*';
        if ('هة'.includes(ch)) return '[هة][\u064B-\u0652\u0670]*';
        if ('يى'.includes(ch)) return '[يى][\u064B-\u0652\u0670]*';
        return `${escapedCh}[\u064B-\u0652\u0670]*`;
      })
      .join('');
  };

  const renderHighlightedSegment = (segmentText: string, regex: RegExp | null, keyPrefix: string) => {
    if (!regex) return segmentText;
    const parts = segmentText.split(regex);
    return parts.map((part, i) =>
      i % 2 === 1 ? (
        <mark key={`${keyPrefix}-${i}`} className="search-highlight">
          {part}
        </mark>
      ) : (
        part
      )
    );
  };

  // Format text with Reverent Mushaf Quranic Spans (﴿...﴾) + High-Contrast Search Term Highlighting
  const renderFormattedText = (rawText: string) => {
    if (!rawText) return null;
    const clean = rawText.replace(/\r\n|\r/g, '\n');
    const paragraphs = clean.split('\n').filter((p) => p.trim().length > 0);
    const term = (inBookQuery || highlightTerm).trim();
    const words = term.split(/\s+/).filter((w) => w.length >= 2);
    const highlightRegex =
      words.length > 0
        ? new RegExp(`(${words.map(buildDiacriticAwarePattern).join('|')})`, 'gi')
        : null;

    return paragraphs.map((para, idx) => {
      // Split paragraph by Quranic Mushaf brackets ﴿...﴾ so Quranic verses are styled in authentic Mushaf Amiri font
      const quranSegments = para.split(/(﴿[^﴾]+﴾)/g);
      return (
        <p key={idx} className="mb-4 leading-[2.1] text-justify">
          {quranSegments.map((seg, sIdx) => {
            if (seg.startsWith('﴿') && seg.endsWith('﴾')) {
              return (
                <span
                  key={sIdx}
                  className="font-amiri text-[#d4af37] font-bold px-1 rounded bg-[#d4af37]/10 border border-[#d4af37]/25 inline"
                  title="نص قرآني محفوظ ومطابق لرسم المصحف الشريف"
                >
                  {renderHighlightedSegment(seg, highlightRegex, `q-${idx}-${sIdx}`)}
                </span>
              );
            }
            return (
              <React.Fragment key={sIdx}>
                {renderHighlightedSegment(seg, highlightRegex, `t-${idx}-${sIdx}`)}
              </React.Fragment>
            );
          })}
        </p>
      );
    });
  };

  const themeBg =
    themeMode === 'oled'
      ? 'bg-black text-gray-100 theme-oled'
      : themeMode === 'sepia'
      ? 'bg-[#f4ecd8] text-[#1a1107] theme-sepia'
      : themeMode === 'day'
      ? 'bg-[#faf8f5] text-[#0f1419] theme-day'
      : 'bg-[#121316] text-[#e3ded4] theme-night';

  const themeCard =
    themeMode === 'oled'
      ? 'bg-[#0c0c0e] border-white/15'
      : themeMode === 'sepia'
      ? 'bg-[#ebe0c5] border-[#b8a278]'
      : themeMode === 'day'
      ? 'bg-white border-gray-300'
      : 'bg-[#1a1c22] border-white/10';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md sm:p-4">
      <div
        className={`flex-1 flex flex-col w-full h-[100dvh] sm:h-[92dvh] sm:max-w-3xl lg:max-w-4xl sm:rounded-3xl sm:border sm:border-white/15 shadow-2xl mx-auto overflow-hidden relative ${themeBg}`}
      >
        {/* Top Reader Bar — Full-Width Book Title Line for Phones & Computers */}
        <div className={`px-3 sm:px-4 py-2.5 border-b space-y-2 ${themeCard}`}>
          {/* Row 1: Close Button + Full Book Title (Never truncated, wraps naturally on a full line) */}
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-start gap-2 min-w-0 flex-1">
              <button
                onClick={onClose}
                className="p-1.5 sm:p-2 rounded-xl bg-black/10 hover:bg-black/20 dark:bg-white/10 dark:hover:bg-white/20 shrink-0 mt-0.5"
                aria-label="إغلاق القارئ"
              >
                <X className="w-5 h-5" />
              </button>
              <h2 className="font-extrabold text-sm sm:text-base leading-snug break-words flex-1">
                {bookTitle}
              </h2>
            </div>
          </div>

          {/* Row 2: Author, Category, Page Count Badge + Reader Action Tools */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5">
            <div className="flex flex-wrap items-center gap-1.5 min-w-0 flex-1">
              <span className="text-xs font-medium opacity-90 break-words">
                {authorName}
              </span>
              {pageData?.category && (
                <span className="text-[11px] opacity-80">• {pageData.category}</span>
              )}
              <span className="px-2 py-0.5 rounded-md bg-[#d4af37]/15 border border-[#d4af37]/30 text-[#d4af37] text-[10px] font-bold shrink-0">
                {totalBookPages.toLocaleString('ar-EG')} صفحة
              </span>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              <button
                onClick={() => setFontSize((s) => Math.max(15, s - 2))}
                className="p-1.5 sm:p-2 rounded-lg hover:bg-white/10 opacity-90"
                title="تصغير الخط"
              >
                <ZoomOut className="w-4 h-4" />
              </button>
              <button
                onClick={() => setFontSize((s) => Math.min(32, s + 2))}
                className="p-1.5 sm:p-2 rounded-lg hover:bg-white/10 opacity-90"
                title="تكبير الخط"
              >
                <ZoomIn className="w-4 h-4" />
              </button>
              <button
                onClick={() =>
                  onToggleBookmark({
                    id: bookmarkKey,
                    type: 'page',
                    title: bookTitle,
                    subtitle: `${authorName} — ص ${pageData?.page_number || currentPageId}`,
                    bookId,
                    pageId: currentPageId,
                    pageNumber: pageData?.page_number || currentPageId,
                    snippet: pageData?.body?.slice(0, 180),
                  })
                }
                className={`p-1.5 sm:p-2 rounded-lg transition ${
                  saved ? 'text-[#d4af37] bg-[#d4af37]/15' : 'opacity-85 hover:bg-white/10'
                }`}
                title="حفظ الصفحة في المفضلة"
              >
                <Bookmark className="w-4 h-4 fill-current" />
              </button>
              <button
                onClick={handleCopyCitation}
                className="p-1.5 sm:p-2 rounded-lg hover:bg-white/10 text-[#d4af37]"
                title="نسخ النص مع التوثيق العلمي"
              >
                {copiedCitation ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </div>

        {/* Sub-navigation Tabs inside Book (Mobile-First 4-Column Grid + Desktop Flex) */}
        <div
          className={`px-2 sm:px-3 py-1.5 border-b grid grid-cols-4 sm:flex sm:flex-wrap items-center gap-1 sm:gap-1.5 ${themeCard}`}
        >
          <button
            onClick={() => setActiveTab('read')}
            className={`min-w-0 px-1.5 sm:px-3 py-1.5 rounded-xl text-[11px] sm:text-xs font-bold flex items-center justify-center gap-1 transition ${
              activeTab === 'read'
                ? 'bg-[#d4af37] text-black shadow-xs'
                : 'opacity-85 hover:opacity-100 hover:bg-white/5'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">نص الصفحة</span>
          </button>

          <button
            onClick={() => setActiveTab('search')}
            className={`min-w-0 px-1.5 sm:px-3 py-1.5 rounded-xl text-[11px] sm:text-xs font-bold flex items-center justify-center gap-1 transition ${
              activeTab === 'search'
                ? 'bg-[#d4af37] text-black shadow-xs'
                : 'opacity-85 hover:opacity-100 hover:bg-white/5'
            }`}
          >
            <Search className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">بحث في الكتاب</span>
          </button>

          <button
            onClick={() => setActiveTab('toc')}
            className={`min-w-0 px-1.5 sm:px-3 py-1.5 rounded-xl text-[11px] sm:text-xs font-bold flex items-center justify-center gap-1 transition ${
              activeTab === 'toc'
                ? 'bg-[#d4af37] text-black shadow-xs'
                : 'opacity-85 hover:opacity-100 hover:bg-white/5'
            }`}
          >
            <ListTree className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">
              الفهرس{bookDetails?.toc?.entries?.length ? ` (${bookDetails.toc.entries.length})` : ''}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('info')}
            className={`min-w-0 px-1.5 sm:px-3 py-1.5 rounded-xl text-[11px] sm:text-xs font-bold flex items-center justify-center gap-1 transition ${
              activeTab === 'info'
                ? 'bg-[#d4af37] text-black shadow-xs'
                : 'opacity-85 hover:opacity-100 hover:bg-white/5'
            }`}
          >
            <Info className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">بطاقة الكتاب</span>
          </button>

          {onAskAiAboutBook && (
            <div className="col-span-4 sm:col-span-1 sm:mr-auto mt-0.5 sm:mt-0 grid grid-cols-2 sm:flex items-center gap-1.5">
              <button
                onClick={() => {
                  onAskAiAboutBook(
                    bookId,
                    bookTitle,
                    `لخص لي كتاب ${bookTitle} ومنهجه وأبرز أبوابه وفصوله`,
                    'book_summary'
                  );
                  onClose();
                }}
                className="px-2.5 py-1.5 rounded-xl text-[11px] sm:text-xs font-bold bg-[#d4af37] text-black flex items-center justify-center gap-1 shadow-xs"
              >
                <Sparkles className="w-3.5 h-3.5 shrink-0" />
                <span>لخص لي الكتاب</span>
              </button>
              <button
                onClick={() => {
                  onAskAiAboutBook(bookId, bookTitle, undefined, 'chat');
                  onClose();
                }}
                className="px-2.5 py-1.5 rounded-xl text-[11px] sm:text-xs font-bold bg-[#d4af37]/15 text-[#d4af37] border border-[#d4af37]/30 flex items-center justify-center gap-1"
              >
                <Sparkles className="w-3.5 h-3.5 shrink-0" />
                <span>ناقش هذا الكتاب فقط</span>
              </button>
            </div>
          )}
        </div>

        {/* Floating Touch Swipe Visual Indicator (حركة تفاعلية تتزامن مع السحب بالاتجاه الصحيح) */}
        {swipeOffset !== 0 && activeTab === 'read' && (
          <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 pointer-events-none transition-transform duration-100">
            <div
              className={`px-4 py-2.5 rounded-2xl backdrop-blur-md border text-xs font-bold shadow-2xl flex items-center gap-2 transition ${
                Math.abs(swipeOffset) >= 48
                  ? 'bg-black/90 border-[#d4af37] text-[#d4af37] scale-105 shadow-[#d4af37]/20 ring-1 ring-[#d4af37]/40'
                  : 'bg-black/80 border-white/20 text-gray-200'
              }`}
            >
              {swipeOffset < 0 ? (
                // Dragging LEFT -> Next Page (التالية)
                pageData?.next_page_id ? (
                  <>
                    <ChevronLeft className="w-4 h-4 text-[#d4af37] animate-pulse" />
                    <span>
                      {Math.abs(swipeOffset) >= 48 ? 'أفلت للانتقال إلى' : 'سحب لـ'}{' '}
                      الصفحة التالية (ص {pageData.next_page_id})
                    </span>
                  </>
                ) : (
                  <>
                    <ChevronLeft className="w-4 h-4 opacity-50" />
                    <span>نهاية الكتاب (آخر صفحة)</span>
                  </>
                )
              ) : (
                // Dragging RIGHT -> Previous Page (السابقة)
                pageData?.prev_page_id ? (
                  <>
                    <span>
                      {Math.abs(swipeOffset) >= 48 ? 'أفلت للانتقال إلى' : 'سحب لـ'}{' '}
                      الصفحة السابقة (ص {pageData.prev_page_id})
                    </span>
                    <ChevronRight className="w-4 h-4 text-[#d4af37] animate-pulse" />
                  </>
                ) : (
                  <>
                    <span>بداية الكتاب (أول صفحة)</span>
                    <ChevronRight className="w-4 h-4 opacity-50" />
                  </>
                )
              )}
            </div>
          </div>
        )}

        {/* Main Content Area with 1:1 Synchronized Real-time Touch Drag */}
        <div
          ref={contentScrollRef}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          className="flex-1 overflow-y-auto p-4 sm:p-6 relative will-change-transform"
          style={{
            transform:
              swipeOffset !== 0
                ? `translateX(${swipeOffset}px)`
                : pageTransitionDir === 'next'
                ? 'translateX(-12px)'
                : pageTransitionDir === 'prev'
                ? 'translateX(12px)'
                : 'none',
            transition: isTouchDragging
              ? 'none'
              : 'transform 0.22s cubic-bezier(0.2, 0.8, 0.2, 1), opacity 0.2s ease-out',
            opacity: isTouchDragging
              ? Math.max(0.68, 1 - Math.abs(swipeOffset) / 850)
              : 1,
          }}
        >
          {activeTab === 'read' && (
            <>
              {loadingPage ? (
                <div className="h-64 flex flex-col items-center justify-center gap-3 opacity-70">
                  <Loader2 className="w-8 h-8 animate-spin text-[#d4af37]" />
                  <p className="text-xs">جاري تحميل الصفحة من الموسوعة...</p>
                </div>
              ) : pageData ? (
                <div className="space-y-4 pb-8">
                  {/* Print-Numbering Status, Tashkeel & Copy Controls */}
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                    <span
                      className={`px-2.5 py-1 rounded-lg font-bold border ${
                        isPrintedMatch
                          ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                          : 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                      }`}
                    >
                      {isPrintedMatch
                        ? '✓ ترقيم موافق للمطبوع (يصلح للعزو العلمي)'
                        : 'تنبيه: ترقيم آلي متسلسل (غير موافق للمطبوع)'}
                    </span>

                    <div className="flex flex-wrap items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setEnableTashkeel((prev) => !prev)}
                        className={`px-2.5 py-1 rounded-lg font-bold border flex items-center gap-1 transition ${
                          enableTashkeel
                            ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-400'
                            : 'bg-white/5 border-white/10 opacity-75'
                        }`}
                        title="إظهار التشكيل وحفظ رسم المصحف الشريف محلياً مجاناً دون استهلاك أي رصيد API"
                      >
                        <ShieldCheck className="w-3.5 h-3.5" />
                        <span>{enableTashkeel ? 'التشكيل المحلي: مفعّل' : 'تفعيل التشكيل'}</span>
                      </button>

                      <button
                        onClick={handleCopyCitation}
                        className="px-2.5 py-1 rounded-lg bg-[#d4af37]/15 border border-[#d4af37]/30 text-[#d4af37] font-bold flex items-center gap-1"
                      >
                        {copiedCitation ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                            <span>تم النسخ مع التوثيق</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" />
                            <span>نسخ النص مع الإحالة</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Typo Corrections & Quranic Mushaf Protection Notice */}
                  {(allCorrections.length > 0 || processedBody.quranCount > 0) && (
                    <div className="flex flex-wrap items-center gap-2 px-3 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/25 text-[11px] text-emerald-300">
                      {processedBody.quranCount > 0 && (
                        <span className="font-bold flex items-center gap-1">
                          <ShieldCheck className="w-3.5 h-3.5 text-[#d4af37]" />
                          <span>
                            تم تأمين ({processedBody.quranCount}) موضع قرآني برسم المصحف الشريف دون مساس
                          </span>
                        </span>
                      )}
                      {allCorrections.map((c, idx) => (
                        <span
                          key={idx}
                          className="px-2 py-0.5 rounded bg-black/25 border border-emerald-500/30 font-bold"
                        >
                          تصحيح خطأ مطبعي: «{c.wrong}» ← «{c.correct}»
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Arabic Touch Swipe Hint */}
                  <div className="flex items-center justify-between px-3 py-1.5 rounded-xl bg-white/5 border border-white/5 text-[11px] opacity-75">
                    <span className="flex items-center gap-1.5">
                      <Hand className="w-3.5 h-3.5 text-[#d4af37] shrink-0" />
                      <span>اسحب الشاشة لليسار ← للصفحة التالية، أو لليمين → للسابقة (حركة فورية متزامنة)</span>
                    </span>
                  </div>

                  {/* Chapter Breadcrumb */}
                  {pageData.chapter_chain && pageData.chapter_chain.length > 0 && (
                    <div className="p-2.5 rounded-xl bg-[#d4af37]/10 border border-[#d4af37]/25 text-xs text-[#d4af37] font-medium flex flex-wrap items-center gap-1.5">
                      <ListTree className="w-3.5 h-3.5 shrink-0" />
                      {pageData.chapter_chain.map((ch, idx) => (
                        <React.Fragment key={idx}>
                          {idx > 0 && <span className="opacity-50">/</span>}
                          <span>{ch.title}</span>
                        </React.Fragment>
                      ))}
                    </div>
                  )}

                  {/* Main Body Text (المتن) */}
                  <div
                    className="font-naskh selection:bg-[#d4af37]/30 pt-1"
                    style={{ fontSize: `${fontSize}px` }}
                  >
                    {pageData.body ? (
                      renderFormattedText(processedBody.text)
                    ) : (
                      <p className="text-center opacity-60 py-12 text-sm">
                        هذه الصفحة مصورة أو فارغة من النص المفرغ.
                      </p>
                    )}
                  </div>

                  {/* Footnotes (الحاشية) */}
                  {pageData.foot && pageData.foot.trim().length > 2 && (
                    <div className="pt-4 border-t-2 border-[#d4af37]/30 space-y-2">
                      <div className="text-xs font-bold text-[#d4af37] flex items-center gap-1.5">
                        <span>الحواشي والتعليقات:</span>
                      </div>
                      <div
                        className="font-naskh opacity-85 bg-black/15 dark:bg-white/5 p-3.5 rounded-2xl border border-white/5"
                        style={{ fontSize: `${Math.max(14, fontSize - 3)}px` }}
                      >
                        {renderFormattedText(processedFoot.text)}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-16 opacity-60 text-sm">
                  لم يتم العثور على نص لهذه الصفحة.
                </div>
              )}
            </>
          )}

          {activeTab === 'toc' && (
            <div className="space-y-2">
              <h3 className="font-bold text-sm text-[#d4af37] mb-3">
                فهرس الأبواب والفصول ({bookDetails?.toc?.pages_total || ''} صفحة إجمالاً)
              </h3>
              {loadingMeta ? (
                <div className="py-12 flex justify-center">
                  <Loader2 className="w-6 h-6 animate-spin text-[#d4af37]" />
                </div>
              ) : bookDetails?.toc?.entries?.length > 0 ? (
                <div className="space-y-1.5">
                  {bookDetails.toc.entries.map((entry: any) => (
                    <button
                      key={entry.title_id}
                      onClick={() => {
                        setCurrentPageId(entry.page_id);
                        setActiveTab('read');
                      }}
                      className={`w-full text-right p-3 rounded-xl border flex items-center justify-between gap-3 hover:border-[#d4af37]/50 transition ${themeCard}`}
                    >
                      <span className="text-sm font-medium">{entry.title}</span>
                      <span className="text-xs px-2 py-0.5 rounded-lg bg-[#d4af37]/15 text-[#d4af37] shrink-0">
                        ص {entry.page_id}
                      </span>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-xs opacity-70 py-8 text-center">
                  لا يتوفر فهرس شجري مفصل لهذا الكتاب، يمكنك استخدام تبويب «بحث سريع في الكتاب» للوصول الفوري لأي مسألة.
                </p>
              )}
            </div>
          )}

          {activeTab === 'search' && (
            <div className="space-y-4">
              <form onSubmit={handleInBookSearch} className="space-y-2.5">
                <div className="flex items-center gap-2 w-full">
                  <input
                    type="search"
                    value={inBookQuery}
                    onChange={(e) => setInBookQuery(e.target.value)}
                    placeholder={`ابحث عن أي كلمة أو جملة داخل «${bookTitle}»...`}
                    className="flex-1 min-w-0 w-full px-3 sm:px-3.5 py-2.5 rounded-xl bg-black/20 border border-white/15 focus:border-[#d4af37] focus:outline-none text-sm"
                  />
                  <button
                    type="submit"
                    disabled={searchingBook}
                    className="px-3.5 sm:px-4 py-2.5 rounded-xl bg-[#d4af37] text-black font-bold text-xs flex items-center justify-center gap-1.5 shrink-0"
                  >
                    {searchingBook ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                    <span>بحث</span>
                  </button>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div className="flex flex-wrap items-center gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        setInBookMatch('all');
                        if (inBookQuery.trim()) executeInBookSearch(inBookQuery, 'all', inBookSearchField, inBookMorphology);
                      }}
                      className={`px-2.5 py-1 rounded-lg border ${
                        inBookMatch === 'all'
                          ? 'bg-[#d4af37]/20 border-[#d4af37] text-[#d4af37] font-bold'
                          : 'border-transparent opacity-70'
                      }`}
                    >
                      كل الكلمات
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setInBookMatch('phrase');
                        if (inBookQuery.trim()) executeInBookSearch(inBookQuery, 'phrase', inBookSearchField, inBookMorphology);
                      }}
                      className={`px-2.5 py-1 rounded-lg border ${
                        inBookMatch === 'phrase'
                          ? 'bg-[#d4af37]/20 border-[#d4af37] text-[#d4af37] font-bold'
                          : 'border-transparent opacity-70'
                      }`}
                    >
                      عبارة مطابقة
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const nextMorph = !inBookMorphology;
                        setInBookMorphology(nextMorph);
                        if (inBookQuery.trim()) executeInBookSearch(inBookQuery, inBookMatch, inBookSearchField, nextMorph);
                      }}
                      className={`px-2.5 py-1 rounded-lg border ${
                        inBookMorphology
                          ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300 font-bold'
                          : 'border-white/10 opacity-75'
                      }`}
                      title="البحث بالجذر اللغوي والاشتقاقات الصرفية للكلمة"
                    >
                      {inBookMorphology ? '✓ بحث بالجذر' : 'بحث بالجذر'}
                    </button>
                  </div>

                  <div className="flex flex-wrap items-center gap-1">
                    {[
                      { id: 'both', label: 'المتن والحاشية' },
                      { id: 'body', label: 'المتن' },
                      { id: 'foot', label: 'الحاشية' },
                    ].map((fld) => (
                      <button
                        key={fld.id}
                        type="button"
                        onClick={() => {
                          setInBookSearchField(fld.id as any);
                          if (inBookQuery.trim()) executeInBookSearch(inBookQuery, inBookMatch, fld.id as any, inBookMorphology);
                        }}
                        className={`px-2 py-1 rounded-lg border ${
                          inBookSearchField === fld.id
                            ? 'bg-[#d4af37]/20 border-[#d4af37] text-[#d4af37] font-bold'
                            : 'border-transparent opacity-70'
                        }`}
                      >
                        {fld.label}
                      </button>
                    ))}
                  </div>
                </div>
                {inBookTotal > 0 && (
                  <div className="text-xs text-[#d4af37] font-bold">
                    إجمالي المواضع المطابقة داخل هذا الكتاب: {inBookTotal.toLocaleString('ar-EG')} موضع
                  </div>
                )}
              </form>

              {searchingBook ? (
                <div className="py-12 flex flex-col items-center justify-center gap-2 opacity-75">
                  <Loader2 className="w-7 h-7 animate-spin text-[#d4af37]" />
                  <span className="text-xs">جاري البحث داخل صفحات الكتاب...</span>
                </div>
              ) : inBookResults.length > 0 ? (
                <div className="space-y-2.5">
                  {inBookResults.map((hit, i) => (
                    <button
                      key={`${hit.page_id}-${i}`}
                      onClick={() => {
                        setCurrentPageId(hit.page_id);
                        setActiveTab('read');
                      }}
                      className={`w-full text-right p-3.5 rounded-2xl border hover:border-[#d4af37] transition space-y-1.5 ${themeCard}`}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-1.5 text-xs text-[#d4af37]">
                        <div className="flex items-center gap-1.5">
                          <span>{hit.field_label || 'المتن'}</span>
                          {hit.proximity_label && (
                            <span className="px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-400 text-[10px] font-bold">
                              {hit.proximity_label}
                            </span>
                          )}
                        </div>
                        <span className="font-bold">صفحة {hit.page_number}</span>
                      </div>
                      <p
                        className="text-sm font-naskh leading-relaxed opacity-95 line-clamp-3"
                        dangerouslySetInnerHTML={{
                          __html: hit.snippet.replace(
                            /<mark>/g,
                            '<mark class="search-highlight">'
                          ),
                        }}
                      />
                    </button>
                  ))}
                </div>
              ) : hasSearchedBook && inBookQuery.trim() ? (
                <div className={`p-5 rounded-2xl border text-center space-y-3 ${themeCard}`}>
                  <p className="text-sm font-bold text-[#d4af37]">
                    لم يتم العثور على الكلمة «{inBookQuery}» في صفحات هذا الكتاب
                  </p>
                  <p className="text-xs opacity-75 leading-relaxed">
                    قد تكون الكلمة مكتوبة بصيغة صرفية مختلفة أو غير واردة في هذا الكتاب تحديداً.
                  </p>
                  {!inBookMorphology && (
                    <button
                      type="button"
                      onClick={() => {
                        setInBookMorphology(true);
                        executeInBookSearch(inBookQuery, 'all', 'both', true);
                      }}
                      className="px-4 py-2 rounded-xl bg-[#d4af37] text-black text-xs font-bold inline-flex items-center gap-1.5"
                    >
                      <Search className="w-3.5 h-3.5" />
                      <span>إعادة البحث بالجذر اللغوي والاشتقاقات</span>
                    </button>
                  )}
                </div>
              ) : (
                <div className={`p-4 rounded-2xl border space-y-2.5 ${themeCard}`}>
                  <p className="text-xs font-bold text-[#d4af37]">كلمات مقترحة للبحث السريع داخل الكتاب:</p>
                  <div className="flex flex-wrap gap-1.5">
                    {['الله', 'العلم', 'الصلاة', 'الحق', 'القرآن', 'الإيمان'].map((word) => (
                      <button
                        key={word}
                        type="button"
                        onClick={() => {
                          setInBookQuery(word);
                          executeInBookSearch(word, 'all', 'both', inBookMorphology);
                        }}
                        className="px-3 py-1.5 rounded-xl bg-[#d4af37]/10 hover:bg-[#d4af37]/20 border border-[#d4af37]/30 text-xs font-medium transition"
                      >
                        {word}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'info' && (
            <div className="space-y-4">
              <div className={`p-4 rounded-2xl border space-y-3.5 ${themeCard}`}>
                {/* Full-Width Book Title Row so long titles show completely */}
                <h3 className="font-extrabold text-base sm:text-lg text-[#d4af37] leading-relaxed break-words border-b border-white/10 pb-2.5">
                  {bookTitle}
                </h3>

                <div className="flex gap-4 items-start">
                  <BookCover
                    title={bookTitle}
                    author={authorName}
                    coverUrl={bookDetails?.local?.cover}
                    bookId={bookId || 1}
                    category={bookDetails?.details?.category?.name || bookDetails?.local?.category}
                    className="w-20 h-28 shrink-0 rounded-xl"
                    showHoverIcon={false}
                  />
                  <div className="space-y-1.5 min-w-0 flex-1">
                    <p className="text-xs sm:text-sm font-semibold opacity-95 break-words">
                      المؤلف: {authorName}
                    </p>
                    <p className="text-xs sm:text-sm opacity-90 break-words">
                      القسم: {bookDetails?.details?.category?.name || bookDetails?.local?.category}
                    </p>
                    <p className="text-xs sm:text-sm font-bold text-[#d4af37]">
                      عدد صفحات الكتاب: {totalBookPages.toLocaleString('ar-EG')} صفحة
                      {bookDetails?.local?.volumesCount && bookDetails.local.volumesCount > 1
                        ? ` (${bookDetails.local.volumesCount.toLocaleString('ar-EG')} أجزاء/مجلدات)`
                        : ''}
                    </p>
                    <p className="text-xs opacity-80">رقم الكتاب في الموسوعة: #{bookId}</p>
                    <span
                      className={`inline-block px-2.5 py-0.5 rounded-md text-[11px] font-bold ${
                        isPrintedMatch
                          ? 'bg-emerald-500/15 text-emerald-400'
                          : 'bg-amber-500/15 text-amber-300'
                      }`}
                    >
                      {isPrintedMatch ? 'موافق للمطبوع' : 'ترقيم آلي متسلسل'}
                    </span>
                  </div>
                </div>

                {pageData?.numbering_note && (
                  <div className="p-3 rounded-xl bg-black/15 border border-white/10 text-xs leading-relaxed opacity-90">
                    <strong className="text-[#d4af37] block mb-1">حالة الترقيم والعزو العلمي:</strong>
                    {pageData.numbering_note.replace(/\*\*/g, '')}
                  </div>
                )}

                {bookDetails?.details?.publication && (
                  <div className="pt-3 border-t border-white/10">
                    <h4 className="text-xs font-bold text-[#d4af37] mb-1.5">بيانات النشر والطبعة:</h4>
                    <pre className="text-xs font-naskh whitespace-pre-wrap leading-relaxed opacity-90">
                      {bookDetails.details.publication}
                    </pre>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Interactive Mobile Page Selector Bottom Sheet / Dropdown */}
        {isPagePickerOpen && activeTab === 'read' && (
          <div className="absolute inset-0 z-40 bg-black/70 backdrop-blur-xs flex flex-col justify-end">
            <div
              className={`w-full max-h-[78vh] rounded-t-3xl border-t p-4 flex flex-col gap-3.5 shadow-2xl ${themeBg} ${themeCard}`}
            >
              {/* Sheet Header */}
              <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
                <div className="flex items-center gap-2">
                  <Hash className="w-4 h-4 text-[#d4af37]" />
                  <h3 className="font-bold text-sm text-[#d4af37]">
                    الانتقال السريع للصفحة ({totalBookPages} صفحة)
                  </h3>
                </div>
                <button
                  onClick={() => setIsPagePickerOpen(false)}
                  className="p-1.5 rounded-full hover:bg-white/10"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* 1. Direct Search / Jump by Page Number */}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const num = parseInt(pageSearchInput.trim(), 10);
                  if (!isNaN(num) && num >= 1) {
                    goToPage(Math.min(maxP, num), num > currentPageId ? 'next' : 'prev');
                  }
                }}
                className="flex gap-2"
              >
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-[#d4af37] absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="number"
                    min={1}
                    max={maxP}
                    value={pageSearchInput}
                    onChange={(e) => setPageSearchInput(e.target.value)}
                    placeholder={`ابحث عن رقم الصفحة (١ إلى ${maxP})...`}
                    className="w-full pr-9 pl-3 py-2.5 rounded-xl bg-black/25 border border-white/20 focus:border-[#d4af37] focus:outline-none text-sm font-bold"
                  />
                </div>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-[#d4af37] text-black font-bold text-xs shrink-0 shadow-md"
                >
                  انتقال للرقم
                </button>
              </form>

              {/* Quick Step Jumps for Mobile */}
              <div className="grid grid-cols-5 gap-1.5 text-[11px] font-bold">
                <button
                  type="button"
                  onClick={() => goToPage(1, 'prev')}
                  className="py-2 rounded-xl bg-white/5 hover:bg-[#d4af37]/20 border border-white/10"
                >
                  الأولى (١)
                </button>
                <button
                  type="button"
                  onClick={() => goToPage(Math.max(1, currentPageId - 20), 'prev')}
                  className="py-2 rounded-xl bg-white/5 hover:bg-[#d4af37]/20 border border-white/10"
                >
                  -٢٠ ص
                </button>
                <button
                  type="button"
                  onClick={() => goToPage(Math.max(1, Math.floor(maxP / 2)), 'next')}
                  className="py-2 rounded-xl bg-white/5 hover:bg-[#d4af37]/20 border border-white/10"
                >
                  المنتصف
                </button>
                <button
                  type="button"
                  onClick={() => goToPage(Math.min(maxP, currentPageId + 20), 'next')}
                  className="py-2 rounded-xl bg-white/5 hover:bg-[#d4af37]/20 border border-white/10"
                >
                  +٢٠ ص
                </button>
                <button
                  type="button"
                  onClick={() => goToPage(maxP, 'next')}
                  className="py-2 rounded-xl bg-white/5 hover:bg-[#d4af37]/20 border border-white/10"
                >
                  الأخيرة ({maxP})
                </button>
              </div>

              {/* 2. Dropdown Selector for 100-Page Ranges & Chapters */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] opacity-75 block mb-1">
                    اختر نطاق الصفحات من القائمة المنسدلة:
                  </label>
                  <select
                    value={selectedRangeStart}
                    onChange={(e) => setSelectedRangeStart(Number(e.target.value))}
                    className="w-full px-3 py-2.5 rounded-xl bg-black/30 border border-[#d4af37]/40 text-xs font-bold focus:outline-none"
                  >
                    {rangeBuckets.map((b) => (
                      <option key={b.start} value={b.start} className="bg-[#16181d] text-white">
                        {b.label}
                      </option>
                    ))}
                  </select>
                </div>

                {bookDetails?.toc?.entries?.length > 0 && (
                  <div>
                    <label className="text-[11px] opacity-75 block mb-1">
                      أو انتقل مباشرة إلى باب / جزء:
                    </label>
                    <select
                      value=""
                      onChange={(e) => {
                        const targetP = Number(e.target.value);
                        if (targetP >= 1) goToPage(targetP, 'next');
                      }}
                      className="w-full px-3 py-2.5 rounded-xl bg-black/30 border border-white/20 text-xs font-bold focus:outline-none"
                    >
                      <option value="" className="bg-[#16181d] text-gray-400">
                        -- اختر الباب أو الجزء --
                      </option>
                      {bookDetails.toc.entries.map((entry: any) => (
                        <option
                          key={entry.title_id}
                          value={entry.page_id}
                          className="bg-[#16181d] text-white"
                        >
                          {entry.title} (ص {entry.page_id})
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {/* 3. Scrollable Touch Grid of Page Numbers */}
              <div className="flex-1 overflow-y-auto pt-1">
                <div className="grid grid-cols-5 sm:grid-cols-8 gap-1.5">
                  {pagesInCurrentBucket.map((pNum) => {
                    const isCurrent = pNum === currentPageId;
                    const isSearchedMatch = !isNaN(searchNumFilter) && pNum === searchNumFilter;
                    return (
                      <button
                        key={pNum}
                        type="button"
                        onClick={() => goToPage(pNum, pNum > currentPageId ? 'next' : 'prev')}
                        className={`py-2.5 rounded-xl text-xs font-bold border transition ${
                          isCurrent
                            ? 'bg-[#d4af37] text-black border-[#d4af37] shadow-md scale-105'
                            : isSearchedMatch
                            ? 'bg-emerald-500/25 border-emerald-400 text-emerald-300'
                            : 'bg-black/15 border-white/10 hover:border-[#d4af37]/50'
                        }`}
                      >
                        ص {pNum}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Bottom Page Navigation Bar (RTL Arabic Order: Right is Previous, Left is Next) */}
        {activeTab === 'read' && (
          <div className={`px-3.5 py-2.5 border-t flex items-center justify-between gap-2 pb-safe ${themeCard}`}>
            <button
              disabled={!pageData?.prev_page_id || loadingPage}
              onClick={() => goToPage(pageData?.prev_page_id || null, 'prev')}
              className="px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 disabled:opacity-30 text-xs font-bold flex items-center gap-1 transition"
            >
              <ChevronRight className="w-4 h-4" />
              <span>السابقة</span>
            </button>

            {/* Tap on Page Number to open the Mobile Page Selector Sheet & Dropdown */}
            <button
              type="button"
              onClick={() => {
                setPageSearchInput(String(currentPageId));
                setIsPagePickerOpen((prev) => !prev);
              }}
              className="px-3.5 py-2 rounded-xl bg-[#d4af37]/15 hover:bg-[#d4af37]/25 border border-[#d4af37]/40 text-xs font-bold flex items-center gap-2 transition active:scale-95"
              title="اضغط لاختيار الصفحة من القائمة أو البحث عن رقم صفحة"
            >
              <span className="text-[#d4af37]">
                ص {pageData?.page_number || currentPageId}
              </span>
              {bookDetails?.toc?.pages_total && (
                <span className="opacity-70">/ {bookDetails.toc.pages_total}</span>
              )}
              {pageData?.part && (
                <span className="px-1.5 py-0.5 rounded bg-black/25 text-[#d4af37] text-[10px]">
                  ج {pageData.part}
                </span>
              )}
              <ChevronUp
                className={`w-3.5 h-3.5 text-[#d4af37] transition-transform ${
                  isPagePickerOpen ? 'rotate-180' : ''
                }`}
              />
            </button>

            <button
              disabled={!pageData?.next_page_id || loadingPage}
              onClick={() => goToPage(pageData?.next_page_id || null, 'next')}
              className="px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 disabled:opacity-30 text-xs font-bold flex items-center gap-1 transition"
            >
              <span>التالية</span>
              <ChevronLeft className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
