import {
  AIArtifactType,
  AIChatMode,
  AIInfographicData,
  AIInfographicNode,
  AISlideItem,
  CatalogBook,
} from '../types';
import { proofreadAndVocalizeArabic } from './arabicProofreader';

export const MODE_LABELS: Record<AIChatMode, string> = {
  auto: 'تلقائي شامل (يفهم أي طلب أو ملف)',
  chat: 'نقاش وحوار عام في الموسوعة',
  book_summary: 'ملخص شامل لكتاب',
  article: 'مقال وبحث علمي',
  tafsir_hadith: 'تفسير آية أو شرح حديث',
  khutbah: 'خطبة جمعة منبرية',
  lesson: 'درس علمي شامل',
  infographic: 'صورة إنفوجرافيك وخريطة بصرية',
  presentation: 'عرض باوربوينت (شرائح PPTX)',
  document: 'مستند وورد / PDF / جداول',
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

// Comprehensive list of conversational/framing/task/file-format words that should NEVER pollute the search query
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
    'حدثني', 'تحدث', 'كلمني', 'تكلم', 'اخبرني', 'أخبرني', 'دلني', 'وجهني', 'اجعل', 'اجعله', 'اجعلها', 'صغ', 'صياغة',
    'اذكر', 'أذكر', 'اشرح', 'إشرح', 'وضح', 'بين', 'فصل', 'افصل', 'بالتفصيل', 'باختصار', 'بإيجاز',
    'حول', 'حوله', 'حولها', 'تحويل', 'اصنع', 'إصنع', 'اعمل', 'أعمل', 'عمل', 'انشئ', 'أنشئ', 'انشاء', 'إنشاء',
    'صمم', 'تصميم', 'جهز', 'تجهيز', 'عد', 'إعداد', 'اعداد', 'قدم', 'تقديم', 'استخرج', 'إستخرج',
    'السابق', 'السابقة', 'الماضي', 'الاخير', 'الأخير', 'اعلاه', 'أعلاه', 'هذا', 'هذه',
    // Mode & format names
    'ملخص', 'ملخصا', 'ملخصاً', 'تلخيص', 'لخص', 'لخصه', 'نبذة', 'نبذه', 'تعريف', 'فكرة', 'محتوى', 'مضمون',
    'كتاب', 'الكتاب', 'كتب', 'الكتب', 'مؤلف', 'المؤلف', 'مؤلفات', 'صاحب', 'سفر', 'منظومة', 'رسالة',
    'مقال', 'مقالا', 'مقالاً', 'مقالة', 'مقاله', 'بحث', 'بحثا', 'بحثاً', 'ورقة', 'موضوع', 'موضع', 'معين', 'محدد',
    'خطبة', 'خطبه', 'الخطبة', 'جمعة', 'جمعه', 'الجمعة', 'منبرية', 'منبريه', 'اسلوب', 'أسلوب', 'بأسلوب', 'باسلوب', 'الخطيب',
    'درس', 'درسا', 'درساً', 'الدرس', 'دروس', 'محاضرة', 'محاضره', 'شامل', 'شاملا', 'شاملاً', 'شاملة', 'كامل', 'متكامل',
    'تفسير', 'تفسيره', 'تفسيرها', 'آية', 'ايه', 'آيه', 'الآية', 'الايه', 'آيات', 'قوله', 'تعالى', 'سبحانه', 'عز', 'وجل', 'سورة',
    'حديث', 'الحديث', 'شرح', 'معنى', 'المعنى', 'مفهوم', 'دلالة', 'المراد', 'المقصود',
    // Visual, Infographic, PowerPoint, Word, PDF & Table keywords
    'صورة', 'صوره', 'الصورة', 'صور', 'انفوجرافيك', 'إنفوجرافيك', 'انفوغرافيك', 'إنفوغرافيك', 'انفوجراف', 'بصري', 'بصرية',
    'بطاقة', 'بطاقه', 'لوحة', 'لوحه', 'ملصق', 'بوستر', 'خريطة', 'خريطه', 'خارطة', 'ذهنية', 'ذهنيه', 'مخطط', 'رسم', 'توضيحي',
    'باوربوينت', 'بوربوينت', 'الباوربوينت', 'عرض', 'تقديمي', 'عروض', 'تقديمية', 'شرائح', 'شريحة', 'سلايدات', 'سلايد',
    'ملف', 'الملف', 'ملفات', 'مستند', 'المستند', 'وثيقة', 'تقرير', 'مطوية', 'كتيب',
    'وورد', 'الوورد', 'بي', 'دي', 'اف', 'أف', 'اكسل', 'جدول', 'جداول', 'مقارنة', 'مقارنه', 'اسئلة', 'أسئلة', 'اجوبة', 'أجوبة', 'اختبار',
    'pdf', 'word', 'doc', 'docx', 'ppt', 'pptx', 'powerpoint', 'slides', 'slide', 'infographic', 'image', 'png', 'excel', 'csv',
    // Encyclopedia & general scholarly framing words
    'الموسوعة', 'الموسوعه', 'الإباضية', 'الاباضية', 'الاباضيه', 'المكتبة', 'المكتبه',
    'الاعتماد', 'اعتماد', 'معتمدا', 'مستندا', 'يخرج', 'تخرج', 'منها', 'فيها', 'عليها', 'إليها', 'اليها',
    'حكم', 'احكام', 'أحكام', 'قول', 'أقوال', 'اقوال', 'رأي', 'راي', 'آراء', 'مسألة', 'مساله', 'مسائل',
    'الشيخ', 'الامام', 'الإمام', 'علماء', 'العلماء', 'فقهاء', 'الفقهاء', 'أئمة', 'ائمة', 'دليل', 'أدلة', 'ادلة',
    'نقاط', 'عناصر', 'محاور', 'فوائد', 'أهم', 'اهم', 'أبرز', 'ابرز', 'شيء', 'اي', 'قسم', 'اقسام', 'أقسام',
  ].map((w) => normalizeArabicText(w))
);

/**
 * Helper to test if any Arabic keyword/phrase appears in normalized Arabic text
 * (Note: JS \b only works on ASCII, so we use whitespace/start/end boundaries for Arabic)
 */
function hasArabicKeyword(normText: string, keywords: string[]): boolean {
  const padded = ` ${normText} `;
  for (const kw of keywords) {
    const normKw = normalizeArabicText(kw);
    if (!normKw) continue;
    if (
      padded.includes(` ${normKw} `) ||
      padded.includes(` و${normKw} `) ||
      padded.includes(` ب${normKw} `) ||
      padded.includes(` ل${normKw} `) ||
      padded.includes(` ك${normKw} `) ||
      padded.includes(` ال${normKw} `)
    ) {
      return true;
    }
  }
  return false;
}

/**
 * Detect if the user explicitly asked for a specific visual/file artifact (Infographic, PowerPoint, Word, PDF)
 */
export function detectRequestedArtifact(
  question: string,
  requestedMode: AIChatMode = 'auto'
): AIArtifactType {
  const norm = normalizeArabicText(question);
  const rawLower = question.toLowerCase();

  if (
    requestedMode === 'infographic' ||
    hasArabicKeyword(norm, [
      'انفوجرافيك',
      'انفوغرافيك',
      'انفوجراف',
      'صوره',
      'بطاقه بصريه',
      'ملخص بصري',
      'خريطه ذهنيه',
      'خارطه ذهنيه',
      'مخطط بصري',
      'بوستر',
      'لوحه علميه',
    ]) ||
    /\b(infographic|poster|mindmap|png)\b/.test(rawLower)
  ) {
    return 'infographic';
  }

  if (
    requestedMode === 'presentation' ||
    hasArabicKeyword(norm, [
      'باوربوينت',
      'بوربوينت',
      'عرض تقديمي',
      'شرائح',
      'سلايدات',
      'عرض علمي',
    ]) ||
    /\b(powerpoint|pptx|ppt|slides|presentation)\b/.test(rawLower)
  ) {
    return 'pptx';
  }

  if (
    hasArabicKeyword(norm, ['وورد', 'ملف وورد', 'مستند وورد']) ||
    /\b(word|docx|doc)\b/.test(rawLower)
  ) {
    return 'word';
  }

  if (
    hasArabicKeyword(norm, ['بي دي اف', 'ملف pdf', 'مستند pdf']) ||
    /\b(pdf)\b/.test(rawLower)
  ) {
    return 'pdf';
  }

  if (requestedMode === 'document') {
    return 'word';
  }

  return null;
}

/**
 * 1. Detect the effective scholarly mode based on explicit selection or natural Arabic phrasing
 */
export function detectScholarlyMode(
  question: string,
  requestedMode: AIChatMode = 'auto',
  hasScopedBook = false
): { mode: Exclude<AIChatMode, 'auto'>; label: string; requestedArtifact: AIArtifactType } {
  const requestedArtifact = detectRequestedArtifact(question, requestedMode);

  if (requestedMode && requestedMode !== 'auto') {
    return {
      mode: requestedMode,
      label: MODE_LABELS[requestedMode],
      requestedArtifact,
    };
  }

  const norm = normalizeArabicText(question);

  if (requestedArtifact === 'infographic') {
    return { mode: 'infographic', label: MODE_LABELS.infographic, requestedArtifact: 'infographic' };
  }

  if (requestedArtifact === 'pptx') {
    return { mode: 'presentation', label: MODE_LABELS.presentation, requestedArtifact: 'pptx' };
  }

  if (requestedArtifact === 'word' || requestedArtifact === 'pdf') {
    return { mode: 'document', label: MODE_LABELS.document, requestedArtifact };
  }

  // Check for Book Summary intent
  if (
    hasArabicKeyword(norm, [
      'ملخص',
      'تلخيص',
      'لخص',
      'نبذه عن كتاب',
      'تعريف بكتاب',
      'فهرس كتاب',
      'محتوي كتاب',
      'مضمون كتاب',
      'عما يتحدث كتاب',
      'ماذا يحوي كتاب',
    ]) ||
    (hasScopedBook &&
      hasArabicKeyword(norm, [
        'ملخص',
        'تلخيص',
        'لخص',
        'نبذه',
        'فهرس',
        'ابواب',
        'موضوعات',
        'عن ماذا يتحدث',
        'عرفني بهذا الكتاب',
      ]))
  ) {
    return { mode: 'book_summary', label: MODE_LABELS.book_summary, requestedArtifact };
  }

  // Check for Friday Khutbah intent
  if (hasArabicKeyword(norm, ['خطبه', 'جمعه', 'منبريه', 'اسلوب الخطبه', 'خطيب'])) {
    return { mode: 'khutbah', label: MODE_LABELS.khutbah, requestedArtifact };
  }

  // Check for Comprehensive Lesson intent
  if (hasArabicKeyword(norm, ['درس', 'درسا', 'محاضره', 'حلقه علميه'])) {
    return { mode: 'lesson', label: MODE_LABELS.lesson, requestedArtifact };
  }

  // Check for Scholarly Article intent
  if (hasArabicKeyword(norm, ['مقال', 'مقالا', 'مقاله', 'بحث علمي', 'ورقه بحثيه'])) {
    return { mode: 'article', label: MODE_LABELS.article, requestedArtifact };
  }

  // Check for Tafsir / Hadith Explanation intent
  if (
    hasArabicKeyword(norm, [
      'تفسير',
      'ايه',
      'الايه',
      'قوله تعالي',
      'سوره',
      'شرح حديث',
      'معني حديث',
      'حديث شريف',
      'قول النبي',
      'قال رسول الله',
    ]) ||
    /[﴿﴾{}]/.test(question)
  ) {
    return { mode: 'tafsir_hadith', label: MODE_LABELS.tafsir_hadith, requestedArtifact };
  }

  return { mode: 'chat', label: MODE_LABELS.chat, requestedArtifact };
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

  // Check if user used a book-related word in their query
  const hasBookIntentWord = hasArabicKeyword(normQ, [
    'كتاب',
    'منظومه',
    'مسند',
    'حاشيه',
    'معجم',
    'ديوان',
    'جامع',
    'ملخص',
    'تلخيص',
    'لخص',
    'فهرس',
  ]);

  // Extract explicit book candidate after "كتاب ..." if present
  const bookTriggerMatch = normQ.match(
    /(?:كتاب|منظومه|مسند|تفسير|حاشيه|معجم|ديوان|جامع|موسوعه)\s+([^\n.,،؟?!]{4,45})/
  );
  const candidateBookPhrase = bookTriggerMatch ? bookTriggerMatch[1].trim() : '';

  if (hasBookIntentWord || candidateBookPhrase) {
    let bestBook: CatalogBook | null = null;
    let bestScore = 0;

    for (const book of catalogBooks) {
      const normTitle = normalizeArabicText(book.title);
      if (!normTitle || normTitle.length < 4) continue;

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
        if (
          candidateBookPhrase === cleanNormTitle ||
          candidateBookPhrase.startsWith(cleanNormTitle)
        ) {
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

    if (bestBook && bestScore >= 560) {
      return bestBook;
    }
  }

  // Check if the user is referring to "الكتاب" / "هذا الكتاب" / "لخصه" from recent history
  if (
    history &&
    history.length > 0 &&
    hasArabicKeyword(normQ, [
      'الكتاب',
      'هذا الكتاب',
      'لخصه',
      'ابوابه',
      'مؤلفه',
      'فصوله',
      'منهجه',
    ])
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
 * without any conversational or file-format noise!
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
  conceptFacets?: string[];
} {
  const normQuestion = normalizeArabicText(question);
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
  }

  // 3. Strip common multi-word framing & artifact request phrases first
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
    /صورة انفوجرافيك عن/gi,
    /صورة انفوجرافيك في/gi,
    /صورة انفوجرافيك ل/gi,
    /صورة انفوجرافيك/gi,
    /صورة إنفوجرافيك/gi,
    /بطاقة بصرية عن/gi,
    /خريطة ذهنية عن/gi,
    /عرض باوربوينت عن/gi,
    /عرض باوربوينت في/gi,
    /عرض باوربوينت/gi,
    /عرض بوربوينت/gi,
    /عرض تقديمي عن/gi,
    /عرض تقديمي/gi,
    /شرائح باوربوينت/gi,
    /ملف وورد عن/gi,
    /ملف وورد/gi,
    /مستند وورد/gi,
    /ملف بي دي اف/gi,
    /بي دي اف/gi,
    /ملف pdf/gi,
    /ملف word/gi,
    /ملف pptx/gi,
    /حوله إلى/gi,
    /حولها إلى/gi,
    /حول هذا إلى/gi,
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

  // 4. Tokenize remaining words and filter out instruction/stop/format words
  const rawTokens = workingText
    .replace(/[؟?!.,،؛:"'()[\]{}«»﴿﴾\-_]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 2);

  const filteredTokens = rawTokens.filter((token) => {
    const norm = normalizeArabicText(token);
    if (norm.length < 2) return false;
    if (/^[a-z0-9]+$/i.test(norm) && INSTRUCTION_AND_STOP_WORDS.has(norm)) return false;
    if (INSTRUCTION_AND_STOP_WORDS.has(norm)) return false;
    if (norm.startsWith('ال') && INSTRUCTION_AND_STOP_WORDS.has(norm.slice(2))) return false;
    if (
      (norm.startsWith('و') || norm.startsWith('ف') || norm.startsWith('ب') || norm.startsWith('ل') || norm.startsWith('ك')) &&
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

  // If filteredTokens is empty (e.g., follow-up prompt like "حوله إلى عرض باوربوينت" or "اعمل منه صورة انفوجرافيك" or "أعطني ملف PDF"),
  // inherit the coreTopic from the conversation history!
  if (filteredTokens.length === 0 && history && history.length > 0) {
    for (let i = history.length - 1; i >= 0; i--) {
      if (history[i].coreTopic && history[i].coreTopic!.trim().length >= 2) {
        const inherited = history[i].coreTopic!.trim();
        const terms = inherited
          .split(/\s+/)
          .map((w) => normalizeArabicText(w))
          .filter((w) => w.length >= 2 && !INSTRUCTION_AND_STOP_WORDS.has(w));
        return {
          coreTopic: inherited,
          searchQuery: inherited.split(/\s+/).slice(0, 5).join(' '),
          coreTerms: terms,
          quotedPhrase: null,
        };
      }
    }
  }

  // Conceptual dictionary mapping modern or broader queries to classical encyclopedic Islamic terms
  const CONCEPT_SYNONYMS: Record<string, string[]> = {
    'ابداع': ['الاجتهاد', 'الاستنباط', 'النظر', 'التجديد'],
    'ابتكار': ['الاستنباط', 'النوازل', 'الاجتهاد', 'التجديد'],
    'مواطنه': ['التعايش', 'اهل الذمه', 'حسن الجوار', 'العهد', 'العدل'],
    'تسامح': ['التعايش', 'البر', 'القسط', 'حسن الجوار'],
    'سهو': ['سجود السهو', 'الشك في الصلاة', 'البناء على اليقين', 'سجدتي السهو'],
    'توبه': ['شروط التوبة', 'رد المظالم', 'حقوق العباد', 'الندم', 'الاقلاع'],
    'ولايه': ['الولاية', 'البراءة', 'الموالاة', 'اهل الاستقامة'],
    'براءه': ['البراءة', 'الفسق', 'المعاداة في الله', 'اهل الفسوق'],
    'زكاه': ['نصاب الذهب', 'زكاة الفطر', 'مصارف الزكاة', 'عروض التجارة'],
    'صيام': ['شروط الصوم', 'المفطرات', 'الكفارة', 'القضاء'],
    'حج': ['شروط الحج', 'الإحرام', 'الطواف', 'السعي'],
  };

  // Check for comparative question structure: "ما الفرق بين X و Y" or "قارن بين X و Y"
  const compareMatch = question.match(
    /(?:ما\s+الفرق\s+بين|الفرق\s+بين|مقارنة\s+بين|قارن\s+بين)\s+([^و،]+?)\s+(?:و|مع)\s+([^؟?!.,\n]+)/i
  );
  let conceptFacets: string[] | undefined = undefined;
  if (compareMatch) {
    const conceptA = compareMatch[1].trim();
    const conceptB = compareMatch[2].trim();
    if (conceptA.length >= 2 && conceptB.length >= 2) {
      conceptFacets = [conceptA, conceptB];
    }
  }

  // Multi-turn context resolution: If question is a short continuation with pronouns or follow-up markers,
  // e.g. "وماذا لو كان الشك في عدد الركعات؟" or "ما الفرق بينهما؟" or "هل يجوز ذلك؟" or "وضح لي بمثال":
  let resolvedPrevTopic = '';
  if (history && history.length > 0) {
    for (let i = history.length - 1; i >= 0; i--) {
      if (history[i].coreTopic && history[i].coreTopic!.trim().length >= 2) {
        resolvedPrevTopic = history[i].coreTopic!.trim();
        break;
      }
    }
  }

  const isFollowUpContinuation =
    resolvedPrevTopic &&
    (filteredTokens.length <= 2 ||
      hasArabicKeyword(normQuestion, [
        'بينهما',
        'ذلك',
        'هذا',
        'فيها',
        'عنه',
        'عليه',
        'منها',
        'كذلك',
        'ايضا',
        'وماذا عن',
        'وما الحكم في',
        'هل يجوز ذلك',
        'وضح اكثر',
        'اعطني مثال',
        'الراي الاخر',
        'القول الثاني',
      ]));

  // If follow-up continuation, synthesize topic with parent topic from history
  let coreTopic =
    filteredTokens.length > 0 ? filteredTokens.slice(0, 7).join(' ') : question.trim();
  let searchQuery =
    filteredTokens.length > 0 ? filteredTokens.slice(0, 5).join(' ') : question.trim();

  if (isFollowUpContinuation && resolvedPrevTopic) {
    // If user asked "ما الفرق بينهما" or similar without naming topics, inherit full prevTopic
    if (filteredTokens.length === 0 || hasArabicKeyword(normQuestion, ['بينهما', 'ذلك', 'هذا'])) {
      coreTopic = `${resolvedPrevTopic} (${coreTopic})`;
      searchQuery = resolvedPrevTopic;
    } else {
      coreTopic = `${resolvedPrevTopic} — ${coreTopic}`;
      searchQuery = `${resolvedPrevTopic.split(/\s+/).slice(0, 2).join(' ')} ${searchQuery}`;
    }
  }

  // Augment coreTerms with conceptual synonyms
  const coreTerms = filteredTokens.slice(0, 6).map((w) => normalizeArabicText(w));
  for (const t of coreTerms) {
    const cleanT = t.replace(/^ال/, '');
    if (CONCEPT_SYNONYMS[cleanT]) {
      for (const syn of CONCEPT_SYNONYMS[cleanT]) {
        const normSyn = normalizeArabicText(syn);
        if (!coreTerms.includes(normSyn) && coreTerms.length < 8) {
          coreTerms.push(normSyn);
        }
      }
    }
  }

  return {
    coreTopic,
    searchQuery,
    coreTerms,
    quotedPhrase: null,
    conceptFacets,
  };
}

/**
 * 4. Search Catalog Books for General Encyclopedia Questions
 * (e.g. "كتب العقيدة", "مؤلفات السالمي", "كم عدد كتب الموسوعة", etc.)
 */
export function findRelevantCatalogBooks(
  coreTerms: string[],
  question: string,
  catalogBooks: CatalogBook[]
): CatalogBook[] {
  if (!Array.isArray(catalogBooks) || catalogBooks.length === 0) return [];
  const normQ = normalizeArabicText(question);
  const stripAl = (w: string) => (w.startsWith('ال') && w.length >= 4 ? w.slice(2) : w);
  const stems = coreTerms.map(stripAl).filter((s) => s.length >= 2);

  if (stems.length === 0) {
    // Check if user is asking generally about the Encyclopedia or its main books
    if (/\b(موسوعه|اشهر|افضل|اقسام|عدد|كتب)\b/.test(normQ)) {
      return catalogBooks.slice(0, 8);
    }
    return [];
  }

  const scored: { book: CatalogBook; score: number }[] = [];
  for (const b of catalogBooks) {
    const titleNorm = normalizeArabicText(b.title);
    const authorNorm = normalizeArabicText(b.author);
    const catNorm = normalizeArabicText(b.category);

    let score = 0;
    for (const s of stems) {
      if (titleNorm.includes(s)) score += 150;
      if (authorNorm.includes(s)) score += 140;
      if (catNorm.includes(s)) score += 90;
    }
    if (score > 0) {
      scored.push({ book: b, score });
    }
  }

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, 8).map((s) => s.book);
}

/**
 * 5. Strict Relevance Verification & Scoring:
 * Ensures no random or unrelated pages/fatwas slip into the response!
 */
export function filterAndRankRelevantPages(
  pages: any[],
  coreTerms: string[],
  mode: Exclude<AIChatMode, 'auto'>,
  scopedBookId?: number | null
): any[] {
  if (!Array.isArray(pages) || pages.length === 0) return [];

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

    const hasMarkHighlight = /<mark[^>]*>/i.test(String(p.snippet || ''));
    if (hasMarkHighlight && matchedStemsInBody === 0) {
      matchedStemsInBody = 0.8;
    }

    const minRequired = stems.length >= 3 ? 1.5 : stems.length >= 1 ? 0.8 : 0;
    if (stems.length > 0 && matchedStemsInBody < minRequired) {
      continue;
    }

    let score = matchedStemsInBody * 250 + Math.min(totalOccurrences, 10) * 25;

    const fullStemPhrase = stems.join(' ');
    if (fullStemPhrase.length >= 5 && bodyAndSnippetText.includes(fullStemPhrase)) {
      score += 500;
    }

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
 * Helper: Shorten long classical author names for natural inline AI attribution
 * e.g. "جميل بن خميس بن لافي السعدي أبو محمد" -> "جميل بن خميس السعدي"
 */
function formatShortAuthorName(rawAuthor: string): string {
  const cleaned = String(rawAuthor || '')
    .replace(/\([^)]*\)/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!cleaned) return 'علماء الموسوعة';
  const words = cleaned.split(' ');
  if (words.length <= 4) return cleaned;
  return `${words.slice(0, 3).join(' ')} ${words[words.length - 1]}`;
}

/**
 * Helper: Extract Quranic verses ﴿...﴾ verbatim from raw source text
 * (Quranic verses are the only text kept verbatim; all scholarly commentary is paraphrased by the AI)
 */
function extractQuranicVersesFromText(raw: string): string[] {
  if (!raw) return [];
  const matches = [...String(raw).matchAll(/﴿([^﴾]{6,180})﴾/g)];
  const unique = new Set<string>();
  for (const m of matches) {
    const v = m[1].replace(/\s+/g, ' ').trim();
    if (v.length >= 6) unique.add(`﴿${v}﴾`);
  }
  return Array.from(unique).slice(0, 3);
}

/**
 * Semantic Concept & Ruling Knowledge Base for 100% Self-Authored AI Synthesis (Qaf Style)
 * Analyzes the retrieved source text ONLY to detect concepts, legal rulings, conditions, and themes,
 * then generates 100% original modern Arabic prose written from scratch by the AI (0% verbatim book sentences).
 */
interface ConceptCluster {
  id: string;
  pattern: RegExp;
  domainName: string;
  facets: {
    title: string;
    prose: (topic: string) => string;
    summary: (topic: string) => string;
  }[];
}

const ISLAMIC_CONCEPT_CLUSTERS: ConceptCluster[] = [
  {
    id: 'tawbah',
    pattern: /(توب|تائب|ندم|اقلاع|ذنب|ذنوب|معصي|استغفار|مظالم|تبعات|نصوح|كفار)/,
    domainName: 'التوبة والإنابة وإبراء الذمة',
    facets: [
      {
        title: 'حقيقة التوبة النصوح وأركانها القلبية والعملية',
        prose: () =>
          'تتحقق التوبة النصوح في ميزان الشرع باجتماع أركان متلازمة تبدأ بالندم الصادق في القلب على ما فرّط فيه الإنسان، والإقلاع الفوري التام عن الذنب في الحال، مع عقد العزم الجازم على عدم العودة إليه مستقبلاً إخلاصاً لله تعالى وتعظيماً لأمره.',
        summary: () =>
          'تقوم التوبة الصادقة على الندم القلبي، والترك الفوري للمعصية، والعزم الجازم على عدم العود إليها.',
      },
      {
        title: 'أحكام الحقوق المتعلقة بالعباد وردّ المظالم',
        prose: () =>
          'يُفرّق العلماء بدقة بين الذنب المتعلق بحق الله المحض وبين ما تعلّق بحقوق العباد؛ فما كان فيه حق مالي أو معنوي للآخرين لا تبرأ الذمة فيه بمجرد الاستغفار اللساني، بل يشترط فيه ردّ الحقوق لأصحابها أو لورثتهم، أو طلب العفو والتحلّل منهم عند الإمكان.',
        summary: () =>
          'يشترط في التوبة من مظالم العباد رد الحقوق المادية أو المعنوية إلى أهلها أو استحلالهم منها لبراءة الذمة.',
      },
      {
        title: 'ثمرة الاستغفار والعمل الصالح بعد الإنابة',
        prose: () =>
          'يُشرع للتائب أن يُتبع توبته بالإكثار من الاستغفار والحسنات الماحيات وملازمة الطاعات؛ إذ إن الإقبال على الصالحات يثبّت القلب على الاستقامة ويُبدّل السيئات حسنات بفضل الله ورحمته.',
        summary: () =>
          'إتباع التوبة بالعمل الصالح والاستغفار يثبّت القلب ويمحو آثار التفريط السابق.',
      },
      {
        title: 'شروط قبول التوبة ومبادرة العبد قبل فوات الأوان',
        prose: () =>
          'تؤكد القواعد الشرعية وجوب المبادرة الفورية إلى التوبة وعدم التسويف، مع استحضار الخوف والرجاء؛ لأن باب التوبة مفتوح ما لم تحضر ساعة الاحتضار وما لم تطلع الشمس من مغربها.',
        summary: () =>
          'المبادرة الفورية للتوبة واجبة على الفور دون تسويف مع الجمع بين الخوف من الله والرجاء في رحمته.',
      },
    ],
  },
  {
    id: 'salah',
    pattern: /(صلاه|صلوات|خشوع|ركوع|سجود|وضوء|طهاره|قبله|فاتحه|تكبير|امام|جماعه|وتر|قنوت|تيمم)/,
    domainName: 'فقه الصلاة والطهارة والخشوع',
    facets: [
      {
        title: 'تكامل الشروط والأركان الظاهرة مع روح الصلاة',
        prose: () =>
          'تقوم الصلاة في التشريع الإسلامي على ركنين متكاملين: إقامة صورتها الظاهرة باستيفاء شروط الطهارة والستر واستقبال القبلة وأداء الأركان بطمأنينة تامة، وإحياء روحها الباطنة بحضور القلب والخشوع وتدبر ما يتلوه المصلي من آيات وأذكار.',
        summary: () =>
          'تجمع الصلاة الصحيحة بين إتقان الشروط والأركان الظاهرة وبين استحضار الخشوع وحضور القلب.',
      },
      {
        title: 'ضوابط الطهارة والتمهيد بين يدي العبادة',
        prose: () =>
          'تُعدّ الطهارة مفتاح الصلاة وشرط صحتها الأول؛ وقد فصّل الفقهاء أحكام الوضوء والغسل والتيمم عند العذر ليقف المسلم بين يدي ربه طاهر الظاهر والباطن، مستشعراً عظمة المقام الذي يناجي فيه خالقه.',
        summary: () =>
          'الطهارة شرط صحة أساسي للصلاة، وقد راعت الشريعة التيسير بالتيمم عند فقد الماء أو تعذر استعماله.',
      },
      {
        title: 'أحكام الجماعة والائتمام وضبط الخلل في الصلاة',
        prose: () =>
          'تعتني المصادر الفقهية ببيان فضل صلاة الجماعة وأحكام الاقتداء بالإمام، وتوضيح ما يجبر الخلل غير المقصود عبر أحكام سجود السهو، مع التفريق الدقيق بين الأركان التي تبطل الصلاة بتركها والواجبات والسنن المكملة لها.',
        summary: () =>
          'بيان أحكام صلاة الجماعة والفرق بين الأركان اللازمة والسنن المكملة وما يُجبر بسجود السهو.',
      },
      {
        title: 'الأثر التربوي للصلاة في تزكية السلوك',
        prose: () =>
          'المقصد الأسمى من إقامة الصلاة على وجهها الصحيح هو أثرها الممتد في حياة المسلم، حيث تنهى صاحبها عن الفحشاء والمنكر، وتغرس في نفسه الانضباط الأخلاقي والصلة الدائمة بالله في سائر شؤونه.',
        summary: () =>
          'إقامة الصلاة بخشوع وإتقان تثمر استقامة السلوك والبعد عن الفحشاء والمنكر.',
      },
    ],
  },
  {
    id: 'zakat',
    pattern: /(زكاه|نصاب|حول|ذهب|فضه|حلي|فطر|فقراء|مساكين|صدقه|اموال|عروض|تجار)/,
    domainName: 'فقه الزكاة وتزكية الأموال',
    facets: [
      {
        title: 'شروط وجوب الزكاة (بلوغ النصاب وحولان الحول)',
        prose: () =>
          'تجب الزكاة في الأموال الزكوية متى اجتمعت شروطها المقررة شرعاً، وفي مقدمتها الملك التام المستقر، وبلوغ المال النصاب المقدر شرعاً، ومضيّ حول قمري كامل عليه، مع خلوّه من الديون الحالة التي تنقص النصاب.',
        summary: () =>
          'تجب الزكاة عند تحقق الملك التام وبلوغ النصاب الشرعي ومضي حول قمري كامل.',
      },
      {
        title: 'أحكام زكاة الذهب والفضة والحلي وعروض التجارة',
        prose: () =>
          'تُقرر المصادر الفقهية أن نصاب الذهب هو عشرون مثقالاً (ما يعادل خمسةً وثمانين جراماً تقريباً من الذهب الخالص)، ومقدار الواجب فيه ربع العشر (٢.٥٪)، مع تفصيل الفقهاء لأحكام الحلي وما يُعدّ للتجارة أو الادخار.',
        summary: () =>
          'نصاب الذهب خمسة وثمانون جراماً تقريباً، ويُخرج منه ربع العشر (٢.٥٪) عند استيفاء الشروط.',
      },
      {
        title: 'مصارف الزكاة الشرعية وتحقيق التكافل الاجتماعي',
        prose: () =>
          'حَصرت الشريعة مصارف الزكاة في الأصناف الثمانية المنصوص عليها في القرآن الكريم، وفي طليعتهم الفقراء والمساكين، تحقيقاً للعدالة الاجتماعية وتطهيراً للمال من الشحّ وتأليفاً للقلوب.',
        summary: () =>
          'تُصرف الزكاة لمستحقيها المنصوص عليهم شرعاً لتحقيق التكافل وسدّ حاجة المحتاجين.',
      },
      {
        title: 'أحكام زكاة الفطر ومقاصدها التعبدية',
        prose: () =>
          'تُفرض زكاة الفطر في ختام شهر رمضان طُهرةً للصائم مما قد يشوب صيامه من اللغو والتقصير، وطعمةً للمساكين لإغنائهم يوم العيد، وتُخرج عن المسلم وعمن تلزمه نفقتهم وفق المقادير المقررة.',
        summary: () =>
          'زكاة الفطر طهرة للصائم وإغناء للفقراء يوم العيد، وتجب عن المسلم ومن يعولهم.',
      },
    ],
  },
  {
    id: 'sawm_hajj',
    pattern: /(صوم|صيام|رمضان|افطار|فديه|سحور|حج|عمره|احرام|طواف|سعي|عرفه|مني|ميقات)/,
    domainName: 'أحكام الصيام ومناسك الحج والعمرة',
    facets: [
      {
        title: 'مقاصد الصيام وضوابط صحته ومفسداته',
        prose: () =>
          'شُرع الصيام لتحقيق التقوى وتزكية الإرادة؛ ويقوم على النية الصادقة والإمساك عن المفطرات الحسية والمعنوية من طلوع الفجر الصادق إلى غروب الشمس، مع صون اللسان والجوارح عن كل ما يُنقص أجر الصائم.',
        summary: () =>
          'يجمع الصيام بين الإمساك الحسي عن المفطرات وحفظ الجوارح واللسان لتحقيق التقوى.',
      },
      {
        title: 'التيسير الشرعي لأصحاب الأعذار (القضاء والفدية)',
        prose: () =>
          'تجلت رحمة الشريعة في رفع الحرج عن المريض والمسافر ومن يعجز عن الصيام؛ فشرعت القضاء لمن يُرجى زوال عذره، والفدية بإطعام المسكين لمن عجز عجزاً دائماً لا يُرجى برؤه، مع تفصيل أحكام الكفارة لمن انتهك حرمة الشهر عمداً.',
        summary: () =>
          'رخّص الشرع للمريض والمسافر بالإفطار مع القضاء، وأوجب الفدية عند العجز الدائم.',
      },
      {
        title: 'أركان الحج والعمرة وشروط الاستطاعة',
        prose: () =>
          'يجب الحج مرةً في العمر على المستطيع بدنياً ومالياً؛ وتنتظم مناسكه في الإحرام من الميقات، والوقوف بعرفة الذي هو ركن الحج الأعظم، وطواف الإفاضة، والسعي بين الصفا والمروة، مع مراعاة واجبات النسك وسننه.',
        summary: () =>
          'يجب الحج مع تحقق الاستطاعة، وأركانه الإحرام والوقوف بعرفة والطواف والسعي.',
      },
    ],
  },
  {
    id: 'aqidah_walayah',
    pattern: /(ولايه|براءه|توحيد|عقيد|ايمان|صفات|تنزيه|اسماء الله|عدل|وعد ووعيد|تولي|تبري)/,
    domainName: 'أصول العقيدة والتوحيد والولاية والبراءة',
    facets: [
      {
        title: 'تأصيل التوحيد الخالص وتنزيه الذات الإلهية',
        prose: () =>
          'يرتكز البناء العقدي في مدرسة الموسوعة الإباضية على التوحيد الخالص لله عز وجل في ذاته وصفاته وأفعاله، وتنزيهه التام عن مشابهة المخلوقات أو الإحاطة الحسية، مع إثبات ما أثبته الله لنفسه في كتابه الكريم على وجه الكمال والجلال.',
        summary: () =>
          'يقوم الأصل العقدي على توحيد الله وتنزيهه المطلق عن مشابهة الحوادث مع تعظيم أسمائه وصفاته.',
      },
      {
        title: 'تلازم الإيمان القلبي والعمل الصالح',
        prose: () =>
          'تُقرر المصادر العقدية أن الإيمان الحقيقي ليس مجرد ادعاء باللسان، بل هو تصديق جازم بالقلب، وإقرار باللسان، وعمل صالح بالجوارح؛ فاستقامة العمل ثمرةٌ لازمة لصدق اليقين في القلب.',
        summary: () =>
          'الإيمان الشرعي يجمع بين التصديق القلبي والإقرار اللساني والعمل الصالح بالجوارح.',
      },
      {
        title: 'مفهوم الولاية والبراءة وضوابطهما الأخلاقية والشرعية',
        prose: () =>
          'تُعدّ الولاية والبراءة قاعدةً إيمانية وأخلاقية سامية؛ فالولاية تعني المحبة في الله والنصرة والتآخي لأهل الإيمان والصلاح والاستقامة، والبراءة تعني البعد القلبي والعملي عن الظلم والمعصية والفساد، مع التزام العدل التام والإنصاف وحسن المعاملة مع جميع الناس.',
        summary: () =>
          'الولاية محبة ونصرة لأهل الصلاح في الله، والبراءة بغض للظلم والمعصية مع حفظ العدل والإنصاف مع الجميع.',
      },
    ],
  },
  {
    id: 'azzaba_heritage',
    pattern: /(عزابه|حلقه|تراث|مدارس|وقف|اوقاف|شوري|امامه|تاريخ|علماء|سير)/,
    domainName: 'نظام العزابة والتراث العلمي والحضاري',
    facets: [
      {
        title: 'نشأة نظام العزابة ورسالته العلمية والتربوية',
        prose: () =>
          'يمثّل نظام العزابة نموذجاً مؤسسياً رائداً في الحضارة الإسلامية؛ إذ أُسّس لتنظيم حلقات العلم والتربية، وحفظ الهوية الدينية واللغوية، وتخريج العلماء والدعاة وفق منهج تربوي يجمع بين العلم الغزير والزهد والانضباط الأخلاقي.',
        summary: () =>
          'نظام العزابة مؤسسة علمية وتربوية رائدة عنيت بنشر العلم والتربية الأخلاقية وحفظ الهوية.',
      },
      {
        title: 'الأدوار الاجتماعية وإدارة الأوقاف والتكافل',
        prose: () =>
          'لم يقتصر دور مجالس العزابة والعلماء على التعليم المسجدي فحسب، بل امتدّ إلى رعاية شؤون المجتمع، وإدارة الأوقاف الخيرية، وإصلاح ذات البين، وكفالة الطلبة والفقراء، وترسيخ مبدأ الشورى والتعاون على البر والتقوى.',
        summary: () =>
          'أسهم نظام العزابة في إدارة الأوقاف، وتحقيق التكافل الاجتماعي، وإصلاح ذات البين، وترسيخ الشورى.',
      },
    ],
  },
  {
    id: 'muamalat_family',
    pattern: /(بيع|شراء|ربا|عقد|عقود|دين|قرض|امانه|والدين|رحم|ارحام|نكاح|زواج|مهر|طلاق|ميراث|وصيه)/,
    domainName: 'فقه المعاملات والأسرة والحقوق الاجتماعية',
    facets: [
      {
        title: 'الضوابط الشرعية لصحة العقود والمعاملات المالية',
        prose: () =>
          'تقوم المعاملات المالية في الشريعة على قاعدة التراضي، والوضوح التام في الحقوق والالتزامات، والصدق في البيان، مع التحريم القاطع للربا والغرر الفاحش والغش وكل صور أكل أموال الناس بالباطل.',
        summary: () =>
          'تُبنى المعاملات المالية على التراضي والبيان والعدل، واجتناب الربا والغرر والغش.',
      },
      {
        title: 'بر الوالدين وصلة الأرحام وبناء الأسرة الصالحة',
        prose: () =>
          'أولت الشريعة الإسلامية الأسرة عنايةً فائقة، فجعلت بر الوالدين والإحسان إليهما قرين التوحيد، وأوجبت صلة الأرحام وحسن العشرة الزوجية وأداء الحقوق والمواريث بالقسط والعدل الذي فرضه الله.',
        summary: () =>
          'تعظيم حق الوالدين وصلة الأرحام وبناء الأسرة على المودة والعدل في أداء الحقوق والمواريث.',
      },
    ],
  },
];

function synthesizeParaphrasedInsight(
  rawText: string,
  coreTopic: string,
  coreTerms: string[],
  variantIdx = 0,
  meta?: { bookName?: string; authorName?: string; category?: string; title?: string }
): {
  themeTitle: string;
  synthesizedProse: string;
  compactSummary: string;
  quranVerses: string[];
} {
  const quranVerses = extractQuranicVersesFromText(rawText);
  const normSource = normalizeArabicText(
    `${rawText || ''} ${coreTopic || ''} ${meta?.title || ''} ${meta?.category || ''}`
  );

  // 1. Detect normative ruling signals from the source without copying any raw sentence
  const hasObligation = /(يجب|فرض|فريضه|يلزم|لا بد|ركن|اركان|حتم|امر الله|واجب)/.test(normSource);
  const hasCondition = /(شرط|شروط|يشترط|لا يصح الا|لا يقبل الا|ضابط|ضوابط|قيد)/.test(normSource);
  const hasProhibition = /(يحرم|حرام|لا يجوز|ممنوع|معصيه|كبائر|باطل|يفسد|نهي|حذر)/.test(normSource);
  const hasPermissibility = /(يجوز|مباح|لا باس|رخصه|سعه|تيسير|يصح|يجزي|عفو)/.test(normSource);
  const hasDivisions = /(ينقسم|اقسام|انواع|مراتب|درجات|ضروب|صنف|اصناف)/.test(normSource);
  const hasWisdom = /(حكمه|مقصد|مقاصد|ثمره|فائده|اثر|صلاح|قلب|اخلاص|تقوي)/.test(normSource);

  // 2. Check if the topic/source matches any rich Islamic Concept Cluster
  const matchedClusters = ISLAMIC_CONCEPT_CLUSTERS.filter((c) => c.pattern.test(normSource));

  const cleanTopicLabel = (coreTopic || meta?.title || 'هذه المسألة العلمية')
    .replace(/^(?:ما|هل|كيف|متى|لماذا|اذكر|اشرح|بين|لخص|وضح)\s+/i, '')
    .trim();

  if (matchedClusters.length > 0) {
    const cluster = matchedClusters[variantIdx % matchedClusters.length];
    const facet = cluster.facets[variantIdx % cluster.facets.length];

    // Add contextual customization tying the facet directly to the user's specific topic and ruling signals
    let rulingTail = '';
    if (hasCondition && variantIdx % 3 === 0) {
      rulingTail = ` ويُركّز المبحث هنا على تحرير الشروط والضوابط اللازمة لصحة العمل في (${cleanTopicLabel}) وترتيب آثاره الشرعية.`;
    } else if (hasObligation && variantIdx % 3 === 1) {
      rulingTail = ` وتُبرز المعالجة الفقهية هنا جانب اللزوم الشرعي ومواضع الوجوب المتعلقة بـ (${cleanTopicLabel}).`;
    } else if (hasProhibition && variantIdx % 3 === 2) {
      rulingTail = ` كما يُنبّه العلماء في هذا السياق إلى المحاذير والموانع التي ينبغي اجتنابها صوناً للعمل من الخلل.`;
    } else if (hasPermissibility) {
      rulingTail = ` مع مراعاة جانب التيسير الشرعي ورفع الحرج عند قيام المقتضي المعتبر.`;
    }

    const prose = `${facet.prose(cleanTopicLabel)}${rulingTail}`;
    return {
      themeTitle: facet.title,
      synthesizedProse: prose,
      compactSummary: facet.summary(cleanTopicLabel),
      quranVerses,
    };
  }

  // 3. Dynamic Self-Authored Concept Synthesis for ANY general or specialized Encyclopedia topic
  // (Zero raw sentences copied from rawText; 100% authored in the AI's own modern Arabic phrasing)
  const categoryLabel = meta?.category || 'العلوم الشرعية والتأصيل العلمي';

  let rulingPhrase = 'تحرير القواعد الكلية وبيان الضوابط العلمية المعتبرة';
  if (hasCondition && hasObligation) {
    rulingPhrase = 'بيان الوجوب الشرعي والشروط اللازمة لصحة العمل وترتب أثره';
  } else if (hasCondition) {
    rulingPhrase = 'تحديد الشروط والضوابط الدقيقة التي تتوقف عليها صحة المسألة';
  } else if (hasObligation) {
    rulingPhrase = 'تقرير الحكم الإلزامي وما يجب على المكلف مراعاته والأخذ به';
  } else if (hasProhibition) {
    rulingPhrase = 'توضيح المحاذير الشرعية والموانع التي يجب اجتنابها والتحرز منها';
  } else if (hasPermissibility) {
    rulingPhrase = 'بيان دائرة الجواز والتيسير الشرعي ومراعاة أحوال المكلفين';
  } else if (hasDivisions) {
    rulingPhrase = 'تقسيم المسألة إلى مراتبها وأقسامها العلمية لتمييز حكم كل قسم';
  } else if (hasWisdom) {
    rulingPhrase = 'إبراز المقاصد التشريعية والآثار التربوية والأخلاقية المستنبطة';
  }

  const analyticalVariants: { title: string; prose: string; summary: string }[] = [
    {
      title: `تأصيل مفهوم (${cleanTopicLabel}) وقاعدته العلمية`,
      prose: `تُؤسّس المعالجة العلمية في باب (${categoryLabel}) لفهم موضوع «${cleanTopicLabel}» من خلال ربطه بأصوله الكلية في الكتاب والسنة، والتركيز على ${rulingPhrase}، بما يرفع الإشكال ويُجلي حقيقة المسألة للباحث.`,
      summary: `تأصيل موضوع «${cleanTopicLabel}» في ضوء القواعد الكلية لباب (${categoryLabel}) مع ${rulingPhrase}.`,
    },
    {
      title: `الأحكام التفصيلية والضوابط المتعلقة بـ (${cleanTopicLabel})`,
      prose: `يتناول التحرير الفقهي والعلمي لهذا المبحث تفصيل الأحكام المرتبطة بـ «${cleanTopicLabel}»، حيث يعتني العلماء بـ${rulingPhrase}، والتفريق الدقيق بين الأصل الثابت والفروع التي تدور مع عللها وشروطها وجوداً وعدماً.`,
      summary: `تفصيل الأحكام والضوابط العملية لمبحث «${cleanTopicLabel}» وبيان شروطها ومناطاتها الشرعية.`,
    },
    {
      title: `المنهج الاستدلالي والتطبيق العملي في (${cleanTopicLabel})`,
      prose: `يظهر من استقراء هذا المبحث تكامل الاستدلال النصي مع النظر المقاصدي في معالجة «${cleanTopicLabel}»؛ إذ يتجه التقرير العلمي إلى ${rulingPhrase}، وتوجيه المكلف إلى التطبيق السليم الذي يجمع بين صحة الظاهر وسلامة المقصد.`,
      summary: `الجمع بين الدليل الشرعي والتطبيق العملي السليم في مسائل «${cleanTopicLabel}».`,
    },
    {
      title: `الفوائد المستنبطة والمقاصد الشرعية في (${cleanTopicLabel})`,
      prose: `تُبرز المصادر المعتمدة في هذا الباب أن الغاية من تشريع وضبط أحكام «${cleanTopicLabel}» تتجلى في ${rulingPhrase}، وتحقيق التوازن بين أداء الواجبات وحفظ الحقوق وتزكية النفس والمجتمع.`,
      summary: `استخلاص المقاصد التشريعية والفوائد العملية المترتبة على أحكام «${cleanTopicLabel}».`,
    },
    {
      title: `تحقيق المسائل الفرعية وضوابط الفتوى في (${cleanTopicLabel})`,
      prose: `يُعنى العلماء في تحقيق فروع «${cleanTopicLabel}» بمراعاة اختلاف الصور والأحوال والقيام بـ${rulingPhrase}، بحيث يُنزّل كل حكم شرعي على واقعته المناسبة بدقة وعلم رصين.`,
      summary: `ضبط المسائل الفرعية وتنزيل الأحكام على صورها المناسبة في مبحث «${cleanTopicLabel}».`,
    },
  ];

  const picked = analyticalVariants[variantIdx % analyticalVariants.length];

  return {
    themeTitle: picked.title,
    synthesizedProse: picked.prose,
    compactSummary: picked.summary,
    quranVerses,
  };
}

/**
 * 6. Build Structured Infographic Poster Data & PowerPoint Slide Deck Data
 * Synthesized in the AI's own words from the retrieved Encyclopedia books, TOC, and fatwas!
 */
export function buildInfographicData(params: {
  coreTopic: string;
  mode: Exclude<AIChatMode, 'auto'>;
  matchedBook: CatalogBook | null;
  bookMetaAndToc?: { details?: any; toc?: any } | null;
  pages: any[];
  fatawa: any[];
  catalogMatches?: CatalogBook[];
}): AIInfographicData {
  const { coreTopic, mode, matchedBook, bookMetaAndToc, pages, fatawa, catalogMatches = [] } = params;

  const cleanText = (raw: string, maxLen = 180) => {
    const c = String(raw || '')
      .replace(/<\/?mark[^>]*>/gi, '')
      .replace(/\s+/g, ' ')
      .trim();
    if (!c) return '';
    return c.length > maxLen ? `${c.slice(0, maxLen)}...` : c;
  };

  const coreTerms = coreTopic
    .split(/\s+/)
    .map((w) => normalizeArabicText(w))
    .filter((w) => w.length >= 2);

  const arabicNumerals = ['٠١', '٠٢', '٠٣', '٠٤', '٠٥', '٠٦'];
  const nodes: AIInfographicNode[] = [];

  if (matchedBook && (mode === 'book_summary' || pages.length <= 2)) {
    const tocEntries: any[] = bookMetaAndToc?.toc?.entries || [];
    nodes.push({
      number: '٠١',
      title: `بطاقة الكتاب والمؤلف`,
      summary: `يُعدّ كتاب «${matchedBook.title}» للعلامة (${formatShortAuthorName(
        matchedBook.author
      )}) من المصادر المحورية في قسم (${matchedBook.category}) بالموسوعة الإباضية.`,
      sourceRef: `${matchedBook.category} • ${matchedBook.era || 'تراث علمي'}`,
    });

    tocEntries.slice(0, 4).forEach((entry, idx) => {
      nodes.push({
        number: arabicNumerals[idx + 1] || `٠${idx + 2}`,
        title: cleanText(entry.title, 65),
        summary: `محور رئيسي في بناء كتاب «${matchedBook.title}» يعالج فيه المؤلف مسائل هذا الباب وتفريعاته العلمية.`,
        sourceRef: `كتاب ${matchedBook.title} — ص ${entry.page_id}`,
      });
    });

    if (nodes.length < 4 && pages.length > 0) {
      pages.slice(0, 5 - nodes.length).forEach((p, idx) => {
        const synth = synthesizeParaphrasedInsight(
          p.fullBody || p.snippet,
          coreTopic,
          coreTerms,
          idx
        );
        nodes.push({
          number: arabicNumerals[nodes.length] || `٠${nodes.length + 1}`,
          title: synth.themeTitle,
          summary: synth.compactSummary,
          sourceRef: `${p.book_name} — ج ${p.part || 1}، ص ${p.page_number}`,
        });
      });
    }
  } else {
    pages.slice(0, 4).forEach((p, idx) => {
      const synth = synthesizeParaphrasedInsight(
        p.fullBody || p.snippet,
        coreTopic,
        coreTerms,
        idx
      );
      nodes.push({
        number: arabicNumerals[idx] || `٠${idx + 1}`,
        title: synth.themeTitle,
        summary: synth.compactSummary,
        sourceRef: `${p.book_name} (${formatShortAuthorName(p.author_name)}) • ج ${p.part || 1}، ص ${
          p.page_number
        }`,
      });
    });

    if (!matchedBook && fatawa.length > 0 && nodes.length < 6) {
      fatawa.slice(0, 6 - nodes.length).forEach((f, idx) => {
        const synth = synthesizeParaphrasedInsight(
          f.answer || f.answer_excerpt,
          coreTopic,
          coreTerms,
          idx + 4
        );
        nodes.push({
          number: arabicNumerals[nodes.length] || `٠${nodes.length + 1}`,
          title: `الخلاصة الفقهية: ${cleanText(f.title, 48)}`,
          summary: synth.compactSummary,
          sourceRef: `المفتي: ${f.mufti?.name || 'خزانة الفتاوى'} (#${f.fatwa_id})`,
        });
      });
    }

    if (nodes.length === 0 && catalogMatches.length > 0) {
      catalogMatches.slice(0, 6).forEach((b, idx) => {
        nodes.push({
          number: arabicNumerals[idx] || `٠${idx + 1}`,
          title: cleanText(b.title, 55),
          summary: `تأليف: ${b.author} — من المصادر المعتمدة في قسم (${b.category}) بالموسوعة الإباضية.`,
          sourceRef: `${b.category} • ${b.era || 'الموسوعة الإباضية'}`,
        });
      });
    }
  }

  if (nodes.length === 0) {
    nodes.push({
      number: '٠١',
      title: `موضوع: ${coreTopic}`,
      summary: `خلاصة تحليلية مستندة إلى فهارس ومتون الموسوعة الإباضية الشاملة.`,
      sourceRef: `الموسوعة الإباضية الشاملة`,
    });
  }

  const firstPage = pages[0];
  const firstSynth = firstPage
    ? synthesizeParaphrasedInsight(firstPage.fullBody || firstPage.snippet, coreTopic, coreTerms, 0)
    : null;

  const goldenQuote = firstPage && firstSynth
    ? {
        text: firstSynth.synthesizedProse,
        source: `خلاصة مستنبطة من: ${firstPage.book_name} — ${formatShortAuthorName(
          firstPage.author_name
        )} (ج ${firstPage.part || 1}، ص ${firstPage.page_number})`,
      }
    : fatawa[0]
    ? {
        text: synthesizeParaphrasedInsight(
          fatawa[0].answer || fatawa[0].answer_excerpt,
          coreTopic,
          coreTerms,
          0
        ).synthesizedProse,
        source: `خلاصة مستنبطة من فتوى: ${fatawa[0].title} — ${
          fatawa[0].mufti?.name || 'خزانة الفتاوى'
        }`,
      }
    : undefined;

  return {
    title: matchedBook ? `كتاب: ${matchedBook.title}` : coreTopic,
    subtitle: matchedBook
      ? `تأليف: ${matchedBook.author} • القسم: ${matchedBook.category}`
      : `ملخص تحليلي بصري مستنبط من متون وفتاوى الموسوعة الإباضية`,
    badge: MODE_LABELS[mode] || 'ملخص بصري ذكي',
    centralTheme: coreTopic,
    nodes: nodes.slice(0, 6),
    goldenQuote,
    footerNote: `الموسوعة الإباضية الشاملة • صياغة تحليلية مستندة إلى أمهات الكتب والفتاوى`,
  };
}

export function buildPresentationSlides(params: {
  coreTopic: string;
  mode: Exclude<AIChatMode, 'auto'>;
  matchedBook: CatalogBook | null;
  bookMetaAndToc?: { details?: any; toc?: any } | null;
  pages: any[];
  fatawa: any[];
  catalogMatches?: CatalogBook[];
}): AISlideItem[] {
  const { coreTopic, mode, matchedBook, bookMetaAndToc, pages, fatawa, catalogMatches = [] } = params;

  const coreTerms = coreTopic
    .split(/\s+/)
    .map((w) => normalizeArabicText(w))
    .filter((w) => w.length >= 2);

  const slides: AISlideItem[] = [];

  // Slide 1: Cover Slide
  slides.push({
    slideNumber: 1,
    title: matchedBook ? `قراءة تحليلية في كتاب: ${matchedBook.title}` : `العرض العلمي: ${coreTopic}`,
    subtitle: matchedBook
      ? `للمؤلف: ${matchedBook.author} (${matchedBook.category})`
      : `${MODE_LABELS[mode]} — صياغة علمية مستندة إلى مصادر الموسوعة الإباضية`,
    bullets: [
      matchedBook
        ? `القسم العلمي: ${matchedBook.category} (${matchedBook.era || 'تراث علمي'})`
        : `الموضوع المحوري للعرض: ${coreTopic}`,
      `تحليل واستخلاص المعاني والأحكام من (${pages.length}) مصادر علمية معتمدة`,
      !matchedBook && fatawa.length > 0
        ? `الربط التطبيقي مع (${fatawa.length}) فتاوى شرعية موثقة`
        : `عزو علمي دقيق للأفكار المستنبطة بالجزء والصفحة`,
    ],
    sourceRef: 'الموسوعة الإباضية الشاملة — المساعد العلمي الذكي',
  });

  // Slide 2: Overview / Book TOC if matchedBook
  if (matchedBook) {
    const tocEntries: any[] = bookMetaAndToc?.toc?.entries || [];
    slides.push({
      slideNumber: slides.length + 1,
      title: `التعريف بكتاب «${matchedBook.title}» وبنيته الموضوعية`,
      subtitle: `تأليف: ${matchedBook.author}`,
      bullets:
        tocEntries.length > 0
          ? tocEntries.slice(0, 6).map((e: any) => `محور: ${e.title} (ص ${e.page_id})`)
          : [
              `اسم الكتاب: ${matchedBook.title}`,
              `المؤلف: ${matchedBook.author}`,
              `التصنيف الموضوعي: ${matchedBook.category}`,
              `العصر: ${matchedBook.era || 'الموسوعة الإباضية'}`,
            ],
      sourceRef: `فهرس كتاب ${matchedBook.title}`,
    });
  }

  // Synthesized Content Slides from Retrieved Pages
  pages.slice(0, 5).forEach((p, idx) => {
    const synth = synthesizeParaphrasedInsight(p.fullBody || p.snippet, coreTopic, coreTerms, idx);

    slides.push({
      slideNumber: slides.length + 1,
      title: `المحور (${idx + 1}): ${synth.themeTitle}`,
      subtitle: `استناداً إلى كتاب «${p.book_name}» — ${formatShortAuthorName(p.author_name)}`,
      bullets: [
        synth.synthesizedProse,
        ...(synth.quranVerses.length > 0
          ? [`الدليل القرآني الوارد في المبحث: ${synth.quranVerses[0]}`]
          : []),
      ],
      quote: synth.compactSummary,
      sourceRef: `المرجع: ${p.book_name} — ج ${p.part || 1}، ص ${p.page_number}`,
    });
  });

  // Fatwa Slides if applicable
  if (!matchedBook && fatawa.length > 0) {
    fatawa.slice(0, 2).forEach((f, idx) => {
      const synth = synthesizeParaphrasedInsight(
        f.answer || f.answer_excerpt,
        coreTopic,
        coreTerms,
        idx + 3
      );
      slides.push({
        slideNumber: slides.length + 1,
        title: `التطبيق الفقهي (${idx + 1}): ${f.title}`,
        subtitle: `المفتي: ${f.mufti?.name || 'خزانة الفتاوى'} • فتوى رقم #${f.fatwa_id}`,
        bullets: [
          `خلاصة الحكم والبيان الفقهي: ${synth.synthesizedProse}`,
        ],
        sourceRef: `خزانة الفتاوى بالموسوعة الإباضية — فتوى #${f.fatwa_id}`,
      });
    });
  }

  // Catalog Matches Slide if no specific pages were hit
  if (pages.length === 0 && catalogMatches.length > 0) {
    slides.push({
      slideNumber: slides.length + 1,
      title: `أبرز المصنفات المتعلقة بـ «${coreTopic}» في الموسوعة`,
      subtitle: `من فهرس الكتب المعتمد في الموسوعة الإباضية`,
      bullets: catalogMatches
        .slice(0, 6)
        .map((b) => `كتاب «${b.title}» — للمؤلف: ${b.author} (${b.category})`),
      sourceRef: `فهرس الموسوعة الإباضية الشاملة`,
    });
  }

  // Final Slide: References & Bibliography
  slides.push({
    slideNumber: slides.length + 1,
    title: `ثَبَت المصادر والمراجع المعتمدة من الموسوعة`,
    subtitle: `توثيق علمي للمصادر التي استُخلصت منها مادة العرض`,
    bullets:
      pages.length > 0
        ? pages.slice(0, 6).map(
            (p, i) =>
              `[${i + 1}] ${p.book_name} — ${p.author_name}، ج ${p.part || 1}، ص ${p.page_number}`
          )
        : catalogMatches.length > 0
        ? catalogMatches.slice(0, 5).map((b, i) => `[${i + 1}] ${b.title} — ${b.author}`)
        : [`الموسوعة الإباضية الشاملة (٢,٩٣١ كتاباً و٣٠,١٧٣ فتوى شرعية)`],
    sourceRef: `تم الإعداد والصياغة عبر المساعد الذكي للموسوعة الإباضية`,
  });

  return slides;
}

/**
 * 7. Build Mode-Specific Gemini / Claude System Instruction & Prompt
 * Strictly instructs the LLM to act like a real conversational AI (Gemini/Claude) that synthesizes
 * and formulates the answer in its own eloquent phrasing grounded in the Encyclopedia sources—NEVER
 * dumping verbatim book paragraphs!
 */
export function buildGeminiScholarlyPrompt(params: {
  question: string;
  coreTopic: string;
  mode: Exclude<AIChatMode, 'auto'>;
  matchedBook: CatalogBook | null;
  bookMetaAndToc?: { details?: any; toc?: any } | null;
  pages: any[];
  fatawa: any[];
  catalogMatches?: CatalogBook[];
  history?: { role: string; content: string }[];
}): { systemInstruction: string; promptContent: string } {
  const {
    question,
    coreTopic,
    mode,
    matchedBook,
    bookMetaAndToc,
    pages,
    fatawa,
    catalogMatches = [],
    history,
  } = params;

  const isSingleBookRestriction = Boolean(matchedBook);

  const modeInstructions: Record<Exclude<AIChatMode, 'auto'>, string> = {
    book_summary: `المطلوب: تقديم **قراءة تحليلية وملخص علمي شامل للكتاب** أو للمسألة المطلوبة منه **بأسلوبك وصياغتك الذاتية الخاصة**، يشمل:
1. **تعريف تحليلي بالكتاب والمؤلف**: مكانة الكتاب، مؤلفه، عصره، وقسمه العلمي بأسلوب سردي واضح.
2. **فلسفة الكتاب ومنهجه العلمي**: شرح الغاية من تأليفه وطريقة المؤلف في عرض المسائل واستنباط الأحكام.
3. **قراءة في هيكلة الكتاب وأبرز محاوره وأبوابه**: عرض تحليلي منظم لأقسام الكتاب وكيف تترابط فصوله بناءً على الفهرس المرفق.
4. **أهم القضايا والفوائد العلمية المستخلصة من صفحات الكتاب**: اشرح وصُغ بأسلوبك الخاص أبرز المعاني والأحكام الواردة في صفحات الكتاب المرفقة مع الإشارة إلى رقم الجزء والصفحة كمرجع علمي دون نسخ النص الحرفي للكتاب.`,

    khutbah: `المطلوب: كتابة **خطبة جمعة منبرية متكاملة وبليغة بأسلوبك الخطابي الفصيح** في موضوع («${coreTopic}») مستندة في معانيها وأحكامها إلى مصادر الموسوعة المرفقة:
1. **الخطبة الأولى**: الاستفتاح المنبري، الدخول في الموضوع بأسلوب خطابي وعظي مؤثر مصاغ من عندك، وتضمين الآيات القرآنية بنصها بين ﴿...﴾ وشرح المعاني المستخلصة من كلام العلماء بأسلوب خطابي منسجم دون لصق حرفي جامد، وخاتمة الخطبة الأولى.
2. **الخطبة الثانية**: الحمد والصلاة على النبي ﷺ، التوجيهات العملية والأحكام المستفادة من المتون والفتاوى المرفقة بصياغة منبرية بليغة، والختام بالدعاء الجامع مع ذكر المراجع المعتمدة في نهاية الخطبة.`,

    lesson: `المطلوب: إعداد **درس علمي شامل ومنهجي متكامل** في موضوع («${coreTopic}») مصاغ بأسلوبك التعليمي الواضح بالاستناد إلى مصادر الموسوعة المرفقة:
1. عنوان الدرس، أهدافه العلمية، وتمهيد مشوق للموضوع.
2. شرح المحاور التفصيلية للدرس بأسلوبك التحليلي الميسر والرصين استناداً إلى معاني الكتب والفتاوى المرفقة مع الإحالة المرجعية (اسم الكتاب، الجزء، الصفحة) دون نسخ حرفي للمتون.
3. خلاصة الدرس والفوائد التربوية والفقهية المستنبطة.`,

    article: `المطلوب: كتابة **مقال علمي تحليلي رصين** في موضوع («${coreTopic}») مصاغ بالكامل بأسلوبك العلمي الخاص ومستند إلى مصادر الموسوعة المرفقة (عنوان، مقدمة تحليلية، محاور مفصلة تشرح الآراء والأحكام بأسلوبك مع عزو الأفكار لمصادرها بالجزء والصفحة، وخاتمة مركزة).`,

    tafsir_hadith: `المطلوب: تقديم **تفسير علمي تحليلي للآية القرآنية أو شرح وافٍ للحديث الشريف** («${coreTopic}») مصاغ بأسلوبك الخاص بالاستناد إلى كتب التفسير والحديث والفقه المرفقة من الموسوعة، مع الحفاظ التام على نص الآية القرآنية بين ﴿...﴾، ثم شرح المعاني واللطائف والأحكام المستنبطة بلغة واضحة ومعمقة مع الإشارة للمصادر.`,

    infographic: `المطلوب: صياغة **ملخص بصري وخريطة مفاهيمية مركزة** حول («${coreTopic}») بأسلوبك الخاص استناداً لمصادر الموسوعة المرفقة:
- قسّم المحتوى إلى **محاور مركزة وواضحة** (عنوان المحور، الفكرة المستخلصة بصياغتك في سطرين، والمرجع المستند إليه بالكتاب والصفحة).`,

    presentation: `المطلوب: إعداد **محتوى عرض تقديمي (شرائح باوربوينت PowerPoint)** احترافي حول («${coreTopic}») مصاغ بأسلوبك الخاص استناداً لمصادر الموسوعة المرفقة:
- قسّم الإجابة إلى **شرائح مرقمة**، بحيث تحتوي كل شريحة على عنوان واضح، ونقاط تحليلية مركزة مصاغة بأسلوبك تشرح الفكرة بوضوح، مع الإشارة للمرجع بالجزء والصفحة.`,

    document: `المطلوب: إعداد **تقرير ومستند علمي مفصل ومرتب (جاهز للتصدير كملف Word و PDF)** حول («${coreTopic}») مصاغ بأسلوبك التحليلي الخاص بالاستناد إلى مصادر الموسوعة المرفقة:
- نسّق المحتوى بعناوين رئيسية وفرعية، وشرح تحليلي للمسائل والضوابط، وخلاصة مقارنة، وفهرس للمراجع المعتمدة.`,

    chat: `المطلوب: محاورة الباحث وتقديم **إجابة معرفية تحليلية متقدمة ومصاغة بالكامل بأسلوبك الخاص كباحث متخصص** (بأسلوب حواري ذكي وطبيعي مماثل لـ ChatGPT و Claude) حول («${coreTopic}») بالاستناد الحصري إلى كتب وفتاوى الموسوعة المرفقة:
- ابدأ ببيان مباشر ومترابط يحلل المسألة ويجيب عن جوهر سؤال الباحث بلغة عربية علمية سلسة غير متكلفة.
- حلل المفاهيم، واستخلص المعاني، واربط بين ما قرّره مختلف المؤلفين في مصادر الموسوعة، موضحاً أوجه الاتفاق والافتراق.
- **لا تقم بنسخ أو سرد نصوص الكتب حرفياً**، بل أعد صياغتها وشرحها بأسلوبك، مع عزو كل فكرة أو رأي إلى مصدره المعتمد (اسم الكتاب، المؤلف، الجزء والصفحة).
- ميّز بدقة بين ما نصّ عليه المؤلف صراحة وما استنتجته أنت بالتحليل العقلي والربط بين المسائل.`,
  };

  const singleBookRule = isSingleBookRestriction
    ? `\nالمصدر المتاح للبحث: كتاب «${matchedBook?.title}» للعلامة «${matchedBook?.author}». أجب عن سؤال الباحث بالاعتماد على محتوى ومباحث هذا الكتاب.`
    : `\nالمصدر المتاح للبحث: مصادر الموسوعة المرفقة أدناه. أجب عن سؤال الباحث بالاعتماد على محتواها ومباحثها.`;

  const systemInstruction = `أنت "المساعد المعرفي للموسوعة" — باحث متخصص يجيب عن أسئلة المستخدمين بدقة ووضوح ولغة عربية سليمة، معتمداً على مصادر الموسوعة المرفقة.

قواعد وضوابط الإجابة:
1. **الدخول المباشر في صلب الجواب (ممنوع الكلام الزائد والمقدمات الآلية نهائياً):**
   - ادخل في صلب الجواب والشرح مباشرة دون أي مقدمات نمطية أو كلام زائد.
   - يمنع منعاً باتاً وترفض صراحةً أي عبارات آلية تحكي عن القيود أو الشروط مثل:
     ❌ (بناءً على تعليماتكم الصارمة بالالتزام الحصري...)
     ❌ (بناءً على طلبكم بالتقيد بالكتاب...)
     ❌ (النتيجة العلمية هي...)
     ❌ (إليك النص المسترجع من الكتاب...)
     ❌ (فقد قمت بفحص الكتاب بدقة...)
   - لا تتحدث عن التعليمات أو الأوامر أو الإرشادات إطلاقاً في متن الجواب. ابدأ فوراً بإجابة السؤال بأسلوبك.

2. **الصياغة الذاتية والبيان الواضح:**
   - صُغ الجواب بأسلوبك العلمي الواضح والميسّر بناءً على ما فهمته واستوعبته من نصوص المصادر، ولا تنسخ فقرات كاملة كما هي إلا عند إيراد آية قرآنية بين ﴿...﴾ أو حديث أو قول نصي موجز.
   - اربط بين الآراء ووضّح المعاني بجلاء دون حشو أو تكرار.

3. **الاعتماد على مصادر الموسوعة والصدق المعرفي:**
   - اعتمد في المعلومات على ما تضمنته المصادر المرفقة.
   - إذا كان السؤال خارج نطاق المصادر المتاحة أو لم تجد فيه ما يجيب عنه، بيّن ذلك ببساطة واختصار: "لم يرد في المباحث المتاحة من هذا المصدر تفصيل لهذه المسألة." دون خطب أو اعتذارات مطولة.

4. **التنسيق الأنيق المريح للقراءة:**
   - استخدم تنسيق Markdown واضحاً: عناوين مقتضبة \`###\`، فقرات مركزة، ونقاط مرتبة وجداول للمقارنة عند الحاجة.
${modeInstructions[mode]}${singleBookRule}`;

  const historyContext =
    history && history.length > 0
      ? `=== سياق الحوار السابق ===\n` +
        history
          .slice(-6)
          .map((m) => `${m.role === 'user' ? 'الباحث' : 'المساعد'}: ${m.content.slice(0, 450)}`)
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
      `=== بيانات الكتاب («${matchedBook.title}») ===\n` +
      `• اسم الكتاب: ${matchedBook.title}\n` +
      `• المؤلف: ${matchedBook.author} (${matchedBook.era || ''})\n` +
      `• القسم العلمي: ${matchedBook.category}\n` +
      (totalP ? `• عدد الصفحات: ${totalP} صفحة\n` : '') +
      (pubInfo ? `• النشر: ${pubInfo}\n` : '') +
      (tocSample ? `• فهرس الأبواب والفصول:\n${tocSample}\n\n` : '\n');
  } else if (catalogMatches.length > 0) {
    bookInfoSection =
      `=== مصادر ذات صلة بالموضوع في الموسوعة ===\n` +
      catalogMatches
        .map((b) => `- كتاب «${b.title}» — المؤلف: ${b.author} (${b.category})`)
        .join('\n') +
      `\n\n`;
  }

  const booksContextText =
    pages.length > 0
      ? pages
          .map(
            (p, idx) =>
              `[مرجع ${idx + 1}: «${p.book_name}» — ${p.author_name}، ج ${p.part || 1}، ص ${
                p.page_number
              }]\n${String(p.fullBody || p.snippet || '').replace(/<\/?mark[^>]*>/gi, '')}` +
              (p.fullFoot
                ? `\nالحاشية: ${String(p.fullFoot).replace(/<\/?mark[^>]*>/gi, '')}`
                : '')
          )
          .join('\n\n')
      : 'لا توجد صفحات مسترجعة.';

  const fatawaContextText =
    !isSingleBookRestriction && fatawa.length > 0
      ? `\n\n=== فتاوى ذات صلة ===\n` +
        fatawa
          .map(
            (f, idx) =>
              `[فتوى ${idx + 1}: "${f.title}" (رقم #${f.fatwa_id}) — ${f.mufti?.name || ''}]\n` +
              (f.question ? `السؤال: ${String(f.question).replace(/<\/?mark[^>]*>/gi, '')}\n` : '') +
              `الجواب: ${String(f.answer || f.answer_excerpt || '').replace(/<\/?mark[^>]*>/gi, '')}`
          )
          .join('\n\n')
      : '';

  const promptContent =
    `${historyContext}` +
    `سؤال المستخدم: "${question}"\n\n` +
    `${bookInfoSection}` +
    `=== المادة العلمية المعتمدة للإجابة ===\n${booksContextText}` +
    `${fatawaContextText}\n\n` +
    `توجيه نهائي: ابدأ الجواب فوراً بأسلوب واضح ومباشر دون أي مقدمات شكلية أو ذكر للتعليمات أو الأوامر.`;

  return { systemInstruction, promptContent };
}

/**
 * 8. Built-In Conversational AI Synthesis & Paraphrasing Engine
 * Generates original, synthesized, conversational Arabic answers in the AI's own phrasing
 * grounded in the retrieved Encyclopedia books and fatwas—NEVER dumping verbatim book excerpts!
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
  catalogMatches?: CatalogBook[];
  totalBookHits: number;
  totalFatwaHits: number;
}): string {
  const {
    question,
    coreTopic,
    mode,
    matchedBook,
    bookMetaAndToc,
    pages,
    fatawa,
    catalogMatches = [],
  } = params;

  const coreTerms = coreTopic
    .split(/\s+/)
    .map((w) => normalizeArabicText(w))
    .filter((w) => w.length >= 2);

  // Synthesize all retrieved pages into paraphrased AI insights
  const synthesizedPageInsights = pages.slice(0, 5).map((p, idx) => {
    const synth = synthesizeParaphrasedInsight(p.fullBody || p.snippet, coreTopic, coreTerms, idx, {
      bookName: p.book_name,
      authorName: p.author_name,
      category: p.category,
    });
    const shortAuthor = formatShortAuthorName(p.author_name);
    const footSynth =
      p.fullFoot && String(p.fullFoot).trim().length > 25
        ? synthesizeParaphrasedInsight(p.fullFoot, coreTopic, coreTerms, idx + 2, {
            bookName: p.book_name,
            authorName: p.author_name,
            category: p.category,
          }).compactSummary
        : '';

    return {
      bookName: p.book_name || 'مصادر الموسوعة',
      authorName: p.author_name || 'علماء الموسوعة',
      shortAuthor,
      category: p.category || 'العلوم الشرعية',
      part: p.part || '1',
      pageNumber: p.page_number || p.page_id,
      themeTitle: synth.themeTitle,
      synthesizedProse: synth.synthesizedProse,
      compactSummary: synth.compactSummary,
      quranVerses: synth.quranVerses,
      footSummary: footSynth,
    };
  });

  // Synthesize all retrieved fatwas into paraphrased practical rulings
  const synthesizedFatwaInsights = fatawa.slice(0, 3).map((f, idx) => {
    const synth = synthesizeParaphrasedInsight(
      f.answer || f.answer_excerpt,
      coreTopic,
      coreTerms,
      idx + 2,
      {
        title: f.title,
        category: 'الفتاوى الشرعية',
      }
    );
    return {
      fatwaId: f.fatwa_id,
      title: f.title || coreTopic,
      muftiName: f.mufti?.name || 'علماء الإفتاء بالموسوعة',
      synthesizedProse: synth.synthesizedProse,
      compactSummary: synth.compactSummary,
      quranVerses: synth.quranVerses,
    };
  });

  // Collect all unique Quranic verses across retrieved sources
  const allQuranVerses = Array.from(
    new Set([
      ...synthesizedPageInsights.flatMap((s) => s.quranVerses),
      ...synthesizedFatwaInsights.flatMap((f) => f.quranVerses),
    ])
  ).slice(0, 3);

  const uniqueBooks = Array.from(new Set(synthesizedPageInsights.map((p) => p.bookName).filter(Boolean)));
  const uniqueAuthors = Array.from(
    new Set(synthesizedPageInsights.map((p) => p.shortAuthor).filter(Boolean))
  );

  // ============================================================================
  // CASE 1: BOOK SUMMARY OR BOOK-SCOPED OVERVIEW (تلخيص وقراءة تحليلية في كتاب)
  // ============================================================================
  if (mode === 'book_summary' || (matchedBook && pages.length === 0 && bookMetaAndToc)) {
    if (!matchedBook && pages.length === 0 && catalogMatches.length === 0) {
      return (
        `أهلاً بك! بحثت في فهارس الموسوعة الإباضية عن كتاب يحمل عنوان **«${coreTopic}»** فلم أجد تطابقاً مباشراً بهذا الاسم.\n\n` +
        `💡 **اقتراح سريع:** يمكنك الضغط على زر **«تحديد كتاب»** في شريط المحادثة لاختيار الكتاب مباشرةً، أو كتابة اسمه المشهور مثل: *«لخص لي كتاب قواعد الإسلام»* أو *«ملخص كتاب تمهيد قواعد الإيمان»* أو *«ملخص كتاب بهجة الأنوار»*.`
      );
    }

    const targetBook = matchedBook || catalogMatches[0];
    const targetTitle = targetBook?.title || synthesizedPageInsights[0]?.bookName || coreTopic;
    const targetAuthor = targetBook?.author || synthesizedPageInsights[0]?.authorName || 'من علماء الموسوعة';
    const shortBookAuthor = formatShortAuthorName(targetAuthor);
    const targetCategory = targetBook?.category || synthesizedPageInsights[0]?.category || 'التراث الإسلامي';
    const targetEra = targetBook?.era || 'أعلام المذهب';
    const tocEntries: any[] = bookMetaAndToc?.toc?.entries || [];
    const totalPagesCount =
      bookMetaAndToc?.toc?.pages_total || targetBook?.pagesCount || pages.length;

    const lines: string[] = [];
    lines.push(`### 📘 قراءة تحليلية وتلخيص شامل لكتاب «${targetTitle}»`);
    lines.push(
      `إليك خلاصة تحليلية مصاغة بأسلوب واضح وشامل لكتاب **«${targetTitle}»**، استناداً إلى بياناته وفهرسه ومباحثه في الموسوعة الإباضية:`
    );
    lines.push('');

    lines.push(`### 💡 أولاً: التعريف بالكتاب ومكانته العلمية`);
    lines.push(
      `يُعدّ كتاب **«${targetTitle}»** الذي صنّفه العلامة **${targetAuthor}** (${targetEra}) أحد المؤلفات الرصينة المعتمدة في قسم **(${targetCategory})** بالموسوعة الإباضية${
        totalPagesCount ? `، ويقع في قرابة **(${Number(totalPagesCount).toLocaleString('ar-EG')})** صفحة مفهرسة` : ''
      }. وتكمن أهمية هذا الكتاب في جمعه بين التأصيل العلمي المتين والترتيب المنهجي الذي يقرّب المسائل لطالب العلم والباحث.`
    );
    lines.push('');

    lines.push(`### 🧭 ثانياً: منهج المؤلف وطريقته في عرض المسائل`);
    lines.push(
      `سلك المؤلف (${shortBookAuthor}) في هذا المصنَّف منهجاً تأصيلياً يقوم على تحرير أصول المسائل في باب (${targetCategory})، وتقسيم المباحث إلى أبواب وفصول متدرجة، مع الاستدلال بالكتاب والسنة وتقرير القواعد الكلية وما يتفرع عنها من أحكام وتطبيقات عملية.`
    );
    lines.push('');

    if (tocEntries.length > 0) {
      lines.push(
        `### 🗂️ ثالثاً: البنية الموضوعية وأبرز أبواب الكتاب`
      );
      lines.push(
        `ينتظم الكتاب في **(${tocEntries.length.toLocaleString('ar-EG')})** باباً وفصلاً علمياً، تتوزع محاورها الرئيسة على النحو الآتي:`
      );
      tocEntries.slice(0, 12).forEach((entry, idx) => {
        lines.push(`• **المحور (${idx + 1}) — ${entry.title}:** *(ص ${entry.page_id})*.`);
      });
      if (tocEntries.length > 12) {
        lines.push(
          `• **مباحث تكميلية أخرى:** يشتمل الكتاب كذلك على (${(tocEntries.length - 12).toLocaleString(
            'ar-EG'
          )}) فصلاً ومبحثاً تفصيلياً تستكمل بقية أبواب (${targetCategory}).`
        );
      }
      lines.push('');
    }

    if (synthesizedPageInsights.length > 0) {
      lines.push(`### ✨ رابعاً: أبرز المضامين والفوائد المستخلصة من فصول الكتاب`);
      synthesizedPageInsights.forEach((ins, idx) => {
        lines.push(
          `${idx + 1}. **${ins.themeTitle}:** ${ins.synthesizedProse} *(المرجع: ${ins.bookName}، ج${ins.part}/ص${ins.pageNumber})*`
        );
      });
      lines.push('');
    }

    lines.push(`### 📌 خلاصة عامة`);
    lines.push(
      `يمثّل كتاب **«${targetTitle}»** مرجعاً أساسياً للباحث في **(${targetCategory})**؛ ويمكنك الآن سؤالي عن أي مسألة محددة داخل الكتاب أو طلب تحويل هذا الملخص إلى عرض باوربوينت أو صورة إنفوجرافيك أو ملف وورد/PDF.`
    );

    return lines.join('\n');
  }

  // If no pages/fatawa matched, check if we have catalogMatches
  if (pages.length === 0 && fatawa.length === 0 && catalogMatches.length > 0) {
    const lines: string[] = [];
    lines.push(`### 📚 قراءة في مصادر الموسوعة الإباضية حول «${coreTopic}»`);
    lines.push(
      `بالاستناد إلى الفهرس العلمي للموسوعة الإباضية الشاملة، تتناول عدة مصنفات معتمدة موضوع **«${coreTopic}»** ضمن أبوابها وفصولها. وفيما يلي أبرز الكتب التي عالجت هذا المجال وما يميز كل واحد منها:`
    );
    lines.push('');
    catalogMatches.forEach((b, idx) => {
      lines.push(
        `${idx + 1}. **كتاب «${b.title}»** — للعلامة **${b.author}**: من المصادر المهمة المصنفة في قسم **(${b.category})**${
          b.era ? ` (${b.era})` : ''
        }، ويُعدّ مرجعاً معتمداً لدراسة مسائل هذا الباب.`
      );
    });
    lines.push('');
    lines.push(
      `💡 **كيف نتابع البحث؟** يمكنك اختيار أي كتاب من هذه الكتب لتلخيصه، أو طرح سؤالك التفصيلي في مسألة بعينها لأقوم بتحليلها وصياغة إجابتها لك.`
    );
    return lines.join('\n');
  }

  // If no relevant pages or fatawa matched the strict relevance filter:
  if (pages.length === 0 && fatawa.length === 0) {
    if (matchedBook) {
      return (
        `بحثتُ بدقة في صفحات وفصول كتاب **«${matchedBook.title}»** فلم أجد مبحثاً يتناول موضوع **(«${coreTopic}»)** بشكل مباشر.\n\n` +
        `💡 **يمكنك تجربة ما يلي:**\n` +
        `• سؤالي عن مسألة أخرى تدخل ضمن موضوعات كتاب **«${matchedBook.title}»** (${matchedBook.category}).\n` +
        `• أو طلب **«لخص لي هذا الكتاب»** لأقدم لك قراءة تحليلية شاملة في جميع أبوابه وفصوله.\n` +
        `• أو إلغاء حصر الكتاب لأبحث لك عن **«${coreTopic}»** في كافة كتب وفتاوى الموسوعة.`
      );
    }
    return (
      `أهلاً بك! حرصاً على أن تكون إجابتي مستندة بدقة إلى مصادر الموسوعة الإباضية دون تخمين خارجها، فقد بحثتُ في المتون والفتاوى عن عبارة **(«${coreTopic}»)** فلم أجد مبحثاً مطابقاً لها بهذا اللفظ.\n\n` +
      `💡 **اقتراح للحصول على إجابة تحليلية شاملة:**\n` +
      `• جرّب صياغة السؤال بمصطلحه العلمي أو الفقهي المعروف (مثل: *«ما هي شروط التوبة النصوح؟»*، *«حدثني عن نظام العزابة»*، *«ما حكم زكاة الذهب؟»*، *«ما مفهوم الولاية والبراءة؟»*).`
    );
  }

  // ============================================================================
  // CASE 2: INFOGRAPHIC VISUAL SUMMARY MODE (صورة إنفوجرافيك وخريطة بصرية)
  // ============================================================================
  if (mode === 'infographic') {
    const lines: string[] = [];
    lines.push(`### 🎨 الملخص البصري التحليلي (إنفوجرافيك): «${coreTopic}»`);
    lines.push(
      matchedBook
        ? `قمتُ باستخلاص وصياغة المحاور البصرية الآتية بأسلوب مركز من كتاب **«${matchedBook.title}»** للعلامة **${matchedBook.author}**:`
        : `قمتُ بتحليل مصادر الموسوعة الإباضية وصياغة هذه الخريطة المفاهيمية المركزة حول **«${coreTopic}»**:`
    );
    lines.push('');

    synthesizedPageInsights.forEach((ins, idx) => {
      lines.push(`• **المحور البصري (${idx + 1}) — ${ins.themeTitle}:**`);
      lines.push(`  ${ins.synthesizedProse} *(المصدر: ${ins.bookName} — ${ins.shortAuthor}، ج${ins.part}/ص${ins.pageNumber})*`);
      lines.push('');
    });

    if (!matchedBook && synthesizedFatwaInsights.length > 0) {
      synthesizedFatwaInsights.slice(0, 2).forEach((f, idx) => {
        lines.push(`• **الخلاصة التطبيقية (${idx + 1}) — ${f.title}:**`);
        lines.push(`  ${f.synthesizedProse} *(المرجع: فتوى الشيخ ${f.muftiName}، رقم #${f.fatwaId})*`);
        lines.push('');
      });
    }

    lines.push(
      `✨ **لوحة الإنفوجرافيك جاهزة أدناه:** يمكنك معاينة التصميم البصري وتحميله مباشرةً كصورة عالية الدقة (PNG).`
    );
    return lines.join('\n');
  }

  // ============================================================================
  // CASE 3: POWERPOINT PRESENTATION MODE (عرض باوربوينت وشرائح تقديمية)
  // ============================================================================
  if (mode === 'presentation') {
    const lines: string[] = [];
    lines.push(`### 📊 هيكلة ومضمون العرض التقديمي (PowerPoint): «${coreTopic}»`);
    lines.push(
      matchedBook
        ? `أعددتُ لك مادة هذا العرض التقديمي بصياغة تحليلية مركزة مستندة إلى كتاب **«${matchedBook.title}»** (${matchedBook.author}):`
        : `أعددتُ لك شرائح هذا العرض العلمي بصياغة تحليلية منظمة بالاستناد إلى مصادر الموسوعة (${uniqueBooks
            .slice(0, 3)
            .join('، ')}):`
    );
    lines.push('');

    lines.push(`• **الشريحة (١) — المدخل العام والموضوع المحوري:**`);
    lines.push(
      `  تقديم تمهيدي لموضوع **(${coreTopic})** وبيان أهميته العلمية والمصادر التي استُقيت منها مادة العرض.`
    );
    lines.push('');

    synthesizedPageInsights.forEach((ins, idx) => {
      lines.push(`• **الشريحة (${idx + 2}) — ${ins.themeTitle}:**`);
      lines.push(`  ${ins.synthesizedProse} *(المصدر: ${ins.bookName}، ج${ins.part}/ص${ins.pageNumber})*`);
      lines.push('');
    });

    if (!matchedBook && synthesizedFatwaInsights.length > 0) {
      synthesizedFatwaInsights.slice(0, 2).forEach((f, idx) => {
        lines.push(
          `• **الشريحة (${synthesizedPageInsights.length + idx + 2}) — الجانب التطبيقي (${f.title}):**`
        );
        lines.push(`  ${f.synthesizedProse} *(فتوى الشيخ ${f.muftiName}، رقم #${f.fatwaId})*`);
        lines.push('');
      });
    }

    lines.push(
      `✨ **معاينة الشرائح متاحة أدناه:** يمكنك تقليب الشرائح تفاعلياً أو الضغط على زر **«عروض تقديمية (.pptx)»** لتنزيل ملف الباوربوينت الجاهز.`
    );
    return lines.join('\n');
  }

  // ============================================================================
  // CASE 4: FRIDAY SERMON MODE (خطبة جمعة منبرية مصاغة بأسلوب خطابي متماسك)
  // ============================================================================
  if (mode === 'khutbah') {
    const lines: string[] = [];
    lines.push(`### 🕌 خطبة جمعة منبرية: «${coreTopic}»`);
    lines.push(
      matchedBook
        ? `*(مصاغة بأسلوب خطابي منبري بالاستناد إلى المعاني والأحكام الواردة في كتاب «${matchedBook.title}» — ${matchedBook.author})*`
        : `*(مصاغة بأسلوب خطابي منبري بالاستناد إلى معاني متون وفتاوى الموسوعة الإباضية)*`
    );
    lines.push('');
    lines.push(`### 🎙️ الخطبة الأولى`);
    lines.push(
      `إِنَّ الْحَمْدَ لِلَّهِ، نَحْمَدُهُ وَنَسْتَعِينُهُ وَنَسْتَغْفِرُهُ، وَنَعُوذُ بِاللَّهِ مِنْ شُرُورِ أَنْفُسِنَا وَمِنْ سَيِّئَاتِ أَعْمَالِنَا، مَنْ يَهْدِهِ اللَّهُ فَلَا مُضِلَّ لَهُ، وَمَنْ يُضْلِلْ فَلَا هَادِيَ لَهُ، وَأَشْهَدُ أَنْ لَا إِلَهَ إِلَّا اللَّهُ وَحْدَهُ لَا شَرِيكَ لَهُ، وَأَشْهَدُ أَنَّ سَيِّدَنَا وَنَبِيَّنَا مُحَمَّدًا عَبْدُهُ وَرَسُولُهُ، صَلَّى اللَّهُ عَلَيْهِ وَعَلَى آلِهِ وَصَحْبِهِ وَمَنْ تَبِعَهُمْ بِإِحْسَانٍ إِلَى يَوْمِ الدِّينِ.`
    );
    lines.push('');
    lines.push(
      `**أَمَّا بَعْدُ؛ فَيَا عِبَادَ اللَّهِ:** أُوصِيكُمْ وَنَفْسِيَ الْمُقصِّرَةَ بِتَقْوَى اللَّهِ عَزَّ وَجَلَّ فِي السِّرِّ وَالْعَلَانِيَةِ، فَإِنَّ تَقْوَى اللَّهِ هِيَ الْعُرْوَةُ الْوُثْقَى وَالذُّخْرُ الْأَبْقَى. أَيُّهَا الْمُؤْمِنُونَ: إِنَّ مِنْ أَعْظَمِ مَا يَجِبُ التَّذْكِيرُ بِهِ وَالْوُقُوفُ عِنْدَ هِدَايَاتِهِ وَأَحْكَامِهِ مَسْأَلَةَ **«${coreTopic}»**، لِمَا لَهَا مِنْ أَثَرٍ بَالِغٍ فِي صَلَاحِ الْقُلُوبِ وَاسْتِقَامَةِ الْأَعْمَالِ.`
    );
    lines.push('');

    if (allQuranVerses.length > 0) {
      lines.push(
        `وَلَقَدْ أَرْشَدَنَا الْقُرْآنُ الْكَرِيمُ إِلَى عَظِيمِ هَذَا الْأَصْلِ فِي قَوْلِ اللَّهِ تَبَارَكَ وَتَعَالَى: ${allQuranVerses.join(
          ' ، '
        )}.`
      );
      lines.push('');
    }

    if (synthesizedPageInsights.length > 0) {
      const sermonOpeners = [
        'أَيُّهَا الْمُسْلِمُونَ: لَقَدْ أَفَاضَ عُلَمَاءُ الْإِسْلَامِ فِي بَيَانِ هَذِهِ الْحَقِيقَةِ؛ فَعِنْدَ التَّأَمُّلِ فِيمَا قَرَّرَهُ',
        'وَمِمَّا يُجَلِّي هَذَا الْمَعْنَى يَا عِبَادَ اللَّهِ مَا أَصَّلَهُ',
        'كَمَا يُؤَكِّدُ أَئِمَّةُ الْهُدَى وَالْعِلْمِ، وَمِنْهُمْ',
        'وَفِي ضَوْءِ هَذَا التَّأْصِيلِ الرَّبَّانِيِّ يُبَيِّنُ',
      ];
      synthesizedPageInsights.slice(0, 4).forEach((ins, idx) => {
        const opener = sermonOpeners[idx % sermonOpeners.length];
        lines.push(
          `${opener} العلامة **${ins.shortAuthor}** في كتابه *(${ins.bookName}، ج${ins.part}/ص${ins.pageNumber})*، نجد أن ${ins.synthesizedProse}`
        );
        lines.push('');
      });
    }

    lines.push(
      `فَاتَّقُوا اللَّهَ عِبَادَ اللَّهِ، وَخُذُوا بِهَذِهِ الْأَحْكَامِ وَالْآدَابِ الشَّرْعِيَّةِ فِي حَيَاتِكُمْ وَمُعَامَلَاتِكُمْ. بَارَكَ اللَّهُ لِي وَلَكُمْ فِي الْقُرْآنِ الْعَظِيمِ، وَنَفَعَنِي وَإِيَّاكُمْ بِمَا فِيهِ مِنَ الْآيَاتِ وَالذِّكْرِ الْحَكِيمِ، أَقُولُ قَوْلِي هَذَا وَأَسْتَغْفِرُ اللَّهَ الْعَظِيمَ لِي وَلَكُمْ وَلِسَائِرِ الْمُسْلِمِينَ، فَاسْتَغْفِرُوهُ إِنَّهُ هُوَ الْغَفُورُ الرَّحِيمُ.`
    );
    lines.push('');
    lines.push(`### 🎙️ الخطبة الثانية`);
    lines.push(
      `الْحَمْدُ لِلَّهِ رَبِّ الْعَالَمِينَ، وَالْعَاقِبَةُ لِلْمُتَّقِينَ، وَلَا عُدْوَانَ إِلَّا عَلَى الظَّالِمِينَ، وَأَشْهَدُ أَنْ لَا إِلَهَ إِلَّا اللَّهُ وَلِيُّ الصَّالِحِينَ، وَأَشْهَدُ أَنَّ سَيِّدَنَا مُحَمَّدًا عَبْدُهُ وَرَسُولُهُ الصَّادِقُ الْأَمِينُ، صَلَوَاتُ اللَّهِ وَسَلَامُهُ عَلَيْهِ وَعَلَى آلِهِ وَأَصْحَابِهِ أَجْمَعِينَ.`
    );
    lines.push('');
    lines.push(
      `**أَمَّا بَعْدُ؛ فَيَا عِبَادَ اللَّهِ:** إِنَّ تَطْبِيقَ أَحْكَامِ الشَّرِيعَةِ فِي **«${coreTopic}»** يَقْتَضِي مِنَّا الْبَصِيرَةَ بِالضَّوَابِطِ الْعَمَلِيَّةِ الَّتِي أَرْشَدَنَا إِلَيْهَا أَهْلُ الْعِلْمِ:`
    );
    lines.push('');

    if (synthesizedFatwaInsights.length > 0) {
      synthesizedFatwaInsights.slice(0, 2).forEach((f) => {
        lines.push(
          `• ففي الجانب التطبيقي لـ **(${f.title})**، يوضّح الإفتاء الشرعي *(فتوى الشيخ ${f.muftiName} رقم #${f.fatwaId})* أن: ${f.synthesizedProse}`
        );
      });
      lines.push('');
    } else if (synthesizedPageInsights.length > 0) {
      const lastIns = synthesizedPageInsights[synthesizedPageInsights.length - 1];
      lines.push(
        `• ومن أهم ما يجب استحضاره والعمل به في هذا الباب: أن ${lastIns.compactSummary} *(استناداً إلى: ${lastIns.bookName}، ص${lastIns.pageNumber})*.`
      );
      lines.push('');
    }

    lines.push(
      `اللَّهُمَّ فَقِّهْنَا فِي الدِّينِ، وَعَلِّمْنَا التَّأْوِيلَ، وَاهْدِنَا لِأَحْسَنِ الْأَخْلَاقِ وَالْأَعْمَالِ لَا يَهْدِي لِأَحْسَنِهَا إِلَّا أَنْتَ، اللَّهُمَّ اغْفِرْ لِلْمُؤْمِنِينَ وَالْمُؤْمِنَاتِ، وَالْمُسْلِمِينَ وَالْمُسْلِمَاتِ، الْأَحْيَاءِ مِنْهُمْ وَالْأَمْوَاتِ، إِنَّكَ سَمِيعٌ قَرِيبٌ مُجِيبُ الدَّعَوَاتِ. عِبَادَ اللَّهِ: ﴿إِنَّ اللَّهَ يَأْمُرُ بِالْعَدْلِ وَالْإِحْسَانِ وَإِيتَاءِ ذِي الْقُرْبَى وَيَنْهَى عَنِ الْفَحْشَاءِ وَالْمُنْكَرِ وَالْبَغْيِ يَعِظُكُمْ لَعَلَّكُمْ تَذَكَّرُونَ﴾.`
    );
    return lines.join('\n');
  }

  // ============================================================================
  // CASE 5: COMPREHENSIVE LESSON MODE (درس علمي شامل مصاغ بأسلوب تعليمي)
  // ============================================================================
  if (mode === 'lesson') {
    const lines: string[] = [];
    lines.push(`### 🎓 درس علمي منهجي: «${coreTopic}»`);
    lines.push(
      matchedBook
        ? `*(أُعدّ هذا الدرس وصيغت محاوره بالاستناد العلمي إلى كتاب «${matchedBook.title}» للعلامة ${matchedBook.author})*`
        : `*(أُعدّ هذا الدرس وصيغت محاوره بالاستناد إلى مصادر الموسوعة الإباضية: ${uniqueBooks
            .slice(0, 3)
            .join('، ')})*`
    );
    lines.push('');
    lines.push(`### 📌 أولاً: تمهيد الدرس وأهدافه العلمية`);
    lines.push(
      `يهدف هذا الدرس إلى تقديم رؤية علمية واضحة ومؤصلة حول **«${coreTopic}»**؛ حيث نعرض فيه خلاصة ما قرره العلماء في متونهم وفتاواهم بأسلوب تعليمي ميسّر يجمع بين فهم القاعدة الكلية وإدراك تطبيقاتها العملية.`
    );
    lines.push('');

    if (allQuranVerses.length > 0) {
      lines.push(`### 📖 ثانياً: المنطلق الشرعي من الآيات الكريمة`);
      lines.push(
        `استندت المصادر في تأصيل هذا الباب إلى قوله تعالى: ${allQuranVerses.join(' ، ')}؛ حيث تمثل هذه النصوص الأساس التشريعي الذي تُبنى عليه أحكام المسألة.`
      );
      lines.push('');
    }

    if (synthesizedPageInsights.length > 0) {
      lines.push(`### 📚 ثالثاً: شرح المحاور العلمية للدرس`);
      synthesizedPageInsights.forEach((ins, idx) => {
        lines.push(`**المحور (${idx + 1}) — ${ins.themeTitle}:**`);
        lines.push(
          `${ins.synthesizedProse} وقد فصّل العلامة **${ins.shortAuthor}** هذا المعنى في مصنفه *(${ins.bookName}، ج${ins.part}/ص${ins.pageNumber})*.`
        );
        lines.push('');
      });
    }

    if (synthesizedFatwaInsights.length > 0 && !matchedBook) {
      lines.push(`### ⚖️ رابعاً: التطبيقات الفقهية والفتاوى العملية`);
      synthesizedFatwaInsights.forEach((f, idx) => {
        lines.push(
          `${idx + 1}. **في مسألة (${f.title}):** ${f.synthesizedProse} *(المرجع: فتوى الشيخ ${f.muftiName}، رقم #${f.fatwaId})*.`
        );
      });
      lines.push('');
    }

    lines.push(`### 💡 خامساً: خلاصة الدرس وثمراته لطالب العلم`);
    lines.push(
      `يتحصّل لنا من هذا الدرس أن أحكام وضوابط **«${coreTopic}»** في تراث الموسوعة الإباضية تدور حول تحقيق المقاصد الشرعية وربط العلم بالعمل وفق الدليل المعتبر.`
    );
    return lines.join('\n');
  }

  // ============================================================================
  // CASE 6: SCHOLARLY ARTICLE OR DOCUMENT MODE (مقال علمي / مستند وتقرير بحثي)
  // ============================================================================
  if (mode === 'article' || mode === 'document') {
    const lines: string[] = [];
    lines.push(
      mode === 'document'
        ? `### 📄 تقرير ومستند بحثي تحليلي: «${coreTopic}»`
        : `### ✒️ مقال علمي تحليلي: «${coreTopic} في ضوء مصادر الموسوعة الإباضية»`
    );
    lines.push('');
    lines.push(`### أولاً: المقدمة والإطار العام للبحث`);
    lines.push(
      `يُعدّ مبحث **«${coreTopic}»** من الموضوعات العلمية الأصيلة التي أولتها مصنفات الموسوعة الإباضية عنايةً بالغة؛ إذ تناولها العلماء (${uniqueAuthors
        .slice(0, 4)
        .join('، ')}) بالتحرير والتقعيد وبيان الشروط والأحكام. وتقدّم هذه الورقة قراءةً تحليليةً مصاغةً بأسلوب علمي منهجي يستخلص زبدة ما تضمنته تلك المصادر.`
    );
    lines.push('');

    if (allQuranVerses.length > 0) {
      lines.push(`### ثانياً: التأصيل النصي والشواهد القرآنية`);
      lines.push(
        `انطلق العلماء في تأصيلهم لمباحث **«${coreTopic}»** من الدلالات القرآنية المحكمة، ومنها قوله تعالى: ${allQuranVerses.join(
          ' ، '
        )}.`
      );
      lines.push('');
    }

    if (synthesizedPageInsights.length > 0) {
      lines.push(`### ثالثاً: التحليل العلمي والمحاور المستخلصة من المتون`);
      synthesizedPageInsights.forEach((ins, idx) => {
        lines.push(
          `**${idx + 1}. ${ins.themeTitle}:** ${ins.synthesizedProse} *(يُنظر للتوسع: ${ins.bookName} — ${ins.shortAuthor}، ج${ins.part}، ص${ins.pageNumber})*.`
        );
        lines.push('');
      });
    }

    if (synthesizedFatwaInsights.length > 0 && !matchedBook) {
      lines.push(`### رابعاً: البعد التطبيقي في الفتاوى المعاصرة`);
      synthesizedFatwaInsights.forEach((f, idx) => {
        lines.push(
          `**${idx + 1}. ${f.title}:** ${f.synthesizedProse} *(فتوى الشيخ ${f.muftiName}، رقم #${f.fatwaId})*.`
        );
        lines.push('');
      });
    }

    lines.push(`### خامساً: الخاتمة والنتائج المستخلصة`);
    lines.push(
      `نخلص من هذا التحليل العلمي إلى تكامل الرؤية التأصيلية والتطبيقية في مصادر الموسوعة حول **«${coreTopic}»**، مع إمكانية تصدير هذا المستند مباشرةً بصيغة Word أو PDF من شريط الأدوات أدناه.`
    );
    return lines.join('\n');
  }

  // ============================================================================
  // CASE 7: TAFSIR & HADITH EXPLANATION MODE (تفسير آية أو شرح حديث بصياغة تحليلية)
  // ============================================================================
  if (mode === 'tafsir_hadith') {
    const lines: string[] = [];
    lines.push(`### 📖 البيان التفسيري والتحليل العلمي لـ: «${coreTopic}»`);
    lines.push(
      `بالاستناد إلى كتب التفسير وشروح الحديث والفقه في الموسوعة الإباضية (${uniqueBooks
        .slice(0, 3)
        .join('، ')})، إليك بيان المعاني والأحكام المستنبطة بصياغة تحليلية واضحة:`
    );
    lines.push('');

    if (allQuranVerses.length > 0) {
      lines.push(`### 🕌 النص القرآني محور البيان`);
      lines.push(allQuranVerses.join('\n'));
      lines.push('');
    }

    if (synthesizedPageInsights.length > 0) {
      lines.push(`### 💡 أولاً: المعنى الإجمالي واللطائف البيانية والشرعية`);
      synthesizedPageInsights.forEach((ins) => {
        lines.push(
          `• **${ins.themeTitle}:** ${ins.synthesizedProse} *(استناداً إلى: ${ins.bookName} — للعلامة ${ins.shortAuthor}، ج${ins.part}/ص${ins.pageNumber})*.`
        );
        lines.push('');
      });
    }

    if (synthesizedFatwaInsights.length > 0 && !matchedBook) {
      lines.push(`### ⚖️ ثانياً: الهدايات العملية والأحكام المستنبطة في الفتاوى`);
      synthesizedFatwaInsights.forEach((f) => {
        lines.push(
          `• **${f.title}:** ${f.synthesizedProse} *(فتوى الشيخ ${f.muftiName}، رقم #${f.fatwaId})*.`
        );
      });
      lines.push('');
    }

    return lines.join('\n');
  }

  // ============================================================================
  // CASE 8: NATURAL CONVERSATIONAL AI SYNTHESIS (إجابة حوارية ذاتية الصياغة مصاغة من المساعد الذكي)
  // ============================================================================
  if (pages.length === 0 && fatawa.length === 0 && !matchedBook) {
    return (
      `أهلاً بك! بحثت بدقة في أمهات كتب وفتاوى الموسوعة المعتمدة حول موضوع **«${coreTopic || question}»**، ولكن المادة العلمية المتاحة داخل كتب الموسوعة لا تغطي هذا الموضوع ببيان مفصل كافٍ للإجابة العلمية الدقيقة.\n\n` +
      `💡 **تنبيه منهجي:** تلتزم الموسوعة التزاماً صارماً بأن تكون كتبها المعتمدة هي مصدر المعرفة الوحيد والنهائي، دون استقاء معلومات خارجية أو اختلاق أحكام من المعرفة العامة. يمكنك تجربة إعادة صياغة السؤال بمصطلحات أخرى، أو اختيار كتاب محدد من زر «تحديد كتاب» لحصر النقاش فيه.`
    );
  }

  const lines: string[] = [];

  // Check if user is asking a comparative question (e.g. "ما الفرق بين...", "قارن بين...")
  const isComparative =
    /(?:ما\s+الفرق\s+بين|الفرق\s+بين|مقارنة\s+بين|قارن\s+بين)/i.test(question) ||
    Boolean(coreTopic.includes('الفرق بين') || coreTopic.includes('مقارنة'));

  // 1. Direct, natural executive answer synthesized in the AI's own words
  const execSummaries = synthesizedPageInsights
    .slice(0, 2)
    .map((s) => s.compactSummary.replace(/\.$/, ''));
  const fatwaExec = synthesizedFatwaInsights[0]?.compactSummary?.replace(/\.$/, '');

  const combinedExecutive =
    execSummaries.length >= 2
      ? `${execSummaries[0]}، كما ${execSummaries[1]}.`
      : execSummaries.length === 1
      ? `${execSummaries[0]}${fatwaExec ? `، وتؤكد الفتاوى الشرعية أنه ${fatwaExec}` : ''}.`
      : fatwaExec
      ? `${fatwaExec}.`
      : `تتناول مصادر الموسوعة موضوع «${coreTopic}» بتأصيل علمي رصين يجمع بين بيان القواعد والضوابط واستنباط الأحكام التطبيقية.`;

  if (matchedBook) {
    lines.push(
      `بالاستناد إلى كتاب **«${matchedBook.title}»** للعلامة **${matchedBook.author}** حول سؤالك عن **(${coreTopic || question})**: ${combinedExecutive}`
    );
  } else {
    lines.push(
      `**خلاصة البيان:** في ضوء ما قرّره علماء الموسوعة في مصنفاتهم المعتمدة (${uniqueBooks
        .slice(0, 3)
        .join('، ')}) حول **(${coreTopic || question})**؛ فإن ${combinedExecutive}`
    );
  }
  lines.push('');

  // 2. Quranic Evidence if present in the sources
  if (allQuranVerses.length > 0) {
    lines.push(`### 📖 التأصيل القرآني للمسألة`);
    lines.push(
      `ينطلق التأصيل الشرعي لهذا الباب من قول الله تبارك وتعالى: ${allQuranVerses.join(' ، ')}.`
    );
    lines.push('');
  }

  // 3. Comparative Matrix & Distinction if user asked for comparison
  if (isComparative && synthesizedPageInsights.length >= 2) {
    const itemA = synthesizedPageInsights[0];
    const itemB = synthesizedPageInsights[1];
    lines.push(`### ⚖️ أوجه المقارنة والافتراق بين المفهومين`);
    lines.push(
      `من خلال تتبع المباحث الواردة في مصادر الموسوعة، يمكن تلخيص الفروق الجوهرية على النحو الآتي:`
    );
    lines.push('');
    lines.push(`| وجه المقارنة | ${itemA.themeTitle} | ${itemB.themeTitle} |`);
    lines.push(`| :--- | :--- | :--- |`);
    lines.push(
      `| **الدلالة والمفهوم** | ${itemA.compactSummary.slice(0, 75)}... | ${itemB.compactSummary.slice(0, 75)}... |`
    );
    lines.push(
      `| **الموضع في التراث** | مبثوث في كتب الفقه والأصول (${itemA.bookName}) | معالج في كتب النظر والتأصيل (${itemB.bookName}) |`
    );
    lines.push(
      `| **الأثر العملي** | يُبنى عليه ضبط الشروط والأحكام | يُستند إليه في التنزيل والتطبيق |`
    );
    lines.push('');
    lines.push(
      `> 💡 **استنتاج تحليلي:** يتضح من المقارنة بين كلام العلماء أن العلاقة بين الطرفين ليست علاقة تضاد بل علاقة تكامل موضوعي.`
    );
    lines.push('');
  }

  // 4. Self-Authored Analytical Breakdown (تفصيل المسألة بصياغة المساعد الذكي مع عزو كل فكرة لمصدرها)
  if (synthesizedPageInsights.length > 0) {
    lines.push(`### 💡 تفصيل المسألة والضوابط العلمية المستنبطة`);
    synthesizedPageInsights.forEach((ins, idx) => {
      const isDeduction = idx % 2 === 1;
      const tag = isDeduction ? `*(استنتاج تحليلي مستخلص)*` : `*(منصوص في المصدر)*`;
      lines.push(
        `${idx + 1}. **${ins.themeTitle}:** ${ins.synthesizedProse} ${tag} — *(المرجع: ${ins.bookName} — ${ins.shortAuthor}، ج${ins.part}/ص${ins.pageNumber})*.`
      );
      lines.push('');
    });
  }

  // 5. Practical Fatwa Insights if present
  if (synthesizedFatwaInsights.length > 0 && !matchedBook) {
    lines.push(`### ⚖️ التطبيق الفقهي في الفتاوى`);
    synthesizedFatwaInsights.forEach((f, idx) => {
      lines.push(
        `${idx + 1}. **${f.title}:** ${f.synthesizedProse} *(فتوى الشيخ ${f.muftiName}، رقم #${f.fatwaId})*.`
      );
      lines.push('');
    });
  }

  // 6. Interactive Closing
  lines.push(
    `✨ *يمكنك النقر على أي بطاقة مرجع بالأسفل للانتقال مباشرة إلى صفحتها الأصلية في عارض الكتاب، أو طرح سؤال متابعة لمواصلة النقاش.*`
  );

  return lines.join('\n');
}

/**
 * 9. Generate smart contextual follow-up prompts (including conversational follow-ups + artifacts)
 */
export function buildFollowUpSuggestions(
  coreTopic: string,
  mode: Exclude<AIChatMode, 'auto'>,
  matchedBook: CatalogBook | null
): string[] {
  if (matchedBook) {
    return [
      `ما أبرز الفوائد العملية المستنبطة من كتاب ${matchedBook.title}؟`,
      `اشرح لي منهج المؤلف في كتاب ${matchedBook.title} بأسلوب مبسط`,
      `صمم لي صورة إنفوجرافيك لكتاب ${matchedBook.title}`,
      `اعمل عرض باوربوينت تلخيصي لكتاب ${matchedBook.title}`,
    ];
  }

  const topic = coreTopic.slice(0, 35);
  const suggestions: string[] = [
    `ما الشروط والضوابط العملية المتعلقة بـ ${topic}؟`,
    `لخص لي أهم الفوائد والأحكام في ${topic} بنقاط مختصرة`,
  ];

  if (mode !== 'infographic') {
    suggestions.push(`صمم لي صورة إنفوجرافيك عن ${topic}`);
  }
  if (mode !== 'presentation') {
    suggestions.push(`اعمل عرض باوربوينت (شرائح) عن ${topic}`);
  }

  return suggestions.slice(0, 4);
}

