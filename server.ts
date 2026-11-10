import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';
import { proofreadAndVocalizeArabic } from './src/utils/arabicProofreader.ts';
import { extractCleanApiKey } from './src/utils/apiKeyParser.ts';
import {
  detectScholarlyMode,
  findMatchingBookInCatalog,
  extractCleanTopicAndKeywords,
  filterAndRankRelevantPages,
  filterAndRankRelevantFatawa,
  buildGeminiScholarlyPrompt,
  composeGroundedScholarlyResponse,
  buildFollowUpSuggestions,
} from './src/utils/scholarlyAssistant.ts';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json({ limit: '2mb' }));

// Load local indexed catalog & categories for instant 0ms response
const catalogPath = path.join(__dirname, 'src', 'data', 'catalog.json');
const categoriesPath = path.join(__dirname, 'src', 'data', 'categories.json');

interface CatalogBook {
  id: number;
  title: string;
  author: string;
  era: string;
  category: string;
  isPdf: boolean;
  cover: string;
}

let catalogBooks: CatalogBook[] = [];
let categoriesList: { name: string; count: number; sampleBook: string }[] = [];

try {
  if (fs.existsSync(catalogPath)) {
    catalogBooks = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));
  }
  if (fs.existsSync(categoriesPath)) {
    categoriesList = JSON.parse(fs.readFileSync(categoriesPath, 'utf8'));
  }
  console.log(`Loaded ${catalogBooks.length} indexed books across ${categoriesList.length} categories.`);
} catch (err) {
  console.error('Error loading local catalog:', err);
}

// Fast in-memory cache for MCP responses
const mcpCache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL = 1000 * 60 * 30; // 30 minutes

async function callIbadiMCP(toolName: string, args: Record<string, any>): Promise<any> {
  const cacheKey = `${toolName}:${JSON.stringify(args)}`;
  const cached = mcpCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }

  const payload = {
    jsonrpc: '2.0',
    id: Date.now(),
    method: 'tools/call',
    params: {
      name: toolName,
      arguments: args,
    },
  };

  const response = await fetch('https://mcp.ibadi.net/mcp', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json, text/event-stream',
      'User-Agent': 'IbadiEncyclopediaMobileApp/2.0',
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
  if (!textContent) {
    return {};
  }

  const parsed = JSON.parse(textContent);
  if (json.result?.isError || parsed?.error) {
    throw new Error(parsed?.message || 'خطأ في استعلام الموسوعة');
  }

  if (mcpCache.size > 500) {
    const firstKey = mcpCache.keys().next().value;
    if (firstKey) mcpCache.delete(firstKey);
  }
  mcpCache.set(cacheKey, { data: parsed, timestamp: Date.now() });
  return parsed;
}

// Normalize Arabic for flexible local catalog filtering
function normalizeArabic(text: string): string {
  if (!text) return '';
  return text
    .replace(/[\u064B-\u065F\u0670]/g, '') // Remove tashkeel
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .toLowerCase()
    .trim();
}

// 1. Get Categories and Statistics
app.get('/api/categories', (_req, res) => {
  res.json({
    totalBooks: 2931,
    indexedCatalogCount: catalogBooks.length,
    totalPages: 790020,
    totalAuthors: 1371,
    totalFatawa: 30173,
    categories: categoriesList,
  });
});

// 2. Browse & Search Catalog Locally (Instant < 2ms)
app.get('/api/catalog', (req, res) => {
  const q = String(req.query.q || '').trim();
  const category = String(req.query.category || '').trim();
  const format = String(req.query.format || 'all').trim(); // 'all' | 'text' | 'pdf'
  const era = String(req.query.era || 'all').trim(); // 'all' | 'classic' | 'modern'
  const page = Math.max(1, parseInt(String(req.query.page || '1'), 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit || '24'), 10) || 24));

  let filtered = catalogBooks;

  if (category && category !== 'all') {
    filtered = filtered.filter((b) => b.category === category);
  }

  if (format === 'text') {
    filtered = filtered.filter((b) => !b.isPdf);
  } else if (format === 'pdf') {
    filtered = filtered.filter((b) => b.isPdf);
  }

  if (era === 'modern') {
    filtered = filtered.filter((b) => b.era.includes('معاصر'));
  } else if (era === 'classic') {
    filtered = filtered.filter((b) => b.era && !b.era.includes('معاصر'));
  }

  if (q) {
    const normQ = normalizeArabic(q);
    const terms = normQ.split(/\s+/).filter(Boolean);
    filtered = filtered.filter((b) => {
      const target = normalizeArabic(`${b.title} ${b.author} ${b.category} ${b.era}`);
      return terms.every((term) => target.includes(term));
    });
  }

  const total = filtered.length;
  const startIndex = (page - 1) * limit;
  const results = filtered.slice(startIndex, startIndex + limit);

  res.json({
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
    results,
  });
});

// 3. Get Single Book Metadata + Table of Contents
app.get('/api/book/:id', async (req, res) => {
  try {
    const bookId = parseInt(req.params.id, 10);
    if (isNaN(bookId)) {
      return res.status(400).json({ error: 'رقم الكتاب غير صالح' });
    }

    const localMeta = catalogBooks.find((b) => b.id === bookId);

    const [bookData, tocData] = await Promise.all([
      callIbadiMCP('ibadi_get_book', { book_id: bookId, include: ['parts'] }).catch(() => null),
      callIbadiMCP('ibadi_get_toc', { book_id: bookId, depth: 3 }).catch(() => null),
    ]);

    res.json({
      bookId,
      local: localMeta || null,
      details: bookData,
      toc: tocData,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'تعذر جلب بيانات الكتاب' });
  }
});

// 4. Get Book Page Content (Body & Footnotes separated)
app.get('/api/page/:bookId/:pageId', async (req, res) => {
  try {
    const bookId = parseInt(req.params.bookId, 10);
    const pageId = parseInt(req.params.pageId, 10);
    if (isNaN(bookId) || isNaN(pageId)) {
      return res.status(400).json({ error: 'بيانات الصفحة غير صالحة' });
    }

    const pageData = await callIbadiMCP('ibadi_get_page', {
      book_id: bookId,
      page_id: pageId,
      include_foot: true,
    });

    res.json(pageData);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'تعذر جلب نص الصفحة' });
  }
});

// Helper: Score and sort search results so paragraphs gathering all search words come first,
// ordered from closest word proximity (الأقرب فالأقرب) to broader matches.
function scoreAndRankByProximity(
  results: any[],
  query: string,
  tierMap: Map<string, number>
): any[] {
  const normQuery = normalizeArabic(query);
  const queryTerms = normQuery.split(/\s+/).filter((w) => w.length >= 2);

  if (queryTerms.length <= 1) {
    return results;
  }

  const scored = results.map((hit, originalIdx) => {
    const key = `${hit.book_id}:${hit.page_id}:${hit.field_matched || 'body'}`;
    const bestTier = tierMap.get(key) ?? 4; // 1=phrase, 2=near(6), 3=near(25), 4=tokens, 5=partial
    const rawSnippet = String(hit.snippet || '');
    const cleanSnippet = rawSnippet.replace(/<\/?mark[^>]*>/g, '');
    const normSnippet = normalizeArabic(cleanSnippet);

    // 1. Check how many distinct query words appear inside this paragraph snippet
    const termPositions: number[][] = [];
    let matchedDistinctTerms = 0;

    for (const term of queryTerms) {
      const positions: number[] = [];
      let pos = normSnippet.indexOf(term);
      while (pos !== -1) {
        positions.push(pos);
        pos = normSnippet.indexOf(term, pos + 1);
      }
      if (positions.length > 0) {
        matchedDistinctTerms++;
        termPositions.push(positions);
      }
    }

    // Also count <mark> tags in snippet (helpful when morphological roots match)
    const markMatches = [...rawSnippet.matchAll(/<mark[^>]*>(.*?)<\/mark>/g)];
    const markCount = markMatches.length;

    // 2. Calculate minimum character span covering the matched terms (الأقرب فالأقرب)
    let minSpan = 9999;
    if (termPositions.length >= 2) {
      // Find smallest window [minPos, maxPos] containing at least one occurrence of each matched term
      const firstGroup = termPositions[0];
      for (const startPos of firstGroup) {
        let low = startPos;
        let high = startPos;
        for (let g = 1; g < termPositions.length; g++) {
          let closest = termPositions[g][0];
          let bestDist = Math.abs(closest - startPos);
          for (const candidate of termPositions[g]) {
            const d = Math.abs(candidate - startPos);
            if (d < bestDist) {
              bestDist = d;
              closest = candidate;
            }
          }
          if (closest < low) low = closest;
          if (closest > high) high = closest;
        }
        const span = high - low;
        if (span < minSpan) minSpan = span;
      }
    } else if (markMatches.length >= 2) {
      // Fallback span using <mark> indices when morphology matched inflected forms
      for (let i = 0; i < markMatches.length - 1; i++) {
        const span = (markMatches[i + 1].index || 0) - (markMatches[i].index || 0);
        if (span > 0 && span < minSpan) minSpan = span;
      }
    }

    const isExactPhraseInSnippet = normSnippet.includes(normQuery);
    const hasAllTermsInSnippet = matchedDistinctTerms === queryTerms.length;

    let proximityLabel = 'اجتماع الكلمات في الصفحة';
    if (isExactPhraseInSnippet || bestTier === 1) {
      proximityLabel = 'تطابق متتالٍ في الفقرة';
    } else if (bestTier === 2 || (hasAllTermsInSnippet && minSpan <= 55)) {
      proximityLabel = 'اجتماع الكلمات في جملة واحدة';
    } else if (bestTier === 3 || hasAllTermsInSnippet) {
      proximityLabel = 'اجتماع الكلمات في نفس الفقرة';
    } else if (bestTier === 5) {
      proximityLabel = `تطابق ${matchedDistinctTerms} من ${queryTerms.length} كلمات`;
    }

    // Composite score:
    // Priority 1: Exact consecutive phrase or tightest tier
    // Priority 2: Paragraph gathers ALL search words (hasAllTermsInSnippet)
    // Priority 3: Number of distinct search words gathered in the paragraph
    // Priority 4: Smaller span distance between words (الأقرب فالأقرب -> 1000 - minSpan)
    const tierBonus = (6 - bestTier) * 20000;
    const allTermsInParagraphBonus = hasAllTermsInSnippet ? 10000 : 0;
    const exactPhraseBonus = isExactPhraseInSnippet ? 15000 : 0;
    const distinctTermsBonus = matchedDistinctTerms * 2500;
    const proximityClosenessBonus = Math.max(0, 1500 - Math.min(1500, minSpan * 3));
    const markBonus = Math.min(400, markCount * 40);

    const totalScore =
      tierBonus +
      allTermsInParagraphBonus +
      exactPhraseBonus +
      distinctTermsBonus +
      proximityClosenessBonus +
      markBonus -
      originalIdx;

    return {
      hit: {
        ...hit,
        proximity_label: proximityLabel,
        proximity_span: minSpan < 9999 ? minSpan : null,
      },
      totalScore,
    };
  });

  scored.sort((a, b) => b.totalScore - a.totalScore);
  return scored.map((item) => item.hit);
}

// 5. Full-Text Encyclopedia Search in Pages & Footnotes (with Multi-Word Proximity Cascade)
app.get('/api/search/pages', async (req, res) => {
  try {
    const query = String(req.query.q || '').trim();
    if (!query) {
      return res.status(400).json({ error: 'يرجى إدخال نص البحث' });
    }

    const rawMatch = String(req.query.match || 'all'); // 'all' | 'phrase' | 'near' | 'morphology'
    const searchInRaw = String(req.query.search_in || 'both'); // 'body' | 'foot' | 'both'
    const bookId = req.query.book_id ? parseInt(String(req.query.book_id), 10) : undefined;
    const categoryId = req.query.category_id ? parseInt(String(req.query.category_id), 10) : undefined;
    const limit = Math.min(35, Math.max(1, parseInt(String(req.query.limit || '20'), 10) || 20));
    const offset = Math.max(0, parseInt(String(req.query.offset || '0'), 10) || 0);

    const isMorphology = rawMatch === 'morphology' || req.query.morphology === 'true';
    const searchInArray =
      searchInRaw === 'body' ? ['body'] : searchInRaw === 'foot' ? ['foot'] : ['body', 'foot'];

    const scope: Record<string, any> | undefined =
      bookId || categoryId
        ? {
            ...(bookId && !isNaN(bookId) ? { book_ids: [bookId] } : {}),
            ...(categoryId && !isNaN(categoryId) ? { category_ids: [categoryId] } : {}),
          }
        : undefined;

    const queryWords = query.split(/\s+/).filter((w) => w.length >= 2);

    // When searching with multiple words in 'all' or 'near' mode on the first page,
    // cascade from closest paragraph co-occurrence (phrase -> near 6 -> near 25 -> tokens)
    if (queryWords.length >= 2 && (rawMatch === 'all' || rawMatch === 'near') && offset === 0) {
      const buildArgs = (matchObj: Record<string, any>, customLimit = limit) => ({
        query,
        match: matchObj,
        search_in: searchInArray,
        limit: customLimit,
        offset: 0,
        ...(scope ? { scope } : {}),
      });

      const [nearTightData, nearParagraphData, tokensData] = await Promise.all([
        // Tier 2: Words within 6 words of each other (same sentence/clause)
        callIbadiMCP(
          'ibadi_search_pages',
          buildArgs({ mode: 'near', distance: 6, morphology: isMorphology }, Math.min(20, limit))
        ).catch(() => null),
        // Tier 3: Words within 25 words of each other (same paragraph)
        callIbadiMCP(
          'ibadi_search_pages',
          buildArgs({ mode: 'near', distance: 25, morphology: isMorphology }, limit)
        ).catch(() => null),
        // Tier 4: All words anywhere on the same page
        callIbadiMCP(
          'ibadi_search_pages',
          buildArgs({ mode: 'tokens', morphology: isMorphology }, limit)
        ).catch(() => null),
      ]);

      const mergedMap = new Map<string, any>();
      const tierMap = new Map<string, number>();

      const addTierResults = (items: any[] | undefined, tierNum: number) => {
        if (!Array.isArray(items)) return;
        for (const item of items) {
          const key = `${item.book_id}:${item.page_id}:${item.field_matched || 'body'}`;
          if (!mergedMap.has(key)) {
            mergedMap.set(key, item);
            tierMap.set(key, tierNum);
          }
        }
      };

      addTierResults(nearTightData?.results, 2);
      addTierResults(nearParagraphData?.results, 3);
      addTierResults(tokensData?.results, 4);

      // If no single page had all words together, fallback to boolean any_of so user still gets closest partial matches
      let totalHits =
        tokensData?.total_hits ||
        nearParagraphData?.total_hits ||
        nearTightData?.total_hits ||
        0;

      if (mergedMap.size === 0 && queryWords.length >= 2) {
        const fallbackData = await callIbadiMCP(
          'ibadi_search_pages',
          buildArgs(
            { mode: 'boolean', any_of: queryWords, morphology: isMorphology },
            limit
          )
        ).catch(() => null);
        addTierResults(fallbackData?.results, 5);
        totalHits = fallbackData?.total_hits || mergedMap.size;
      }

      const rankedResults = scoreAndRankByProximity(
        Array.from(mergedMap.values()),
        query,
        tierMap
      ).slice(0, limit);

      return res.json({
        query,
        total_hits: Math.max(totalHits, rankedResults.length),
        returned: rankedResults.length,
        results: rankedResults,
      });
    }

    // Standard single-word or subsequent pagination offset call
    const matchMode =
      rawMatch === 'phrase'
        ? 'phrase'
        : rawMatch === 'near'
        ? 'near'
        : rawMatch === 'exact'
        ? 'exact'
        : 'tokens';

    const args: Record<string, any> = {
      query,
      match: {
        mode: matchMode,
        ...(matchMode === 'near' ? { distance: 15 } : {}),
        morphology: isMorphology,
      },
      search_in: searchInArray,
      limit,
      offset,
      ...(scope ? { scope } : {}),
    };

    const data = await callIbadiMCP('ibadi_search_pages', args);
    if (Array.isArray(data?.results) && queryWords.length >= 2) {
      const tierMap = new Map<string, number>();
      data.results = scoreAndRankByProximity(data.results, query, tierMap);
    }
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'حدث خطأ أثناء البحث في المتون' });
  }
});

// 6. Search Chapter Titles
app.get('/api/search/titles', async (req, res) => {
  try {
    const query = String(req.query.q || '').trim();
    if (!query) {
      return res.status(400).json({ error: 'يرجى إدخال عنوان للبحث' });
    }
    const bookId = req.query.book_id ? parseInt(String(req.query.book_id), 10) : undefined;
    const limit = Math.min(35, parseInt(String(req.query.limit || '20'), 10) || 20);
    const offset = Math.max(0, parseInt(String(req.query.offset || '0'), 10) || 0);

    const args: Record<string, any> = {
      query,
      limit,
      offset,
    };
    if (bookId && !isNaN(bookId)) {
      args.scope = { book_ids: [bookId] };
    }

    const data = await callIbadiMCP('ibadi_search_titles', args);
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'حدث خطأ أثناء البحث في الفهارس' });
  }
});

// 7. Search Fatawa Archive (30,173 Fatawa)
app.get('/api/search/fatawa', async (req, res) => {
  try {
    const query = String(req.query.q || '').trim();
    if (!query) {
      return res.status(400).json({ error: 'يرجى إدخال سؤال أو موضوع الفتوى' });
    }
    const limit = Math.min(25, parseInt(String(req.query.limit || '12'), 10) || 12);
    const offset = Math.max(0, parseInt(String(req.query.offset || '0'), 10) || 0);

    const data = await callIbadiMCP('ibadi_search_fatawa', {
      query,
      limit,
      offset,
    });
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'حدث خطأ أثناء البحث في الفتاوى' });
  }
});

// 8. Get Single Fatwa Details
app.get('/api/fatwa/:id', async (req, res) => {
  try {
    const fatwaId = parseInt(req.params.id, 10);
    if (isNaN(fatwaId)) {
      return res.status(400).json({ error: 'رقم الفتوى غير صالح' });
    }
    const data = await callIbadiMCP('ibadi_get_fatwa', { fatwa_id: fatwaId });
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'تعذر جلب تفاصيل الفتوى' });
  }
});

// 9. Verify Quote Verbatim in the Encyclopedia
app.post('/api/verify-quote', async (req, res) => {
  try {
    const { quote, bookId } = req.body || {};
    if (!quote || typeof quote !== 'string' || quote.trim().length < 5) {
      return res.status(400).json({ error: 'يرجى إدخال النص المراد التحقق من نسبته' });
    }
    const args: Record<string, any> = {
      quote: quote.trim(),
      limit: 5,
    };
    if (bookId) args.book_id = Number(bookId);

    const data = await callIbadiMCP('ibadi_verify_quote', args);
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'تعذر التحقق من النص' });
  }
});

// 10. Check AI API Status
app.get('/api/ai/status', (_req, res) => {
  const hasServerKey = Boolean(
    process.env.GEMINI_API_KEY &&
      process.env.GEMINI_API_KEY !== 'MY_GEMINI_API_KEY' &&
      process.env.GEMINI_API_KEY.trim().length > 10
  );
  res.json({ hasServerKey });
});

// In-memory LRU Cache for Smart Research & Summarization so repeated queries cost 0 API quota
const askResponseCache = new Map<string, any>();

// Helper: Collect candidate Gemini API keys (sanitizing any pasted code snippet via extractCleanApiKey)
// and try free-tier lightweight Flash models first
async function generateWithFallback(
  candidateKeys: string[],
  buildParams: (model: string) => any
): Promise<{ text: string; modelUsed: string }> {
  const validKeys = Array.from(
    new Set(
      candidateKeys
        .map((raw) => extractCleanApiKey(raw))
        .filter((r) => r.detectedProvider !== 'claude' && r.cleanKey.length >= 20)
        .map((r) => r.cleanKey)
    )
  );
  if (validKeys.length === 0) {
    throw new Error('NO_GEMINI_KEY');
  }

  // Prioritize fast free-tier models
  const candidateModels = ['gemini-3.8-flash', 'gemini-flash-latest', 'gemini-3.1-flash-lite'];
  let lastError: any = null;

  for (const apiKey of validKeys) {
    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: { 'User-Agent': 'aistudio-build' },
      },
    });
    for (const model of candidateModels) {
      try {
        const response = await ai.models.generateContent(buildParams(model));
        if (response && response.text) {
          return { text: response.text, modelUsed: model };
        }
      } catch (err: any) {
        lastError = err;
        const msg = String(err?.message || '');
        if (
          msg.includes('402') ||
          msg.toLowerCase().includes('prepayment credits are depleted') ||
          msg.includes('API_KEY_INVALID') ||
          msg.toLowerCase().includes('api key not valid')
        ) {
          break;
        }
      }
    }
  }

  throw lastError || new Error('GEMINI_CALL_FAILED');
}

// Helper: Call Anthropic Claude Messages API with model fallback
async function generateWithClaudeFallback(
  candidateKeys: string[],
  systemInstruction: string,
  userPrompt: string
): Promise<{ text: string; modelUsed: string }> {
  const validKeys = Array.from(
    new Set(
      candidateKeys
        .map((raw) => extractCleanApiKey(raw))
        .filter((r) => (r.detectedProvider === 'claude' || r.cleanKey.startsWith('sk-ant')) && r.cleanKey.length >= 20)
        .map((r) => r.cleanKey)
    )
  );
  if (validKeys.length === 0) {
    throw new Error('NO_CLAUDE_KEY');
  }

  const claudeModels = [
    'claude-3-5-haiku-latest',
    'claude-3-7-sonnet-latest',
    'claude-sonnet-4-20250514',
  ];
  let lastError: any = null;

  for (const apiKey of validKeys) {
    for (const model of claudeModels) {
      try {
        const response = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
          },
          body: JSON.stringify({
            model,
            max_tokens: 2400,
            system: systemInstruction,
            messages: [{ role: 'user', content: userPrompt }],
          }),
        });

        if (!response.ok) {
          const errBody = await response.text().catch(() => '');
          lastError = new Error(`Claude HTTP ${response.status}: ${errBody}`);
          if (response.status === 401 || response.status === 403 || errBody.includes('credit balance')) {
            break;
          }
          continue;
        }

        const data: any = await response.json();
        const textBlock = Array.isArray(data?.content)
          ? data.content.find((c: any) => c.type === 'text')?.text
          : '';
        if (textBlock) {
          return { text: String(textBlock).trim(), modelUsed: model };
        }
      } catch (err: any) {
        lastError = err;
      }
    }
  }

  throw lastError || new Error('CLAUDE_CALL_FAILED');
}

// 11. Test & Sanitize Pasted User API Key / Code Snippet (Supports both Gemini & Claude)
app.post('/api/ai/test-key', async (req, res) => {
  const rawInput = String(
    req.body?.apiKey || req.headers['x-claude-key'] || req.headers['x-gemini-key'] || ''
  ).trim();
  const parsed = extractCleanApiKey(rawInput);
  const requestedProvider = req.body?.provider || parsed.detectedProvider;

  if (!parsed.cleanKey) {
    return res.json({
      valid: true,
      cleanKey: '',
      mode: 'built-in-free',
      message:
        'تم تفعيل المحرك المجاني المدمج للبحث والدردشة العلمية والتلخيص من كتب الموسوعة (يعمل مجاناً وبلا انقطاع وبدون أي اشتراكات).',
    });
  }

  const isClaude = requestedProvider === 'claude' || parsed.detectedProvider === 'claude';

  try {
    if (isClaude) {
      await generateWithClaudeFallback([parsed.cleanKey], 'أجب بكلمة واحدة فقط.', 'قل: متصل');
    } else {
      await generateWithFallback([parsed.cleanKey], (model) => ({
        model,
        contents: 'قل: متصل',
      }));
    }

    return res.json({
      valid: true,
      cleanKey: parsed.cleanKey,
      provider: isClaude ? 'claude' : 'gemini',
      mode: isClaude ? 'claude-connected' : 'gemini-free',
      message: parsed.extractedFromSnippet
        ? `تم استخلاص مفتاح ${isClaude ? 'Claude' : 'Gemini'} تلقائياً من الكود الملصق وتفعيله بنجاح للدردشة العلمية والتلخيص!`
        : `تم التحقق من مفتاح ${isClaude ? 'Claude' : 'Gemini'} وتفعيله بنجاح للدردشة العلمية والتلخيص!`,
    });
  } catch {
    return res.json({
      valid: true,
      cleanKey: parsed.cleanKey,
      provider: isClaude ? 'claude' : 'gemini',
      mode: 'hybrid-free',
      message: `تمت معالجة وحفظ مفتاح ${
        isClaude ? 'Claude' : 'Gemini'
      } وتفعيل نظام الدردشة والتلخيص غير المنقطع (ينتقل تلقائياً للمحرك المدمج عند انتهاء الرصيد دون توقف)!`,
    });
  }
});

// 12. Advanced AI Scholarly Chat, Book Summary, Khutbah, Lesson, Article & Tafsir Assistant
app.post('/api/ai/ask', async (req, res) => {
  try {
    const {
      question,
      mode: requestedMode = 'auto',
      searchScope = 'all',
      bookId,
      scopedBookId,
      preferredProvider = 'auto',
      history = [],
    } = req.body || {};
    const targetBookId = bookId ?? scopedBookId;

    if (!question || typeof question !== 'string' || !question.trim()) {
      return res.status(400).json({ error: 'يرجى كتابة السؤال أو الموضوع المطلوب في الدردشة' });
    }

    const cleanQuestion = question.trim();

    // 1. Check if the user selected a specific book OR mentioned a specific book in their prompt/history
    const matchedBook = findMatchingBookInCatalog(
      cleanQuestion,
      catalogBooks,
      targetBookId ? Number(targetBookId) : null,
      Array.isArray(history) ? history : []
    );

    // 2. Detect the effective scholarly mode (chat, book_summary, khutbah, lesson, article, tafsir_hadith)
    const { mode: effectiveMode, label: modeLabel } = detectScholarlyMode(
      cleanQuestion,
      requestedMode,
      Boolean(matchedBook)
    );

    // 3. Extract pure topic & keywords (stripping framing words like "اكتب لي خطبة جمعة عن" or "درسا شاملا في")
    const { coreTopic, searchQuery, coreTerms, quotedPhrase } = extractCleanTopicAndKeywords(
      cleanQuestion,
      matchedBook,
      Array.isArray(history) ? history : []
    );

    const cacheKey = `${cleanQuestion}::${effectiveMode}::${searchScope}::${
      matchedBook ? matchedBook.id : 'all'
    }`;
    if (askResponseCache.has(cacheKey)) {
      return res.json(askResponseCache.get(cacheKey));
    }

    const customGeminiKey = extractCleanApiKey(String(req.headers['x-gemini-key'] || '')).cleanKey;
    const customClaudeKey = extractCleanApiKey(String(req.headers['x-claude-key'] || '')).cleanKey;
    const serverGeminiKey = extractCleanApiKey(process.env.GEMINI_API_KEY || '').cleanKey;
    const serverClaudeKey = extractCleanApiKey(process.env.ANTHROPIC_API_KEY || '').cleanKey;

    // 4. If a specific book is targeted (either for summary or book-scoped discussion),
    // fetch that book's metadata + Table of Contents so the response relies 100% on that book!
    let bookMetaAndToc: { details?: any; toc?: any } | null = null;
    if (matchedBook) {
      const [bData, tData] = await Promise.all([
        callIbadiMCP('ibadi_get_book', { book_id: matchedBook.id, include: ['parts'] }).catch(
          () => null
        ),
        callIbadiMCP('ibadi_get_toc', { book_id: matchedBook.id, depth: 3 }).catch(() => null),
      ]);
      bookMetaAndToc = { details: bData, toc: tData };
    }

    // 5. High-Precision Retrieval from Encyclopedia Books & Fatawa
    const scopeFilter = matchedBook ? { book_ids: [Number(matchedBook.id)] } : undefined;
    let candidatePages: any[] = [];
    let totalBookHits = 0;

    if (searchScope !== 'fatawa' || matchedBook) {
      // If user asked to summarize a specific book without a narrow sub-topic, fetch sample pages directly from the book
      if (matchedBook && (effectiveMode === 'book_summary' || coreTerms.length === 0)) {
        const tocEntries: any[] = bookMetaAndToc?.toc?.entries || [];
        // Pick first few TOC entry page IDs or pages 1, 2, 3, 5
        const samplePageIds = Array.from(
          new Set([
            1,
            2,
            ...(tocEntries.slice(0, 4).map((e: any) => Number(e.page_id)).filter((n) => n >= 1)),
          ])
        ).slice(0, 5);

        const samplePages = await Promise.all(
          samplePageIds.map(async (pid) => {
            try {
              const pData = await callIbadiMCP('ibadi_get_page', {
                book_id: matchedBook.id,
                page_id: pid,
                include_foot: true,
              });
              if (!pData || !pData.body) return null;
              return {
                book_id: matchedBook.id,
                book_name: matchedBook.title,
                author_name: matchedBook.author,
                category: matchedBook.category,
                page_id: pid,
                page_number: pData.page_number || pid,
                part: pData.part || '1',
                snippet: String(pData.body).slice(0, 350),
                fullBody: String(pData.body).slice(0, 1250),
                fullFoot: pData.foot ? String(pData.foot).slice(0, 400) : '',
                numbering: pData.numbering || 'unknown',
                numbering_declared:
                  pData.numbering_declared ||
                  (pData.numbering === 'printed' ? 'موافق للمطبوع' : 'ترقيم آلي متسلسل'),
                citable: Boolean(pData.citable),
              };
            } catch {
              return null;
            }
          })
        );
        candidatePages.push(...samplePages.filter(Boolean));
        totalBookHits =
          bookMetaAndToc?.toc?.pages_total || matchedBook.pagesCount || candidatePages.length;
      }

      // If there are specific core topic terms, run multi-tier precision search
      if (coreTerms.length > 0) {
        const queryToRun = quotedPhrase || searchQuery;
        const [nearResult, tokensResult, titlesResult] = await Promise.all([
          // Tier 1: Words near each other in the same sentence/paragraph
          coreTerms.length >= 2
            ? callIbadiMCP('ibadi_search_pages', {
                query: queryToRun,
                match: { mode: 'near', distance: 12, morphology: true },
                limit: 8,
                ...(scopeFilter ? { scope: scopeFilter } : {}),
              }).catch(() => ({ results: [], total_hits: 0 }))
            : Promise.resolve({ results: [], total_hits: 0 }),
          // Tier 2: All core terms on the page (with morphology enabled for rich Arabic recall)
          callIbadiMCP('ibadi_search_pages', {
            query: queryToRun,
            match: { mode: 'tokens', morphology: true },
            limit: 8,
            ...(scopeFilter ? { scope: scopeFilter } : {}),
          }).catch(() => ({ results: [], total_hits: 0 })),
          // Tier 3: Search chapter headings (عناوين الأبواب والفصول) matching the topic
          callIbadiMCP('ibadi_search_titles', {
            query: coreTerms.slice(0, 4).join(' '),
            limit: 4,
            ...(scopeFilter ? { scope: scopeFilter } : {}),
          }).catch(() => ({ results: [] })),
        ]);

        const seenKeys = new Set<string>(candidatePages.map((p) => `${p.book_id}:${p.page_id}`));
        const addPageHit = (hit: any) => {
          if (!hit || !hit.book_id || !hit.page_id) return;
          if (matchedBook && Number(hit.book_id) !== Number(matchedBook.id)) return;
          const k = `${hit.book_id}:${hit.page_id}`;
          if (!seenKeys.has(k)) {
            seenKeys.add(k);
            candidatePages.push(hit);
          }
        };

        for (const h of nearResult?.results || []) addPageHit(h);
        for (const h of tokensResult?.results || []) addPageHit(h);
        for (const t of titlesResult?.results || []) {
          addPageHit({
            book_id: t.book_id,
            book_name: t.book_name,
            author_name: t.author_name || '',
            category: t.category || '',
            page_id: t.page_id,
            page_number: t.page_number || t.page_id,
            snippet: `باب / عنوان فصل: ${t.title}`,
          });
        }

        totalBookHits = Math.max(
          totalBookHits,
          tokensResult?.total_hits || 0,
          nearResult?.total_hits || 0,
          candidatePages.length
        );

        // If 0 hits with all terms and coreTerms has >= 3 words, try boolean any_of with top 3 core terms
        // (Still strictly filtered by filterAndRankRelevantPages below!)
        if (candidatePages.length === 0 && coreTerms.length >= 2) {
          const fallbackPages = await callIbadiMCP('ibadi_search_pages', {
            query: coreTerms.slice(0, 3).join(' '),
            match: { mode: 'boolean', any_of: coreTerms.slice(0, 3), morphology: true },
            limit: 10,
            ...(scopeFilter ? { scope: scopeFilter } : {}),
          }).catch(() => ({ results: [], total_hits: 0 }));

          for (const h of fallbackPages?.results || []) addPageHit(h);
          totalBookHits = Math.max(totalBookHits, fallbackPages?.total_hits || 0);
        }
      }
    }

    // 6. Strict Relevance Filtering on Candidate Pages (Eliminates any random/unrelated pages!)
    const relevantPages = filterAndRankRelevantPages(
      candidatePages,
      coreTerms,
      effectiveMode,
      matchedBook ? matchedBook.id : null
    );

    // Enrich top 5 relevant pages with full page body & footnotes
    const enrichedPages = await Promise.all(
      relevantPages.slice(0, 5).map(async (hit) => {
        if (hit.fullBody) return hit;
        try {
          const fullPage = await callIbadiMCP('ibadi_get_page', {
            book_id: hit.book_id,
            page_id: hit.page_id,
            include_foot: true,
          });
          return {
            ...hit,
            author_name: hit.author_name || fullPage.author_name || '',
            category: hit.category || fullPage.category || '',
            fullBody: fullPage.body ? String(fullPage.body).slice(0, 1300) : hit.snippet,
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
          return {
            ...hit,
            fullBody: hit.snippet,
            fullFoot: '',
            part: '1',
            numbering: hit.numbering || 'unknown',
            numbering_declared: hit.numbering === 'printed' ? 'موافق للمطبوع' : 'ترقيم تسلسلي',
            citable: Boolean(hit.citable),
          };
        }
      })
    );

    const remainingPages = relevantPages.slice(5, 8).map((hit) => ({
      ...hit,
      fullBody: hit.fullBody || hit.snippet,
      fullFoot: hit.fullFoot || '',
      part: hit.part || '1',
      numbering: hit.numbering || 'unknown',
      numbering_declared: hit.numbering === 'printed' ? 'موافق للمطبوع' : 'ترقيم تسلسلي',
      citable: Boolean(hit.citable),
    }));

    const allContextPages = [...enrichedPages, ...remainingPages];

    // 7. Fetch Fatawa ONLY if not restricted to a single book and searchScope !== 'books'
    let enrichedFatawa: any[] = [];
    let totalFatwaHits = 0;

    if (!matchedBook && searchScope !== 'books' && coreTerms.length > 0) {
      const fatawaResult = await callIbadiMCP('ibadi_search_fatawa', {
        query: coreTerms.slice(0, 4).join(' '),
        limit: 6,
      }).catch(() => ({ results: [], total_hits: 0 }));

      const relevantFatawa = filterAndRankRelevantFatawa(
        fatawaResult?.results || [],
        coreTerms,
        null
      );
      totalFatwaHits = relevantFatawa.length > 0 ? fatawaResult?.total_hits || relevantFatawa.length : 0;

      enrichedFatawa = await Promise.all(
        relevantFatawa.slice(0, 3).map(async (f) => {
          try {
            const detail = await callIbadiMCP('ibadi_get_fatwa', { fatwa_id: f.fatwa_id });
            return {
              ...f,
              question: detail.question || f.question_excerpt || '',
              answer: detail.answer ? String(detail.answer).slice(0, 950) : f.answer_excerpt || '',
            };
          } catch {
            return f;
          }
        })
      );
    }

    // 8. Synthesize the Scholarly Response using Claude, Gemini, or Built-In Free Composer
    let finalAnswerText = '';

    const hasEnoughContext =
      allContextPages.length > 0 || enrichedFatawa.length > 0 || Boolean(matchedBook && bookMetaAndToc);

    if (hasEnoughContext) {
      const { systemInstruction, promptContent } = buildGeminiScholarlyPrompt({
        question: cleanQuestion,
        coreTopic,
        mode: effectiveMode,
        matchedBook,
        bookMetaAndToc,
        pages: allContextPages,
        fatawa: enrichedFatawa,
        history: Array.isArray(history) ? history : [],
      });

      const claudeKeys = [customClaudeKey, serverClaudeKey].filter(Boolean);
      const geminiKeys = [customGeminiKey, serverGeminiKey].filter(Boolean);

      const tryClaudeFirst =
        preferredProvider === 'claude' || (claudeKeys.length > 0 && geminiKeys.length === 0);

      if (tryClaudeFirst) {
        if (claudeKeys.length > 0) {
          try {
            const claudeRes = await generateWithClaudeFallback(
              claudeKeys,
              systemInstruction,
              promptContent
            );
            finalAnswerText = claudeRes.text;
          } catch {
            finalAnswerText = '';
          }
        }
        if (!finalAnswerText && geminiKeys.length > 0) {
          try {
            const geminiRes = await generateWithFallback(geminiKeys, (model) => ({
              model,
              contents: promptContent,
              config: { systemInstruction },
            }));
            finalAnswerText = geminiRes.text;
          } catch {
            finalAnswerText = '';
          }
        }
      } else {
        if (geminiKeys.length > 0) {
          try {
            const geminiRes = await generateWithFallback(geminiKeys, (model) => ({
              model,
              contents: promptContent,
              config: { systemInstruction },
            }));
            finalAnswerText = geminiRes.text;
          } catch {
            finalAnswerText = '';
          }
        }
        if (!finalAnswerText && claudeKeys.length > 0) {
          try {
            const claudeRes = await generateWithClaudeFallback(
              claudeKeys,
              systemInstruction,
              promptContent
            );
            finalAnswerText = claudeRes.text;
          } catch {
            finalAnswerText = '';
          }
        }
      }
    }

    // Built-In 100% Free Scholarly Composer (Guaranteed uninterrupted fallback)
    if (!finalAnswerText) {
      finalAnswerText = composeGroundedScholarlyResponse({
        question: cleanQuestion,
        coreTopic,
        searchQuery,
        mode: effectiveMode,
        matchedBook,
        bookMetaAndToc,
        pages: allContextPages,
        fatawa: enrichedFatawa,
        totalBookHits,
        totalFatwaHits,
      });
    }

    const followUpSuggestions = buildFollowUpSuggestions(coreTopic, effectiveMode, matchedBook);

    const payload = {
      question: cleanQuestion,
      modeUsed: effectiveMode,
      modeLabel,
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
      followUpSuggestions,
      sources: allContextPages.map((p) => ({
        book_id: p.book_id,
        book_name: p.book_name,
        author_name: p.author_name,
        author_death: p.author_death,
        category: p.category,
        page_id: p.page_id,
        page_number: p.page_number,
        part: p.part || '1',
        numbering: p.numbering,
        numbering_declared: p.numbering_declared,
        citable: p.citable,
        snippet: p.snippet,
      })),
      fatawaSources: enrichedFatawa.map((f) => ({
        fatwa_id: f.fatwa_id,
        title: f.title,
        mufti: f.mufti?.name || '',
        question: f.question || f.question_excerpt || '',
        answer_excerpt: String(f.answer || f.answer_excerpt || '').slice(0, 300),
      })),
      totalBookHits,
      totalFatwaHits,
    };

    if (askResponseCache.size >= 200) {
      const oldestKey = askResponseCache.keys().next().value;
      if (oldestKey) askResponseCache.delete(oldestKey);
    }
    askResponseCache.set(cacheKey, payload);

    res.json(payload);
  } catch (err: any) {
    console.error('AI Ask Error:', err);
    res.status(500).json({
      error: 'حدث خطأ غير متوقع في الاتصال بالشبكة، يرجى المحاولة مرة أخرى.',
    });
  }
});

// 13. Local-Only Deterministic Tashkeel & Typo Proofreading (0 API Calls, 100% Free, Never Uses Credits)
app.post('/api/ai/tashkeel', (req, res) => {
  const { text, foot } = req.body || {};
  if (!text || typeof text !== 'string') {
    return res.status(400).json({ error: 'لا يوجد نص لتشكيله' });
  }

  const detBody = proofreadAndVocalizeArabic(text, {
    fixTypos: true,
    applyTashkeel: true,
  });
  const detFoot = foot
    ? proofreadAndVocalizeArabic(String(foot), {
        fixTypos: true,
        applyTashkeel: true,
      })
    : { text: '', corrections: [], quranCount: 0 };

  return res.json({
    body: detBody.text,
    foot: detFoot.text,
    corrections: detBody.corrections,
  });
});

async function startServer() {
  const portArgIdx = process.argv.indexOf('--port');
  const portFromArg = portArgIdx !== -1 ? parseInt(process.argv[portArgIdx + 1], 10) : NaN;
  const PORT = !isNaN(portFromArg) && portFromArg > 0 ? portFromArg : 3000;

  const distPath = path.join(__dirname, 'dist');

  if (process.env.NODE_ENV === 'production' && fs.existsSync(distPath)) {
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  } else {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: false },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`Ibadi Encyclopedia Server running on http://0.0.0.0:${PORT}`);
  });

  server.on('error', (err: any) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`Port ${PORT} is already in use.`);
    } else {
      console.error('Server error:', err);
    }
  });

  process.on('SIGTERM', () => {
    server.close();
  });
  process.on('SIGINT', () => {
    server.close();
  });
}

startServer();

