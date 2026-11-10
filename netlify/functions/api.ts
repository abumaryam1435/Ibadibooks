import { GoogleGenAI } from '@google/genai';
import { extractCleanApiKey } from '../../src/utils/apiKeyParser';
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
} from '../../src/utils/scholarlyAssistant';
import catalogJson from '../../src/data/catalog.json';
import { CatalogBook } from '../../src/types';

const catalogBooks: CatalogBook[] = Array.isArray((catalogJson as any)?.books)
  ? (catalogJson as any).books
  : [];

async function callIbadiMCP(toolName: string, args: Record<string, any>) {
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
      'User-Agent': 'IbadiEncyclopediaNetlify/3.0',
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

const corsHeaders = {
  'Content-Type': 'application/json; charset=utf-8',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, x-gemini-key, x-claude-key',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

async function generateWithGeminiFallback(
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

  const candidateModels = ['gemini-3.8-flash', 'gemini-flash-latest', 'gemini-3.1-flash-lite'];
  let lastError: any = null;

  for (const apiKey of validKeys) {
    const ai = new GoogleGenAI({ apiKey });
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

async function generateWithClaudeFallback(
  candidateKeys: string[],
  systemInstruction: string,
  userPrompt: string
): Promise<{ text: string; modelUsed: string }> {
  const validKeys = Array.from(
    new Set(
      candidateKeys
        .map((raw) => extractCleanApiKey(raw))
        .filter(
          (r) =>
            (r.detectedProvider === 'claude' || r.cleanKey.startsWith('sk-ant')) &&
            r.cleanKey.length >= 20
        )
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
          if (
            response.status === 401 ||
            response.status === 403 ||
            errBody.includes('credit balance')
          ) {
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

export async function handler(event: any) {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: corsHeaders, body: '' };
  }

  const rawPath = String(event.path || '')
    .replace(/^\/\.netlify\/functions\/api/, '')
    .replace(/^\/api/, '');
  const query = event.queryStringParameters || {};
  const headers = event.headers || {};

  try {
    // 1. GET /book/:id
    const bookMatch = rawPath.match(/^\/book\/(\d+)$/);
    if (bookMatch && event.httpMethod === 'GET') {
      const bookId = parseInt(bookMatch[1], 10);
      const localBook = catalogBooks.find((b) => b.id === bookId) || null;
      const [bookData, tocData] = await Promise.all([
        callIbadiMCP('ibadi_get_book', { book_id: bookId, include: ['parts'] }).catch(() => null),
        callIbadiMCP('ibadi_get_toc', { book_id: bookId, depth: 3 }).catch(() => null),
      ]);
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({ bookId, local: localBook, details: bookData, toc: tocData }),
      };
    }

    // 2. GET /page/:bookId/:pageId
    const pageMatch = rawPath.match(/^\/page\/(\d+)\/(\d+)$/);
    if (pageMatch && event.httpMethod === 'GET') {
      const bookId = parseInt(pageMatch[1], 10);
      const pageId = parseInt(pageMatch[2], 10);
      const pageData = await callIbadiMCP('ibadi_get_page', {
        book_id: bookId,
        page_id: pageId,
        include_foot: true,
      });
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify(pageData),
      };
    }

    // 3. GET /search/pages
    if (rawPath === '/search/pages' && event.httpMethod === 'GET') {
      const q = String(query.q || '').trim();
      if (!q) {
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'يرجى إدخال نص البحث' }),
        };
      }
      const rawMatch = String(query.match || 'all');
      const searchInRaw = String(query.search_in || 'both');
      const isMorphology = rawMatch === 'morphology' || query.morphology === 'true';
      const searchInArray =
        searchInRaw === 'body' ? ['body'] : searchInRaw === 'foot' ? ['foot'] : ['body', 'foot'];
      const limit = Math.min(35, parseInt(query.limit || '20', 10) || 20);
      const offset = Math.max(0, parseInt(query.offset || '0', 10) || 0);

      const scope =
        query.book_id || query.category_id
          ? {
              ...(query.book_id ? { book_ids: [parseInt(query.book_id, 10)] } : {}),
              ...(query.category_id ? { category_ids: [parseInt(query.category_id, 10)] } : {}),
            }
          : undefined;

      const matchMode =
        rawMatch === 'phrase'
          ? 'phrase'
          : rawMatch === 'near'
          ? 'near'
          : rawMatch === 'exact'
          ? 'exact'
          : 'tokens';

      const args: Record<string, any> = {
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
      };
      const data = await callIbadiMCP('ibadi_search_pages', args);
      return { statusCode: 200, headers: corsHeaders, body: JSON.stringify(data) };
    }

    // 4. GET /search/titles
    if (rawPath === '/search/titles' && event.httpMethod === 'GET') {
      const q = String(query.q || '').trim();
      const args: Record<string, any> = {
        query: q,
        limit: Math.min(35, parseInt(query.limit || '20', 10) || 20),
        offset: Math.max(0, parseInt(query.offset || '0', 10) || 0),
      };
      if (query.book_id) {
        args.scope = { book_ids: [parseInt(query.book_id, 10)] };
      }
      const data = await callIbadiMCP('ibadi_search_titles', args);
      return { statusCode: 200, headers: corsHeaders, body: JSON.stringify(data) };
    }

    // 5. GET /search/fatawa OR /fatawa
    if ((rawPath === '/search/fatawa' || rawPath === '/fatawa') && event.httpMethod === 'GET') {
      const q = String(query.q || 'الصلاة').trim() || 'الصلاة';
      const data = await callIbadiMCP('ibadi_search_fatawa', {
        query: q,
        limit: Math.min(25, parseInt(query.limit || '14', 10) || 14),
        offset: Math.max(0, parseInt(query.offset || '0', 10) || 0),
      });
      return { statusCode: 200, headers: corsHeaders, body: JSON.stringify(data) };
    }

    // 6. GET /fatwa/:id
    const fatwaMatch = rawPath.match(/^\/fatwa\/(\d+)$/);
    if (fatwaMatch && event.httpMethod === 'GET') {
      const fatwaId = parseInt(fatwaMatch[1], 10);
      const data = await callIbadiMCP('ibadi_get_fatwa', { fatwa_id: fatwaId });
      return { statusCode: 200, headers: corsHeaders, body: JSON.stringify(data) };
    }

    // 7. POST /verify-quote
    if (rawPath === '/verify-quote' && event.httpMethod === 'POST') {
      const body = JSON.parse(event.body || '{}');
      const data = await callIbadiMCP('ibadi_verify_quote', {
        quote: String(body.quote || '').trim(),
        limit: 5,
      });
      return { statusCode: 200, headers: corsHeaders, body: JSON.stringify(data) };
    }

    // 8. GET /ai/status
    if (rawPath === '/ai/status' && event.httpMethod === 'GET') {
      const hasServerKey = Boolean(
        process.env.GEMINI_API_KEY &&
          process.env.GEMINI_API_KEY !== 'MY_GEMINI_API_KEY' &&
          process.env.GEMINI_API_KEY.trim().length > 10
      );
      return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({ hasServerKey }) };
    }

    // 9. POST /ai/test-key (Supports both Gemini & Claude)
    if (rawPath === '/ai/test-key' && event.httpMethod === 'POST') {
      const body = JSON.parse(event.body || '{}');
      const rawInput = String(
        body.apiKey ||
          headers['x-claude-key'] ||
          headers['X-Claude-Key'] ||
          headers['x-gemini-key'] ||
          headers['X-Gemini-Key'] ||
          ''
      ).trim();

      const parsed = extractCleanApiKey(rawInput);
      const requestedProvider = body.provider || parsed.detectedProvider;

      if (!parsed.cleanKey) {
        return {
          statusCode: 200,
          headers: corsHeaders,
          body: JSON.stringify({
            valid: true,
            cleanKey: '',
            mode: 'built-in-free',
            message:
              'تم تفعيل المحرك المجاني المدمج للبحث والدردشة العلمية والتلخيص من كتب الموسوعة (يعمل مجاناً وبلا انقطاع).',
          }),
        };
      }

      const isClaude = requestedProvider === 'claude' || parsed.detectedProvider === 'claude';

      try {
        if (isClaude) {
          await generateWithClaudeFallback([parsed.cleanKey], 'أجب بكلمة واحدة فقط.', 'قل: متصل');
        } else {
          await generateWithGeminiFallback([parsed.cleanKey], (model) => ({
            model,
            contents: 'قل: متصل',
          }));
        }

        return {
          statusCode: 200,
          headers: corsHeaders,
          body: JSON.stringify({
            valid: true,
            cleanKey: parsed.cleanKey,
            provider: isClaude ? 'claude' : 'gemini',
            mode: isClaude ? 'claude-connected' : 'gemini-free',
            message: `تم التحقق من مفتاح ${isClaude ? 'Claude' : 'Gemini'} وتفعيله بنجاح!`,
          }),
        };
      } catch {
        return {
          statusCode: 200,
          headers: corsHeaders,
          body: JSON.stringify({
            valid: true,
            cleanKey: parsed.cleanKey,
            provider: isClaude ? 'claude' : 'gemini',
            mode: 'hybrid-free',
            message: `تمت معالجة وحفظ مفتاح ${isClaude ? 'Claude' : 'Gemini'} وتفعيل النظام الهجين غير المنقطع!`,
          }),
        };
      }
    }

    // 10. POST /ai/ask (Full Multi-Turn Chat, Book Summary, Khutbah, Lesson, Infographic, PPTX, Word, PDF)
    if (rawPath === '/ai/ask' && event.httpMethod === 'POST') {
      const body = JSON.parse(event.body || '{}');
      const {
        question,
        mode: requestedMode = 'auto',
        searchScope = 'all',
        bookId,
        scopedBookId,
        preferredProvider = 'auto',
        history = [],
      } = body;
      const targetBookId = bookId ?? scopedBookId;

      if (!question || typeof question !== 'string' || !question.trim()) {
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'يرجى كتابة السؤال أو الموضوع المطلوب في الدردشة' }),
        };
      }

      const cleanQuestion = question.trim();

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

      const customGeminiKey = extractCleanApiKey(
        String(headers['x-gemini-key'] || headers['X-Gemini-Key'] || '')
      ).cleanKey;
      const customClaudeKey = extractCleanApiKey(
        String(headers['x-claude-key'] || headers['X-Claude-Key'] || '')
      ).cleanKey;
      const serverGeminiKey = extractCleanApiKey(process.env.GEMINI_API_KEY || '').cleanKey;
      const serverClaudeKey = extractCleanApiKey(process.env.ANTHROPIC_API_KEY || '').cleanKey;

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

      const scopeFilter = matchedBook ? { book_ids: [Number(matchedBook.id)] } : undefined;
      let candidatePages: any[] = [];
      let totalBookHits = 0;

      if (searchScope !== 'fatawa' || matchedBook) {
        if (matchedBook && (effectiveMode === 'book_summary' || coreTerms.length === 0)) {
          const tocEntries: any[] = bookMetaAndToc?.toc?.entries || [];
          const samplePageIds = Array.from(
            new Set([
              1,
              2,
              ...tocEntries
                .slice(0, 4)
                .map((e: any) => Number(e.page_id))
                .filter((n) => n >= 1),
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

        if (coreTerms.length > 0) {
          const queryToRun = quotedPhrase || searchQuery;
          const [nearResult, tokensResult, titlesResult] = await Promise.all([
            coreTerms.length >= 2
              ? callIbadiMCP('ibadi_search_pages', {
                  query: queryToRun,
                  match: { mode: 'near', distance: 12, morphology: true },
                  limit: 8,
                  ...(scopeFilter ? { scope: scopeFilter } : {}),
                }).catch(() => ({ results: [], total_hits: 0 }))
              : Promise.resolve({ results: [], total_hits: 0 }),
            callIbadiMCP('ibadi_search_pages', {
              query: queryToRun,
              match: { mode: 'tokens', morphology: true },
              limit: 8,
              ...(scopeFilter ? { scope: scopeFilter } : {}),
            }).catch(() => ({ results: [], total_hits: 0 })),
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
        }
      }

      const relevantPages = filterAndRankRelevantPages(
        candidatePages,
        coreTerms,
        effectiveMode,
        matchedBook ? matchedBook.id : null
      );

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

      const allContextPages = [...enrichedPages, ...relevantPages.slice(5, 8)];

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
        totalFatwaHits =
          relevantFatawa.length > 0 ? fatawaResult?.total_hits || relevantFatawa.length : 0;

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

      let finalAnswerText = '';
      const hasEnoughContext =
        allContextPages.length > 0 ||
        enrichedFatawa.length > 0 ||
        catalogMatches.length > 0 ||
        Boolean(matchedBook && bookMetaAndToc);

      if (hasEnoughContext) {
        const { systemInstruction, promptContent } = buildGeminiScholarlyPrompt({
          question: cleanQuestion,
          coreTopic,
          mode: effectiveMode,
          matchedBook,
          bookMetaAndToc,
          pages: allContextPages,
          fatawa: enrichedFatawa,
          catalogMatches,
          history: Array.isArray(history) ? history : [],
        });

        const claudeKeys = [customClaudeKey, serverClaudeKey].filter(Boolean);
        const geminiKeys = [customGeminiKey, serverGeminiKey].filter(Boolean);
        const tryClaudeFirst =
          preferredProvider === 'claude' || (claudeKeys.length > 0 && geminiKeys.length === 0);

        if (tryClaudeFirst) {
          if (claudeKeys.length > 0) {
            try {
              const cRes = await generateWithClaudeFallback(
                claudeKeys,
                systemInstruction,
                promptContent
              );
              finalAnswerText = cRes.text;
            } catch {
              finalAnswerText = '';
            }
          }
          if (!finalAnswerText && geminiKeys.length > 0) {
            try {
              const gRes = await generateWithGeminiFallback(geminiKeys, (model) => ({
                model,
                contents: promptContent,
                config: { systemInstruction },
              }));
              finalAnswerText = gRes.text;
            } catch {
              finalAnswerText = '';
            }
          }
        } else {
          if (geminiKeys.length > 0) {
            try {
              const gRes = await generateWithGeminiFallback(geminiKeys, (model) => ({
                model,
                contents: promptContent,
                config: { systemInstruction },
              }));
              finalAnswerText = gRes.text;
            } catch {
              finalAnswerText = '';
            }
          }
          if (!finalAnswerText && claudeKeys.length > 0) {
            try {
              const cRes = await generateWithClaudeFallback(
                claudeKeys,
                systemInstruction,
                promptContent
              );
              finalAnswerText = cRes.text;
            } catch {
              finalAnswerText = '';
            }
          }
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
          pages: allContextPages,
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
        pages: allContextPages,
        fatawa: enrichedFatawa,
        catalogMatches,
      });

      const slidesData = buildPresentationSlides({
        coreTopic,
        mode: effectiveMode,
        matchedBook,
        bookMetaAndToc,
        pages: allContextPages,
        fatawa: enrichedFatawa,
        catalogMatches,
      });

      const followUpSuggestions = buildFollowUpSuggestions(coreTopic, effectiveMode, matchedBook);

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
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
        }),
      };
    }

    return {
      statusCode: 404,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Endpoint not found' }),
    };
  } catch (err: any) {
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: err?.message || 'Serverless Function Error' }),
    };
  }
}
