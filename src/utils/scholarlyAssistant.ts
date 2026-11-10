import { AIChatMode, CatalogBook } from '../types';
import { proofreadAndVocalizeArabic } from './arabicProofreader';

export const MODE_LABELS: Record<AIChatMode, string> = {
  auto: 'تلقائي ذكي (يكتشف نوع الطلب)',
  chat: 'حوار وسؤال علمي دقيق',
  book_summary: 'ملخص شامل لكتاب',
  article: 'مقال علمي مؤصل',
  tafsir_hadith: 'تفسير آية أو شرح حديث',
  khutbah: 'خطبة جمعة منبرية',
  lesson: 'درس علمي شامل',
};

export function normalizeArabicText(text: string): string {
  if (!text) return '';
  return text
    .replace(/[\u064B-\u065F\u0670\u0640]/g, '') // Remove tashkeel and tatweel
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .toLowerCase()
    .trim();
}

// Comprehensive list of conversational/framing/task words that should NEVER pollute the search query
const INSTRUCTION_AND_STOP_WORDS = new Set(
  [
    // Question & framing particles
    'ما', 'ماذا', 'هو', 'هي', 'هم', 'هن', 'هل', 'كيف', 'متى', 'اين', 'أين', 'لماذا', 'كم', 'اي', 'أي',
    'في', 'من', 'الى', 'إلى', 'عن', 'على', 'مع', 'بين', 'عند', 'حول', 'بدل', 'بدلا', 'دون', 'بدون',
    'هذا', 'هذه', 'ذلك', 'تلك', 'هؤلاء', 'الذي', 'التي', 'الذين', 'اللاتي', 'اللذان', 'اللتان',
    'ان', 'أن', 'إن', 'انه', 'إنه', 'انها', 'إنها', 'لان', 'لأن', 'كان', 'كانت', 'يكون', 'تكون',
    'قد', 'لقد', 'كل', 'بعض', 'غير', 'سوى', 'نفس', 'ذات', 'ايضا', 'أيضا', 'كذلك', 'فقط', 'جدا',
    // Polite & conversational requests
    'اكتب', 'أكتب', 'كتابة', 'لي', 'لنا', 'لك', 'اعطني', 'أعطني', 'اعطنا', 'هات', 'زودني', 'افدني', 'أفدني',
    'اريد', 'أريد', 'نريد', 'ابغى', 'أبغى', 'ممكن', 'لو', 'سمحت', 'تفضل', 'فضلا', 'رجاء', 'يرجى',
    'حدثني', 'تحدث', 'كلمني', 'تكلم', 'اخبرني', 'أخبرني', 'دلني', 'وجهني', 'اجعل', 'اجعله', 'صغ', 'صياغة',
    'اذكر', 'أذكر', 'اشرح', 'إشرح', 'وضح', 'بين', 'فصل', 'افصل', 'بالتفصيل', 'باختصار', 'بإيجاز',
    // Mode & format names (so asking for a khutbah or lesson doesn't search for the word "خطبة" or "درس")
    'ملخص', 'ملخصا', 'ملخصاً', 'تلخيص', 'لخص', 'لخصه', 'نبذة', 'نبذه', 'تعريف', 'فكرة', 'محتوى', 'مضمون',
    'كتاب', 'الكتاب', 'كتب', 'الكتب', 'مؤلف', 'المؤلف', 'صاحب', 'سفر', 'منظومة', 'رسالة',
    'مقال', 'مقالا', 'مقالاً', 'مقالة', 'مقاله', 'بحث', 'بحثا', 'بحثاً', 'ورقة', 'موضوع', 'موضع', 'معين', 'محدد',
    'خطبة', 'خطبه', 'الخطبة', 'جمعة', 'جمعه', 'الجمعة', 'منبرية', 'منبريه', 'اسلوب', 'أسلوب', 'بأسلوب', 'باسلوب', 'الخطيب',
    'درس', 'درسا', 'درساً', 'الدرس', 'دروس', 'محاضرة', 'محاضره', 'شامل', 'شاملا', 'شاملاً', 'شاملة', 'كامل', 'متكامل',
    'تفسير', 'تفسيره', 'تفسيرها', 'آية', 'ايه', 'آيه', 'الآية', 'الايه', 'آيات', 'قوله', 'تعالى', 'سبحانه', 'عز', 'وجل', 'سورة',
    'حديث', 'الحديث', 'شرح', 'معنى', 'المعنى', 'مفهوم', 'دلالة', 'المراد', 'المقصود',
    // Encyclopedia & general scholarly framing words
    'الموسوعة', 'الموسوعه', 'الإباضية', 'الاباضية', 'الاباضيه', 'المكتبة', 'المكتبه',
    'الاعتماد', 'اعتماد', 'معتمدا', 'مستندا', 'يخرج', 'تخرج', 'منها', 'فيها', 'عليها', 'إليها', 'اليها',
    'حكم', 'احكام', 'أحكام', 'قول', 'أقوال', 'اقوال', 'رأي', 'راي', 'آراء', 'مسألة', 'مساله', 'مسائل',
    'الشيخ', 'الامام', 'الإمام', 'علماء', 'العلماء', 'فقهاء', 'الفقهاء', 'أئمة', 'ائمة', 'دليل', 'أدلة', 'ادلة',
    'نقاط', 'عناصر', 'محاور', 'فوائد', 'أهم', 'اهم', 'أبرز', 'ابرز', 'شيء', 'اي',
  ].map((w) => normalizeArabicText(w))
);

/**
 * 1. Detect the effective scholarly mode based on explicit selection or natural Arabic phrasing
 */
export function detectScholarlyMode(
  question: string,
  requestedMode: AIChatMode = 'auto',
  hasScopedBook = false
): { mode: Exclude<AIChatMode, 'auto'>; label: string } {
  if (requestedMode && requestedMode !== 'auto') {
    return { mode: requestedMode, label: MODE_LABELS[requestedMode] };
  }

  const norm = normalizeArabicText(question);

  // Check for Book Summary intent
  if (
    /\b(ملخص|تلخيص|لخص|نبذه عن كتاب|تعريف بكتاب|فهرس كتاب|محتوي كتاب|مضمون كتاب|عما يتحدث كتاب|ماذا يحوي كتاب)\b/.test(
      norm
    ) ||
    (hasScopedBook && /\b(ملخص|تلخيص|لخص|نبذه|فهرس|ابواب|موضوعات|عن ماذا يتحدث|عرفني بهذا الكتاب)\b/.test(norm))
  ) {
    return { mode: 'book_summary', label: MODE_LABELS.book_summary };
  }

  // Check for Friday Khutbah intent
  if (/\b(خطبه|جمعه|منبريه|اسلوب الخطبه|خطيب)\b/.test(norm)) {
    return { mode: 'khutbah', label: MODE_LABELS.khutbah };
  }

  // Check for Comprehensive Lesson intent
  if (/\b(درس|درسا|محاضره|حلقه علميه)\b/.test(norm)) {
    return { mode: 'lesson', label: MODE_LABELS.lesson };
  }

  // Check for Scholarly Article intent
  if (/\b(مقال|مقالا|مقاله|بحث علمي)\b/.test(norm)) {
    return { mode: 'article', label: MODE_LABELS.article };
  }

  // Check for Tafsir / Hadith Explanation intent
  if (
    /\b(تفسير|ايه|الايه|قوله تعالي|سوره|شرح حديث|معني حديث|حديث شريف|قول النبي|قال رسول الله)\b/.test(
      norm
    ) ||
    /[﴿﴾{}]/.test(question)
  ) {
    return { mode: 'tafsir_hadith', label: MODE_LABELS.tafsir_hadith };
  }

  return { mode: 'chat', label: MODE_LABELS.chat };
}

/**
 * 2. Detect if the user mentioned a specific book from the catalog in their prompt
 * (or return the explicitly scoped book if provided)
 */
export function findMatchingBookInCatalog(
  question: string,
  catalogBooks: CatalogBook[],
  explicitBookId?: number | null,
  history?: { role: string; content: string; bookId?: number }[]
): CatalogBook | null {
  if (explicitBookId) {
    const found = catalogBooks.find((b) => b.id === Number(explicitBookId));
    if (found) return found;
  }

  const normQ = normalizeArabicText(question);

  // Extract explicit book candidate after "كتاب ..." if present
  const bookTriggerMatch = normQ.match(
    /(?:كتاب|منظومه|مسند|تفسير|حاشيه|معجم|ديوان|جامع|موسوعه)\s+([^\n.,،؟?!]{4,45})/
  );
  const candidateBookPhrase = bookTriggerMatch ? bookTriggerMatch[1].trim() : '';

  let bestBook: CatalogBook | null = null;
  let bestScore = 0;

  for (const book of catalogBooks) {
    const normTitle = normalizeArabicText(book.title);
    if (!normTitle || normTitle.length < 4) continue;

    // Clean parenthetical notes from book title for matching (e.g. "قواعد الإسلام (ط. الأوقاف)")
    const cleanNormTitle = normTitle.replace(/\([^)]*\)/g, '').trim();
    const titleWords = cleanNormTitle.split(/\s+/).filter((w) => w.length >= 2);
    if (titleWords.length === 0) continue;

    let score = 0;

    // Case A: Exact title appears in the user's question
    if (cleanNormTitle.length >= 6 && normQ.includes(cleanNormTitle)) {
      score += 500 + cleanNormTitle.length * 12 + titleWords.length * 40;
    }

    // Case B: User wrote "كتاب <X>" and <X> starts with or equals the book title
    if (candidateBookPhrase && cleanNormTitle.length >= 5) {
      if (candidateBookPhrase === cleanNormTitle || candidateBookPhrase.startsWith(cleanNormTitle)) {
        score += 700 + cleanNormTitle.length * 15;
      } else if (
        cleanNormTitle.startsWith(candidateBookPhrase) &&
        candidateBookPhrase.split(/\s+/).length >= 2
      ) {
        score += 450 + candidateBookPhrase.length * 10;
      }
    }

    if (score > bestScore) {
      bestScore = score;
      bestBook = book;
    }
  }

  // Require a strong confidence threshold so generic words don't accidentally lock a book
  if (bestBook && bestScore >= 560) {
    return bestBook;
  }

  // Check if the user is referring to "الكتاب" / "هذا الكتاب" / "لخصه" from recent history
  if (
    history &&
    history.length > 0 &&
    /\b(الكتاب|هذا الكتاب|لخصه|ابوابه|مؤلفه|فصوله|منهجه)\b/.test(normQ)
  ) {
    for (let i = history.length - 1; i >= 0; i--) {
      if (history[i].bookId) {
        const prevBook = catalogBooks.find((b) => b.id === Number(history[i].bookId));
        if (prevBook) return prevBook;
      }
    }
  }

  return null;
}

/**
 * 3. Extract the pure, laser-focused scholarly topic & keywords from the user prompt
 * without any conversational or formatting noise!
 */
export function extractCleanTopicAndKeywords(
  question: string,
  matchedBook: CatalogBook | null,
  history?: { role: string; content: string; coreTopic?: string }[]
): {
  coreTopic: string;
  searchQuery: string;
  coreTerms: string[];
  quotedPhrase: string | null;
} {
  // 1. Check if the user put a specific verse, hadith, or phrase inside quotes «...», "...", ﴿...﴾, {...}
  const quoteMatch =
    question.match(/﴿([^﴾]{4,120})﴾/) ||
    question.match(/«([^»]{4,120})»/) ||
    question.match(/"([^"]{4,120})"/) ||
    question.match(/\{([^}]{4,120})\}/);

  const quotedPhrase = quoteMatch ? quoteMatch[1].trim() : null;

  // 2. Remove the matched book title from the prompt if the user is asking a question inside a specific book
  let workingText = question;
  if (matchedBook) {
    const cleanTitle = matchedBook.title.replace(/\([^)]*\)/g, '').trim();
    workingText = workingText.replace(cleanTitle, ' ');
    const normTitle = normalizeArabicText(cleanTitle);
    // Also strip normalized title words if user only asked "لخص لي كتاب X"
    for (const tw of normTitle.split(/\s+/)) {
      if (tw.length >= 3) {
        const regex = new RegExp(tw, 'gi');
        workingText = workingText; // Keep original unless stripping
      }
    }
  }

  // 3. Strip common multi-word framing phrases first
  const multiWordFraming = [
    /بدلا من البحث في الموسوعة/g,
    /بالاعتماد على كتب الموسوعة/g,
    /من كتب الموسوعة الإباضية/g,
    /من كتب الموسوعة/g,
    /في الموسوعة الإباضية/g,
    /بدون أن يخرج منها/g,
    /دون الخروج عنها/g,
    /بأسلوب الخطبة/g,
    /أسلوب الخطبة/g,
    /خطبة جمعة عن/g,
    /خطبة جمعة في/g,
    /خطبة جمعة حول/g,
    /خطبة جمعة/g,
    /درسا شاملا في موضوع/g,
    /درسا شاملا عن/g,
    /درسا شاملا في/g,
    /درس شامل عن/g,
    /درس شامل في/g,
    /درس علمي عن/g,
    /مقالا في موضوع/g,
    /مقال في موضوع/g,
    /مقال علمي عن/g,
    /ملخصا لكتاب/g,
    /ملخص كتاب/g,
    /لخص لي كتاب/g,
    /لخص لي هذا الكتاب/g,
    /لخص لي الكتاب/g,
    /تفسير قوله تعالى/g,
    /تفسير الآية الكريمة/g,
    /تفسير آية/g,
    /شرح حديث/g,
    /معنى حديث/g,
    /قال رسول الله صلى الله عليه وسلم/g,
    /صلى الله عليه وسلم/g,
  ];

  for (const pattern of multiWordFraming) {
    workingText = workingText.replace(pattern, ' ');
  }

  // If matchedBook is present, also remove its title words when extracting the sub-topic
  const bookTitleWords = new Set(
    matchedBook
      ? normalizeArabicText(matchedBook.title.replace(/\([^)]*\)/g, ''))
          .split(/\s+/)
          .filter((w) => w.length >= 2)
      : []
  );

  // 4. Tokenize remaining words and filter out instruction/stop words
  const rawTokens = workingText
    .replace(/[؟?!.,،؛:"'()[\]{}«»﴿﴾\-_]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 2);

  const filteredTokens = rawTokens.filter((token) => {
    const norm = normalizeArabicText(token);
    if (norm.length < 2) return false;
    // Strip leading "و" or "ف" or "ب" or "ل" or "ك" + instruction word check
    if (INSTRUCTION_AND_STOP_WORDS.has(norm)) return false;
    if (norm.startsWith('ال') && INSTRUCTION_AND_STOP_WORDS.has(norm.slice(2))) return false;
    if (
      (norm.startsWith('و') || norm.startsWith('ف') || norm.startsWith('ب') || norm.startsWith('ل')) &&
      INSTRUCTION_AND_STOP_WORDS.has(norm.slice(1))
    ) {
      return false;
    }
    if (matchedBook && bookTitleWords.has(norm)) return false;
    return true;
  });

  // If user quoted a specific verse/hadith, prioritize its core words
  if (quotedPhrase) {
    const quoteWords = quotedPhrase
      .replace(/[؟?!.,،؛:"'()[\]{}«»﴿﴾]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length >= 2 && !INSTRUCTION_AND_STOP_WORDS.has(normalizeArabicText(w)));

    const searchQuery = quoteWords.slice(0, 6).join(' ') || quotedPhrase;
    return {
      coreTopic: quotedPhrase,
      searchQuery,
      coreTerms: quoteWords.map((w) => normalizeArabicText(w)),
      quotedPhrase,
    };
  }

  // If filteredTokens is empty (e.g., follow-up prompt like "اجعله خطبة جمعة" or "لخص لي الكتاب"),
  // check conversation history for the previous coreTopic!
  if (filteredTokens.length === 0 && history && history.length > 0) {
    for (let i = history.length - 1; i >= 0; i--) {
      if (history[i].coreTopic && history[i].coreTopic!.trim().length >= 2) {
        const inherited = history[i].coreTopic!.trim();
        const terms = inherited
          .split(/\s+/)
          .map((w) => normalizeArabicText(w))
          .filter((w) => w.length >= 2);
        return {
          coreTopic: inherited,
          searchQuery: inherited.split(/\s+/).slice(0, 5).join(' '),
          coreTerms: terms,
          quotedPhrase: null,
        };
      }
    }
  }

  // If matchedBook is active and user only asked to summarize the book ("لخص لي الكتاب")
  if (filteredTokens.length === 0 && matchedBook) {
    return {
      coreTopic: matchedBook.title,
      searchQuery: 'مقدمة الفصل الباب',
      coreTerms: [],
      quotedPhrase: null,
    };
  }

  const coreTopic =
    filteredTokens.length > 0 ? filteredTokens.slice(0, 7).join(' ') : question.trim();
  const searchQuery =
    filteredTokens.length > 0 ? filteredTokens.slice(0, 5).join(' ') : question.trim();
  const coreTerms = filteredTokens.slice(0, 6).map((w) => normalizeArabicText(w));

  return {
    coreTopic,
    searchQuery,
    coreTerms,
    quotedPhrase: null,
  };
}

/**
 * 4. Strict Relevance Verification & Scoring:
 * Ensures no random or unrelated pages/fatwas slip into the response!
 */
export function filterAndRankRelevantPages(
  pages: any[],
  coreTerms: string[],
  mode: Exclude<AIChatMode, 'auto'>,
  scopedBookId?: number | null
): any[] {
  if (!Array.isArray(pages) || pages.length === 0) return [];

  // Strip 'ال' prefix for flexible root-stem matching
  const stripAl = (w: string) => (w.startsWith('ال') && w.length >= 4 ? w.slice(2) : w);
  const stems = coreTerms.map(stripAl).filter((s) => s.length >= 2);

  const scored: { page: any; score: number; matchedCount: number }[] = [];

  for (const p of pages) {
    // If scoped to a specific book, strictly reject any page from any other book!
    if (scopedBookId && Number(p.book_id) !== Number(scopedBookId)) {
      continue;
    }

    // If summarizing a specific book and coreTerms is empty, keep the book's own pages
    if (scopedBookId && stems.length === 0) {
      scored.push({ page: p, score: 100, matchedCount: 1 });
      continue;
    }

    const combinedText = normalizeArabicText(
      `${p.snippet || ''} ${p.fullBody || ''} ${p.book_name || ''} ${p.category || ''}`
    );
    const bodyAndSnippetText = normalizeArabicText(`${p.snippet || ''} ${p.fullBody || ''}`);

    let matchedStemsInBody = 0;
    let totalOccurrences = 0;

    for (const stem of stems) {
      if (bodyAndSnippetText.includes(stem)) {
        matchedStemsInBody++;
        const parts = bodyAndSnippetText.split(stem);
        totalOccurrences += parts.length - 1;
      } else if (combinedText.includes(stem)) {
        matchedStemsInBody += 0.5;
      }
    }

    // Also check if MCP highlighted <mark> tags in snippet (morphological match)
    const hasMarkHighlight = /<mark[^>]*>/i.test(String(p.snippet || ''));
    if (hasMarkHighlight && matchedStemsInBody === 0) {
      matchedStemsInBody = 0.8;
    }

    // STRICT RELEVANCE GATE:
    // Reject any page that doesn't match the core topic at all!
    const minRequired = stems.length >= 3 ? 1.5 : stems.length >= 1 ? 0.8 : 0;
    if (stems.length > 0 && matchedStemsInBody < minRequired) {
      continue;
    }

    let score = matchedStemsInBody * 250 + Math.min(totalOccurrences, 10) * 25;

    // Check consecutive phrase bonus
    const fullStemPhrase = stems.join(' ');
    if (fullStemPhrase.length >= 5 && bodyAndSnippetText.includes(fullStemPhrase)) {
      score += 500;
    }

    // Mode-specific category boosting
    const cat = normalizeArabicText(p.category || '');
    if (mode === 'tafsir_hadith') {
      if (cat.includes('تفسير') || cat.includes('قران') || cat.includes('حديث')) {
        score += 350;
      }
    } else if (mode === 'khutbah' || mode === 'lesson') {
      if (cat.includes('وعظ') || cat.includes('اخلاق') || cat.includes('تفسير') || cat.includes('فقه')) {
        score += 120;
      }
    }

    scored.push({ page: p, score, matchedCount: matchedStemsInBody });
  }

  scored.sort((a, b) => b.score - a.score);
  return scored.map((s) => s.page);
}

export function filterAndRankRelevantFatawa(
  fatawa: any[],
  coreTerms: string[],
  scopedBookId?: number | null
): any[] {
  // When discussing or summarizing a specific book, rely 100% on that book ONLY (0 external fatawa)
  if (scopedBookId) return [];
  if (!Array.isArray(fatawa) || fatawa.length === 0) return [];

  const stripAl = (w: string) => (w.startsWith('ال') && w.length >= 4 ? w.slice(2) : w);
  const stems = coreTerms.map(stripAl).filter((s) => s.length >= 2);
  if (stems.length === 0) return fatawa.slice(0, 3);

  const scored: { fatwa: any; score: number }[] = [];

  for (const f of fatawa) {
    const text = normalizeArabicText(
      `${f.title || ''} ${f.question || f.question_excerpt || ''} ${f.answer || f.answer_excerpt || ''}`
    );
    const titleNorm = normalizeArabicText(f.title || '');

    let matched = 0;
    let titleMatches = 0;
    for (const stem of stems) {
      if (text.includes(stem)) matched++;
      if (titleNorm.includes(stem)) titleMatches++;
    }

    const minRequired = stems.length >= 3 ? 2 : 1;
    if (matched < minRequired && titleMatches === 0) {
      continue;
    }

    scored.push({
      fatwa: f,
      score: matched * 200 + titleMatches * 300,
    });
  }

  scored.sort((a, b) => b.score - a.score);
  return scored.map((s) => s.fatwa);
}

/**
 * 5. Build Mode-Specific Gemini System Instruction & Prompt
 * Strictly grounded in the retrieved Encyclopedia books/fatawa (or the single scoped book).
 */
export function buildGeminiScholarlyPrompt(params: {
  question: string;
  coreTopic: string;
  mode: Exclude<AIChatMode, 'auto'>;
  matchedBook: CatalogBook | null;
  bookMetaAndToc?: { details?: any; toc?: any } | null;
  pages: any[];
  fatawa: any[];
  history?: { role: string; content: string }[];
}): { systemInstruction: string; promptContent: string } {
  const { question, coreTopic, mode, matchedBook, bookMetaAndToc, pages, fatawa, history } = params;

  const isSingleBookRestriction = Boolean(matchedBook);

  const modeInstructions: Record<Exclude<AIChatMode, 'auto'>, string> = {
    book_summary: `المطلوب: تقديم **ملخص علمي شامل ومفصل للكتاب** أو للمسألة المطلوبة منه، يشمل:
1. **بطاقة التعريف بالكتاب والمؤلف**: اسم الكتاب، مؤلفه، عصره، وقسمه العلمي.
2. **موضوع الكتاب ومنهجه العلمي**: بيان الغاية من تأليفه وطريقة المؤلف في عرض المسائل.
3. **هيكلة الكتاب وأبرز أبوابه وفصوله**: استعراض منظم لأقسام وأبواب الكتاب بناءً على الفهرس المرفق.
4. **مقتطفات ونماذج علمية موثقة من صفحات الكتاب**: إيراد شواهد نصية بين «...» مع عزوها الدقيق لرقم الجزء والصفحة.`,

    khutbah: `المطلوب: كتابة **خطبة جمعة منبرية متكاملة وبليغة بأسلوب الخطبة الشرعية الأصيلة** في موضوع («${coreTopic}») بالاعتماد الحصري على نصوص الموسوعة المرفقة:
1. **الخطبة الأولى**:
   - الاستفتاح المنبري (الحمد لله والثناء عليه، والشهادتان، والصلاة على النبي ﷺ، والوصية بتقوى الله عز وجل).
   - الدخول في موضوع الخطبة («${coreTopic}») بأسلوب خطابي وعظي مؤثر وفصيح (يا عباد الله / أيها المؤمنون).
   - تضمين الآيات القرآنية الكريمة مضبوطة بين ﴿...﴾ والأحاديث النبوية وكلام أئمة وعلماء الموسوعة المقتبس من النصوص المرفقة مع الإشارة للمصدر والصفحة.
   - خاتمة الخطبة الأولى (بارك الله لي ولكم في القرآن العظيم... أقول قولي هذا وأستغفر الله لي ولكم).
2. **الخطبة الثانية**:
   - الحمد والثناء والصلاة والسلام على رسول الله ﷺ.
   - التوجيهات العملية والأحكام الفقهية المستخلصة من المتون والفتاوى المرفقة.
   - الختام بالدعاء المنبري الجامع والتوثيق العلمي للمصادر المعتمدة في آخر الخطبة.`,

    lesson: `المطلوب: إعداد **درس علمي شامل ومنهجي متكامل** في موضوع («${coreTopic}») يصلح للإلقاء والتدريس العلمي بالاعتماد الحصري على نصوص الموسوعة المرفقة:
1. **عنوان الدرس وأهدافه العلمية**.
2. **تمهيد وتعريف بالموضوع** في ضوء نصوص الموسوعة.
3. **المحاور التفصيلية للدرس (مرتبة في عناصر مرقمة)**:
   - التأصيل الشرعي والأدلة من القرآن والسنة كما وردت في المتون المرفقة.
   - أقوال أئمة وعلماء الموسوعة وتفصيلاتهم الفقهية والعقدية مع الاقتباس النصي بين «...» والعزو للكتاب والجزء والصفحة.
   - الأحكام التطبيقية والفتاوى الشرعية المتعلقة بالموضوع.
4. **خلاصة الدرس والفوائد المستنبطة** (نقاط مركزة يسهل حفظها ومراجعتها).
5. **ثَبَت المصادر والمراجع المعتمدة من الموسوعة**.`,

    article: `المطلوب: كتابة **مقال علمي رصين ومؤصل** في موضوع («${coreTopic}») بالاعتماد الحصري على نصوص الموسوعة المرفقة:
1. **عنوان المقال العلمي**.
2. **مقدمة مركزة** تمهد للموضوع وتبرز أهميته.
3. **صلب المقال ومحاوره التحليلية**: عرض مترابط وفصيح يدمج الشواهد المقتبسة من أمهات كتب الموسوعة وفتاواها بين «...» مع توثيق كل شاهد (الكتاب، المؤلف، الجزء، الصفحة).
4. **خاتمة المقال**: تتضمن أهم النتائج العلمية المستخلصة يتبعها فهرس المصادر.`,

    tafsir_hadith: `المطلوب: تقديم **تفسير علمي للآية القرآنية أو شرح وافٍ للحديث الشريف** («${coreTopic}») بالاعتماد الحصري على كتب التفسير والحديث والفقه المرفقة من الموسوعة:
1. **إيراد النص الشريف مضبوطاً** (مع الحفاظ التام على نص الآية القرآنية بالرسم العثماني بين ﴿...﴾ دون أي تغيير).
2. **المعنى الإجمالي والبيان اللغوي** كما قرره علماء الموسوعة في النصوص المرفقة.
3. **التفسير التفصيلي وأقوال أئمة الموسوعة** (مع الاقتباس النصي بين «...» والعزو الدقيق للكتاب والمؤلف والجزء والصفحة).
4. **الأحكام الشرعية والهدايات المستنبطة** من النص.`,

    chat: `المطلوب: تقديم **إجابة علمية دقيقة ومباشرة ومفصلة** على سؤال السائل حول («${coreTopic}») بالاعتماد الحصري على النصوص المرفقة:
1. الإجابة المباشرة والمركزة في صلب الموضوع المسؤول عنه دون أي خروج عنه أو حشو.
2. دعم كل حكم أو معلومة بالاقتباس النصي من المتون والفتاوى المرفقة بين «...» مع العزو الدقيق (اسم الكتاب، المؤلف، الجزء، الصفحة، وحالة الترقيم).`,
  };

  const singleBookRule = isSingleBookRestriction
    ? `\nتنبيه صارم جداً: النقاش محصور في كتاب واحد فقط هو «${matchedBook?.title}» للمؤلف «${matchedBook?.author}». اعتمد حصرياً على بيانات وفهرس وصفحات هذا الكتاب المرفقة أدناه، ولا تذكر أي مصدر خارجي آخر إطلاقاً.`
    : `\nتنبيه صارم جداً: اعتمد حصرياً على النصوص والفتاوى المرفقة من الموسوعة الإباضية دون أن تخرج عنها إطلاقاً، ولا تأتِ بأي معلومات عشوائية أو غير متعلقة بموضوع السؤال («${coreTopic}»).`;

  const systemInstruction = `أنت "المساعد العلمي والموسوعي الشامل للموسوعة الإباضية".
مهمتك: محاورة الباحثين وطلاب العلم وتلبية طلباتهم العلمية (تلخيص كتب، كتابة مقالات، تفسير آيات وشرح أحاديث، صياغة خطب جمعة منبرية، إعداد دروس علمية شاملة، والإجابة الدقيقة عن المسائل) بالاعتماد الكلي والحصري على كتب ومتون وفتاوى الموسوعة الإباضية المرفقة فقط.
- حافظ تماماً على الآيات القرآنية بنصها وتشكيلها بين ﴿...﴾ دون مساس بها.
- التزم بالدقة العلمية التامة وعدم الخروج عن الموضوع المطلوب.
${modeInstructions[mode]}${singleBookRule}`;

  const historyContext =
    history && history.length > 0
      ? `=== سياق الحوار السابق ===\n` +
        history
          .slice(-4)
          .map((m) => `${m.role === 'user' ? 'السائل' : 'المساعد'}: ${m.content.slice(0, 350)}`)
          .join('\n') +
        `\n\n`
      : '';

  let bookInfoSection = '';
  if (matchedBook) {
    const tocEntries = bookMetaAndToc?.toc?.entries || [];
    const tocSample = tocEntries
      .slice(0, 35)
      .map((e: any) => `- ${e.title} (ص ${e.page_id})`)
      .join('\n');
    const pubInfo = bookMetaAndToc?.details?.publication || '';
    const totalP = bookMetaAndToc?.toc?.pages_total || matchedBook.pagesCount || '';

    bookInfoSection =
      `=== بيانات وفهرس الكتاب المحدد («${matchedBook.title}») ===\n` +
      `• اسم الكتاب: ${matchedBook.title}\n` +
      `• المؤلف: ${matchedBook.author} (${matchedBook.era || ''})\n` +
      `• القسم العلمي: ${matchedBook.category}\n` +
      (totalP ? `• عدد الصفحات: ${totalP} صفحة\n` : '') +
      (pubInfo ? `• بيانات الطبعة والنشر: ${pubInfo}\n` : '') +
      (tocSample ? `• أبرز أبواب وفصول الكتاب من الفهرس المعتمد:\n${tocSample}\n\n` : '\n');
  }

  const booksContextText =
    pages.length > 0
      ? pages
          .map(
            (p, idx) =>
              `[مصدر ${idx + 1}: كتاب ${p.book_name} — المؤلف: ${p.author_name}، القسم: ${
                p.category || 'عام'
              }، ج ${p.part || 1}، ص ${p.page_number} (${p.numbering_declared || 'مفهرس'})]\n` +
              `النص: «${String(p.fullBody || p.snippet || '').replace(/<\/?mark[^>]*>/gi, '')}»` +
              (p.fullFoot
                ? `\nالحاشية: «${String(p.fullFoot).replace(/<\/?mark[^>]*>/gi, '')}»`
                : '')
          )
          .join('\n\n')
      : 'لا توجد صفحات نصية مستخرجة مباشرة.';

  const fatawaContextText =
    !isSingleBookRestriction && fatawa.length > 0
      ? `\n\n=== الفتاوى الشرعية المستخرجة من الموسوعة ===\n` +
        fatawa
          .map(
            (f, idx) =>
              `[فتوى ${idx + 1}: ${f.title} (فتوى رقم #${f.fatwa_id}) — المفتي: ${
                f.mufti?.name || 'غير محدد'
              }]\n` +
              (f.question ? `السؤال: ${String(f.question).replace(/<\/?mark[^>]*>/gi, '')}\n` : '') +
              `الجواب: «${String(f.answer || f.answer_excerpt || '').replace(
                /<\/?mark[^>]*>/gi,
                ''
              )}»`
          )
          .join('\n\n')
      : '';

  const promptContent =
    `${historyContext}` +
    `طلب الباحث الحالي: "${question}"\n` +
    `الموضوع المحوري: "${coreTopic}"\n` +
    `نوع المخرج المطلوب: ${MODE_LABELS[mode]}\n\n` +
    `${bookInfoSection}` +
    `=== النصوص المعتمدة المستخرجة من كتب الموسوعة ===\n${booksContextText}` +
    `${fatawaContextText}\n\n` +
    `أنجز المطلوب الآن بدقة علمية عالية وبنفس الأسلوب المطلوب (${MODE_LABELS[mode]}) مع الاقتصار التام على ما ورد في المصادر المرفقة وتوثيق كل شاهد بالكتاب والجزء والصفحة.`;

  return { systemInstruction, promptContent };
}

/**
 * 6. Built-In 100% Free Scholarly Composer Engine (0 API Credits, Never Interrupts)
 * Composes rich, structured, mode-authentic Arabic responses directly from the retrieved Encyclopedia texts!
 */
export function composeGroundedScholarlyResponse(params: {
  question: string;
  coreTopic: string;
  searchQuery: string;
  mode: Exclude<AIChatMode, 'auto'>;
  matchedBook: CatalogBook | null;
  bookMetaAndToc?: { details?: any; toc?: any } | null;
  pages: any[];
  fatawa: any[];
  totalBookHits: number;
  totalFatwaHits: number;
}): string {
  const {
    question,
    coreTopic,
    searchQuery,
    mode,
    matchedBook,
    bookMetaAndToc,
    pages,
    fatawa,
    totalBookHits,
    totalFatwaHits,
  } = params;

  const cleanAndVocalize = (raw: string, maxLen = 700): string => {
    const cleaned = String(raw || '')
      .replace(/<\/?mark[^>]*>/gi, '')
      .replace(/\s+/g, ' ')
      .trim();
    if (!cleaned) return '';
    const sliced = cleaned.slice(0, maxLen);
    const vocalized = proofreadAndVocalizeArabic(sliced, {
      fixTypos: true,
      applyTashkeel: true,
    }).text;
    return `${vocalized}${cleaned.length > maxLen ? '...' : ''}`;
  };

  const getNumberingLabel = (p: any) =>
    p.numbering === 'printed' || p.citable || p.numbering_declared === 'موافق للمطبوع'
      ? 'موافق للمطبوع'
      : 'ترقيم آلي متسلسل';

  // ============================================================================
  // CASE 1: BOOK SUMMARY OR BOOK-SCOPED DISCUSSION (ملخص كتاب أو نقاش محصور في كتاب)
  // ============================================================================
  if (mode === 'book_summary' || (matchedBook && pages.length === 0 && bookMetaAndToc)) {
    if (!matchedBook && pages.length === 0) {
      return (
        `لم يتم العثور على كتاب مطابق لعنوان («${coreTopic}») في فهرس الموسوعة.\n` +
        `💡 نصيحة: يمكنك اختيار الكتاب مباشرة من قائمة «تحديد كتاب من الموسوعة» أعلى المحادثة، أو كتابة الاسم المشهور للكتاب مثل: «لخص لي كتاب قواعد الإسلام» أو «ملخص كتاب تمهيد قواعد الإيمان» أو «ملخص كتاب بهجة الأنوار».`
      );
    }

    const lines: string[] = [];
    const targetTitle = matchedBook?.title || pages[0]?.book_name || coreTopic;
    const targetAuthor = matchedBook?.author || pages[0]?.author_name || 'من علماء الموسوعة';
    const targetCategory = matchedBook?.category || pages[0]?.category || 'التراث الإسلامي';
    const targetEra = matchedBook?.era || '';
    const tocEntries: any[] = bookMetaAndToc?.toc?.entries || [];
    const totalPagesCount =
      bookMetaAndToc?.toc?.pages_total || matchedBook?.pagesCount || pages.length;

    lines.push(`📘 ملخص وتعريف شامل بكتاب: «${targetTitle}»`);
    lines.push(`(معتمد حصرياً على بيانات وفهرس ومتن الكتاب في الموسوعة الإباضية)`);
    lines.push('');
    lines.push('أولاً: البطاقة التعريفية بالكتاب والمؤلف:');
    lines.push(`• عنوان الكتاب: ${targetTitle}`);
    lines.push(`• المؤلف: ${targetAuthor}${targetEra ? ` (${targetEra})` : ''}`);
    lines.push(`• القسم العلمي في الموسوعة: ${targetCategory}`);
    if (totalPagesCount) {
      lines.push(`• عدد صفحات الكتاب المفهرسة: ${Number(totalPagesCount).toLocaleString('ar-EG')} صفحة`);
    }
    if (bookMetaAndToc?.details?.publication) {
      lines.push(
        `• بيانات الطبعة والنشر: ${String(bookMetaAndToc.details.publication).replace(/\s+/g, ' ').trim()}`
      );
    }
    lines.push('');

    lines.push('ثانياً: موضوع الكتاب ومنهجه العلمي:');
    lines.push(
      `• يُعدّ كتاب «${targetTitle}» للإمام/العالم (${targetAuthor}) من المصادر المعتمدة في قسم (${targetCategory}) بالموسوعة الإباضية، وقد اعتنى فيه مؤلفه بتأصيل مسائل هذا العلم وتحرير أبوابه وفصوله بأسلوب علمي رصين مستند إلى الأدلة الشرعية وأقوال أئمة المذهب.`
    );
    lines.push('');

    if (tocEntries.length > 0) {
      lines.push(
        `ثالثاً: هيكلة الكتاب وأبرز أبوابه وفصوله (من فهرس الكتاب المعتمد — ${tocEntries.length.toLocaleString(
          'ar-EG'
        )} عنواناً):`
      );
      tocEntries.slice(0, 22).forEach((entry, idx) => {
        lines.push(`${idx + 1}. ${entry.title} (ص ${entry.page_id})`);
      });
      if (tocEntries.length > 22) {
        lines.push(`... بالإضافة إلى (${tocEntries.length - 22}) باباً وفصلاً أخرى مفصلة داخل الكتاب.`);
      }
      lines.push('');
    }

    if (pages.length > 0) {
      lines.push('رابعاً: مقتطفات ونماذج علمية موثقة من صفحات الكتاب:');
      pages.slice(0, 5).forEach((p, idx) => {
        const excerpt = cleanAndVocalize(p.fullBody || p.snippet, 650);
        lines.push(
          `${idx + 1}. من كتاب (${p.book_name}، ج ${p.part || 1}، ص ${p.page_number} — ${getNumberingLabel(
            p
          )}):`
        );
        lines.push(`«${excerpt}»`);
        lines.push('');
      });
    }

    return lines.join('\n');
  }

  // If no relevant pages or fatawa matched the strict relevance filter:
  if (pages.length === 0 && fatawa.length === 0) {
    if (matchedBook) {
      return (
        `لم أجد في صفحات كتاب «${matchedBook.title}» نصاً يتناول موضوع («${coreTopic}») بعينه.\n` +
        `• يمكنك سؤال المساعد عن موضوع آخر من موضوعات كتاب «${matchedBook.title}»، أو طلب «لخص لي هذا الكتاب» لاستعراض جميع أبوابه وفصوله، أو إلغاء حصر الكتاب للبحث في كافة كتب الموسوعة.`
      );
    }
    return (
      `حرصاً على الدقة العلمية التامة وعدم الإتيان بإجابات عشوائية خارج كتب الموسوعة:\n` +
      `لم يُعثر في متون وفتاوى الموسوعة على نصوص مطابقة بشكل مباشر لعبارة («${coreTopic}»).\n\n` +
      `💡 مقترحات للوصول الدقيق للمطلوب:\n` +
      `1. جرّب صياغة الموضوع بمصطلحه الفقهي أو الشرعي المشهور في كتب التراث (مثل: «زكاة الحلي»، «صلاة المسافر»، «بر الوالدين»، «أحكام الربا»).\n` +
      `2. إذا كنت تسأل عن كتاب معيّن، اختر الكتاب من زر «تحديد كتاب» أعلى الدردشة ثم اطلب تلخيصه أو مناقشته.`
    );
  }

  const uniqueBooks = Array.from(new Set(pages.map((p) => p.book_name).filter(Boolean)));
  const uniqueAuthors = Array.from(new Set(pages.map((p) => p.author_name).filter(Boolean)));

  // ============================================================================
  // CASE 2: FRIDAY SERMON MODE (خطبة جمعة منبرية بأسلوب الخطبة)
  // ============================================================================
  if (mode === 'khutbah') {
    const lines: string[] = [];
    lines.push(`🕌 خطبة جمعة منبرية بعنوان: «${coreTopic}»`);
    lines.push(
      matchedBook
        ? `(مُعدّة بالاعتماد الحصري على كتاب «${matchedBook.title}» — ${matchedBook.author})`
        : `(مُعدّة ومؤصلة حصرياً من متون وفتاوى الموسوعة الإباضية)`
    );
    lines.push('════════════════════════════════════════');
    lines.push('');
    lines.push('🎙️ 【 الخطبة الأولى 】');
    lines.push('');
    lines.push(
      'إِنَّ الْحَمْدَ لِلَّهِ، نَحْمَدُهُ وَنَسْتَعِينُهُ وَنَسْتَغْفِرُهُ، وَنَعُوذُ بِاللَّهِ مِنْ شُرُورِ أَنْفُسِنَا وَمِنْ سَيِّئَاتِ أَعْمَالِنَا، مَنْ يَهْدِهِ اللَّهُ فَلَا مُضِلَّ لَهُ، وَمَنْ يُضْلِلْ فَلَا هَادِيَ لَهُ، وَأَشْهَدُ أَنْ لَا إِلَهَ إِلَّا اللَّهُ وَحْدَهُ لَا شَرِيكَ لَهُ، وَأَشْهَدُ أَنَّ سَيِّدَنَا وَنَبِيَّنَا مُحَمَّدًا عَبْدُهُ وَرَسُولُهُ، صَلَّى اللَّهُ عَلَيْهِ وَعَلَى آلِهِ وَصَحْبِهِ وَمَنْ تَبِعَهُمْ بِإِحْسَانٍ إِلَى يَوْمِ الدِّينِ.'
    );
    lines.push('');
    lines.push(
      `أَمَّا بَعْدُ؛ فَيَا عِبَادَ اللَّهِ: أُوصِيكُمْ وَنَفْسِيَ الْمُقَصِّرَةَ بِتَقْوَى اللَّهِ عَزَّ وَجَلَّ فِي السِّرِّ وَالْعَلَانِيَةِ، فَإِنَّ تَقْوَى اللَّهِ هِيَ الْعُرْوَةُ الْوُثْقَى وَالذُّخْرُ الْأَبْقَى. أَيُّهَا الْمُؤْمِنُونَ: إِنَّ مِنْ أَعْظَمِ مَا يَجِبُ التَّذْكِيرُ بِهِ وَالْوُقُوفُ عِنْدَ هِدَايَاتِهِ وَأَحْكَامِهِ مَسْأَلَةَ: «${coreTopic}».`
    );
    lines.push('');

    if (pages.length > 0) {
      lines.push('أَيُّهَا الْمُسْلِمُونَ:');
      pages.slice(0, 4).forEach((p, idx) => {
        const excerpt = cleanAndVocalize(p.fullBody || p.snippet, 650);
        const introConnectors = [
          'لَقَدْ بَيَّنَ عُلَمَاءُ الْإِسْلَامِ فِي مَوْسُوعَتِنَا الْعِلْمِيَّةِ هَذَا الْأَمْرَ بَيَانًا شَافِيًا؛ فَقَدْ جَاءَ',
          'وَمِمَّا يُؤَكِّدُ هَذَا الْمَعْنَى الْعَظِيمَ يَا عِبَادَ اللَّهِ مَا قَرَّرَهُ أَئِمَّةُ الْهُدَى',
          'وَفِي تَفْصِيلِ هَذَا الْبَابِ وَبَيَانِ حَقَائِقِهِ نَقْرَأُ مَا سَطَّرَهُ الْعُلَمَاءُ',
          'وَتَأَمَّلُوا رَحِمَكُمُ اللَّهُ فِي هَذَا التَّأْصِيلِ السَّدِيدِ الَّذِي وَرَدَ',
        ];
        const connector = introConnectors[idx % introConnectors.length];
        lines.push(
          `${connector} فِي كِتَابِ (${p.book_name}) لِلْمُؤَلِّفِ (${p.author_name}، ج ${
            p.part || 1
          }، ص ${p.page_number}):`
        );
        lines.push(`«${excerpt}»`);
        lines.push('');
      });
    }

    lines.push(
      'فَاتَّقُوا اللَّهَ عِبَادَ اللَّهِ، وَخُذُوا بِهَذِهِ الْآدَابِ وَالْأَحْكَامِ الشَّرْعِيَّةِ فِي حَيَاتِكُمْ وَمُعَامَلَاتِكُمْ. بَارَكَ اللَّهُ لِي وَلَكُمْ فِي الْقُرْآنِ الْعَظِيمِ، وَنَفَعَنِي وَإِيَّاكُمْ بِمَا فِيهِ مِنَ الْآيَاتِ وَالذِّكْرِ الْحَكِيمِ، أَقُولُ قَوْلِي هَذَا وَأَسْتَغْفِرُ اللَّهَ الْعَظِيمَ لِي وَلَكُمْ وَلِسَائِرِ الْمُسْلِمِينَ، فَاسْتَغْفِرُوهُ إِنَّهُ هُوَ الْغَفُورُ الرَّحِيمُ.'
    );
    lines.push('');
    lines.push('────────────────────────────────────────');
    lines.push('🎙️ 【 الخطبة الثانية 】');
    lines.push('');
    lines.push(
      'الْحَمْدُ لِلَّهِ رَبِّ الْعَالَمِينَ، وَالْعَاقِبَةُ لِلْمُتَّقِينَ، وَلَا عُدْوَانَ إِلَّا عَلَى الظَّالِمِينَ، وَأَشْهَدُ أَنْ لَا إِلَهَ إِلَّا اللَّهُ وَلِيُّ الصَّالِحِينَ، وَأَشْهَدُ أَنَّ سَيِّدَنَا مُحَمَّدًا عَبْدُهُ وَرَسُولُهُ الصَّادِقُ الْأَمِينُ، صَلَوَاتُ اللَّهِ وَسَلَامُهُ عَلَيْهِ وَعَلَى آلِهِ وَأَصْحَابِهِ أَجْمَعِينَ.'
    );
    lines.push('');
    lines.push(`أَمَّا بَعْدُ؛ فَيَا عِبَادَ اللَّهِ: إِنَّ تَطْبِيقَ أَحْكَامِ الشَّرِيعَةِ فِي («${coreTopic}») يَقْتَضِي مِنَّا الْفِقْهَ فِي الدِّينِ وَالْبَصِيرَةَ بِالْأَحْكَامِ:`);

    if (fatawa.length > 0) {
      fatawa.slice(0, 2).forEach((f) => {
        const excerpt = cleanAndVocalize(f.answer || f.answer_excerpt, 500);
        lines.push(
          `• وَقَدْ وَرَدَ فِي فَتَاوَى عُلَمَائِنَا (${f.title} — لِلْمُفْتِي: ${
            f.mufti?.name || 'غير محدد'
          }، فتوى رقم #${f.fatwa_id}):`
        );
        lines.push(`«${excerpt}»`);
        lines.push('');
      });
    } else if (pages.length > 4) {
      pages.slice(4, 6).forEach((p) => {
        const excerpt = cleanAndVocalize(p.fullBody || p.snippet, 500);
        lines.push(`• وَجَاءَ فِي كِتَابِ (${p.book_name} — ${p.author_name}، ج ${p.part || 1}، ص ${p.page_number}):`);
        lines.push(`«${excerpt}»`);
        lines.push('');
      });
    }

    lines.push(
      'اللَّهُمَّ فَقِّهْنَا فِي الدِّينِ، وَعَلِّمْنَا التَّأْوِيلَ، وَاهْدِنَا لِأَحْسَنِ الْأَخْلَاقِ وَالْأَعْمَالِ لَا يَهْدِي لِأَحْسَنِهَا إِلَّا أَنْتَ، اللَّهُمَّ اغْفِرْ لِلْمُؤْمِنِينَ وَالْمُؤْمِنَاتِ، وَالْمُسْلِمِينَ وَالْمُسْلِمَاتِ، الْأَحْيَاءِ مِنْهُمْ وَالْأَمْوَاتِ، إِنَّكَ سَمِيعٌ قَرِيبٌ مُجِيبُ الدَّعَوَاتِ. عِبَادَ اللَّهِ: إِنَّ اللَّهَ يَأْمُرُ بِالْعَدْلِ وَالْإِحْسَانِ وَإِيتَاءِ ذِي الْقُرْبَى وَيَنْهَى عَنِ الْفَحْشَاءِ وَالْمُنْكَرِ وَالْبَغْيِ يَعِظُكُمْ لَعَلَّكُمْ تَذَكَّرُونَ.'
    );
    lines.push('');
    lines.push('📚 المصادر المعتمدة في إعداد الخطبة من الموسوعة:');
    pages.slice(0, 6).forEach((p, idx) => {
      lines.push(
        `- [${idx + 1}] ${p.book_name} — ${p.author_name}، ج ${p.part || 1}، ص ${
          p.page_number
        } (${getNumberingLabel(p)}).`
      );
    });
    return lines.join('\n');
  }

  // ============================================================================
  // CASE 3: COMPREHENSIVE LESSON MODE (درس علمي شامل)
  // ============================================================================
  if (mode === 'lesson') {
    const lines: string[] = [];
    lines.push(`🎓 درس علمي شامل بعنوان: «${coreTopic}»`);
    lines.push(
      matchedBook
        ? `(مُستخرج حصرياً من كتاب «${matchedBook.title}» — للمؤلف: ${matchedBook.author})`
        : `(مُؤصل من متون وفتاوى الموسوعة الإباضية — ${uniqueBooks.slice(0, 4).join('، ')})`
    );
    lines.push('════════════════════════════════════════');
    lines.push('');
    lines.push('📌 أولاً: تمهيد الدرس ومحاوره العلمية:');
    lines.push(
      `يتناول هذا الدرس العلمي موضوع («${coreTopic}») بالاستناد الكلي إلى ما قرّره علماء الموسوعة الإباضية في مصنفاتهم وفتاواهم، دون خروج عن النصوص المعتمدة، وذلك عبر المحاور الآتية:`
    );
    lines.push('١. التأصيل العلمي والنصوص الواردة في أمهات الكتب.');
    lines.push('٢. التفصيل الفقهي والفتاوى التطبيقية ذات الصلة.');
    lines.push('٣. الخلاصة والفوائد العلمية المستنبطة لطلبة العلم.');
    lines.push('');

    if (pages.length > 0) {
      lines.push('📖 ثانياً: التأصيل العلمي والشواهد من المتون:');
      pages.slice(0, 5).forEach((p, idx) => {
        const excerpt = cleanAndVocalize(p.fullBody || p.snippet, 680);
        lines.push(
          `العنصر (${idx + 1}) — من كتاب «${p.book_name}» للمؤلف (${p.author_name}، ج ${
            p.part || 1
          }، ص ${p.page_number} - ${getNumberingLabel(p)}):`
        );
        lines.push(`«${excerpt}»`);
        if (p.fullFoot && String(p.fullFoot).trim().length > 10) {
          lines.push(`   • بيان الحاشية: «${cleanAndVocalize(p.fullFoot, 300)}»`);
        }
        lines.push('');
      });
    }

    if (fatawa.length > 0) {
      lines.push('⚖️ ثالثاً: المسائل التطبيقية والفتاوى الشرعية في الموضوع:');
      fatawa.slice(0, 3).forEach((f, idx) => {
        const excerpt = cleanAndVocalize(f.answer || f.answer_excerpt, 550);
        lines.push(
          `المسألة (${idx + 1}) — ${f.title} (المفتي: ${f.mufti?.name || 'غير محدد'} — فتوى رقم #${
            f.fatwa_id
          }):`
        );
        if (f.question || f.question_excerpt) {
          lines.push(`   • السؤال: ${cleanAndVocalize(f.question || f.question_excerpt, 220)}`);
        }
        lines.push(`   • الجواب والتفصيل: «${excerpt}»`);
        lines.push('');
      });
    }

    lines.push('💡 رابعاً: خلاصة الدرس والمراجع المعتمدة:');
    lines.push(
      `• تضافرت نصوص العلماء (${uniqueAuthors.slice(0, 4).join('، ')}) على بيان أحكام وضوابط («${coreTopic}») كما تقدم في الشواهد الموثقة أعلاه.`
    );
    pages.slice(0, 6).forEach((p, idx) => {
      lines.push(
        `- المرجع [${idx + 1}]: ${p.book_name} — ${p.author_name}، ج ${p.part || 1}، ص ${
          p.page_number
        } (${getNumberingLabel(p)}).`
      );
    });

    return lines.join('\n');
  }

  // ============================================================================
  // CASE 4: SCHOLARLY ARTICLE MODE (مقال علمي مؤصل)
  // ============================================================================
  if (mode === 'article') {
    const lines: string[] = [];
    lines.push(`✒️ مقال علمي مؤصل: «${coreTopic} في ضوء تراث الموسوعة الإباضية»`);
    if (matchedBook) {
      lines.push(`(قراءة علمية خاصة في كتاب «${matchedBook.title}» — ${matchedBook.author})`);
    }
    lines.push('════════════════════════════════════════');
    lines.push('');
    lines.push('▪ مقدمة المقال:');
    lines.push(
      `يُشكّل موضوع («${coreTopic}») أحد المباحث المهمة التي حظيت بعناية فائقة في المصنفات الإسلامية بالموسوعة الإباضية؛ حيث تناوله العلماء بالبيان والتأصيل والتحرير في (${totalBookHits.toLocaleString(
        'ar-EG'
      )}) موضعاً نصياً${
        !matchedBook ? ` و(${totalFatwaHits.toLocaleString('ar-EG')}) فتوى شرعية` : ''
      }. وفي هذا المقال نستجلي أبرز ما سطّره الأئمة والعلماء في هذا الموضع بالاقتصار الأمين على نصوصهم الموثقة.`
    );
    lines.push('');

    if (pages.length > 0) {
      lines.push('▪ المحور الأول: التأصيل والتحرير في متون الكتب:');
      pages.slice(0, 5).forEach((p, idx) => {
        const excerpt = cleanAndVocalize(p.fullBody || p.snippet, 680);
        lines.push(
          `${idx + 1}- يقرر العالم (${p.author_name}) في كتابه «${p.book_name}» (ج ${
            p.part || 1
          }، ص ${p.page_number} — ${getNumberingLabel(p)}) ما نصه:`
        );
        lines.push(`«${excerpt}»`);
        lines.push('');
      });
    }

    if (fatawa.length > 0) {
      lines.push('▪ المحور الثاني: الإفتاء والتطبيقات الفقهية:');
      fatawa.slice(0, 3).forEach((f, idx) => {
        const excerpt = cleanAndVocalize(f.answer || f.answer_excerpt, 550);
        lines.push(
          `${idx + 1}- وفي خزانة الفتاوى، جاء في فتوى بعنوان «${f.title}» للمفتي (${
            f.mufti?.name || 'غير محدد'
          }، رقم #${f.fatwa_id}):`
        );
        lines.push(`«${excerpt}»`);
        lines.push('');
      });
    }

    lines.push('▪ خاتمة المقال وتوثيق المصادر:');
    lines.push(
      `يتبين مما سبق دقة التأصيل العلمي لموضوع («${coreTopic}») في كتب الموسوعة، وفيما يلي ثبت المصادر التي اعتمد عليها المقال:`
    );
    pages.slice(0, 6).forEach((p, idx) => {
      lines.push(
        `- [${idx + 1}] ${p.book_name} — ${p.author_name}، ج ${p.part || 1}، ص ${
          p.page_number
        } (${getNumberingLabel(p)}).`
      );
    });

    return lines.join('\n');
  }

  // ============================================================================
  // CASE 5: TAFSIR & HADITH EXPLANATION MODE (تفسير آية أو شرح حديث)
  // ============================================================================
  if (mode === 'tafsir_hadith') {
    const lines: string[] = [];
    lines.push(`📖 التفسير والبيان العلمي من الموسوعة لـ: «${coreTopic}»`);
    if (matchedBook) {
      lines.push(`(مُستخرج حصرياً من كتاب «${matchedBook.title}» — ${matchedBook.author})`);
    }
    lines.push('════════════════════════════════════════');
    lines.push('');

    if (pages.length > 0) {
      lines.push('أولاً: أقوال المفسرين والشراح والعلماء في كتب الموسوعة:');
      pages.slice(0, 5).forEach((p, idx) => {
        const excerpt = cleanAndVocalize(p.fullBody || p.snippet, 700);
        lines.push(
          `${idx + 1}. في كتاب «${p.book_name}» للمؤلف (${p.author_name}، القسم: ${
            p.category || 'التفسير والحديث'
          }، ج ${p.part || 1}، ص ${p.page_number} — ${getNumberingLabel(p)}):`
        );
        lines.push(`«${excerpt}»`);
        if (p.fullFoot && String(p.fullFoot).trim().length > 10) {
          lines.push(`   • الحاشية والتخريج: «${cleanAndVocalize(p.fullFoot, 320)}»`);
        }
        lines.push('');
      });
    }

    if (fatawa.length > 0) {
      lines.push('ثانياً: الفوائد والأحكام المستنبطة في فتاوى العلماء:');
      fatawa.slice(0, 3).forEach((f, idx) => {
        const excerpt = cleanAndVocalize(f.answer || f.answer_excerpt, 550);
        lines.push(
          `${idx + 1}. فتوى «${f.title}» — المفتي: ${f.mufti?.name || 'غير محدد'} (رقم #${f.fatwa_id}):`
        );
        lines.push(`«${excerpt}»`);
        lines.push('');
      });
    }

    lines.push('ثالثاً: توثيق المراجع المعتمدة:');
    pages.slice(0, 6).forEach((p, idx) => {
      lines.push(
        `- [${idx + 1}] ${p.book_name} — ${p.author_name}، ج ${p.part || 1}، ص ${
          p.page_number
        } (${getNumberingLabel(p)}).`
      );
    });

    return lines.join('\n');
  }

  // ============================================================================
  // CASE 6: DIRECT SCHOLARLY CHAT & Q&A (حوار وسؤال علمي دقيق)
  // ============================================================================
  const lines: string[] = [];
  lines.push(`📌 الإجابة العلمية الموثقة حول: «${coreTopic || question}»`);
  if (matchedBook) {
    lines.push(
      `• تم استقراء الإجابة حصرياً من كتاب «${matchedBook.title}» للمؤلف (${matchedBook.author}) دون الخروج عنه.`
    );
  } else {
    lines.push(
      `• تم استقراء المتون والفتاوى المفهرسة بدقة لعبارة («${searchQuery}»)، بالاعتماد الحصري على مصادر الموسوعة (${uniqueBooks
        .slice(0, 4)
        .join('، ')}).`
    );
  }
  lines.push('');

  if (pages.length > 0) {
    lines.push('أولاً: النصوص والتفصيل العلمي من بطون الكتب (مع العزو للجزء والصفحة):');
    pages.slice(0, 5).forEach((p, idx) => {
      const excerpt = cleanAndVocalize(p.fullBody || p.snippet, 680);
      lines.push(
        `${idx + 1}. في كتاب (${p.book_name} — ${p.author_name}${
          p.author_death ? `، ت ${p.author_death}` : ''
        }، ج ${p.part || 1}، ص ${p.page_number} - ${getNumberingLabel(p)}):`
      );
      lines.push(`«${excerpt}»`);
      if (p.fullFoot && String(p.fullFoot).trim().length > 10) {
        lines.push(`   • وجاء في الحاشية: «${cleanAndVocalize(p.fullFoot, 300)}»`);
      }
      lines.push('');
    });
  }

  if (fatawa.length > 0 && !matchedBook) {
    lines.push('ثانياً: الفتاوى الشرعية ذات الصلة من خزانة الفتاوى:');
    fatawa.slice(0, 3).forEach((f, idx) => {
      const muftiName = f.mufti?.name || 'غير محدد';
      const excerpt = cleanAndVocalize(f.answer || f.answer_excerpt, 550);
      lines.push(`${idx + 1}. (${f.title} — فتوى رقم ${f.fatwa_id} — المفتي: ${muftiName}):`);
      if (f.question || f.question_excerpt) {
        lines.push(`   • السؤال: ${cleanAndVocalize(f.question || f.question_excerpt, 220)}`);
      }
      lines.push(`   • خلاصة الجواب: «${excerpt}»`);
      lines.push('');
    });
  }

  lines.push('ثالثاً: الفهرس التوثيقي للمصادر المعتمدة:');
  pages.slice(0, 6).forEach((p, idx) => {
    lines.push(
      `- [${idx + 1}] ${p.book_name} — ${p.author_name}، القسم: ${p.category || 'عام'}، ج ${
        p.part || 1
      }، ص ${p.page_number} (${getNumberingLabel(p)}).`
    );
  });
  if (!matchedBook) {
    fatawa.slice(0, 3).forEach((f) => {
      lines.push(`- [فتوى #${f.fatwa_id}] ${f.title} — المفتي: ${f.mufti?.name || 'غير محدد'}.`);
    });
  }

  return lines.join('\n');
}

/**
 * 7. Generate smart contextual follow-up prompts for the interactive chat
 */
export function buildFollowUpSuggestions(
  coreTopic: string,
  mode: Exclude<AIChatMode, 'auto'>,
  matchedBook: CatalogBook | null
): string[] {
  if (matchedBook) {
    return [
      `لخص لي أهم أبواب وموضوعات كتاب ${matchedBook.title}`,
      `ما هو منهج المؤلف ${matchedBook.author} في هذا الكتاب؟`,
      `اكتب لي درساً علمياً مستخلصاً من كتاب ${matchedBook.title}`,
      `اكتب لي مقالاً علمياً يجمع أبرز فوائد كتاب ${matchedBook.title}`,
    ];
  }

  const topic = coreTopic.slice(0, 35);
  const suggestions: string[] = [];

  if (mode !== 'khutbah') {
    suggestions.push(`اكتب لي خطبة جمعة منبرية عن ${topic}`);
  }
  if (mode !== 'lesson') {
    suggestions.push(`اكتب لي درساً علمياً شاملاً في موضوع ${topic}`);
  }
  if (mode !== 'article') {
    suggestions.push(`اكتب لي مقالاً علمياً مؤصلاً عن ${topic}`);
  }
  if (mode !== 'chat') {
    suggestions.push(`ما هي أبرز الفتاوى والأحكام التفصيلية في ${topic}؟`);
  }

  return suggestions.slice(0, 3);
}
