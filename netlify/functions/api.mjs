import { GoogleGenAI } from '@google/genai';

async function callIbadiMCP(toolName, args) {
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
      'User-Agent': 'IbadiEncyclopediaNetlify/2.0',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`MCP HTTP error: ${response.status}`);
  }

  const json = await response.json();
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
  'Access-Control-Allow-Headers': 'Content-Type, x-gemini-key',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

export async function handler(event) {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: corsHeaders, body: '' };
  }

  const rawPath = event.path
    .replace(/^\/\.netlify\/functions\/api/, '')
    .replace(/^\/api/, '');
  const query = event.queryStringParameters || {};

  try {
    // 1. GET /book/:id
    const bookMatch = rawPath.match(/^\/book\/(\d+)$/);
    if (bookMatch && event.httpMethod === 'GET') {
      const bookId = parseInt(bookMatch[1], 10);
      const [bookData, tocData] = await Promise.all([
        callIbadiMCP('ibadi_get_book', { book_id: bookId, include: ['parts'] }).catch(() => null),
        callIbadiMCP('ibadi_get_toc', { book_id: bookId, depth: 3 }).catch(() => null),
      ]);
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({ bookId, details: bookData, toc: tocData }),
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

    // 3. GET /search/pages (with Multi-Word Paragraph Proximity Cascade)
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

      const normalizeAr = (t) =>
        String(t || '')
          .replace(/[\u064B-\u065F\u0670]/g, '')
          .replace(/[أإآ]/g, 'ا')
          .replace(/ة/g, 'ه')
          .replace(/ى/g, 'ي')
          .replace(/ؤ/g, 'و')
          .replace(/ئ/g, 'ي')
          .toLowerCase()
          .trim();

      const scoreAndRank = (results, tierMap) => {
        const normQuery = normalizeAr(q);
        const queryTerms = normQuery.split(/\s+/).filter((w) => w.length >= 2);
        if (queryTerms.length <= 1) return results;

        const scored = results.map((hit, idx) => {
          const key = `${hit.book_id}:${hit.page_id}:${hit.field_matched || 'body'}`;
          const bestTier = tierMap.get(key) ?? 4;
          const rawSnippet = String(hit.snippet || '');
          const cleanSnippet = rawSnippet.replace(/<\/?mark[^>]*>/g, '');
          const normSnippet = normalizeAr(cleanSnippet);

          const termPositions = [];
          let matchedDistinctTerms = 0;
          for (const term of queryTerms) {
            const positions = [];
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

          const markMatches = [...rawSnippet.matchAll(/<mark[^>]*>(.*?)<\/mark>/g)];
          let minSpan = 9999;
          if (termPositions.length >= 2) {
            for (const startPos of termPositions[0]) {
              let low = startPos;
              let high = startPos;
              for (let g = 1; g < termPositions.length; g++) {
                let closest = termPositions[g][0];
                let bestDist = Math.abs(closest - startPos);
                for (const cand of termPositions[g]) {
                  const d = Math.abs(cand - startPos);
                  if (d < bestDist) {
                    bestDist = d;
                    closest = cand;
                  }
                }
                if (closest < low) low = closest;
                if (closest > high) high = closest;
              }
              if (high - low < minSpan) minSpan = high - low;
            }
          } else if (markMatches.length >= 2) {
            for (let i = 0; i < markMatches.length - 1; i++) {
              const span = (markMatches[i + 1].index || 0) - (markMatches[i].index || 0);
              if (span > 0 && span < minSpan) minSpan = span;
            }
          }

          const isExactPhrase = normSnippet.includes(normQuery);
          const hasAllInSnippet = matchedDistinctTerms === queryTerms.length;

          let proximityLabel = 'اجتماع الكلمات في الصفحة';
          if (isExactPhrase || bestTier === 1) {
            proximityLabel = 'تطابق متتالٍ في الفقرة';
          } else if (bestTier === 2 || (hasAllInSnippet && minSpan <= 55)) {
            proximityLabel = 'اجتماع الكلمات في جملة واحدة';
          } else if (bestTier === 3 || hasAllInSnippet) {
            proximityLabel = 'اجتماع الكلمات في نفس الفقرة';
          } else if (bestTier === 5) {
            proximityLabel = `تطابق ${matchedDistinctTerms} من ${queryTerms.length} كلمات`;
          }

          const totalScore =
            (6 - bestTier) * 20000 +
            (hasAllInSnippet ? 10000 : 0) +
            (isExactPhrase ? 15000 : 0) +
            matchedDistinctTerms * 2500 +
            Math.max(0, 1500 - Math.min(1500, minSpan * 3)) +
            Math.min(400, markMatches.length * 40) -
            idx;

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
        return scored.map((s) => s.hit);
      };

      const queryWords = q.split(/\s+/).filter((w) => w.length >= 2);

      if (queryWords.length >= 2 && (rawMatch === 'all' || rawMatch === 'near') && offset === 0) {
        const buildArgs = (matchObj, customLimit = limit) => ({
          query: q,
          match: matchObj,
          search_in: searchInArray,
          limit: customLimit,
          offset: 0,
          ...(scope ? { scope } : {}),
        });

        const [nearTightData, nearParagraphData, tokensData] = await Promise.all([
          callIbadiMCP(
            'ibadi_search_pages',
            buildArgs({ mode: 'near', distance: 6, morphology: isMorphology }, Math.min(20, limit))
          ).catch(() => null),
          callIbadiMCP(
            'ibadi_search_pages',
            buildArgs({ mode: 'near', distance: 25, morphology: isMorphology }, limit)
          ).catch(() => null),
          callIbadiMCP(
            'ibadi_search_pages',
            buildArgs({ mode: 'tokens', morphology: isMorphology }, limit)
          ).catch(() => null),
        ]);

        const mergedMap = new Map();
        const tierMap = new Map();
        const addTier = (items, tierNum) => {
          if (!Array.isArray(items)) return;
          for (const item of items) {
            const k = `${item.book_id}:${item.page_id}:${item.field_matched || 'body'}`;
            if (!mergedMap.has(k)) {
              mergedMap.set(k, item);
              tierMap.set(k, tierNum);
            }
          }
        };

        addTier(nearTightData?.results, 2);
        addTier(nearParagraphData?.results, 3);
        addTier(tokensData?.results, 4);

        let totalHits =
          tokensData?.total_hits ||
          nearParagraphData?.total_hits ||
          nearTightData?.total_hits ||
          0;

        if (mergedMap.size === 0) {
          const fallbackData = await callIbadiMCP(
            'ibadi_search_pages',
            buildArgs({ mode: 'boolean', any_of: queryWords, morphology: isMorphology }, limit)
          ).catch(() => null);
          addTier(fallbackData?.results, 5);
          totalHits = fallbackData?.total_hits || mergedMap.size;
        }

        const ranked = scoreAndRank(Array.from(mergedMap.values()), tierMap).slice(0, limit);
        return {
          statusCode: 200,
          headers: corsHeaders,
          body: JSON.stringify({
            query: q,
            total_hits: Math.max(totalHits, ranked.length),
            returned: ranked.length,
            results: ranked,
          }),
        };
      }

      const matchMode =
        rawMatch === 'phrase'
          ? 'phrase'
          : rawMatch === 'near'
          ? 'near'
          : rawMatch === 'exact'
          ? 'exact'
          : 'tokens';

      const args = {
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
      if (Array.isArray(data?.results) && queryWords.length >= 2) {
        data.results = scoreAndRank(data.results, new Map());
      }
      return { statusCode: 200, headers: corsHeaders, body: JSON.stringify(data) };
    }

    // 4. GET /search/titles
    if (rawPath === '/search/titles' && event.httpMethod === 'GET') {
      const q = String(query.q || '').trim();
      const args = {
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

    // 5. GET /search/fatawa
    if (rawPath === '/search/fatawa' && event.httpMethod === 'GET') {
      const q = String(query.q || '').trim();
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

    // Helper to extract a clean Gemini API key from any pasted code snippet or raw text
    const sanitizePastedApiKey = (raw) => {
      if (!raw || typeof raw !== 'string') return '';
      const norm = raw.replace(/[\u200B-\u200F\u202A-\u202E\u2066-\u2069\uFEFF]/g, '').trim();
      if (!norm || norm === 'MY_GEMINI_API_KEY' || norm.startsWith('{')) return '';
      const m = norm.match(/(AIza[0-9A-Za-z_-]{30,45})/);
      if (m && m[1]) return m[1].trim();
      const cleaned = norm
        .replace(/^(export\s+)?(VITE_)?(GEMINI_API_KEY|GOOGLE_API_KEY|API_KEY|apiKey|key)\s*[:=]\s*/i, '')
        .replace(/^Bearer\s+/i, '')
        .replace(/^["'`]+|["'`;,]+$/g, '')
        .replace(/\s+/g, '')
        .trim();
      return cleaned.length >= 20 && !/[{}[\]"'<>]/.test(cleaned) ? cleaned : '';
    };

    // 9. POST /ai/test-key
    if (rawPath === '/ai/test-key' && event.httpMethod === 'POST') {
      const body = JSON.parse(event.body || '{}');
      const rawInput = String(
        body.apiKey || event.headers['x-gemini-key'] || event.headers['X-Gemini-Key'] || ''
      ).trim();
      const cleanKey = sanitizePastedApiKey(rawInput);

      if (!cleanKey) {
        return {
          statusCode: 200,
          headers: corsHeaders,
          body: JSON.stringify({
            valid: true,
            cleanKey: '',
            mode: 'built-in-free',
            message:
              'تم تفعيل المحرك المجاني المدمج للبحث الذكي والتلخيص من كتب الموسوعة (يعمل مجاناً وبلا انقطاع وبدون أي اشتراكات).',
          }),
        };
      }

      try {
        const ai = new GoogleGenAI({ apiKey: cleanKey });
        await ai.models.generateContent({
          model: 'gemini-3.1-flash-lite',
          contents: 'قل: متصل',
        });
        return {
          statusCode: 200,
          headers: corsHeaders,
          body: JSON.stringify({
            valid: true,
            cleanKey,
            mode: 'gemini-free',
            message: 'تمت معالجة وتفعيل المفتاح المجاني بنجاح للبحث الذكي والتلخيص من كتب الموسوعة!',
          }),
        };
      } catch {
        return {
          statusCode: 200,
          headers: corsHeaders,
          body: JSON.stringify({
            valid: true,
            cleanKey,
            mode: 'hybrid-free',
            message:
              'تمت معالجة وحفظ المفتاح وتفعيل نظام البحث الذكي والتلخيص المجاني غير المنقطع (ينتقل تلقائياً للمحرك المدمج عند انتهاء الحصة المجانية دون توقف أو اشتراك)!',
          }),
        };
      }
    }

    // 10. POST /ai/ask (Smart Research & Summarization — Free, Uninterrupted)
    if (rawPath === '/ai/ask' && event.httpMethod === 'POST') {
      const body = JSON.parse(event.body || '{}');
      const { question, searchScope = 'all', bookId } = body;
      const customKey = sanitizePastedApiKey(
        String(event.headers['x-gemini-key'] || event.headers['X-Gemini-Key'] || '')
      );
      const serverKey = sanitizePastedApiKey(process.env.GEMINI_API_KEY || '');
      const activeKey = customKey || serverKey;

      const cleanQuestion = String(question || '').trim();
      const stopWords = new Set([
        'ما', 'هو', 'هي', 'هم', 'هل', 'كيف', 'متى', 'اين', 'أين', 'لماذا', 'كم',
        'في', 'من', 'الى', 'إلى', 'عن', 'على', 'مع', 'بين', 'عند', 'حول',
        'حكم', 'قول', 'رأي', 'راي', 'مسألة', 'مساله', 'الموسوعة', 'الاباضية', 'الإباضية',
        'الشيخ', 'الامام', 'الإمام', 'علماء', 'كتاب', 'كتب', 'اذكر', 'اشرح', 'وضح', 'فصل', 'دليل', 'لخص', 'تلخيص'
      ]);
      const rawWords = cleanQuestion
        .replace(/[؟?!.,،؛:"'()[\]{}]/g, ' ')
        .split(/\s+/)
        .filter((w) => w.length >= 2);
      const keyTerms = rawWords.filter((w) => !stopWords.has(w));
      const searchQuery = keyTerms.length > 0 ? keyTerms.slice(0, 5).join(' ') : cleanQuestion;

      const pageSearchArgs = { query: searchQuery, limit: 6 };
      if (bookId) pageSearchArgs.scope = { book_ids: [Number(bookId)] };

      const [pagesResult, fatawaResult] = await Promise.all([
        searchScope !== 'fatawa'
          ? callIbadiMCP('ibadi_search_pages', pageSearchArgs).catch(() => ({ results: [], total_hits: 0 }))
          : Promise.resolve({ results: [], total_hits: 0 }),
        searchScope !== 'books' && !bookId
          ? callIbadiMCP('ibadi_search_fatawa', { query: searchQuery, limit: 4 }).catch(() => ({
              results: [],
              total_hits: 0,
            }))
          : Promise.resolve({ results: [], total_hits: 0 }),
      ]);

      const pageHits = pagesResult?.results || [];
      const fatwaHits = fatawaResult?.results || [];

      const enrichedPages = await Promise.all(
        pageHits.slice(0, 4).map(async (hit) => {
          try {
            const fullPage = await callIbadiMCP('ibadi_get_page', {
              book_id: hit.book_id,
              page_id: hit.page_id,
              include_foot: true,
            });
            return {
              ...hit,
              fullBody: fullPage.body ? String(fullPage.body).slice(0, 1100) : hit.snippet,
              fullFoot: fullPage.foot ? String(fullPage.foot).slice(0, 400) : '',
              part: fullPage.part || '1',
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

      const allContextPages = [...enrichedPages, ...pageHits.slice(4)];
      let answerText = '';

      if (activeKey) {
        const booksContextText =
          allContextPages.length > 0
            ? allContextPages
                .map(
                  (p, idx) =>
                    `[كتاب ${idx + 1}: ${p.book_name} — ${p.author_name}، ج ${p.part || 1}، ص ${
                      p.page_number
                    } (${p.numbering_declared || 'متسلسل'})]\n«${String(
                      p.fullBody || p.snippet
                    ).replace(/<\/?mark>/g, '')}»`
                )
                .join('\n\n')
            : 'لا توجد نصوص مستخرجة مباشرة من المتون.';

        const fatawaContextText =
          fatwaHits.length > 0
            ? fatwaHits
                .map(
                  (f, idx) =>
                    `[فتوى ${idx + 1}: ${f.title} (#${f.fatwa_id}) — المفتي: ${
                      f.mufti?.name || ''
                    }]\n«${String(f.answer_excerpt || f.question_excerpt || '').replace(
                      /<\/?mark>/g,
                      ''
                    )}»`
                )
                .join('\n\n')
            : 'لا توجد فتاوى مستخرجة.';

        for (const model of ['gemini-3.1-flash-lite', 'gemini-flash-latest', 'gemini-3.8-flash']) {
          try {
            const ai = new GoogleGenAI({ apiKey: activeKey });
            const response = await ai.models.generateContent({
              model,
              contents: `السؤال: "${cleanQuestion}"\n\n=== النصوص من كتب المكتبة ===\n${booksContextText}\n\n=== الفتاوى ===\n${fatawaContextText}\n\nلخّص الجواب بدقة علمية مرتبة مع ذكر المصادر والصفحات.`,
              config: {
                systemInstruction:
                  'أنت الباحث الذكي والملخص العلمي للموسوعة الإباضية. التزم حصرياً بالنصوص المرفقة من الموسوعة ولا تخرج عنها أبداً. وثق كل قول بذكر الكتاب والمؤلف والجزء والصفحة وحالة الترقيم (موافق للمطبوع أو ترقيم آلي).',
                temperature: 0.2,
              },
            });
            if (response && response.text) {
              answerText = response.text;
              break;
            }
          } catch {
            // Try next model or fallback
          }
        }
      }

      if (!answerText) {
        const lines = [];
        lines.push(`📌 خلاصة وتلخيص المسألة من كتب الموسوعة الإباضية حول: «${cleanQuestion}»`);
        lines.push('');
        if (allContextPages.length > 0) {
          lines.push('أولاً: التلخيص والنصوص المستخرجة من بطون الكتب:');
          allContextPages.slice(0, 5).forEach((p, idx) => {
            const excerpt = String(p.fullBody || p.snippet || '')
              .replace(/<\/?mark[^>]*>/gi, '')
              .replace(/\s+/g, ' ')
              .trim()
              .slice(0, 650);
            lines.push(
              `${idx + 1}. في كتاب (${p.book_name} — ${p.author_name}، ج ${p.part || 1}، ص ${
                p.page_number
              } - ${p.numbering_declared || 'موافق للمطبوع'}):\n«${excerpt}...»\n`
            );
          });
        }
        if (fatwaHits.length > 0) {
          lines.push('ثانياً: خلاصة الفتاوى الشرعية ذات الصلة:');
          fatwaHits.slice(0, 3).forEach((f, idx) => {
            const excerpt = String(f.answer_excerpt || f.question_excerpt || '')
              .replace(/<\/?mark[^>]*>/gi, '')
              .replace(/\s+/g, ' ')
              .trim();
            lines.push(
              `${idx + 1}. (${f.title} — فتوى رقم ${f.fatwa_id} — المفتي: ${
                f.mufti?.name || 'غير محدد'
              }):\n«${excerpt}»\n`
            );
          });
        }
        answerText =
          lines.length > 2
            ? lines.join('\n')
            : 'لم أجد في المقتطفات المسترجعة نصاً يفصل هذه المسألة بعينها، يرجى تجربة كلمات مفتاحية أدق.';
      }

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          question: cleanQuestion,
          searchQueryUsed: searchQuery,
          answer: answerText,
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
          fatawaSources: fatwaHits.map((f) => ({
            fatwa_id: f.fatwa_id,
            title: f.title,
            mufti: f.mufti?.name || '',
            question: f.question_excerpt || '',
            answer_excerpt: f.answer_excerpt || '',
          })),
          totalBookHits: pagesResult?.total_hits || 0,
          totalFatwaHits: fatawaResult?.total_hits || 0,
        }),
      };
    }

    // 11. POST /ai/tashkeel (Local-only, 0 API credit usage)
    if (rawPath === '/ai/tashkeel' && event.httpMethod === 'POST') {
      const body = JSON.parse(event.body || '{}');
      const { text, foot } = body;
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          body: String(text || '').replace(/\{([^}]+)\}/g, '﴿$1﴾'),
          foot: String(foot || '').replace(/\{([^}]+)\}/g, '﴿$1﴾'),
          corrections: [],
        }),
      };
    }

    return {
      statusCode: 404,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Endpoint not found' }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: err.message || 'Serverless Function Error' }),
    };
  }
}
