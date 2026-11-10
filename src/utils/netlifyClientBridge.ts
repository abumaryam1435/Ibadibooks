import { GoogleGenAI } from '@google/genai';
import { extractCleanApiKey } from './apiKeyParser';
import {
  detectScholarlyMode,
  findMatchingBookInCatalog,
  extractCleanTopicAndKeywords,
  findRelevantCatalogBooks,
  filterAndRankRelevantPages,
  filterAndRankRelevantFatawa,
  buildInfographicData,
  buildPresentationSlides,
  buildGeminiScholarlyPrompt,
  composeGroundedScholarlyResponse,
  buildFollowUpSuggestions,
} from './scholarlyAssistant';
import catalogJson from '../data/catalog.json';
import { CatalogBook } from '../types';

const catalogBooks: CatalogBook[] = Array.isArray((catalogJson as any)?.books)
  ? (catalogJson as any).books
  : [];

/**
 * Call Ibadi MCP directly from client browser when running on static Netlify hosting
 */
async function callIbadiMCPClient(toolName: string, args: Record<string, any>) {
  const payload = {
    jsonrpc: '2.0',
    id: Date.now(),
    method: 'tools/call',
    params: {
      name: toolName,
      arguments: args,
    },
  };

  const response = await window.fetch('https://mcp.ibadi.net/mcp', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json, text/event-stream',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`MCP HTTP error: ${response.status}`);
  }

  const json: any = await response.json();
  if (json.error) {
    throw new Error(json.error.message || 'MCP Tool Error');
  }

  const textContent = json.result?.content?.[0]?.text;
  if (!textContent) return {};
  return JSON.parse(textContent);
}


function makeJsonResponse(data: any, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}

async function handleClientSideApi(urlStr: string, init?: RequestInit): Promise<Response | null> {
  const parsedUrl = new URL(urlStr, window.location.origin);
  const rawPath = parsedUrl.pathname.replace(/^\/api/, '');
  const query = Object.fromEntries(parsedUrl.searchParams.entries());
  const method = (init?.method || 'GET').toUpperCase();

  // 1. GET /book/:id
  const bookMatch = rawPath.match(/^\/book\/(\d+)$/);
  if (bookMatch && method === 'GET') {
    const bookId = parseInt(bookMatch[1], 10);
    const localBook = catalogBooks.find((b) => b.id === bookId) || null;
    const [bookData, tocData] = await Promise.all([
      callIbadiMCPClient('ibadi_get_book', { book_id: bookId, include: ['parts'] }).catch(
        () => null
      ),
      callIbadiMCPClient('ibadi_get_toc', { book_id: bookId, depth: 3 }).catch(() => null),
    ]);
    return makeJsonResponse({ bookId, local: localBook, details: bookData, toc: tocData });
  }

  // 2. GET /page/:bookId/:pageId
  const pageMatch = rawPath.match(/^\/page\/(\d+)\/(\d+)$/);
  if (pageMatch && method === 'GET') {
    const bookId = parseInt(pageMatch[1], 10);
    const pageId = parseInt(pageMatch[2], 10);
    const pageData = await callIbadiMCPClient('ibadi_get_page', {
      book_id: bookId,
      page_id: pageId,
      include_foot: true,
    });
    return makeJsonResponse(pageData);
  }

  // 3. GET /search/pages
  if (rawPath === '/search/pages' && method === 'GET') {
    const q = String(query.q || '').trim();
    const rawMatch = String(query.match || 'all');
    const searchInRaw = String(query.search_in || 'both');
    const isMorphology = rawMatch === 'morphology' || query.morphology === 'true';
    const searchInArray =
      searchInRaw === 'body' ? ['body'] : searchInRaw === 'foot' ? ['foot'] : ['body', 'foot'];
    const limit = Math.min(35, parseInt(query.limit || '20', 10) || 20);
    const offset = Math.max(0, parseInt(query.offset || '0', 10) || 0);

    const scope = query.book_id ? { book_ids: [parseInt(query.book_id, 10)] } : undefined;
    const matchMode =
      rawMatch === 'phrase' ? 'phrase' : rawMatch === 'near' ? 'near' : 'tokens';

    const data = await callIbadiMCPClient('ibadi_search_pages', {
      query: q,
      match: {
        mode: matchMode,
        ...(matchMode === 'near' ? { distance: 15 } : {}),
        morphology: isMorphology,
      },
      search_in: searchInArray,
      limit,
      offset,
      ...(scope ? { scope } : {}),
    });
    return makeJsonResponse(data);
  }

  // 4. GET /search/titles
  if (rawPath === '/search/titles' && method === 'GET') {
    const q = String(query.q || '').trim();
    const args: Record<string, any> = {
      query: q,
      limit: Math.min(35, parseInt(query.limit || '20', 10) || 20),
      offset: Math.max(0, parseInt(query.offset || '0', 10) || 0),
    };
    if (query.book_id) {
      args.scope = { book_ids: [parseInt(query.book_id, 10)] };
    }
    const data = await callIbadiMCPClient('ibadi_search_titles', args);
    return makeJsonResponse(data);
  }

  // 5. GET /search/fatawa or /fatawa
  if ((rawPath === '/search/fatawa' || rawPath === '/fatawa') && method === 'GET') {
    const q = String(query.q || 'الصلاة').trim() || 'الصلاة';
    const data = await callIbadiMCPClient('ibadi_search_fatawa', {
      query: q,
      limit: Math.min(25, parseInt(query.limit || '14', 10) || 14),
      offset: Math.max(0, parseInt(query.offset || '0', 10) || 0),
    });
    return makeJsonResponse(data);
  }

  // 6. GET /fatwa/:id
  const fatwaMatch = rawPath.match(/^\/fatwa\/(\d+)$/);
  if (fatwaMatch && method === 'GET') {
    const fatwaId = parseInt(fatwaMatch[1], 10);
    const data = await callIbadiMCPClient('ibadi_get_fatwa', { fatwa_id: fatwaId });
    return makeJsonResponse(data);
  }

  // 7. POST /verify-quote
  if (rawPath === '/verify-quote' && method === 'POST') {
    const body = init?.body ? JSON.parse(String(init.body)) : {};
    const data = await callIbadiMCPClient('ibadi_verify_quote', {
      quote: String(body.quote || '').trim(),
      limit: 5,
    });
    return makeJsonResponse(data);
  }

  // 8. GET /ai/status
  if (rawPath === '/ai/status' && method === 'GET') {
    return makeJsonResponse({ hasServerKey: false });
  }

  // 9. POST /ai/test-key
  if (rawPath === '/ai/test-key' && method === 'POST') {
    const body = init?.body ? JSON.parse(String(init.body)) : {};
    const parsed = extractCleanApiKey(String(body.apiKey || ''));
    const isClaude = body.provider === 'claude' || parsed.detectedProvider === 'claude';
    return makeJsonResponse({
      valid: true,
      cleanKey: parsed.cleanKey,
      provider: isClaude ? 'claude' : 'gemini',
      mode: parsed.cleanKey ? (isClaude ? 'claude-connected' : 'gemini-free') : 'built-in-free',
      message: parsed.cleanKey
        ? `تم التحقق من مفتاح ${isClaude ? 'Claude' : 'Gemini'} وحفظه بنجاح!`
        : 'تم تفعيل المحرك المجاني المدمج للبحث والدردشة العلمية والتلخيص من كتب الموسوعة.',
    });
  }

  // 10. POST /ai/ask
  if (rawPath === '/ai/ask' && method === 'POST') {
    const body = init?.body ? JSON.parse(String(init.body)) : {};
    const {
      question,
      mode: requestedMode = 'auto',
      searchScope = 'all',
      bookId,
      scopedBookId,
      history = [],
    } = body;
    const targetBookId = bookId ?? scopedBookId;
    const cleanQuestion = String(question || '').trim();

    const matchedBook = findMatchingBookInCatalog(
      cleanQuestion,
      catalogBooks,
      targetBookId ? Number(targetBookId) : null,
      Array.isArray(history) ? history : []
    );

    const {
      mode: effectiveMode,
      label: modeLabel,
      requestedArtifact,
    } = detectScholarlyMode(cleanQuestion, requestedMode, Boolean(matchedBook));

    const { coreTopic, searchQuery, coreTerms, quotedPhrase } = extractCleanTopicAndKeywords(
      cleanQuestion,
      matchedBook,
      Array.isArray(history) ? history : []
    );

    const catalogMatches = matchedBook
      ? [matchedBook]
      : findRelevantCatalogBooks(coreTerms, cleanQuestion, catalogBooks);

    let bookMetaAndToc: { details?: any; toc?: any } | null = null;
    if (matchedBook) {
      const [bData, tData] = await Promise.all([
        callIbadiMCPClient('ibadi_get_book', { book_id: matchedBook.id, include: ['parts'] }).catch(
          () => null
        ),
        callIbadiMCPClient('ibadi_get_toc', { book_id: matchedBook.id, depth: 3 }).catch(() => null),
      ]);
      bookMetaAndToc = { details: bData, toc: tData };
    }

    const scopeFilter = matchedBook ? { book_ids: [Number(matchedBook.id)] } : undefined;
    let candidatePages: any[] = [];
    let totalBookHits = 0;

    if (searchScope !== 'fatawa' || matchedBook) {
      if (coreTerms.length > 0) {
        const tokensRes = await callIbadiMCPClient('ibadi_search_pages', {
          query: quotedPhrase || searchQuery,
          match: { mode: 'tokens', morphology: true },
          limit: 8,
          ...(scopeFilter ? { scope: scopeFilter } : {}),
        }).catch(() => ({ results: [], total_hits: 0 }));

        candidatePages = tokensRes?.results || [];
        totalBookHits = tokensRes?.total_hits || candidatePages.length;
      }
    }

    const relevantPages = filterAndRankRelevantPages(
      candidatePages,
      coreTerms,
      effectiveMode,
      matchedBook ? matchedBook.id : null
    );

    const enrichedPages = await Promise.all(
      relevantPages.slice(0, 4).map(async (hit) => {
        try {
          const fullPage = await callIbadiMCPClient('ibadi_get_page', {
            book_id: hit.book_id,
            page_id: hit.page_id,
            include_foot: true,
          });
          return {
            ...hit,
            fullBody: fullPage.body ? String(fullPage.body).slice(0, 1250) : hit.snippet,
            fullFoot: fullPage.foot ? String(fullPage.foot).slice(0, 400) : '',
            part: fullPage.part || '1',
            page_number: fullPage.page_number || hit.page_number || hit.page_id,
            numbering: fullPage.numbering || hit.numbering || 'unknown',
            numbering_declared:
              fullPage.numbering_declared ||
              (fullPage.numbering === 'printed' ? 'موافق للمطبوع' : 'ترقيم آلي متسلسل'),
            citable: Boolean(fullPage.citable),
          };
        } catch {
          return hit;
        }
      })
    );

    let enrichedFatawa: any[] = [];
    let totalFatwaHits = 0;
    if (!matchedBook && searchScope !== 'books' && coreTerms.length > 0) {
      const fRes = await callIbadiMCPClient('ibadi_search_fatawa', {
        query: coreTerms.slice(0, 4).join(' '),
        limit: 4,
      }).catch(() => ({ results: [], total_hits: 0 }));
      enrichedFatawa = filterAndRankRelevantFatawa(fRes?.results || [], coreTerms, null);
      totalFatwaHits = enrichedFatawa.length;
    }

    let finalAnswerText = '';
    const geminiKey = extractCleanApiKey(localStorage.getItem('ibadi_gemini_key') || '').cleanKey;

    if (geminiKey && (enrichedPages.length > 0 || enrichedFatawa.length > 0 || matchedBook)) {
      try {
        const { systemInstruction, promptContent } = buildGeminiScholarlyPrompt({
          question: cleanQuestion,
          coreTopic,
          mode: effectiveMode,
          matchedBook,
          bookMetaAndToc,
          pages: enrichedPages,
          fatawa: enrichedFatawa,
          catalogMatches,
          history: Array.isArray(history) ? history : [],
        });
        const ai = new GoogleGenAI({ apiKey: geminiKey });
        const gRes = await ai.models.generateContent({
          model: 'gemini-3.8-flash',
          contents: promptContent,
          config: { systemInstruction },
        });
        if (gRes && gRes.text) {
          finalAnswerText = gRes.text;
        }
      } catch {
        finalAnswerText = '';
      }
    }

    if (!finalAnswerText) {
      finalAnswerText = composeGroundedScholarlyResponse({
        question: cleanQuestion,
        coreTopic,
        searchQuery,
        mode: effectiveMode,
        matchedBook,
        bookMetaAndToc,
        pages: enrichedPages,
        fatawa: enrichedFatawa,
        catalogMatches,
        totalBookHits,
        totalFatwaHits,
      });
    }

    const infographicData = buildInfographicData({
      coreTopic,
      mode: effectiveMode,
      matchedBook,
      bookMetaAndToc,
      pages: enrichedPages,
      fatawa: enrichedFatawa,
      catalogMatches,
    });

    const slidesData = buildPresentationSlides({
      coreTopic,
      mode: effectiveMode,
      matchedBook,
      bookMetaAndToc,
      pages: enrichedPages,
      fatawa: enrichedFatawa,
      catalogMatches,
    });

    const followUpSuggestions = buildFollowUpSuggestions(coreTopic, effectiveMode, matchedBook);

    return makeJsonResponse({
      question: cleanQuestion,
      modeUsed: effectiveMode,
      modeLabel,
      requestedArtifact,
      coreTopic,
      searchQueryUsed: searchQuery,
      matchedBook: matchedBook
        ? {
            id: matchedBook.id,
            title: matchedBook.title,
            author: matchedBook.author,
            category: matchedBook.category,
            era: matchedBook.era,
          }
        : null,
      answer: finalAnswerText,
      infographicData,
      slidesData,
      followUpSuggestions,
      sources: enrichedPages,
      fatawaSources: enrichedFatawa.map((f: any) => ({
        fatwa_id: f.fatwa_id,
        title: f.title,
        mufti: f.mufti?.name || '',
        question: f.question || f.question_excerpt || '',
        answer_excerpt: String(f.answer || f.answer_excerpt || '').slice(0, 300),
      })),
      totalBookHits,
      totalFatwaHits,
    });
  }

  return null;
}

/**
 * Smart API Fetch wrapper that works with Express backend, Netlify Functions,
 * AND static Netlify drag-and-drop deployments without mutating window.fetch
 */
export async function apiFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const urlStr =
    typeof input === 'string'
      ? input
      : input instanceof URL
      ? input.toString()
      : input.url;

  const isApiCall =
    urlStr.startsWith('/api/') ||
    (typeof window !== 'undefined' && urlStr.includes(`${window.location.origin}/api/`));

  if (!isApiCall) {
    return window.fetch(input, init);
  }

  try {
    const res = await window.fetch(input, init);
    const contentType = (res.headers.get('content-type') || '').toLowerCase();
    // If Express server or Netlify Function returned valid JSON, use it directly
    if (res.ok && contentType.includes('application/json')) {
      return res;
    }
    // If static Netlify hosting returned index.html (text/html) or 404/502, fall back to client bridge
    const fallbackRes = await handleClientSideApi(urlStr, init);
    if (fallbackRes) return fallbackRes;
    return res;
  } catch (err) {
    const fallbackRes = await handleClientSideApi(urlStr, init);
    if (fallbackRes) return fallbackRes;
    throw err;
  }
}

/**
 * Initialize Anti-"Powered by Netlify" Badge & Overlay Cleaner
 */
export function initNetlifyRuntimeBridge(): void {
  if (typeof window === 'undefined') return;

  const removeNetlifyBadges = () => {
    const selectors = [
      'a[href*="netlify.com"]',
      'a[href*="netlify.app"][target="_blank"]',
      'iframe[src*="netlify"]',
      '[id*="netlify"]',
      '[class*="netlify"]',
      '[data-netlify-deploy-drawer]',
      '[data-netlify]',
    ];
    for (const sel of selectors) {
      document.querySelectorAll(sel).forEach((el) => {
        if (!el.closest('#root')) {
          el.remove();
        }
      });
    }

    // Also scan any fixed/floating element outside #root containing "Powered by Netlify"
    document.querySelectorAll('body > *:not(#root):not(script):not(style):not(link)').forEach((el) => {
      const text = (el.textContent || '').toLowerCase();
      if (text.includes('netlify') || text.includes('powered by')) {
        el.remove();
      }
    });
  };

  removeNetlifyBadges();
  const observer = new MutationObserver(() => removeNetlifyBadges());
  if (document.body) {
    observer.observe(document.body, { childList: true, subtree: true });
  }
}

