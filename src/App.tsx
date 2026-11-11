import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Square,
  BookOpen,
  Search,
  Sparkles,
  MessageSquareQuote,
  Settings,
  Moon,
  Sun,
  Key,
  Bookmark,
  ChevronLeft,
  ChevronRight,
  Loader2,
  CheckCircle2,
  ShieldCheck,
  Copy,
  Check,
  Database,
  Filter,
  Trash2,
  ExternalLink,
  FileCheck2,
  Library,
  Compass,
  Eye,
  X,
  SlidersHorizontal,
  ListTree,
  Bot,
  Send,
  RotateCcw,
  FileText,
  Mic,
  GraduationCap,
  Image as ImageIcon,
  Presentation,
} from 'lucide-react';
import {
  CatalogBook,
  CategoryInfo,
  PageSearchResult,
  FatwaItem,
  AIResearchResponse,
  AIChatMode,
  AIChatMessage,
  BookmarkItem,
  ThemeMode,
} from './types';
import { ApiKeyGuideModal } from './components/ApiKeyGuideModal';
import { BookReaderModal } from './components/BookReaderModal';
import { FatwaReaderModal } from './components/FatwaReaderModal';
import { PWAInstallBanner } from './components/PWAInstallBanner';
import { BookCover } from './components/BookCover';
import { AppLogo } from './components/AppLogo';
import { ChatArtifactStudio } from './components/ChatArtifactStudio';
import { getCategoriesSummary, searchLocalCatalog } from './services/localCatalog';
import { copyTextToClipboard } from './utils/clipboard';
import { proofreadAndVocalizeArabic } from './utils/arabicProofreader';
import { extractCleanApiKey, AIProviderType } from './utils/apiKeyParser';
import { apiFetch } from './utils/netlifyClientBridge';


export default function App() {
  // Navigation & Theme State
  const [activeTab, setActiveTab] = useState<'catalog' | 'search' | 'ai' | 'fatawa' | 'settings'>('catalog');
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => {
    return (localStorage.getItem('ibadi_theme') as ThemeMode) || 'night';
  });

  // API Keys State (Supports both Gemini & Claude, auto-sanitized if user pasted a snippet)
  const [userApiKey, setUserApiKey] = useState<string>(() => {
    const raw = localStorage.getItem('ibadi_gemini_key') || '';
    return extractCleanApiKey(raw).cleanKey;
  });
  const [claudeApiKey, setClaudeApiKey] = useState<string>(() => {
    const raw = localStorage.getItem('ibadi_claude_key') || '';
    return extractCleanApiKey(raw).cleanKey;
  });
  const [preferredProvider, setPreferredProvider] = useState<AIProviderType>(() => {
    return (localStorage.getItem('ibadi_ai_provider') as AIProviderType) || 'auto';
  });
  const [hasServerKey, setHasServerKey] = useState<boolean>(false);
  const [isApiModalOpen, setIsApiModalOpen] = useState<boolean>(false);

  // Bookmarks State
  const [bookmarks, setBookmarks] = useState<BookmarkItem[]>(() => {
    try {
      const saved = localStorage.getItem('ibadi_bookmarks');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Reader Modals State
  const [readerBookId, setReaderBookId] = useState<number | null>(null);
  const [readerPageId, setReaderPageId] = useState<number>(1);
  const [readerHighlight, setReaderHighlight] = useState<string>('');
  const [selectedFatwaId, setSelectedFatwaId] = useState<number | null>(null);

  // 1. Instant Local Catalog State (0ms response, works offline & on Netlify)
  const categoriesSummary = useMemo(() => getCategoriesSummary(), []);
  const categories: CategoryInfo[] = categoriesSummary.categories;

  const [catalogQuery, setCatalogQuery] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedEra, setSelectedEra] = useState<'all' | 'classic' | 'modern'>('all');
  const [selectedFormat, setSelectedFormat] = useState<'all' | 'text' | 'pdf'>('all');
  const [catalogPage, setCatalogPage] = useState<number>(1);

  const catalogResult = useMemo(() => {
    return searchLocalCatalog({
      q: catalogQuery,
      category: selectedCategory,
      era: selectedEra,
      format: selectedFormat,
      page: catalogPage,
      limit: 24,
    });
  }, [catalogQuery, selectedCategory, selectedEra, selectedFormat, catalogPage]);

  const catalogBooks: CatalogBook[] = catalogResult.results;
  const catalogTotal: number = catalogResult.total;
  const catalogTotalPages: number = catalogResult.totalPages;

  // Reset catalog page when filters change
  useEffect(() => {
    setCatalogPage(1);
  }, [catalogQuery, selectedCategory, selectedEra, selectedFormat]);

  // 2. Fast Advanced Full-Text Search Tab State
  const [searchModeTab, setSearchModeTab] = useState<'pages' | 'titles' | 'verify'>('pages');
  const [pageQuery, setPageQuery] = useState<string>('');
  const [matchType, setMatchType] = useState<'all' | 'phrase' | 'near'>('all');
  const [useMorphology, setUseMorphology] = useState<boolean>(false);
  const [searchInField, setSearchInField] = useState<'both' | 'body' | 'foot'>('both');
  const [searchFilterBook, setSearchFilterBook] = useState<CatalogBook | null>(null);
  const [bookPickerQuery, setBookPickerQuery] = useState<string>('');
  const [showBookFilterDropdown, setShowBookFilterDropdown] = useState<boolean>(false);

  const [pageResults, setPageResults] = useState<PageSearchResult[]>([]);
  const [titleResults, setTitleResults] = useState<any[]>([]);
  const [pageTotalHits, setPageTotalHits] = useState<number>(0);
  const [searchOffset, setSearchOffset] = useState<number>(0);
  const [searchingPages, setSearchingPages] = useState<boolean>(false);
  const [loadingMorePages, setLoadingMorePages] = useState<boolean>(false);
  const [hasSearchedPages, setHasSearchedPages] = useState<boolean>(false);

  // Filtered books for the Advanced Search Book Picker dropdown
  const bookPickerOptions = useMemo(() => {
    return searchLocalCatalog({ q: bookPickerQuery, limit: 15 }).results;
  }, [bookPickerQuery]);

  // Quote Verification State
  const [quoteInput, setQuoteInput] = useState<string>('');
  const [quoteVerification, setQuoteVerification] = useState<any>(null);
  const [verifyingQuote, setVerifyingQuote] = useState<boolean>(false);

  // 3. Advanced AI Scholarly Chat & Content Creation Studio State
  const [aiQuestion, setAiQuestion] = useState<string>('');
  const [aiMode, setAiMode] = useState<AIChatMode>('auto');
  const [aiScope, setAiScope] = useState<'all' | 'books' | 'fatawa'>('all');
  const [aiScopedBook, setAiScopedBook] = useState<{ id: number; name: string } | null>(null);
  const [aiBookPickerQuery, setAiBookPickerQuery] = useState<string>('');
  const [showAiBookPicker, setShowAiBookPicker] = useState<boolean>(false);
  const [aiLoading, setAiLoading] = useState<boolean>(false);
  const [aiResult, setAiResult] = useState<AIResearchResponse | null>(null);
  const [aiMessages, setAiMessages] = useState<AIChatMessage[]>(() => {
    try {
      const saved = localStorage.getItem('ibadi_ai_chat_history');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [aiError, setAiError] = useState<string | null>(null);
  const [copiedAiMode, setCopiedAiMode] = useState<string | null>(null);
  const [aiLiveStatus, setAiLiveStatus] = useState<string>('');
  const aiAbortControllerRef = useRef<AbortController | null>(null);

  const aiBookPickerOptions = useMemo(() => {
    return searchLocalCatalog({ q: aiBookPickerQuery, limit: 15 }).results;
  }, [aiBookPickerQuery]);

  // 4. Fatawa Tab State
  const [fatwaQuery, setFatwaQuery] = useState<string>('الصلاة');
  const [fatwaResults, setFatwaResults] = useState<FatwaItem[]>([]);
  const [fatwaTotalHits, setFatwaTotalHits] = useState<number>(0);
  const [loadingFatawa, setLoadingFatawa] = useState<boolean>(false);

  // Check Server AI Key Status
  useEffect(() => {
    apiFetch('/api/ai/status')
      .then((r) => r.json())
      .then((data) => {
        setHasServerKey(Boolean(data.hasServerKey));
      })
      .catch(() => setHasServerKey(false));
  }, []);

  // Save theme preference
  useEffect(() => {
    localStorage.setItem('ibadi_theme', themeMode);
  }, [themeMode]);

  // Save AI chat history (keep last 20 messages)
  useEffect(() => {
    try {
      localStorage.setItem('ibadi_ai_chat_history', JSON.stringify(aiMessages.slice(-20)));
    } catch {
      // ignore storage quota errors
    }
  }, [aiMessages]);

  // Save Gemini API Key
  const handleSaveApiKey = (rawKey: string) => {
    const clean = extractCleanApiKey(rawKey).cleanKey;
    setUserApiKey(clean);
    if (clean) {
      localStorage.setItem('ibadi_gemini_key', clean);
    } else {
      localStorage.removeItem('ibadi_gemini_key');
    }
  };

  // Save Claude API Key
  const handleSaveClaudeKey = (rawKey: string) => {
    const clean = extractCleanApiKey(rawKey).cleanKey;
    setClaudeApiKey(clean);
    if (clean) {
      localStorage.setItem('ibadi_claude_key', clean);
    } else {
      localStorage.removeItem('ibadi_claude_key');
    }
  };

  // Save Preferred AI Provider
  const handleChangeProvider = (prov: AIProviderType) => {
    setPreferredProvider(prov);
    localStorage.setItem('ibadi_ai_provider', prov);
  };

  // Bookmark Helpers
  const handleToggleBookmark = (item: Omit<BookmarkItem, 'savedAt'>) => {
    setBookmarks((prev) => {
      const exists = prev.some((b) => b.id === item.id);
      const updated = exists
        ? prev.filter((b) => b.id !== item.id)
        : [{ ...item, savedAt: Date.now() }, ...prev];
      localStorage.setItem('ibadi_bookmarks', JSON.stringify(updated));
      return updated;
    });
  };

  const isBookmarked = useCallback(
    (id: string) => bookmarks.some((b) => b.id === id),
    [bookmarks]
  );

  // Full-Text Page & Chapter Titles Search Handler
  const executePageSearch = async (
    customQ?: string,
    nextOffset = 0,
    morphOverride?: boolean,
    clearBookOverride?: boolean
  ) => {
    const qToUse = (customQ !== undefined ? customQ : pageQuery).trim();
    if (!qToUse) return;
    const morph = morphOverride !== undefined ? morphOverride : useMorphology;
    const bookToFilter = clearBookOverride ? null : searchFilterBook;

    if (nextOffset === 0) {
      setSearchingPages(true);
      setHasSearchedPages(true);
      setSearchOffset(0);
    } else {
      setLoadingMorePages(true);
    }

    try {
      if (searchModeTab === 'titles') {
        const params = new URLSearchParams({
          q: qToUse,
          limit: '20',
          offset: String(nextOffset),
        });
        if (bookToFilter) {
          params.set('book_id', String(bookToFilter.id));
        }
        const res = await apiFetch(`/api/search/titles?${params.toString()}`);
        if (res.ok) {
          const data = await res.json();
          const newItems = data.results || [];
          setTitleResults((prev) => (nextOffset === 0 ? newItems : [...prev, ...newItems]));
          setPageTotalHits(data.total_hits || newItems.length);
          setSearchOffset(nextOffset);
        }
      } else {
        const params = new URLSearchParams({
          q: qToUse,
          match: matchType,
          search_in: searchInField,
          morphology: String(morph),
          limit: '20',
          offset: String(nextOffset),
        });
        if (bookToFilter) {
          params.set('book_id', String(bookToFilter.id));
        }
        const res = await apiFetch(`/api/search/pages?${params.toString()}`);
        if (res.ok) {
          const data = await res.json();
          const newItems = data.results || [];
          setPageResults((prev) => (nextOffset === 0 ? newItems : [...prev, ...newItems]));
          setPageTotalHits(data.total_hits || 0);
          setSearchOffset(nextOffset);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSearchingPages(false);
      setLoadingMorePages(false);
    }
  };

  // Quote Verifier Handler
  const handleVerifyQuote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quoteInput.trim() || quoteInput.trim().length < 5) return;
    setVerifyingQuote(true);
    setQuoteVerification(null);
    try {
      const res = await apiFetch('/api/verify-quote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quote: quoteInput.trim() }),
      });
      if (res.ok) {
        const data = await res.json();
        setQuoteVerification(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setVerifyingQuote(false);
    }
  };

  // Stop ongoing AI streaming generation
  const handleStopAI = () => {
    if (aiAbortControllerRef.current) {
      aiAbortControllerRef.current.abort();
      aiAbortControllerRef.current = null;
    }
    setAiLoading(false);
    setAiLiveStatus('');
    setAiMessages((prev) =>
      prev.map((msg, idx) =>
        idx === prev.length - 1 && msg.role === 'assistant'
          ? { ...msg, isStreaming: false, isStopped: true }
          : msg
      )
    );
  };

  // Advanced AI Scholarly Chat & Content Creation Handler with SSE Streaming
  const handleAskAI = async (
    customPrompt?: string,
    overrideMode?: AIChatMode,
    overrideBook?: { id: number; name: string } | null
  ) => {
    const q = (customPrompt !== undefined ? customPrompt : aiQuestion).trim();
    if (!q) return;

    if (aiAbortControllerRef.current) {
      aiAbortControllerRef.current.abort();
    }
    const abortController = new AbortController();
    aiAbortControllerRef.current = abortController;

    const modeToUse = overrideMode !== undefined ? overrideMode : aiMode;
    const bookToUse = overrideBook !== undefined ? overrideBook : aiScopedBook;

    const userMsg: AIChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: q,
      mode: modeToUse,
      scopedBookName: bookToUse?.name,
      timestamp: Date.now(),
    };

    const assistantMsgId = `assistant-${Date.now()}`;
    const initialAssistantMsg: AIChatMessage = {
      id: assistantMsgId,
      role: 'assistant',
      content: '',
      mode: modeToUse,
      scopedBookName: bookToUse?.name,
      timestamp: Date.now(),
      isStreaming: true,
      statusMessage: 'جاري استيعاب المسألة ومطابقة المصادر في الموسوعة...',
    };

    setAiMessages((prev) => [...prev, userMsg, initialAssistantMsg]);
    setAiQuestion('');
    setAiLoading(true);
    setAiLiveStatus('جاري استيعاب المسألة ومطابقة المصادر في الموسوعة...');
    setAiError(null);

    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (userApiKey) {
        headers['x-gemini-key'] = userApiKey;
      }
      if (claudeApiKey) {
        headers['x-claude-key'] = claudeApiKey;
      }

      const historyPayload = aiMessages.slice(-6).map((m) => ({
        role: m.role,
        content: m.content,
        coreTopic: m.response?.coreTopic,
        bookId: m.response?.matchedBook?.id || (m.scopedBookName ? bookToUse?.id : undefined),
      }));

      let res: Response | null = null;
      try {
        res = await fetch('/api/ai/ask/stream', {
          method: 'POST',
          headers,
          signal: abortController.signal,
          body: JSON.stringify({
            question: q,
            mode: modeToUse,
            searchScope: bookToUse ? 'books' : aiScope,
            bookId: bookToUse?.id,
            preferredProvider,
            history: historyPayload,
          }),
        });
      } catch {
        res = null;
      }

      if (!res || !res.ok || !res.body) {
        // Fallback to POST /api/ai/ask (which works on Netlify Functions and client bridge)
        const fallbackRes = await apiFetch('/api/ai/ask', {
          method: 'POST',
          headers,
          signal: abortController.signal,
          body: JSON.stringify({
            question: q,
            mode: modeToUse,
            searchScope: bookToUse ? 'books' : aiScope,
            bookId: bookToUse?.id,
            preferredProvider,
            history: historyPayload,
          }),
        });
        if (!fallbackRes.ok) {
          throw new Error(`خطأ في استجابة الخادم: ${fallbackRes.status}`);
        }
        const data = await fallbackRes.json();
        setAiResult(data);
        setAiMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMsgId
              ? {
                  ...m,
                  content: data.answer,
                  isStreaming: false,
                  statusMessage: undefined,
                  response: data,
                }
              : m
          )
        );
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';
      let accumulatedAnswer = '';
      let metaData: any = null;

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split('\n\n');
        buffer = events.pop() || '';

        for (const rawEvent of events) {
          if (!rawEvent.trim()) continue;

          let eventType = 'message';
          let dataStr = '';

          const lines = rawEvent.split('\n');
          for (const line of lines) {
            if (line.startsWith('event: ')) {
              eventType = line.slice(7).trim();
            } else if (line.startsWith('data: ')) {
              dataStr = line.slice(6);
            }
          }

          if (!dataStr) continue;

          try {
            const parsedData = JSON.parse(dataStr);

            if (eventType === 'status') {
              const statusText = parsedData.message || '';
              setAiLiveStatus(statusText);
              setAiMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantMsgId
                    ? { ...m, statusMessage: statusText }
                    : m
                )
              );
            } else if (eventType === 'meta') {
              metaData = parsedData;
              setAiMessages((prev) =>
                prev.map((m) => {
                  if (m.id !== assistantMsgId) return m;
                  const synthResponse: AIResearchResponse = {
                    question: q,
                    modeUsed: metaData.modeUsed,
                    modeLabel: metaData.modeLabel,
                    requestedArtifact: metaData.requestedArtifact,
                    coreTopic: metaData.coreTopic,
                    searchQueryUsed: metaData.searchQueryUsed,
                    matchedBook: metaData.matchedBook,
                    answer: accumulatedAnswer,
                    infographicData: metaData.infographicData,
                    slidesData: metaData.slidesData,
                    followUpSuggestions: metaData.followUpSuggestions,
                    sources: metaData.sources || [],
                    fatawaSources: metaData.fatawaSources || [],
                    totalBookHits: metaData.totalBookHits || 0,
                    totalFatwaHits: metaData.totalFatwaHits || 0,
                  };
                  return {
                    ...m,
                    mode: metaData.modeUsed,
                    modeLabel: metaData.modeLabel,
                    scopedBookName: metaData.matchedBook?.title || bookToUse?.name,
                    response: synthResponse,
                  };
                })
              );
            } else if (eventType === 'chunk') {
              accumulatedAnswer += parsedData.text || '';
              setAiMessages((prev) =>
                prev.map((m) => {
                  if (m.id !== assistantMsgId) return m;
                  const currentResp = m.response || {
                    question: q,
                    modeUsed: modeToUse,
                    searchQueryUsed: q,
                    answer: accumulatedAnswer,
                    sources: [],
                    fatawaSources: [],
                    totalBookHits: 0,
                    totalFatwaHits: 0,
                  };
                  return {
                    ...m,
                    content: accumulatedAnswer,
                    isStreaming: true,
                    response: {
                      ...currentResp,
                      answer: accumulatedAnswer,
                    },
                  };
                })
              );
            } else if (eventType === 'done') {
              const finalAns = parsedData.fullAnswer || accumulatedAnswer;
              setAiMessages((prev) =>
                prev.map((m) => {
                  if (m.id !== assistantMsgId) return m;
                  const finalResp: AIResearchResponse = {
                    question: q,
                    modeUsed: metaData?.modeUsed || modeToUse,
                    modeLabel: metaData?.modeLabel,
                    requestedArtifact: metaData?.requestedArtifact,
                    coreTopic: metaData?.coreTopic,
                    searchQueryUsed: metaData?.searchQueryUsed || q,
                    matchedBook: metaData?.matchedBook,
                    answer: finalAns,
                    infographicData: metaData?.infographicData,
                    slidesData: metaData?.slidesData,
                    followUpSuggestions: metaData?.followUpSuggestions,
                    sources: metaData?.sources || [],
                    fatawaSources: metaData?.fatawaSources || [],
                    totalBookHits: metaData?.totalBookHits || 0,
                    totalFatwaHits: metaData?.totalFatwaHits || 0,
                  };
                  setAiResult(finalResp);
                  return {
                    ...m,
                    content: finalAns,
                    isStreaming: false,
                    response: finalResp,
                  };
                })
              );
            } else if (eventType === 'error') {
              setAiError(parsedData.message || 'حدث خطأ أثناء معالجة السؤال');
            }
          } catch {
            // Non-JSON line or parse error
          }
        }
      }
    } catch (err: any) {
      if (err?.name === 'AbortError') {
        // User deliberately clicked Stop
      } else {
        setAiError('حدث خطأ في الاتصال بالخادم. يرجى المحاولة مرة أخرى.');
        setAiMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMsgId ? { ...m, isStreaming: false } : m
          )
        );
      }
    } finally {
      aiAbortControllerRef.current = null;
      setAiLoading(false);
      setAiLiveStatus('');
    }
  };

  // Regenerate last assistant response
  const handleRegenerateLastAI = () => {
    let lastUserQuery = '';
    let lastMode: AIChatMode | undefined = undefined;
    let lastBook: { id: number; name: string } | null = null;

    for (let i = aiMessages.length - 1; i >= 0; i--) {
      if (aiMessages[i].role === 'user') {
        lastUserQuery = aiMessages[i].content;
        lastMode = aiMessages[i].mode;
        break;
      }
    }

    if (!lastUserQuery) return;

    // Remove the last assistant message and re-run
    setAiMessages((prev) => {
      const idx = prev.map((m) => m.role).lastIndexOf('assistant');
      if (idx !== -1) {
        return prev.slice(0, idx);
      }
      return prev;
    });

    handleAskAI(lastUserQuery, lastMode, lastBook || aiScopedBook);
  };

  // Copy AI Answer Helpers
  const handleCopyAiResult = async (
    targetResponse: AIResearchResponse,
    mode: 'answer' | 'full',
    msgId?: string
  ) => {
    if (!targetResponse) return;

    if (mode === 'answer') {
      await copyTextToClipboard(targetResponse.answer);
    } else {
      const bookCitations =
        targetResponse.sources.length > 0
          ? '\n\n📚 المصادر المعتمدة من كتب الموسوعة الإباضية:\n' +
            targetResponse.sources
              .map(
                (s, idx) =>
                  `${idx + 1}. ${s.book_name} — ${s.author_name}، ج ${s.part || 1}، ص ${
                    s.page_number
                  } (${s.numbering_declared || 'مفهرس'})`
              )
              .join('\n')
          : '';

      const fatwaCitations =
        targetResponse.fatawaSources.length > 0
          ? '\n\n⚖️ الفتاوى المعتمدة من خزانة الفتاوى:\n' +
            targetResponse.fatawaSources
              .map(
                (f, idx) =>
                  `${idx + 1}. فتوى: ${f.title} — المفتي: ${f.mufti} (رقم #${f.fatwa_id})`
              )
              .join('\n')
          : '';

      const fullFormatted = `الموضوع / السؤال: ${targetResponse.question}\n\n${targetResponse.answer}${bookCitations}${fatwaCitations}\n\n— مستخرج عبر المساعد العلمي للموسوعة الإباضية`;
      await copyTextToClipboard(fullFormatted);
    }

    const key = `${msgId || 'latest'}-${mode}`;
    setCopiedAiMode(key);
    setTimeout(() => setCopiedAiMode(null), 2200);
  };

  // Fatawa Search Handler
  const executeFatwaSearch = useCallback(async (qStr: string) => {
    if (!qStr.trim()) return;
    setLoadingFatawa(true);
    try {
      const res = await apiFetch(`/api/search/fatawa?q=${encodeURIComponent(qStr.trim())}&limit=16`);
      if (res.ok) {
        const data = await res.json();
        setFatwaResults(data.results || []);
        setFatwaTotalHits(data.total_hits || 0);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingFatawa(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'fatawa' && fatwaResults.length === 0) {
      executeFatwaSearch(fatwaQuery);
    }
  }, [activeTab, fatwaQuery, fatwaResults.length, executeFatwaSearch]);

  // Theme Styling Classes (With high-contrast ink in Sepia & Day modes)
  const themeClasses = {
    night: {
      appBg: 'bg-[#0f1013] text-[#e3ded4] theme-night',
      headerBg: 'bg-[#15171c]/95 border-white/10',
      cardBg: 'bg-[#181b21] border-white/10 hover:border-[#d4af37]/40',
      inputBg: 'bg-[#121418] border-white/15 text-white placeholder:text-gray-500',
      mutedText: 'text-gray-400',
      navBg: 'bg-[#15171c]/95 border-white/10',
    },
    oled: {
      appBg: 'bg-black text-[#ece8df] theme-oled',
      headerBg: 'bg-black/95 border-white/15',
      cardBg: 'bg-[#0a0a0c] border-white/15 hover:border-[#d4af37]/50',
      inputBg: 'bg-[#08080a] border-white/20 text-white placeholder:text-gray-600',
      mutedText: 'text-gray-400',
      navBg: 'bg-black/95 border-white/15',
    },
    sepia: {
      appBg: 'bg-[#f4ecd8] text-[#1a1107] theme-sepia',
      headerBg: 'bg-[#eadec3]/95 border-[#b8a278]',
      cardBg: 'bg-[#efe4ca] border-[#c4af87] hover:border-[#784f04]',
      inputBg: 'bg-[#fbf6ea] border-[#b8a278] text-[#140c04] placeholder:text-[#5c472c]',
      mutedText: 'text-[#3b2a18] font-medium',
      navBg: 'bg-[#eadec3]/95 border-[#b8a278]',
    },
    day: {
      appBg: 'bg-[#f8f7f4] text-[#0f1419] theme-day',
      headerBg: 'bg-white/95 border-gray-300',
      cardBg: 'bg-white border-gray-300 hover:border-[#7c5405] shadow-xs',
      inputBg: 'bg-white border-gray-300 text-[#090d12] placeholder:text-gray-500',
      mutedText: 'text-[#27303f] font-medium',
      navBg: 'bg-white/95 border-gray-300',
    },
  }[themeMode];

  const cycleTheme = () => {
    const order: ThemeMode[] = ['night', 'oled', 'sepia', 'day'];
    const next = order[(order.indexOf(themeMode) + 1) % order.length];
    setThemeMode(next);
  };

  const themeLabels: Record<ThemeMode, string> = {
    night: 'ليلي مريح',
    oled: 'أسود OLED',
    sepia: 'ورق تراثي',
    day: 'نهاري',
  };

  return (
    <div className={`min-h-screen flex flex-col transition-colors duration-200 ${themeClasses.appBg}`}>
      {/* Mobile-First Container that scales cleanly to Desktop Computers */}
      <div className="w-full max-w-5xl mx-auto flex-1 flex flex-col pb-24">
        {/* Sticky Mobile-First & Desktop Responsive Header (رأس الصفحة) */}
        <header
          className={`sticky top-0 z-30 px-3 sm:px-5 py-2.5 sm:py-3 border-b backdrop-blur-md transition-colors ${themeClasses.headerBg}`}
        >
          <div className="flex items-center justify-between gap-2.5">
            {/* Brand Title & Official Encyclopedia Emblem — Full width, zero clutter */}
            <div className="flex items-center gap-2.5 min-w-0 flex-1">
              <AppLogo size="md" showBadge />
              <div className="min-w-0 flex-1">
                <h1 className="font-extrabold text-base sm:text-lg leading-snug break-words">
                  الموسوعة الإباضية الشاملة
                </h1>
                <p className={`text-[11px] sm:text-xs leading-normal break-words ${themeClasses.mutedText}`}>
                  ٢٬٩٣١ كتاباً • ١٬٨١٦ موافق للمطبوع • ٣٠٬١٧٣ فتوى
                </p>
              </div>
            </div>

            {/* Optional Home Screen Install Button (Hidden automatically once installed) */}
            <div className="shrink-0">
              <PWAInstallBanner variant="header-button" />
            </div>
          </div>

          {/* Desktop Quick Navigation Bar (Shown on Computers & Tablets alongside Mobile Bottom Nav) */}
          <div className="hidden md:flex items-center gap-2 pt-2.5 mt-2.5 border-t border-white/10">
            {[
              { id: 'catalog', label: 'فهرس الكتب والأقسام', icon: BookOpen },
              { id: 'search', label: 'البحث المتقدم السريع', icon: Search },
              { id: 'ai', label: 'المساعد والحوار العلمي الشامل', icon: Sparkles },
              { id: 'fatawa', label: 'خزانة الفتاوى (٣٠٬١٧٣)', icon: MessageSquareQuote },
              { id: 'settings', label: 'الضبط والمفضلة والتثبيت', icon: Settings },
            ].map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id as any)}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition ${
                    isActive
                      ? 'bg-[#d4af37] text-black shadow-xs'
                      : 'opacity-75 hover:opacity-100 hover:bg-white/5'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>
        </header>

        {/* TAB 1: CATALOG & BOOKS (الفهرس والكتب - فوري 0ms) */}
        {activeTab === 'catalog' && (
          <main className="p-3.5 space-y-4 flex-1">
            {/* Instant Search Bar */}
            <div className="relative">
              <Search className="w-4 h-4 text-[#d4af37] absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="search"
                value={catalogQuery}
                onChange={(e) => setCatalogQuery(e.target.value)}
                placeholder="ابحث فوراً في عناوين الكتب أو أسماء المؤلفين..."
                className={`w-full pr-10 pl-9 py-3 rounded-2xl border text-sm focus:border-[#d4af37] focus:outline-none transition ${themeClasses.inputBg}`}
              />
              {catalogQuery && (
                <button
                  onClick={() => setCatalogQuery('')}
                  className="absolute left-3 top-1/2 -translate-y-1/2 p-1 opacity-60 hover:opacity-100"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Horizontal Scrollable Categories (46 Scientific Sections) */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs px-1">
                <span className="font-bold text-[#d4af37] flex items-center gap-1">
                  <Compass className="w-3.5 h-3.5" />
                  <span>الأقسام العلمية ({categories.length} قسماً):</span>
                </span>
                {selectedCategory !== 'all' && (
                  <button
                    onClick={() => setSelectedCategory('all')}
                    className="text-[#d4af37] underline text-[11px]"
                  >
                    عرض كل الأقسام
                  </button>
                )}
              </div>

              <div className="flex items-center gap-1.5 overflow-x-auto pb-1.5 no-scrollbar">
                <button
                  onClick={() => setSelectedCategory('all')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold shrink-0 border transition ${
                    selectedCategory === 'all'
                      ? 'bg-[#d4af37] text-black border-[#d4af37]'
                      : `${themeClasses.cardBg}`
                  }`}
                >
                  الكل (٢٬٥٩٥)
                </button>
                {categories.map((cat) => (
                  <button
                    key={cat.name}
                    onClick={() => setSelectedCategory(cat.name)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-medium shrink-0 border transition flex items-center gap-1.5 ${
                      selectedCategory === cat.name
                        ? 'bg-[#d4af37] text-black border-[#d4af37] font-bold'
                        : `${themeClasses.cardBg}`
                    }`}
                  >
                    <span>{cat.name}</span>
                    <span className="text-[10px] opacity-70 px-1.5 py-0.2 rounded-full bg-black/15">
                      {cat.count}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Era & Format Quick Filters */}
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-1">
                <Filter className="w-3.5 h-3.5 text-[#d4af37] ml-1" />
                {[
                  { id: 'all', label: 'كل العصور' },
                  { id: 'classic', label: 'التراث المتقدم' },
                  { id: 'modern', label: 'المعاصرون' },
                ].map((eraItem) => (
                  <button
                    key={eraItem.id}
                    onClick={() => setSelectedEra(eraItem.id as any)}
                    className={`px-2.5 py-1 rounded-lg border transition ${
                      selectedEra === eraItem.id
                        ? 'bg-[#d4af37]/20 border-[#d4af37] text-[#d4af37] font-bold'
                        : 'border-transparent opacity-70 hover:opacity-100'
                    }`}
                  >
                    {eraItem.label}
                  </button>
                ))}
              </div>

              <span className={`text-[11px] font-medium ${themeClasses.mutedText}`}>
                النتائج: <strong className="text-[#d4af37]">{catalogTotal}</strong> كتاب
              </span>
            </div>

            {/* Books Grid (1 Column on Phones, 2 on Tablets, 3 on Desktop Computers) */}
            {catalogBooks.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
                {catalogBooks.map((book) => (
                  <div
                    key={book.id}
                    className={`p-3.5 rounded-2xl border transition flex flex-col gap-2.5 justify-between ${themeClasses.cardBg}`}
                  >
                    {/* Top Row: Full-Line Book Title so long book names appear completely in full on mobile & desktop */}
                    <h3
                      onClick={() => {
                        setReaderBookId(book.id);
                        setReaderPageId(1);
                        setReaderHighlight('');
                      }}
                      className="w-full font-extrabold text-sm sm:text-base leading-relaxed break-words cursor-pointer hover:text-[#d4af37] transition border-b border-white/10 pb-2"
                    >
                      {book.title}
                    </h3>

                    {/* Middle Row: Book Cover + Full Author & Badges */}
                    <div className="flex gap-3 items-start">
                      <BookCover
                        title={book.title}
                        author={book.author}
                        coverUrl={book.cover}
                        bookId={book.id}
                        category={book.category}
                        className="w-16 h-22 shrink-0 rounded-xl"
                        onClick={() => {
                          setReaderBookId(book.id);
                          setReaderPageId(1);
                          setReaderHighlight('');
                        }}
                      />

                      <div className="flex-1 min-w-0 space-y-2">
                        <p className={`text-xs font-medium leading-snug break-words ${themeClasses.mutedText}`}>
                          {book.author || 'مؤلف غير محدد'}
                        </p>

                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="px-2 py-0.5 rounded-md bg-[#d4af37]/15 text-[#d4af37] text-[10px] font-bold">
                            {book.category}
                          </span>
                          {book.pagesCount && book.pagesCount > 0 ? (
                            <span
                              className="px-2 py-0.5 rounded-md bg-[#d4af37]/20 border border-[#d4af37]/40 text-[#d4af37] text-[10px] font-bold whitespace-nowrap"
                              title="إجمالي عدد صفحات الكتاب في الموسوعة"
                            >
                              {book.pagesCount.toLocaleString('ar-EG')} صفحة
                            </span>
                          ) : null}
                          {book.volumesCount && book.volumesCount > 1 && (
                            <span className="px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-400 text-[10px] font-bold">
                              {book.volumesCount.toLocaleString('ar-EG')} أجزاء
                            </span>
                          )}
                          {book.era && (
                            <span className="px-2 py-0.5 rounded-md bg-white/5 text-[10px] opacity-85">
                              {book.era}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Bottom Row: Action Buttons */}
                    <div className="flex items-center gap-1.5 pt-1">
                      <button
                        onClick={() => {
                          setReaderBookId(book.id);
                          setReaderPageId(1);
                          setReaderHighlight('');
                        }}
                        className="flex-1 py-2 px-2.5 rounded-xl bg-[#d4af37] text-black font-bold text-xs flex items-center justify-center gap-1 hover:brightness-110 active:scale-95 transition"
                      >
                        <BookOpen className="w-3.5 h-3.5 shrink-0" />
                        <span>قراءة الكتاب</span>
                      </button>
                      <button
                        onClick={() => {
                          const scoped = { id: book.id, name: book.title };
                          setAiScopedBook(scoped);
                          setAiMode('book_summary');
                          setActiveTab('ai');
                          handleAskAI(
                            `لخص لي كتاب ${book.title} ومنهجه وأبرز أبوابه وفصوله`,
                            'book_summary',
                            scoped
                          );
                        }}
                        className="py-2 px-2.5 rounded-xl bg-[#d4af37]/15 border border-[#d4af37]/30 text-[#d4af37] font-bold text-xs flex items-center gap-1 hover:bg-[#d4af37]/25 transition"
                        title="تلخيص ومناقشة هذا الكتاب بالذكاء الاصطناعي"
                      >
                        <Sparkles className="w-3.5 h-3.5 shrink-0" />
                        <span>لخص الكتاب</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-16 text-center space-y-2 opacity-70">
                <p className="text-sm font-bold">لا توجد كتب مطابقة لخيارات التصفية الحالية</p>
                <button
                  onClick={() => {
                    setCatalogQuery('');
                    setSelectedCategory('all');
                    setSelectedEra('all');
                    setSelectedFormat('all');
                  }}
                  className="px-4 py-2 rounded-xl bg-[#d4af37] text-black text-xs font-bold"
                >
                  إعادة ضبط الفلاتر
                </button>
              </div>
            )}

            {/* Pagination */}
            {catalogTotalPages > 1 && (
              <div className="flex items-center justify-center gap-3 pt-4">
                <button
                  disabled={catalogPage <= 1}
                  onClick={() => setCatalogPage((p) => Math.max(1, p - 1))}
                  className={`px-3.5 py-2 rounded-xl border text-xs font-bold disabled:opacity-30 flex items-center gap-1 ${themeClasses.cardBg}`}
                >
                  <ChevronRight className="w-4 h-4" />
                  <span>السابق</span>
                </button>
                <span className="text-xs font-bold">
                  صفحة <span className="text-[#d4af37]">{catalogPage}</span> من {catalogTotalPages}
                </span>
                <button
                  disabled={catalogPage >= catalogTotalPages}
                  onClick={() => setCatalogPage((p) => Math.min(catalogTotalPages, p + 1))}
                  className={`px-3.5 py-2 rounded-xl border text-xs font-bold disabled:opacity-30 flex items-center gap-1 ${themeClasses.cardBg}`}
                >
                  <span>التالي</span>
                  <ChevronLeft className="w-4 h-4" />
                </button>
              </div>
            )}
          </main>
        )}

        {/* TAB 2: FAST ADVANCED SEARCH IN BOOKS (البحث المتقدم السريع في الكتب) */}
        {activeTab === 'search' && (
          <main className="p-3.5 space-y-4 flex-1">
            {/* Sub-Tabs: Pages & Footnotes vs Chapter Headings vs Quote Verifier */}
            <div className={`p-1 rounded-2xl border grid grid-cols-3 gap-1 ${themeClasses.cardBg}`}>
              <button
                onClick={() => setSearchModeTab('pages')}
                className={`py-2 px-1 rounded-xl text-[11px] sm:text-xs font-bold flex items-center justify-center gap-1 transition ${
                  searchModeTab === 'pages' ? 'bg-[#d4af37] text-black' : 'opacity-75'
                }`}
              >
                <Search className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">المتون والحواشي</span>
              </button>
              <button
                onClick={() => setSearchModeTab('titles')}
                className={`py-2 px-1 rounded-xl text-[11px] sm:text-xs font-bold flex items-center justify-center gap-1 transition ${
                  searchModeTab === 'titles' ? 'bg-[#d4af37] text-black' : 'opacity-75'
                }`}
              >
                <ListTree className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">عناوين الأبواب</span>
              </button>
              <button
                onClick={() => setSearchModeTab('verify')}
                className={`py-2 px-1 rounded-xl text-[11px] sm:text-xs font-bold flex items-center justify-center gap-1 transition ${
                  searchModeTab === 'verify' ? 'bg-[#d4af37] text-black' : 'opacity-75'
                }`}
              >
                <FileCheck2 className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">تحقيق النصوص</span>
              </button>
            </div>

            {searchModeTab !== 'verify' ? (
              <div className="space-y-3.5">
                {/* Advanced Search Form */}
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    executePageSearch(undefined, 0);
                  }}
                  className={`p-3.5 rounded-2xl border space-y-3 ${themeClasses.cardBg}`}
                >
                  <div className="flex items-center gap-2 w-full">
                    <input
                      type="search"
                      value={pageQuery}
                      onChange={(e) => setPageQuery(e.target.value)}
                      placeholder={
                        searchModeTab === 'titles'
                          ? 'ابحث في ٣٠٬٣٦٤ عنوان باب وفصل...'
                          : 'ابحث في ٧٩٠٬٠٢٠ صفحة (متن وحاشية)...'
                      }
                      className={`flex-1 min-w-0 w-full px-3 sm:px-3.5 py-2.5 rounded-xl border text-sm focus:border-[#d4af37] focus:outline-none ${themeClasses.inputBg}`}
                    />
                    <button
                      type="submit"
                      disabled={searchingPages}
                      className="px-4 sm:px-5 py-2.5 rounded-xl bg-[#d4af37] text-black font-bold text-xs flex items-center justify-center gap-1.5 shrink-0 shadow-md"
                    >
                      {searchingPages ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Search className="w-4 h-4" />
                      )}
                      <span>بحث</span>
                    </button>
                  </div>

                  {/* Advanced Options for Pages Search */}
                  {searchModeTab === 'pages' && (
                    <div className="space-y-2.5 pt-2 border-t border-white/10">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-xs">
                        <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-1.5">
                          {[
                            { id: 'all', label: 'الأقرب فالأقرب (ذكي)' },
                            { id: 'phrase', label: 'عبارة متتالية' },
                            { id: 'near', label: 'في نفس الفقرة' },
                          ].map((m) => (
                            <button
                              key={m.id}
                              type="button"
                              onClick={() => setMatchType(m.id as any)}
                              className={`px-2.5 py-1.5 rounded-xl border text-center transition ${
                                matchType === m.id
                                  ? 'bg-[#d4af37]/20 border-[#d4af37] text-[#d4af37] font-bold'
                                  : 'border-white/10 opacity-75'
                              }`}
                            >
                              {m.label}
                            </button>
                          ))}
                          <button
                            type="button"
                            onClick={() => setUseMorphology((p) => !p)}
                            className={`px-2.5 py-1.5 rounded-xl border text-center transition ${
                              useMorphology
                                ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300 font-bold'
                                : 'border-white/10 opacity-75'
                            }`}
                            title="البحث بالجذر اللغوي والاشتقاقات الصرفية للكلمة"
                          >
                            {useMorphology ? '✓ بحث بالجذر' : 'بحث بالجذر'}
                          </button>
                        </div>

                        <div className="grid grid-cols-3 sm:flex items-center gap-1.5">
                          {[
                            { id: 'both', label: 'المتن والحاشية' },
                            { id: 'body', label: 'المتن فقط' },
                            { id: 'foot', label: 'الحاشية فقط' },
                          ].map((f) => (
                            <button
                              key={f.id}
                              type="button"
                              onClick={() => setSearchInField(f.id as any)}
                              className={`px-2 py-1.5 rounded-xl border text-center transition ${
                                searchInField === f.id
                                  ? 'bg-[#d4af37]/20 border-[#d4af37] text-[#d4af37] font-bold'
                                  : 'border-white/10 opacity-75'
                              }`}
                            >
                              {f.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Filter by Specific Book Dropdown */}
                      <div className="relative">
                        {searchFilterBook ? (
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-3 py-2.5 rounded-xl bg-[#d4af37]/15 border border-[#d4af37]/40 text-xs">
                            <span className="font-bold text-[#d4af37] break-words leading-relaxed">
                              البحث محصور في كتاب: «{searchFilterBook.title}»
                              {searchFilterBook.pagesCount
                                ? ` (${searchFilterBook.pagesCount.toLocaleString('ar-EG')} صفحة)`
                                : ''}
                            </span>
                            <button
                              type="button"
                              onClick={() => setSearchFilterBook(null)}
                              className="text-white bg-black/30 px-2.5 py-1 rounded-lg text-[11px] font-bold self-end sm:self-auto shrink-0"
                            >
                              إلغاء التخصيص
                            </button>
                          </div>
                        ) : (
                          <div>
                            <button
                              type="button"
                              onClick={() => setShowBookFilterDropdown((p) => !p)}
                              className="w-full px-3 py-2.5 rounded-xl bg-black/15 border border-white/10 text-xs flex items-center justify-between gap-2 text-right opacity-85 hover:opacity-100"
                            >
                              <span className="break-words">تخصيص البحث في كتاب معين (اختياري)</span>
                              <ChevronLeft className="w-4 h-4 text-[#d4af37] -rotate-90 shrink-0" />
                            </button>

                            {showBookFilterDropdown && (
                              <div
                                className={`mt-1.5 p-2.5 rounded-2xl border shadow-xl space-y-2 ${themeClasses.cardBg}`}
                              >
                                <input
                                  type="search"
                                  value={bookPickerQuery}
                                  onChange={(e) => setBookPickerQuery(e.target.value)}
                                  placeholder="اكتب اسم الكتاب لاختياره من القائمة..."
                                  className={`w-full px-3 py-2 rounded-xl border text-xs focus:outline-none ${themeClasses.inputBg}`}
                                />
                                <div className="max-h-44 overflow-y-auto space-y-1">
                                  {bookPickerOptions.map((b) => (
                                    <button
                                      key={b.id}
                                      type="button"
                                      onClick={() => {
                                        setSearchFilterBook(b);
                                        setShowBookFilterDropdown(false);
                                      }}
                                      className="w-full text-right px-2.5 py-1.5 rounded-lg hover:bg-[#d4af37]/15 text-xs flex items-center justify-between gap-2"
                                    >
                                      <span className="font-bold truncate">
                                        {b.title}
                                        {b.pagesCount
                                          ? ` (${b.pagesCount.toLocaleString('ar-EG')} صفحة)`
                                          : ''}
                                      </span>
                                      <span className="text-[10px] opacity-70 shrink-0">
                                        {b.author}
                                      </span>
                                    </button>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </form>

                {/* Quick Suggested Searches if empty */}
                {pageResults.length === 0 && titleResults.length === 0 && !searchingPages && (
                  <div className={`p-4 rounded-2xl border space-y-3 ${themeClasses.cardBg}`}>
                    <h3 className="text-xs font-bold text-[#d4af37]">عمليات بحث سريعة مقترحة في المتون:</h3>
                    <div className="flex flex-wrap gap-2">
                      {[
                        'أركان الصلاة',
                        'قواعد الإسلام الجيطالي',
                        'الولاية والبراءة',
                        'زكاة الفطر',
                        'نظام العزابة',
                        'المصنف الكندي',
                        'بيان الشرع',
                      ].map((term) => (
                        <button
                          key={term}
                          onClick={() => {
                            setPageQuery(term);
                            executePageSearch(term, 0);
                          }}
                          className="px-3 py-1.5 rounded-xl bg-[#d4af37]/10 hover:bg-[#d4af37]/20 border border-[#d4af37]/30 text-xs font-medium transition"
                        >
                          {term}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Search Results List */}
                {searchingPages ? (
                  <div className="py-16 flex flex-col items-center justify-center gap-2 opacity-75">
                    <Loader2 className="w-8 h-8 animate-spin text-[#d4af37]" />
                    <span className="text-xs">جاري البحث الفوري في الموسوعة...</span>
                  </div>
                ) : searchModeTab === 'titles' && titleResults.length > 0 ? (
                  <div className="space-y-2.5">
                    <div className="text-xs px-1">
                      عناوين الأبواب المطابقة:{' '}
                      <strong className="text-[#d4af37]">{pageTotalHits}</strong> عنوان
                    </div>
                    {titleResults.map((t, idx) => (
                      <div
                        key={`${t.book_id}-${t.page_id}-${idx}`}
                        onClick={() => {
                          setReaderBookId(t.book_id);
                          setReaderPageId(t.page_id);
                          setReaderHighlight(pageQuery);
                        }}
                        className={`p-3.5 rounded-2xl border cursor-pointer flex items-center justify-between gap-2 ${themeClasses.cardBg}`}
                      >
                        <div className="min-w-0 flex-1">
                          <h4 className="font-bold text-sm text-[#d4af37] break-words leading-snug">{t.title}</h4>
                          <p className={`text-xs break-words mt-0.5 ${themeClasses.mutedText}`}>
                            {t.book_name} — {t.author_name}
                          </p>
                        </div>
                        <span className="px-2.5 py-1 rounded-lg bg-[#d4af37]/15 text-[#d4af37] font-bold text-xs shrink-0">
                          ص {t.page_id}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : pageResults.length > 0 ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-xs px-1">
                      <span>
                        إجمالي المواضع المطابقة:{' '}
                        <strong className="text-[#d4af37]">{pageTotalHits.toLocaleString('ar-EG')}</strong> موضع
                      </span>
                      <span className="opacity-70">اضغط لفتح الصفحة كاملة</span>
                    </div>

                    {pageResults.map((hit, idx) => {
                      const proofreadSnippet = proofreadAndVocalizeArabic(hit.snippet || '', {
                        fixTypos: true,
                        applyTashkeel: true,
                      }).text;
                      return (
                        <div
                          key={`${hit.book_id}-${hit.page_id}-${idx}`}
                          onClick={() => {
                            setReaderBookId(hit.book_id);
                            setReaderPageId(hit.page_id);
                            setReaderHighlight(pageQuery);
                          }}
                          className={`p-3.5 sm:p-4 rounded-2xl border cursor-pointer transition space-y-2 ${themeClasses.cardBg}`}
                        >
                          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <h4 className="font-bold text-sm text-[#d4af37] break-words leading-snug">{hit.book_name}</h4>
                              <p className={`text-xs break-words mt-0.5 ${themeClasses.mutedText}`}>
                                {hit.author_name} {hit.author_death ? `(${hit.author_death})` : ''} • {hit.category}
                              </p>
                            </div>
                            <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                              {hit.proximity_label && (
                                <span className="px-2 py-0.5 rounded-md bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-[10px] font-bold">
                                  {hit.proximity_label}
                                </span>
                              )}
                              <span className="px-2 py-0.5 rounded-md bg-white/10 text-[10px]">
                                {hit.field_label || 'المتن'}
                              </span>
                              <span className="px-2.5 py-1 rounded-lg bg-[#d4af37]/15 text-[#d4af37] font-bold text-xs">
                                ص {hit.page_number}
                              </span>
                            </div>
                          </div>

                          <div
                            className="font-naskh text-base leading-[2.0] text-right sm:text-justify break-words pt-1.5 border-t border-white/5"
                            dangerouslySetInnerHTML={{
                              __html: proofreadSnippet.replace(
                                /<mark>/g,
                                '<mark class="search-highlight">'
                              ),
                            }}
                          />
                        </div>
                      );
                    })}

                    {pageResults.length < pageTotalHits && (
                      <button
                        type="button"
                        disabled={loadingMorePages}
                        onClick={() => executePageSearch(undefined, searchOffset + 20)}
                        className={`w-full py-3 rounded-2xl border text-xs font-bold flex items-center justify-center gap-2 ${themeClasses.cardBg}`}
                      >
                        {loadingMorePages ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin text-[#d4af37]" />
                            <span>جاري تحميل المزيد...</span>
                          </>
                        ) : (
                          <span>عرض المزيد من النتائج ({pageResults.length} من {pageTotalHits})</span>
                        )}
                      </button>
                    )}
                  </div>
                ) : hasSearchedPages && pageQuery.trim() ? (
                  <div className={`p-5 rounded-2xl border text-center space-y-3 ${themeClasses.cardBg}`}>
                    <p className="text-sm font-bold text-[#d4af37]">
                      لم يتم العثور على نتائج مطابقة لعبارة «{pageQuery}»
                      {searchFilterBook ? ` في كتاب «${searchFilterBook.title}»` : ''}
                    </p>
                    <div className="flex flex-wrap items-center justify-center gap-2">
                      {!useMorphology && (
                        <button
                          type="button"
                          onClick={() => {
                            setUseMorphology(true);
                            executePageSearch(pageQuery, 0, true, false);
                          }}
                          className="px-4 py-2 rounded-xl bg-[#d4af37] text-black text-xs font-bold inline-flex items-center gap-1.5"
                        >
                          <Search className="w-3.5 h-3.5" />
                          <span>البحث بالجذر اللغوي للكلمة</span>
                        </button>
                      )}
                      {searchFilterBook && (
                        <button
                          type="button"
                          onClick={() => {
                            setSearchFilterBook(null);
                            executePageSearch(pageQuery, 0, useMorphology, true);
                          }}
                          className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-xs font-bold inline-flex items-center gap-1.5"
                        >
                          <span>البحث في جميع كتب الموسوعة</span>
                        </button>
                      )}
                    </div>
                  </div>
                ) : null}
              </div>
            ) : (
              /* Quote Verifier Sub-Tab */
              <div className="space-y-4">
                <div className={`p-4 rounded-2xl border space-y-3 ${themeClasses.cardBg}`}>
                  <div className="space-y-1">
                    <h3 className="font-bold text-sm text-[#d4af37] flex items-center gap-1.5">
                      <FileCheck2 className="w-4 h-4" />
                      <span>أداة التحقق من صحة النصوص المقتبسة</span>
                    </h3>
                    <p className={`text-xs leading-relaxed ${themeClasses.mutedText}`}>
                      الصق أي نص منقول لتتحقق فوراً هل هو موجود بحروفه في كتب الموسوعة أم فيه اختلاف أو تلفيق، وفي أي كتاب وصفحة ورد.
                    </p>
                  </div>

                  <form onSubmit={handleVerifyQuote} className="space-y-3">
                    <textarea
                      rows={3}
                      value={quoteInput}
                      onChange={(e) => setQuoteInput(e.target.value)}
                      placeholder="مثال: بُني الإسلام على خمس شهادة أن لا إله إلا الله وإقام الصلاة..."
                      className={`w-full p-3.5 rounded-xl border text-sm font-naskh focus:border-[#d4af37] focus:outline-none ${themeClasses.inputBg}`}
                    />
                    <button
                      type="submit"
                      disabled={verifyingQuote || quoteInput.trim().length < 5}
                      className="w-full py-2.5 rounded-xl bg-[#d4af37] text-black font-bold text-xs flex items-center justify-center gap-2 disabled:opacity-40"
                    >
                      {verifyingQuote ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>جاري فحص النص ومطابقته...</span>
                        </>
                      ) : (
                        <>
                          <ShieldCheck className="w-4 h-4" />
                          <span>افحص دقة النص في الموسوعة</span>
                        </>
                      )}
                    </button>
                  </form>
                </div>

                {quoteVerification && (
                  <div className={`p-4 rounded-2xl border space-y-3 ${themeClasses.cardBg}`}>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-[#d4af37]">نتيجة الفحص والتحقق:</span>
                      <span className="px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-400 text-xs font-bold">
                        {quoteVerification.verdict || quoteVerification.status || 'تم الفحص'}
                      </span>
                    </div>
                    <pre className="text-xs font-naskh whitespace-pre-wrap leading-relaxed opacity-90 bg-black/20 p-3 rounded-xl overflow-x-auto">
                      {JSON.stringify(quoteVerification, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            )}
          </main>
        )}

        {/* TAB 3: QAF-STYLE CONVERSATIONAL AI ASSISTANT & CONTENT STUDIO (محادثة ذكية بأسلوب تطبيق قاف) */}
        {activeTab === 'ai' && (
          <main className="p-3 sm:p-4 flex flex-col gap-3 flex-1 min-h-[72vh]">
            {/* 1. Clean Responsive Assistant Header Bar */}
            <div
              className={`p-3 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 ${themeClasses.cardBg}`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-9 h-9 rounded-2xl bg-gradient-to-br from-[#d4af37] to-[#9a7b1c] text-black flex items-center justify-center shrink-0 shadow-sm">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <h2 className="font-extrabold text-sm sm:text-base leading-snug text-[#d4af37]">
                      المساعد الذكي للموسوعة
                    </h2>
                    <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 text-[10px] font-bold">
                      صياغة ذاتية من المصادر
                    </span>
                  </div>
                  <p className={`text-[11px] truncate ${themeClasses.mutedText}`}>
                    إجابات مؤصلة مستندة إلى كتب وفتاوى الموسوعة
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1.5 self-end sm:self-auto shrink-0 w-full sm:w-auto justify-end pt-1 sm:pt-0 border-t sm:border-t-0 border-white/5">
                <button
                  type="button"
                  onClick={() => setShowAiBookPicker((p) => !p)}
                  className={`flex-1 sm:flex-initial px-3 py-1.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition ${
                    aiScopedBook
                      ? 'bg-[#d4af37] text-black border-[#d4af37]'
                      : 'bg-[#d4af37]/15 border-[#d4af37]/40 text-[#d4af37] hover:bg-[#d4af37]/25'
                  }`}
                >
                  <BookOpen className="w-3.5 h-3.5 shrink-0" />
                  <span className="max-w-[140px] sm:max-w-[180px] truncate">
                    {aiScopedBook ? aiScopedBook.name : 'تحديد كتاب'}
                  </span>
                </button>

                {aiMessages.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setAiMessages([]);
                      setAiResult(null);
                      setAiError(null);
                    }}
                    className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/15 text-xs font-bold flex items-center justify-center gap-1 shrink-0 transition"
                    title="بدء محادثة جديدة"
                  >
                    <RotateCcw className="w-3.5 h-3.5 text-[#d4af37]" />
                    <span>جديد</span>
                  </button>
                )}
              </div>
            </div>

            {/* Active Scoped Book Quick Strip */}
            {aiScopedBook && (
              <div className="p-2.5 rounded-2xl bg-[#d4af37]/15 border border-[#d4af37]/40 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-1.5 min-w-0">
                  <BookOpen className="w-4 h-4 text-[#d4af37] shrink-0" />
                  <span className="font-bold text-[#d4af37] truncate">
                    النقاش محصور في: «{aiScopedBook.name}»
                  </span>
                </div>
                <div className="flex items-center gap-1.5 justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      setAiMode('book_summary');
                      handleAskAI(
                        `لخص لي كتاب ${aiScopedBook.name} ومنهجه وأبرز أبوابه وفصوله`,
                        'book_summary',
                        aiScopedBook
                      );
                    }}
                    className="px-2.5 py-1 rounded-lg bg-[#d4af37] text-black font-bold text-[11px]"
                  >
                    لخص الكتاب
                  </button>
                  <button
                    type="button"
                    onClick={() => setAiScopedBook(null)}
                    className="px-2 py-1 rounded-lg bg-black/25 hover:bg-black/40 text-[11px] font-bold flex items-center gap-1"
                  >
                    <X className="w-3 h-3" />
                    <span>إلغاء الحصر</span>
                  </button>
                </div>
              </div>
            )}

            {showAiBookPicker && (
              <div className={`p-3 rounded-2xl border shadow-xl space-y-2.5 ${themeClasses.cardBg}`}>
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-[#d4af37]">
                    اختر كتاباً من الموسوعة لتلخيصه أو حصر الحوار فيه:
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowAiBookPicker(false)}
                    className="p-1 rounded-lg hover:bg-white/10"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <input
                  type="search"
                  value={aiBookPickerQuery}
                  onChange={(e) => setAiBookPickerQuery(e.target.value)}
                  placeholder="ابحث عن اسم الكتاب أو المؤلف..."
                  className={`w-full px-3 py-2 rounded-xl border text-xs focus:border-[#d4af37] focus:outline-none ${themeClasses.inputBg}`}
                />
                <div className="max-h-52 overflow-y-auto space-y-1.5">
                  {aiBookPickerOptions.map((b) => (
                    <div
                      key={b.id}
                      className="w-full p-2.5 rounded-xl bg-black/10 hover:bg-[#d4af37]/10 border border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs transition"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="font-bold break-words leading-snug">{b.title}</div>
                        <div className="text-[11px] opacity-75 break-words mt-0.5">
                          {b.author} • {b.category}
                        </div>
                      </div>
                      <div className="grid grid-cols-2 sm:flex items-center gap-1.5 w-full sm:w-auto shrink-0">
                        <button
                          type="button"
                          onClick={() => {
                            const scoped = { id: b.id, name: b.title };
                            setAiScopedBook(scoped);
                            setShowAiBookPicker(false);
                            setAiMode('book_summary');
                            handleAskAI(
                              `لخص لي كتاب ${b.title} ومنهجه وأبرز أبوابه وفصوله`,
                              'book_summary',
                              scoped
                            );
                          }}
                          className="px-2.5 py-1.5 rounded-lg bg-[#d4af37] text-black font-bold text-[11px] text-center"
                        >
                          لخص الكتاب
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setAiScopedBook({ id: b.id, name: b.title });
                            setShowAiBookPicker(false);
                          }}
                          className="px-2.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 font-bold text-[11px] text-center"
                        >
                          حصر النقاش فيه
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 2. Qaf-Style Conversational Area (Welcome View when empty OR Chat Thread when active) */}
            <div className="flex-1 flex flex-col justify-between gap-3">
              {aiMessages.length === 0 && !aiLoading ? (
                <div className="my-auto space-y-4 py-2">
                  {/* Qaf-Style Center Greeting */}
                  <div className={`p-5 rounded-3xl border text-center space-y-2.5 ${themeClasses.cardBg}`}>
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#d4af37] to-[#9a7b1c] text-black flex items-center justify-center mx-auto shadow-md">
                      <Sparkles className="w-6 h-6" />
                    </div>
                    <h3 className="font-extrabold text-base sm:text-lg text-[#d4af37]">
                      أهلاً بك في المحادثة الذكية للموسوعة
                    </h3>
                    <p className={`text-xs sm:text-sm max-w-xl mx-auto leading-relaxed ${themeClasses.mutedText}`}>
                      اسأل بأسلوبك الطبيعي عن أي مسألة فقهية أو عقدية أو تاريخية؛ يقرأ المساعد أمهات الكتب والفتاوى ثم <strong className="text-[#d4af37]">يصوغ لك الإجابة من عنده بلغة واضحة وميسّرة</strong> دون سرد جامد، مع توثيق كل فكرة بمصدرها.
                    </p>
                  </div>

                  {/* Qaf-Style Conversational Question Chips */}
                  <div className="space-y-2">
                    <span className="text-xs font-bold text-[#d4af37] px-1 block">
                      أسئلة حوارية مقترحة (اضغط للبدء الفوري):
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {[
                        {
                          label: 'ما هي شروط التوبة النصوح وكيف تبرأ الذمة من حقوق العباد؟',
                          mode: 'chat' as AIChatMode,
                          badge: 'حوار فقهي وتزكوي',
                        },
                        {
                          label: 'ما حكم زكاة الذهب الملبوس وما شروط وجوبها؟',
                          mode: 'chat' as AIChatMode,
                          badge: 'فقه الزكاة',
                        },
                        {
                          label: 'اشرح لي مفهوم الولاية والبراءة وضوابطهما بأسلوب مبسط',
                          mode: 'chat' as AIChatMode,
                          badge: 'العقيدة والأخلاق',
                        },
                        {
                          label: 'كيف أحقق الخشوع وحضور القلب في الصلاة؟',
                          mode: 'chat' as AIChatMode,
                          badge: 'فقه الصلاة',
                        },
                        {
                          label: 'لخص لي كتاب قواعد الإسلام للإمام الجيطالي وأبرز أبوابه',
                          mode: 'book_summary' as AIChatMode,
                          badge: 'ملخص كتاب',
                        },
                        {
                          label: 'حدثني عن نظام العزابة ودوره التعليمي والحضاري',
                          mode: 'chat' as AIChatMode,
                          badge: 'تراث وتاريخ',
                        },
                      ].map((qItem) => (
                        <button
                          key={qItem.label}
                          type="button"
                          onClick={() => {
                            setAiMode(qItem.mode);
                            handleAskAI(qItem.label, qItem.mode);
                          }}
                          className={`text-right p-3.5 rounded-2xl border hover:border-[#d4af37] transition flex items-start justify-between gap-2.5 ${themeClasses.cardBg}`}
                        >
                          <div className="space-y-1 min-w-0 flex-1">
                            <span className="inline-block px-2 py-0.5 rounded-md bg-[#d4af37]/15 text-[#d4af37] font-bold text-[10px]">
                              {qItem.badge}
                            </span>
                            <p className="font-bold text-xs sm:text-sm leading-relaxed break-words">
                              {qItem.label}
                            </p>
                          </div>
                          <ChevronLeft className="w-4 h-4 text-[#d4af37] shrink-0 mt-1" />
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                /* Active Multi-Turn Qaf-Style Chat Stream */
                <div className="space-y-4">
                  {aiMessages.map((msg) => {
                    if (msg.role === 'user') {
                      return (
                        <div key={msg.id} className="flex justify-start">
                          <div className="w-full sm:max-w-[85%] p-3.5 sm:p-4 rounded-2xl rounded-tr-xs bg-[#d4af37]/15 border border-[#d4af37]/40 space-y-1.5">
                            <div className="flex items-center justify-between gap-2 text-[11px]">
                              <span className="font-extrabold text-[#d4af37]">أنت</span>
                              {msg.scopedBookName && (
                                <span className="px-2 py-0.5 rounded-md bg-black/30 text-[#d4af37] font-bold text-[10px] truncate max-w-[200px]">
                                  {msg.scopedBookName}
                                </span>
                              )}
                            </div>
                            <p className="font-bold text-sm sm:text-base leading-relaxed break-words">
                              {msg.content}
                            </p>
                          </div>
                        </div>
                      );
                    }

                    const resp = msg.response;
                    if (!resp) return null;

                    const ansCopyKey = `${msg.id}-answer`;
                    const fullCopyKey = `${msg.id}-full`;

                    const isLastAssistant =
                      msg.role === 'assistant' &&
                      aiMessages.map((m) => m.id).lastIndexOf(msg.id) ===
                        aiMessages.map((m) => m.role).lastIndexOf('assistant');

                    const renderInlineRichText = (lineText: string) => {
                      const tokens = lineText.split(
                        /(\*\*[^*]+\*\*|\*\([^)]+\)\*|﴿[^﴾]+﴾|\[\d+\]|\[منصوص في المصدر\]|\[استنتاج تحليلي مستخلص\]|\[استنتاج تحليلي\])/g
                      );
                      return tokens.map((tok, tIdx) => {
                        if (!tok) return null;
                        if (tok.startsWith('**') && tok.endsWith('**') && tok.length > 4) {
                          return (
                            <strong key={tIdx} className="font-extrabold text-[#d4af37]">
                              {tok.slice(2, -2)}
                            </strong>
                          );
                        }
                        if (/^\[\d+\]$/.test(tok)) {
                          const refNum = parseInt(tok.slice(1, -1), 10);
                          const matchedPageSource =
                            resp?.sources && refNum >= 1 && refNum <= resp.sources.length
                              ? resp.sources[refNum - 1]
                              : null;
                          if (matchedPageSource) {
                            return (
                              <button
                                key={tIdx}
                                type="button"
                                onClick={() => {
                                  setReaderBookId(matchedPageSource.book_id);
                                  setReaderPageId(matchedPageSource.page_id);
                                  setReaderHighlight(resp.searchQueryUsed);
                                }}
                                title={`${matchedPageSource.book_name} — ج ${matchedPageSource.part || 1}، ص ${matchedPageSource.page_number}`}
                                className="inline-block mx-0.5 px-1.5 py-0.5 rounded bg-[#d4af37]/15 hover:bg-[#d4af37]/30 border border-[#d4af37]/35 text-[#d4af37] text-[11px] font-sans font-bold align-baseline transition cursor-pointer"
                              >
                                {tok}
                              </button>
                            );
                          }
                          return (
                            <span
                              key={tIdx}
                              className="inline-block mx-0.5 px-1.5 py-0.5 rounded bg-[#d4af37]/15 border border-[#d4af37]/30 text-[#d4af37] text-[11px] font-sans font-bold align-baseline"
                            >
                              {tok}
                            </span>
                          );
                        }
                        if (tok === '[منصوص في المصدر]') {
                          return (
                            <span
                              key={tIdx}
                              className="inline-block mx-1 px-2 py-0.5 rounded-md bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 text-[11px] font-sans font-bold"
                            >
                              ✓ منصوص في المصدر
                            </span>
                          );
                        }
                        if (
                          tok === '[استنتاج تحليلي مستخلص]' ||
                          tok === '[استنتاج تحليلي]'
                        ) {
                          return (
                            <span
                              key={tIdx}
                              className="inline-block mx-1 px-2 py-0.5 rounded-md bg-amber-500/20 border border-amber-500/40 text-amber-300 text-[11px] font-sans font-bold"
                            >
                              💡 استنتاج تحليلي مستخلص
                            </span>
                          );
                        }
                        if (tok.startsWith('*(') && tok.endsWith(')*') && tok.length > 4) {
                          return (
                            <span
                              key={tIdx}
                              className="inline-block mx-1 px-2 py-0.5 rounded-md bg-[#d4af37]/10 border border-[#d4af37]/25 text-[#d4af37] text-xs font-sans font-bold"
                            >
                              {tok.slice(1, -1)}
                            </span>
                          );
                        }
                        if (tok.startsWith('﴿') && tok.endsWith('﴾')) {
                          return (
                            <span
                              key={tIdx}
                              className="inline mx-0.5 px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400 font-bold"
                            >
                              {tok}
                            </span>
                          );
                        }
                        return <React.Fragment key={tIdx}>{tok}</React.Fragment>;
                      });
                    };

                    const formattedLines = String(msg.content || resp?.answer || '')
                      .replace(/^\s*═+\s*$/gm, '')
                      .replace(/^\s*─+\s*$/gm, '')
                      .split('\n');

                    return (
                      <div key={msg.id} className="space-y-3">
                        <div
                          className={`p-3.5 sm:p-5 rounded-3xl rounded-tl-xs border space-y-3.5 overflow-hidden ${themeClasses.cardBg}`}
                        >
                          {/* Assistant Message Header - Responsive Stacking */}
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 border-b border-white/10 pb-2.5">
                            <div className="flex items-center gap-2 min-w-0">
                              <div className="w-7 h-7 rounded-xl bg-gradient-to-br from-[#d4af37] to-[#9a7b1c] text-black flex items-center justify-center shrink-0">
                                <Sparkles className="w-4 h-4" />
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="text-xs sm:text-sm font-extrabold text-[#d4af37]">
                                    المساعد الذكي للموسوعة
                                  </span>
                                  {msg.isStreaming ? (
                                    <span className="px-2 py-0.5 rounded-md bg-[#d4af37]/20 border border-[#d4af37]/40 text-[#d4af37] text-[10px] font-bold animate-pulse">
                                      جاري الكتابة...
                                    </span>
                                  ) : (
                                    <span className="px-2 py-0.5 rounded-md bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-[10px] font-bold">
                                      صياغة مؤصلة
                                    </span>
                                  )}
                                  {msg.isStopped && (
                                    <span className="px-2 py-0.5 rounded-md bg-amber-500/15 text-amber-400 text-[10px] font-bold">
                                      تم الإيقاف
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-1.5 self-end sm:self-auto flex-wrap justify-end">
                              {resp && (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => handleCopyAiResult(resp, 'answer', msg.id)}
                                    className="px-2.5 py-1.5 rounded-xl bg-[#d4af37] text-black font-bold text-[11px] flex items-center gap-1 shadow-xs active:scale-95 transition"
                                  >
                                    {copiedAiMode === ansCopyKey ? (
                                      <>
                                        <Check className="w-3.5 h-3.5 shrink-0" />
                                        <span>تم</span>
                                      </>
                                    ) : (
                                      <>
                                        <Copy className="w-3.5 h-3.5 shrink-0" />
                                        <span>نسخ</span>
                                      </>
                                    )}
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => handleCopyAiResult(resp, 'full', msg.id)}
                                    className="px-2.5 py-1.5 rounded-xl bg-[#d4af37]/15 border border-[#d4af37]/40 text-[#d4af37] font-bold text-[11px] flex items-center gap-1 active:scale-95 transition"
                                  >
                                    {copiedAiMode === fullCopyKey ? (
                                      <>
                                        <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                                        <span>تم</span>
                                      </>
                                    ) : (
                                      <>
                                        <Copy className="w-3.5 h-3.5 shrink-0" />
                                        <span>مع المراجع</span>
                                      </>
                                    )}
                                  </button>
                                </>
                              )}

                              {isLastAssistant && !msg.isStreaming && (
                                <button
                                  type="button"
                                  onClick={handleRegenerateLastAI}
                                  className="px-2 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/15 text-xs font-bold flex items-center gap-1 transition"
                                  title="إعادة التوليد"
                                >
                                  <RotateCcw className="w-3.5 h-3.5 text-[#d4af37]" />
                                  <span className="hidden sm:inline">إعادة</span>
                                </button>
                              )}

                              {resp && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleToggleBookmark({
                                      id: `ai-${resp.question.slice(0, 40)}`,
                                      type: 'ai',
                                      title: resp.question,
                                      subtitle: `${resp.modeLabel || 'حوار علمي'} (${
                                        resp.sources.length
                                      } مصادر)`,
                                      fullText: resp.answer,
                                    })
                                  }
                                  className={`p-1.5 rounded-xl border shrink-0 transition ${
                                    isBookmarked(`ai-${resp.question.slice(0, 40)}`)
                                      ? 'bg-[#d4af37]/20 border-[#d4af37] text-[#d4af37]'
                                      : 'border-white/15 opacity-80'
                                  }`}
                                  title="حفظ في المفضلة"
                                >
                                  <Bookmark className="w-4 h-4 fill-current" />
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Live Thinking Status if streaming with no text yet */}
                          {msg.isStreaming && !msg.content && (
                            <div className="p-3 rounded-xl bg-[#d4af37]/10 border border-[#d4af37]/25 flex items-center gap-2.5 text-xs text-[#d4af37] animate-pulse">
                              <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                              <span>{msg.statusMessage || 'جاري استيعاب المسألة ومطابقة المصادر في الموسوعة...'}</span>
                            </div>
                          )}

                          {/* Self-Authored Analytical Answer Prose with Markdown Tables & Blocks */}
                          <div className="font-naskh text-base sm:text-lg leading-[2.0] text-right break-words overflow-x-hidden select-text space-y-2.5">
                            {formattedLines.map((rawLine, lIdx) => {
                              const line = rawLine.trim();
                              if (!line) {
                                return <div key={lIdx} className="h-1" />;
                              }
                              if (line.startsWith('### ')) {
                                const headingText = line.replace(/^###\s+/, '');
                                return (
                                  <h4
                                    key={lIdx}
                                    className="font-sans font-extrabold text-sm sm:text-base text-[#d4af37] pt-2 pb-1 border-b border-[#d4af37]/20 flex items-center gap-1.5"
                                  >
                                    <span>{headingText}</span>
                                  </h4>
                                );
                              }
                              if (line.startsWith('## ') || line.startsWith('# ')) {
                                const headingText = line.replace(/^#+\s+/, '');
                                return (
                                  <h3
                                    key={lIdx}
                                    className="font-sans font-extrabold text-base sm:text-lg text-[#d4af37] pt-2 pb-1 border-b border-[#d4af37]/30"
                                  >
                                    {headingText}
                                  </h3>
                                );
                              }
                              // Callout blockquote (> ...)
                              if (line.startsWith('>')) {
                                const quoteText = line.replace(/^>\s*/, '');
                                return (
                                  <div
                                    key={lIdx}
                                    className="my-2 p-3 rounded-xl bg-[#d4af37]/10 border-r-4 border-[#d4af37] text-sm sm:text-base font-bold italic text-[#d4af37]"
                                  >
                                    {renderInlineRichText(quoteText)}
                                  </div>
                                );
                              }
                              // Markdown table row (| ... |)
                              if (line.startsWith('|') && line.endsWith('|')) {
                                if (line.replace(/[\s|:-]/g, '').length === 0) {
                                  // Separator row
                                  return null;
                                }
                                const cells = line
                                  .slice(1, -1)
                                  .split('|')
                                  .map((c) => c.trim());
                                const isHeaderRow =
                                  lIdx < formattedLines.length - 1 &&
                                  formattedLines[lIdx + 1]?.trim().startsWith('|') &&
                                  formattedLines[lIdx + 1]?.trim().includes('---');

                                return (
                                  <div
                                    key={lIdx}
                                    className={`grid grid-cols-${cells.length} gap-2 p-2 rounded-lg my-1 border text-xs sm:text-sm font-sans ${
                                      isHeaderRow
                                        ? 'bg-[#d4af37]/20 border-[#d4af37]/50 font-extrabold text-[#d4af37]'
                                        : 'bg-black/20 border-white/10'
                                    }`}
                                    style={{
                                      gridTemplateColumns: `repeat(${cells.length}, minmax(0, 1fr))`,
                                    }}
                                  >
                                    {cells.map((cell, cIdx) => (
                                      <div key={cIdx} className="break-words px-1">
                                        {renderInlineRichText(cell)}
                                      </div>
                                    ))}
                                  </div>
                                );
                              }
                              if (/^(?:المصادر|Sources)\s*[:：]?$/i.test(line)) {
                                return (
                                  <h4
                                    key={lIdx}
                                    className="font-sans font-extrabold text-xs sm:text-sm text-[#d4af37] pt-3 pb-1 border-t border-white/10 mt-2"
                                  >
                                    {line}
                                  </h4>
                                );
                              }
                              if (/^\[\d+\]\s+.+/.test(line)) {
                                return (
                                  <div
                                    key={lIdx}
                                    className="text-xs sm:text-sm font-sans leading-relaxed opacity-90 py-0.5"
                                  >
                                    {renderInlineRichText(line)}
                                  </div>
                                );
                              }
                              // Numbered main section title like "1. مكانة الصلاة وفضلها" (short line without colon)
                              if (/^(?:\d+[.-]|[١٢٣٤٥٦٧٨٩٠]+[.-])\s+[^:：]{3,65}$/.test(line)) {
                                return (
                                  <h4
                                    key={lIdx}
                                    className="font-sans font-extrabold text-sm sm:text-base text-[#d4af37] pt-3 pb-1 border-b border-[#d4af37]/20"
                                  >
                                    {line}
                                  </h4>
                                );
                              }
                              if (/^(?:•|-|\*|\d+[.-]|[١٢٣٤٥٦٧٨٩٠]+[.-])\s+/.test(line)) {
                                return (
                                  <div
                                    key={lIdx}
                                    className="pr-2.5 sm:pr-3.5 py-1 border-r-2 border-[#d4af37]/40 leading-[2.0]"
                                  >
                                    {renderInlineRichText(line)}
                                  </div>
                                );
                              }
                              return (
                                <p key={lIdx} className="leading-[2.05]">
                                  {renderInlineRichText(line)}
                                </p>
                              );
                            })}

                            {/* Streaming Typing Cursor Indicator */}
                            {msg.isStreaming && (
                              <span className="inline-block w-2.5 h-5 bg-[#d4af37] animate-pulse rounded-xs mr-1 align-middle" />
                            )}
                          </div>

                          {/* Compact Clickable Source Chips (المصادر المعتمدة من الموسوعة) */}
                          {resp && (resp.sources.length > 0 || resp.fatawaSources.length > 0) && (
                            <div className="pt-3 border-t border-white/10 space-y-2">
                              <span className="text-xs font-bold text-[#d4af37] flex items-center gap-1.5">
                                <BookOpen className="w-3.5 h-3.5 shrink-0" />
                                <span>
                                  المصادر المعتمدة التي استند إليها المساعد (اضغط لقراءة الصفحة في الكتاب):
                                </span>
                              </span>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                {resp.sources.map((src, i) => (
                                  <button
                                    key={`${src.book_id}-${src.page_id}-${i}`}
                                    type="button"
                                    onClick={() => {
                                      setReaderBookId(src.book_id);
                                      setReaderPageId(src.page_id);
                                      setReaderHighlight(resp.searchQueryUsed);
                                    }}
                                    className="text-right p-2.5 rounded-xl bg-black/20 hover:bg-[#d4af37]/15 border border-white/10 hover:border-[#d4af37]/50 flex items-center justify-between gap-2 transition"
                                  >
                                    <div className="min-w-0 flex-1">
                                      <div className="font-bold text-xs text-[#d4af37] truncate">
                                        [{i + 1}] {src.book_name}
                                      </div>
                                      <div className={`text-[10px] truncate ${themeClasses.mutedText}`}>
                                        {src.author_name}
                                      </div>
                                    </div>
                                    <span className="px-2 py-1 rounded-lg bg-[#d4af37]/15 text-[#d4af37] font-bold text-[11px] shrink-0">
                                      ج{src.part || 1}/ص{src.page_number}
                                    </span>
                                  </button>
                                ))}

                                {resp.fatawaSources.map((f) => (
                                  <button
                                    key={f.fatwa_id}
                                    type="button"
                                    onClick={() => setSelectedFatwaId(f.fatwa_id)}
                                    className="text-right p-2.5 rounded-xl bg-black/20 hover:bg-emerald-500/15 border border-white/10 hover:border-emerald-500/50 flex items-center justify-between gap-2 transition"
                                  >
                                    <div className="min-w-0 flex-1">
                                      <div className="font-bold text-xs text-emerald-400 truncate">
                                        {f.title}
                                      </div>
                                      <div className={`text-[10px] truncate ${themeClasses.mutedText}`}>
                                        المفتي: {f.mufti}
                                      </div>
                                    </div>
                                    <span className="px-2 py-1 rounded-lg bg-emerald-500/15 text-emerald-400 font-bold text-[11px] shrink-0">
                                      فتوى #{f.fatwa_id}
                                    </span>
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Interactive Artifact Studio: Infographic PNG, PowerPoint PPTX, Word DOC, and PDF */}
                          {resp && <ChatArtifactStudio response={resp} themeMode={themeMode} />}

                          {/* One-Tap Follow-Up Suggestions */}
                          {resp && resp.followUpSuggestions && resp.followUpSuggestions.length > 0 && (
                            <div className="pt-2.5 border-t border-white/10 space-y-2">
                              <span className="text-xs font-bold text-[#d4af37] block">
                                أسئلة مقترحة لمتابعة الحوار:
                              </span>
                              <div className="flex flex-wrap gap-1.5">
                                {resp.followUpSuggestions.map((sug) => (
                                  <button
                                    key={sug}
                                    type="button"
                                    onClick={() =>
                                      handleAskAI(
                                        sug,
                                        'auto',
                                        resp.matchedBook
                                          ? { id: resp.matchedBook.id, name: resp.matchedBook.title }
                                          : aiScopedBook
                                      )
                                    }
                                    className="text-right px-3 py-1.5 rounded-xl bg-white/5 hover:bg-[#d4af37]/15 border border-white/10 hover:border-[#d4af37]/40 text-xs font-medium leading-relaxed break-words transition"
                                  >
                                    {sug}
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}

                  {/* Live AI Synthesizing Status Bar if streaming */}
                  {aiLoading && aiLiveStatus && (
                    <div className={`p-4 rounded-2xl border flex items-center justify-between gap-3 ${themeClasses.cardBg}`}>
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className="w-8 h-8 rounded-xl bg-[#d4af37]/20 border border-[#d4af37]/40 flex items-center justify-center shrink-0">
                          <Loader2 className="w-4 h-4 animate-spin text-[#d4af37]" />
                        </div>
                        <div className="space-y-0.5 min-w-0 flex-1">
                          <div className="text-xs font-extrabold text-[#d4af37] truncate">
                            {aiLiveStatus}
                          </div>
                          <div className={`text-[11px] truncate ${themeClasses.mutedText}`}>
                            يتم استخلاص المعاني والمقارنة بين أمهات الكتب وصياغتها بأسلوب ذاتي
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={handleStopAI}
                        className="px-3 py-1.5 rounded-xl bg-red-500/15 hover:bg-red-500/25 border border-red-500/40 text-red-400 font-bold text-xs flex items-center gap-1.5 shrink-0 transition"
                      >
                        <Square className="w-3.5 h-3.5 fill-current" />
                        <span>إيقاف التوليد</span>
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Error Alert */}
              {aiError && (
                <div className="p-3.5 rounded-2xl bg-red-500/15 border border-red-500/30 text-red-400 text-xs space-y-2">
                  <p className="font-bold break-words">{aiError}</p>
                  <button
                    onClick={() => setIsApiModalOpen(true)}
                    className="px-3 py-1.5 rounded-xl bg-[#d4af37] text-black font-bold text-xs inline-flex items-center gap-1.5"
                  >
                    <Key className="w-3.5 h-3.5" />
                    <span>إعدادات ربط Gemini و Claude</span>
                  </button>
                </div>
              )}

              {/* 3. Bottom Sticky Chat Composer Bar */}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (aiQuestion.trim() && !aiLoading) {
                    handleAskAI();
                  }
                }}
                className={`sticky bottom-16 z-20 p-3 rounded-2xl border shadow-2xl space-y-2.5 backdrop-blur-md ${themeClasses.cardBg}`}
              >
                {/* Compact Horizontal Mode & Scope Strip */}
                <div className="flex items-center justify-between gap-2 overflow-x-auto no-scrollbar pb-0.5">
                  <div className="flex items-center gap-1 shrink-0">
                    {[
                      { id: 'auto', label: 'حوار ذكي مباشر', icon: Sparkles },
                      { id: 'book_summary', label: 'ملخص كتاب', icon: BookOpen },
                      { id: 'khutbah', label: 'خطبة جمعة', icon: Mic },
                      { id: 'lesson', label: 'درس علمي', icon: GraduationCap },
                      { id: 'infographic', label: 'إنفوجرافيك', icon: ImageIcon },
                      { id: 'presentation', label: 'باوربوينت', icon: Presentation },
                      { id: 'document', label: 'وورد / PDF', icon: FileText },
                    ].map((m) => {
                      const MIcon = m.icon;
                      const active = aiMode === m.id || (m.id === 'auto' && aiMode === 'chat');
                      return (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => setAiMode(m.id as AIChatMode)}
                          className={`px-2.5 py-1 rounded-xl text-[11px] font-bold flex items-center gap-1 border shrink-0 transition ${
                            active
                              ? 'bg-[#d4af37] text-black border-[#d4af37]'
                              : 'bg-white/5 border-white/10 opacity-80 hover:opacity-100'
                          }`}
                        >
                          <MIcon className="w-3 h-3 shrink-0" />
                          <span>{m.label}</span>
                        </button>
                      );
                    })}
                  </div>

                  {!aiScopedBook && (
                    <div className="flex items-center gap-1 shrink-0 border-r border-white/10 pr-2">
                      {[
                        { id: 'all', label: 'الكل' },
                        { id: 'books', label: 'الكتب' },
                        { id: 'fatawa', label: 'الفتاوى' },
                      ].map((s) => (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => setAiScope(s.id as any)}
                          className={`px-2 py-1 rounded-lg text-[10px] font-bold border transition ${
                            aiScope === s.id
                              ? 'bg-[#d4af37]/20 border-[#d4af37] text-[#d4af37]'
                              : 'border-transparent opacity-70'
                          }`}
                        >
                          {s.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Chat Message Input + Send / Stop Button */}
                <div className="flex items-end gap-2">
                  <textarea
                    rows={2}
                    value={aiQuestion}
                    onChange={(e) => setAiQuestion(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        if (aiQuestion.trim() && !aiLoading) {
                          handleAskAI();
                        }
                      }
                    }}
                    placeholder={
                      aiScopedBook
                        ? `اسأل المساعد الذكي أي سؤال في كتاب «${aiScopedBook.name}»...`
                        : 'اسأل المساعد الذكي أي سؤال... يصوغ لك الجواب بأسلوبه من الكتب والفتاوى'
                    }
                    className={`flex-1 min-w-0 w-full px-3.5 py-2.5 rounded-xl border text-xs sm:text-sm leading-relaxed focus:border-[#d4af37] focus:outline-none resize-none ${themeClasses.inputBg}`}
                  />

                  {aiLoading ? (
                    <button
                      type="button"
                      onClick={handleStopAI}
                      className="h-[52px] px-3.5 sm:px-4 rounded-xl bg-red-500/20 hover:bg-red-500/30 border border-red-500/50 text-red-400 font-extrabold text-xs flex items-center justify-center gap-1.5 shrink-0 shadow-md active:scale-95 transition"
                      title="إيقاف التوليد"
                    >
                      <Square className="w-4 h-4 fill-current" />
                      <span className="hidden sm:inline">إيقاف</span>
                    </button>
                  ) : (
                    <button
                      type="submit"
                      disabled={!aiQuestion.trim()}
                      className="h-[52px] px-4 sm:px-5 rounded-xl bg-gradient-to-l from-[#d4af37] to-[#b89225] text-black font-extrabold text-xs sm:text-sm flex items-center justify-center gap-1.5 disabled:opacity-40 shrink-0 shadow-md active:scale-95 transition"
                    >
                      <Send className="w-4 h-4" />
                      <span>إرسال</span>
                    </button>
                  )}
                </div>
              </form>
            </div>
          </main>
        )}

        {/* TAB 4: FATAWA ARCHIVE (خزانة الفتاوى - ٣٠٬١٧٣ فتوى) */}
        {activeTab === 'fatawa' && (
          <main className="p-3.5 space-y-4 flex-1">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                executeFatwaSearch(fatwaQuery);
              }}
              className="flex items-center gap-2 w-full"
            >
              <input
                type="search"
                value={fatwaQuery}
                onChange={(e) => setFatwaQuery(e.target.value)}
                placeholder="ابحث في ٣٠٬١٧٣ فتوى (الصلاة، الزكاة، المعاملات، الأسرة...)"
                className={`flex-1 min-w-0 w-full px-3.5 sm:px-4 py-3 rounded-2xl border text-sm focus:border-[#d4af37] focus:outline-none ${themeClasses.inputBg}`}
              />
              <button
                type="submit"
                disabled={loadingFatawa}
                className="px-4 sm:px-5 py-3 rounded-2xl bg-[#d4af37] text-black font-bold text-xs flex items-center justify-center gap-1.5 shrink-0"
              >
                {loadingFatawa ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                <span>بحث</span>
              </button>
            </form>

            {/* Quick Fatwa Topic Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
              {[
                'الصلاة',
                'زكاة الذهب',
                'الصيام والقضاء',
                'الحج والعمرة',
                'البيع والربا',
                'النكاح والمهور',
                'الميراث والوصية',
                'كفارة اليمين',
              ].map((topic) => (
                <button
                  key={topic}
                  onClick={() => {
                    setFatwaQuery(topic);
                    executeFatwaSearch(topic);
                  }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-medium shrink-0 border transition ${
                    fatwaQuery === topic
                      ? 'bg-[#d4af37] text-black border-[#d4af37] font-bold'
                      : `${themeClasses.cardBg}`
                  }`}
                >
                  {topic}
                </button>
              ))}
            </div>

            {loadingFatawa ? (
              <div className="py-16 flex flex-col items-center justify-center gap-2 opacity-75">
                <Loader2 className="w-7 h-7 animate-spin text-[#d4af37]" />
                <span className="text-xs">جاري البحث في خزانة الفتاوى...</span>
              </div>
            ) : (
              <div className="space-y-2.5">
                <div className="flex items-center justify-between text-xs px-1">
                  <span>
                    الفتاوى المطابقة:{' '}
                    <strong className="text-[#d4af37]">{fatwaTotalHits.toLocaleString('ar-EG')}</strong> فتوى
                  </span>
                  <span className="opacity-70">اضغط لقراءة السؤال والجواب كاملاً</span>
                </div>

                {fatwaResults.map((f) => (
                  <div
                    key={f.fatwa_id}
                    onClick={() => setSelectedFatwaId(f.fatwa_id)}
                    className={`p-4 rounded-2xl border cursor-pointer transition space-y-2 ${themeClasses.cardBg}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-bold text-sm text-[#d4af37]">{f.title}</h3>
                      <span className="px-2 py-0.5 rounded-md bg-white/10 text-[10px] shrink-0">
                        {f.content_type_label || 'فتوى'}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 text-xs opacity-80">
                      <span>المفتي: {f.mufti?.name || 'غير محدد'}</span>
                      {f.topics && f.topics.length > 0 && <span>• {f.topics.slice(0, 2).join('، ')}</span>}
                    </div>

                    {(f.question_excerpt || f.answer_excerpt) && (
                      <p
                        className="font-naskh text-sm opacity-95 line-clamp-2 pt-1 border-t border-white/5"
                        dangerouslySetInnerHTML={{
                          __html: (f.question_excerpt || f.answer_excerpt || '').replace(
                            /<mark>/g,
                            '<mark class="search-highlight">'
                          ),
                        }}
                      />
                    )}
                  </div>
                ))}
              </div>
            )}
          </main>
        )}

        {/* TAB 5: BOOKMARKS, SETTINGS & INDEX ANALYSIS (المفضلة والضبط وتحليل الموسوعة) */}
        {activeTab === 'settings' && (
          <main className="p-3.5 space-y-5 flex-1">
            {/* 0. Install App to Phone Home Screen Card */}
            <PWAInstallBanner variant="card" themeCardClass={themeClasses.cardBg} />

            {/* 1. Eye-Comfort Theme Selector */}
            <section className={`p-4 rounded-2xl border space-y-3 ${themeClasses.cardBg}`}>
              <h2 className="font-bold text-sm text-[#d4af37] flex items-center gap-2">
                <Moon className="w-4 h-4" />
                <span>أوضاع القراءة وراحة العين</span>
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { id: 'night', label: 'ليلي مريح (افتراضي)', desc: 'تباين دافئ للقراءة الطويلة' },
                  { id: 'oled', label: 'أسود OLED', desc: 'توفير الطاقة في الشاشات الحديثة' },
                  { id: 'sepia', label: 'ورق مخطوط (سيبيا)', desc: 'لون الورق التراثي الدافئ' },
                  { id: 'day', label: 'نهاري ساطع', desc: 'للقراءة في الإضاءة العالية' },
                ].map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setThemeMode(t.id as ThemeMode)}
                    className={`p-3 rounded-xl border text-right transition ${
                      themeMode === t.id
                        ? 'border-[#d4af37] bg-[#d4af37]/15'
                        : 'border-white/10 opacity-75 hover:opacity-100'
                    }`}
                  >
                    <div className="font-bold text-xs text-[#d4af37]">{t.label}</div>
                    <div className="text-[10px] opacity-75 mt-0.5">{t.desc}</div>
                  </button>
                ))}
              </div>
            </section>

            {/* 2. API Key Configuration Card (Gemini & Claude) */}
            <section className={`p-4 rounded-2xl border space-y-3 ${themeClasses.cardBg}`}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="space-y-1 min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-bold text-sm text-[#d4af37] flex items-center gap-2">
                      <Bot className="w-4 h-4 shrink-0" />
                      <span>إعدادات ربط الذكاء الاصطناعي (Google Gemini & Anthropic Claude)</span>
                    </h2>
                    <span className="px-2 py-0.5 rounded-lg text-[11px] font-bold bg-emerald-500/15 border border-emerald-500/30 text-emerald-400">
                      {claudeApiKey && (preferredProvider === 'claude' || !userApiKey)
                        ? '✓ Claude مفعل'
                        : userApiKey
                        ? '✓ Gemini مفعل'
                        : 'المحرك العلمي المدمج مفعل'}
                    </span>
                  </div>
                  <p className={`text-xs ${themeClasses.mutedText}`}>
                    اربط مفتاح Gemini أو Claude بخطوات سهلة وواضحة، مع استمرار عمل المحرك العلمي المدمج مجاناً وبلا انقطاع
                  </p>
                </div>
                <button
                  onClick={() => setIsApiModalOpen(true)}
                  className="w-full sm:w-auto px-3.5 py-2.5 rounded-xl bg-[#d4af37] text-black font-bold text-xs shrink-0 flex items-center justify-center gap-1.5"
                >
                  <Key className="w-3.5 h-3.5" />
                  <span>إعدادات الربط (Gemini / Claude)</span>
                </button>
              </div>
            </section>

            {/* 3. Saved Bookmarks Section */}
            <section className={`p-4 rounded-2xl border space-y-3 ${themeClasses.cardBg}`}>
              <h2 className="font-bold text-sm text-[#d4af37] flex items-center gap-2">
                <Bookmark className="w-4 h-4" />
                <span>المفضلة والمحفوظات ({bookmarks.length})</span>
              </h2>

              {bookmarks.length === 0 ? (
                <p className="text-xs opacity-60 py-4 text-center">
                  لم تقم بحفظ أي صفحات أو فتاوى أو أبحاث بعد. اضغط على أيقونة الحفظ أثناء القراءة للرجوع إليها هنا.
                </p>
              ) : (
                <div className="space-y-2">
                  {bookmarks.map((bm) => (
                    <div
                      key={bm.id}
                      className="p-3 rounded-xl bg-black/15 border border-white/10 flex items-center justify-between gap-2"
                    >
                      <div
                        onClick={() => {
                          if (bm.type === 'page' && bm.bookId) {
                            setReaderBookId(bm.bookId);
                            setReaderPageId(bm.pageId || 1);
                          } else if (bm.type === 'fatwa' && bm.fatwaId) {
                            setSelectedFatwaId(bm.fatwaId);
                          } else if (bm.type === 'ai' && bm.fullText) {
                            const restoredResp: AIResearchResponse = {
                              question: bm.title,
                              searchQueryUsed: bm.title,
                              answer: bm.fullText,
                              sources: [],
                              fatawaSources: [],
                              totalBookHits: 0,
                              totalFatwaHits: 0,
                            };
                            setAiResult(restoredResp);
                            setAiMessages([
                              {
                                id: `bm-u-${Date.now()}`,
                                role: 'user',
                                content: bm.title,
                                timestamp: Date.now(),
                              },
                              {
                                id: `bm-a-${Date.now()}`,
                                role: 'assistant',
                                content: bm.fullText,
                                response: restoredResp,
                                timestamp: Date.now(),
                              },
                            ]);
                            setActiveTab('ai');
                          }
                        }}
                        className="min-w-0 flex-1 cursor-pointer"
                      >
                        <h4 className="font-bold text-xs text-[#d4af37] break-words">{bm.title}</h4>
                        <p className="text-[11px] opacity-80 break-words">{bm.subtitle}</p>
                      </div>
                      <button
                        onClick={() => handleToggleBookmark(bm)}
                        className="p-1.5 text-gray-400 hover:text-red-400"
                        title="حذف من المفضلة"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* 4. Encyclopedia File, Print-Numbering & Netlify Deployment Info */}
            <section className={`p-4 rounded-2xl border space-y-3.5 ${themeClasses.cardBg}`}>
              <div className="flex items-center justify-between">
                <h2 className="font-bold text-sm text-[#d4af37] flex items-center gap-2">
                  <Database className="w-4 h-4" />
                  <span>تحليل الفهرسة ومطابقة المطبوع</span>
                </h2>
                <a
                  href="https://ibadi.net/download"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-[#d4af37] underline flex items-center gap-1"
                >
                  <span>صفحة التحميل الرسمية</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>

              <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/25 text-xs space-y-1 leading-relaxed">
                <div className="font-bold text-emerald-400">
                  حالة مطابقة ترقيم الصفحات للمطبوع في الموسوعة:
                </div>
                <p className="opacity-90">
                  • <strong>١٬٨١٦ كتاباً</strong> في الموسوعة <strong>موافقة للمطبوع</strong> (`printed`) وتصلح للعزو العلمي المباشر بالجزء والصفحة.
                </p>
                <p className="opacity-90">
                  • <strong>٩٥٤ كتاباً</strong> ذات ترقيم آلي متسلسل (`sequential`)، ويظهر تنبيه واضح أعلى كل صفحة في القارئ لبيان حالة الكتاب.
                </p>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                <div className="p-3 rounded-xl bg-black/15 border border-white/5">
                  <div className="font-bold text-base text-[#d4af37]">٢٬٩٣١</div>
                  <div className="text-[11px] opacity-75">إجمالي الكتب</div>
                </div>
                <div className="p-3 rounded-xl bg-black/15 border border-white/5">
                  <div className="font-bold text-base text-emerald-400">١٬٨١٦</div>
                  <div className="text-[11px] opacity-75">موافق للمطبوع</div>
                </div>
                <div className="p-3 rounded-xl bg-black/15 border border-white/5">
                  <div className="font-bold text-base text-[#d4af37]">٧٩٠٬٠٢٠</div>
                  <div className="text-[11px] opacity-75">صفحة مفهرسة</div>
                </div>
                <div className="p-3 rounded-xl bg-black/15 border border-white/5">
                  <div className="font-bold text-base text-[#d4af37]">٣٠٬١٧٣</div>
                  <div className="text-[11px] opacity-75">فتوى مفهرسة</div>
                </div>
              </div>

              <div className="max-h-56 overflow-y-auto space-y-1.5 pt-2 pr-1">
                {categories.map((c) => (
                  <div
                    key={c.name}
                    onClick={() => {
                      setSelectedCategory(c.name);
                      setActiveTab('catalog');
                    }}
                    className="p-2 rounded-lg bg-black/10 hover:bg-[#d4af37]/15 flex items-center justify-between text-xs cursor-pointer transition"
                  >
                    <span className="font-medium">{c.name}</span>
                    <span className="text-[#d4af37] font-bold">{c.count} كتاب</span>
                  </div>
                ))}
              </div>
            </section>
          </main>
        )}

        {/* Responsive Page Footer (ذيل الصفحة - متوافق مع الهاتف والحاسوب) */}
        <footer
          className={`mx-3.5 mt-6 p-4 rounded-2xl border text-xs space-y-3 ${themeClasses.cardBg}`}
        >
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
              <span className="font-bold text-[#d4af37]">
                الموسوعة الإباضية — تصميم مخصص للهواتف الذكية والحواسيب
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-[11px]">
              <span className="px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-400 font-bold">
                الآيات القرآنية محفوظة برسم المصحف الشريف ﴿...﴾
              </span>
              <span className="px-2 py-0.5 rounded-md bg-[#d4af37]/15 text-[#d4af37] font-bold">
                التشكيل والتدقيق اللغوي مفعّل
              </span>
            </div>
          </div>

          <div className={`flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-white/10 text-[11px] ${themeClasses.mutedText}`}>
            <span>
              إجمالي القاعدة: ٢٬٩٣١ كتاباً (١٬٨١٦ موافق للمطبوع) • ٧٩٠٬٠٢٠ صفحة • ٣٠٬١٧٣ فتوى
            </span>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setActiveTab('settings')}
                className="text-[#d4af37] hover:underline font-bold"
              >
                تثبيت التطبيق على الهاتف
              </button>
              <a
                href="https://ibadi.net/download"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#d4af37] hover:underline font-bold flex items-center gap-1"
              >
                <span>المصدر الرسمي</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>
        </footer>

        {/* Fixed Mobile-First & Desktop Bottom Navigation Bar */}
        <nav
          className={`fixed bottom-0 right-0 left-0 z-30 border-t backdrop-blur-md pb-safe ${themeClasses.navBg}`}
        >
          <div className="max-w-3xl mx-auto grid grid-cols-5 gap-0.5 px-1 sm:px-4 py-1">
            {[
              { id: 'catalog', mobileLabel: 'الفهرس', desktopLabel: 'الفهرس', icon: BookOpen },
              { id: 'search', mobileLabel: 'بحث متقدم', desktopLabel: 'بحث متقدم', icon: Search },
              { id: 'ai', mobileLabel: 'المساعد الذكي', desktopLabel: 'الدردشة العلمية', icon: Sparkles },
              { id: 'fatawa', mobileLabel: 'الفتاوى', desktopLabel: 'الفتاوى', icon: MessageSquareQuote },
              { id: 'settings', mobileLabel: 'الضبط', desktopLabel: 'الضبط والمفضلة', icon: Settings },
            ].map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id as any)}
                  className={`min-w-0 overflow-hidden flex flex-col items-center justify-center min-h-[52px] py-1 px-0.5 rounded-xl transition active:scale-95 ${
                    isActive ? 'text-[#d4af37] font-bold' : 'opacity-75 hover:opacity-100'
                  }`}
                >
                  <div className={`px-2 sm:px-2.5 py-1 rounded-xl transition ${isActive ? 'bg-[#d4af37]/20' : ''}`}>
                    <Icon className="w-4 h-4 sm:w-5 sm:h-5" />
                  </div>
                  <span className="text-[10px] sm:text-xs leading-tight mt-0.5 text-center w-full truncate">
                    <span className="sm:hidden">{item.mobileLabel}</span>
                    <span className="hidden sm:inline">{item.desktopLabel}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </nav>
      </div>

      {/* Modals */}
      <ApiKeyGuideModal
        isOpen={isApiModalOpen}
        onClose={() => setIsApiModalOpen(false)}
        userApiKey={userApiKey}
        onSaveKey={handleSaveApiKey}
        claudeApiKey={claudeApiKey}
        onSaveClaudeKey={handleSaveClaudeKey}
        preferredProvider={preferredProvider}
        onChangeProvider={handleChangeProvider}
        hasServerKey={hasServerKey}
      />

      <BookReaderModal
        bookId={readerBookId}
        initialPageId={readerPageId}
        highlightTerm={readerHighlight}
        onClose={() => setReaderBookId(null)}
        onToggleBookmark={handleToggleBookmark}
        isBookmarked={isBookmarked}
        onAskAiAboutBook={(bId, bName, initialPrompt, initialMode) => {
          const scoped = { id: bId, name: bName };
          setAiScopedBook(scoped);
          if (initialMode) {
            setAiMode(initialMode);
          }
          setActiveTab('ai');
          if (initialPrompt) {
            handleAskAI(initialPrompt, initialMode || 'book_summary', scoped);
          }
        }}
        themeMode={themeMode}
      />

      <FatwaReaderModal
        fatwaId={selectedFatwaId}
        onClose={() => setSelectedFatwaId(null)}
        onToggleBookmark={handleToggleBookmark}
        isBookmarked={isBookmarked}
        themeMode={themeMode}
      />
    </div>
  );
}
