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

  // If matchedBook is active and user only asked to summarize/visualize the book
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
 * 6. Build Structured Infographic Poster Data & PowerPoint Slide Deck Data
 * from the retrieved Encyclopedia books, TOC, and fatwas!
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

  const cleanText = (raw: string, maxLen = 190) => {
    const c = String(raw || '')
      .replace(/<\/?mark[^>]*>/gi, '')
      .replace(/\s+/g, ' ')
      .trim();
    if (!c) return '';
    return c.length > maxLen ? `${c.slice(0, maxLen)}...` : c;
  };

  const arabicNumerals = ['٠١', '٠٢', '٠٣', '٠٤', '٠٥', '٠٦'];
  const nodes: AIInfographicNode[] = [];

  if (matchedBook && (mode === 'book_summary' || pages.length <= 2)) {
    const tocEntries: any[] = bookMetaAndToc?.toc?.entries || [];
    nodes.push({
      number: '٠١',
      title: `التعريف بالكتاب والمؤلف`,
      summary: `كتاب «${matchedBook.title}» للمؤلف (${matchedBook.author}) — مصنف ضمن قسم (${matchedBook.category}) في الموسوعة الإباضية.`,
      sourceRef: `${matchedBook.category} • ${matchedBook.era || 'تراث علمي'}`,
    });

    tocEntries.slice(0, 4).forEach((entry, idx) => {
      nodes.push({
        number: arabicNumerals[idx + 1] || `٠${idx + 2}`,
        title: cleanText(entry.title, 65),
        summary: `من الأبواب والفصول الرئيسة المعتمدة في هيكلة كتاب «${matchedBook.title}».`,
        sourceRef: `كتاب ${matchedBook.title} — ص ${entry.page_id}`,
      });
    });

    if (nodes.length < 4 && pages.length > 0) {
      pages.slice(0, 5 - nodes.length).forEach((p) => {
        nodes.push({
          number: arabicNumerals[nodes.length] || `٠${nodes.length + 1}`,
          title: `شاهد نصي من الكتاب (ص ${p.page_number})`,
          summary: cleanText(p.fullBody || p.snippet, 175),
          sourceRef: `${p.book_name} — ج ${p.part || 1}، ص ${p.page_number}`,
        });
      });
    }
  } else {
    pages.slice(0, 4).forEach((p, idx) => {
      nodes.push({
        number: arabicNumerals[idx] || `٠${idx + 1}`,
        title: `تأصيل: ${cleanText(p.book_name, 52)}`,
        summary: cleanText(p.fullBody || p.snippet, 175),
        sourceRef: `${p.author_name} • ج ${p.part || 1}، ص ${p.page_number}`,
      });
    });

    if (!matchedBook && fatawa.length > 0 && nodes.length < 6) {
      fatawa.slice(0, 6 - nodes.length).forEach((f) => {
        nodes.push({
          number: arabicNumerals[nodes.length] || `٠${nodes.length + 1}`,
          title: `فتوى: ${cleanText(f.title, 52)}`,
          summary: cleanText(f.answer || f.answer_excerpt, 170),
          sourceRef: `المفتي: ${f.mufti?.name || 'خزانة الفتاوى'} (#${f.fatwa_id})`,
        });
      });
    }

    if (nodes.length === 0 && catalogMatches.length > 0) {
      catalogMatches.slice(0, 6).forEach((b, idx) => {
        nodes.push({
          number: arabicNumerals[idx] || `٠${idx + 1}`,
          title: cleanText(b.title, 55),
          summary: `تأليف: ${b.author} — من مصادر قسم (${b.category}) في الموسوعة الإباضية.`,
          sourceRef: `${b.category} • ${b.era || 'الموسوعة الإباضية'}`,
        });
      });
    }
  }

  if (nodes.length === 0) {
    nodes.push({
      number: '٠١',
      title: `موضوع: ${coreTopic}`,
      summary: `ملخص بصري مستند إلى فهارس ومتون الموسوعة الإباضية الشاملة (٢,٥٩٥ كتاباً و٥,٣٨٥ فتوى).`,
      sourceRef: `الموسوعة الإباضية الشاملة`,
    });
  }

  const firstPage = pages[0];
  const goldenQuote = firstPage
    ? {
        text: cleanText(firstPage.fullBody || firstPage.snippet, 220),
        source: `${firstPage.book_name} — ${firstPage.author_name} (ج ${firstPage.part || 1}، ص ${firstPage.page_number})`,
      }
    : fatawa[0]
    ? {
        text: cleanText(fatawa[0].answer || fatawa[0].answer_excerpt, 220),
        source: `فتوى: ${fatawa[0].title} — ${fatawa[0].mufti?.name || 'خزانة الفتاوى'}`,
      }
    : undefined;

  return {
    title: matchedBook ? `كتاب: ${matchedBook.title}` : coreTopic,
    subtitle: matchedBook
      ? `تأليف: ${matchedBook.author} • القسم: ${matchedBook.category}`
      : `بطاقة إنفوجرافيك علمية مؤصلة من متون وفتاوى الموسوعة الإباضية`,
    badge: MODE_LABELS[mode] || 'ملخص بصري موثق',
    centralTheme: coreTopic,
    nodes: nodes.slice(0, 6),
    goldenQuote,
    footerNote: `الموسوعة الإباضية الشاملة • توثيق آلي مباشر من أمهات الكتب والفتاوى`,
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

  const cleanText = (raw: string, maxLen = 220) => {
    const c = String(raw || '')
      .replace(/<\/?mark[^>]*>/gi, '')
      .replace(/\s+/g, ' ')
      .trim();
    if (!c) return '';
    return c.length > maxLen ? `${c.slice(0, maxLen)}...` : c;
  };

  const slides: AISlideItem[] = [];

  // Slide 1: Cover Slide
  slides.push({
    slideNumber: 1,
    title: matchedBook ? `قراءة وتلخيص كتاب: ${matchedBook.title}` : `العرض العلمي: ${coreTopic}`,
    subtitle: matchedBook
      ? `للمؤلف: ${matchedBook.author} (${matchedBook.category})`
      : `${MODE_LABELS[mode]} — مستخرج وموثق من الموسوعة الإباضية`,
    bullets: [
      matchedBook
        ? `القسم العلمي: ${matchedBook.category} (${matchedBook.era || 'تراث علمي'})`
        : `الموضوع المحوري: ${coreTopic}`,
      `عدد الشواهد النصية المستخرجة: ${pages.length} مصادر من أمهات الكتب`,
      !matchedBook && fatawa.length > 0
        ? `عدد الفتاوى الشرعية المرفقة: ${fatawa.length} فتاوى موثقة`
        : `توثيق كامل بالجزء والصفحة وحالة الترقيم المطبوع`,
    ],
    sourceRef: 'الموسوعة الإباضية الشاملة — البوابة العلمية والبحثية',
  });

  // Slide 2: Overview / Book TOC if matchedBook
  if (matchedBook) {
    const tocEntries: any[] = bookMetaAndToc?.toc?.entries || [];
    slides.push({
      slideNumber: slides.length + 1,
      title: `التعريف بكتاب «${matchedBook.title}» وهيكله العام`,
      subtitle: `تأليف: ${matchedBook.author}`,
      bullets:
        tocEntries.length > 0
          ? tocEntries.slice(0, 6).map((e: any) => `${e.title} (ص ${e.page_id})`)
          : [
              `اسم الكتاب: ${matchedBook.title}`,
              `المؤلف: ${matchedBook.author}`,
              `التصنيف الموضوعي: ${matchedBook.category}`,
              `العصر: ${matchedBook.era || 'الموسوعة الإباضية'}`,
            ],
      sourceRef: `فهرس كتاب ${matchedBook.title}`,
    });
  }

  // Content Slides from Retrieved Pages
  pages.slice(0, 5).forEach((p, idx) => {
    const bodyText = cleanText(p.fullBody || p.snippet, 360);
    const sentences = bodyText
      .split(/[.:؛،\n]+/)
      .map((s) => s.trim())
      .filter((s) => s.length >= 18)
      .slice(0, 4);

    slides.push({
      slideNumber: slides.length + 1,
      title: `الشاهد (${idx + 1}): من كتاب «${p.book_name}»`,
      subtitle: `المؤلف: ${p.author_name} • القسم: ${p.category || 'عام'}`,
      bullets:
        sentences.length > 0
          ? sentences
          : [cleanText(p.fullBody || p.snippet, 260)],
      quote: cleanText(p.snippet || p.fullBody, 200),
      sourceRef: `المرجع: ${p.book_name} — ج ${p.part || 1}، ص ${p.page_number} (${
        p.numbering_declared || 'مفهرس'
      })`,
    });
  });

  // Fatwa Slides if applicable
  if (!matchedBook && fatawa.length > 0) {
    fatawa.slice(0, 2).forEach((f, idx) => {
      slides.push({
        slideNumber: slides.length + 1,
        title: `الفتوى الشرعية (${idx + 1}): ${cleanText(f.title, 70)}`,
        subtitle: `المفتي: ${f.mufti?.name || 'خزانة الفتاوى'} • فتوى رقم #${f.fatwa_id}`,
        bullets: [
          f.question || f.question_excerpt
            ? `السؤال: ${cleanText(f.question || f.question_excerpt, 180)}`
            : `مسألة فقهية تطبيقية في باب (${coreTopic})`,
          `الجواب: ${cleanText(f.answer || f.answer_excerpt, 260)}`,
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
    subtitle: `توثيق علمي مباشر من طبعات الكتب والفتاوى`,
    bullets:
      pages.length > 0
        ? pages.slice(0, 6).map(
            (p, i) =>
              `[${i + 1}] ${p.book_name} — ${p.author_name}، ج ${p.part || 1}، ص ${p.page_number}`
          )
        : catalogMatches.length > 0
        ? catalogMatches.slice(0, 5).map((b, i) => `[${i + 1}] ${b.title} — ${b.author}`)
        : [`الموسوعة الإباضية الشاملة (٢,٥٩٥ كتاباً و٥,٣٨٥ فتوى شرعية)`],
    sourceRef: `تم الإعداد والتوثيق عبر المساعد العلمي للموسوعة الإباضية`,
  });

  return slides;
}

/**
 * 7. Build Mode-Specific Gemini / Claude System Instruction & Prompt
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
    book_summary: `المطلوب: تقديم **ملخص علمي شامل ومفصل للكتاب** أو للمسألة المطلوبة منه، يشمل:
1. **بطاقة التعريف بالكتاب والمؤلف**: اسم الكتاب، مؤلفه، عصره، وقسمه العلمي.
2. **موضوع الكتاب ومنهجه العلمي**: بيان الغاية من تأليفه وطريقة المؤلف في عرض المسائل.
3. **هيكلة الكتاب وأبرز أبوابه وفصوله**: استعراض منظم لأقسام وأبواب الكتاب بناءً على الفهرس المرفق.
4. **مقتطفات ونماذج علمية موثقة من صفحات الكتاب**: إيراد شواهد نصية بين «...» مع عزوها الدقيق لرقم الجزء والصفحة.`,

    khutbah: `المطلوب: كتابة **خطبة جمعة منبرية متكاملة وبليغة بأسلوب الخطبة الشرعية الأصيلة** في موضوع («${coreTopic}») بالاعتماد الحصري على نصوص الموسوعة المرفقة:
1. **الخطبة الأولى**: الاستفتاح المنبري، الدخول في الموضوع بأسلوب خطابي وعظي مؤثر، تضمين الآيات بين ﴿...﴾ والأحاديث وأقوال العلماء الموثقة بالجزء والصفحة، وخاتمة الخطبة الأولى.
2. **الخطبة الثانية**: الحمد والصلاة على النبي ﷺ، التوجيهات العملية والأحكام المستخلصة من المتون والفتاوى المرفقة، والختام بالدعاء المنبري الجامع وتوثيق المصادر.`,

    lesson: `المطلوب: إعداد **درس علمي شامل ومنهجي متكامل** في موضوع («${coreTopic}») يصلح للإلقاء والتدريس العلمي بالاعتماد الحصري على نصوص الموسوعة المرفقة:
1. عنوان الدرس وأهدافه العلمية وتمهيد بالموضوع.
2. المحاور التفصيلية للدرس مرتبة في عناصر مرقمة مع الاقتباس النصي بين «...» والعزو للكتاب والجزء والصفحة.
3. خلاصة الدرس والفوائد المستنبطة وثبت المصادر.`,

    article: `المطلوب: كتابة **مقال علمي رصين ومؤصل** في موضوع («${coreTopic}») بالاعتماد الحصري على نصوص الموسوعة المرفقة (عنوان، مقدمة، محاور تحليلية موثقة بالشواهد، وخاتمة وفهرس مصادر).`,

    tafsir_hadith: `المطلوب: تقديم **تفسير علمي للآية القرآنية أو شرح وافٍ للحديث الشريف** («${coreTopic}») بالاعتماد الحصري على كتب التفسير والحديث والفقه المرفقة من الموسوعة، مع الحفاظ التام على نص الآية القرآنية بالرسم العثماني بين ﴿...﴾ دون أي تغيير.`,

    infographic: `المطلوب: صياغة **محتوى إنفوجرافيك وخريطة مفاهيمية بصرية منظمة** حول («${coreTopic}») بالاعتماد الحصري على نصوص الموسوعة المرفقة:
- قسّم المحتوى إلى **بطاقات/محاور بصرية مرقمة ومركزة** (العنوان البارز، الخلاصة المركزة في سطرين، والشاهد الموثق بالكتاب والصفحة) ليتكامل مع لوحة الإنفوجرافيك المرفقة للمستخدم.`,

    presentation: `المطلوب: إعداد **محتوى عرض تقديمي (شرائح باوربوينت PowerPoint)** احترافي ومفصل حول («${coreTopic}») بالاعتماد الحصري على نصوص الموسوعة المرفقة:
- قسّم الإجابة إلى **شرائح مرقمة (الشريحة ١، الشريحة ٢، ...)**، بحيث تحتوي كل شريحة على عنوان واضح، نقاط مركزة، نص شاهد مقتبس بين «...»، وتوثيق المرجع بالجزء والصفحة.`,

    document: `المطلوب: إعداد **مستند علمي وتقرير مفصل ومرتب (جاهز للتصدير كملف Word و PDF)** حول («${coreTopic}») بالاعتماد الحصري على نصوص الموسوعة المرفقة:
- نسّق المحتوى بعناوين رئيسية وفرعية واضحة، ونقاط منظمة، وجدول مقارنة أو ملخص، وشواهد نصية موثقة بالكتاب والجزء والصفحة، وفهرس مراجع ختامي.`,

    chat: `المطلوب: تقديم **إجابة علمية شاملة ودقيقة ومباشرة** على طلب الباحث حول («${coreTopic}») بالاعتماد الحصري على النصوص وبيانات الموسوعة المرفقة، مع تلبية أي تنسيق يطلبه السائل (مقارنة، نقاط، أسئلة وأجوبة، جداول، أو شرح تفصيلي) وتوثيق كل شاهد بالكتاب والجزء والصفحة.`,
  };

  const singleBookRule = isSingleBookRestriction
    ? `\nتنبيه صارم جداً: النقاش محصور في كتاب واحد فقط هو «${matchedBook?.title}» للمؤلف «${matchedBook?.author}». اعتمد حصرياً على بيانات وفهرس وصفحات هذا الكتاب المرفقة أدناه، ولا تذكر أي مصدر خارجي آخر إطلاقاً.`
    : `\nتنبيه صارم جداً: اعتمد حصرياً على النصوص والفتاوى وبيانات الكتب المرفقة من الموسوعة الإباضية دون أن تخرج عنها إطلاقاً، ولا تأتِ بأي معلومات عشوائية أو غير متعلقة بموضوع السؤال («${coreTopic}»).`;

  const systemInstruction = `أنت "المساعد العلمي والموسوعي الشامل للموسوعة الإباضية".
مهمتك: محاورة الباحثين في كل ما يتعلق بالموسوعة الإباضية (تلخيص كتب، كتابة مقالات، تفسير آيات وشرح أحاديث، صياغة خطب جمعة، إعداد دروس علمية، تصميم محتوى إنفوجرافيك وخرائط ذهنية، إعداد عروض باوربوينت، وتجهيز مستندات وورد وPDF وجداول علمية) بالاعتماد الكلي والحصري على كتب ومتون وفتاوى الموسوعة الإباضية المرفقة فقط.
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
  } else if (catalogMatches.length > 0) {
    bookInfoSection =
      `=== كتب مطابقة للموضوع في فهرس الموسوعة (إجمالي كتب الموسوعة: 2,595 كتاباً و5,385 فتوى) ===\n` +
      catalogMatches
        .map((b) => `- كتاب «${b.title}» — المؤلف: ${b.author} (القسم: ${b.category}، العصر: ${b.era || 'عام'})`)
        .join('\n') +
      `\n\n`;
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
 * 8. Built-In 100% Free Scholarly Composer Engine (0 API Credits, Never Interrupts)
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
  catalogMatches?: CatalogBook[];
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
    catalogMatches = [],
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
    if (!matchedBook && pages.length === 0 && catalogMatches.length === 0) {
      return (
        `لم يتم العثور على كتاب مطابق لعنوان («${coreTopic}») في فهرس الموسوعة.\n` +
        `💡 نصيحة: يمكنك اختيار الكتاب مباشرة من قائمة «تحديد كتاب من الموسوعة» أعلى المحادثة، أو كتابة الاسم المشهور للكتاب مثل: «لخص لي كتاب قواعد الإسلام» أو «ملخص كتاب تمهيد قواعد الإيمان» أو «ملخص كتاب بهجة الأنوار».`
      );
    }

    const lines: string[] = [];
    const targetBook = matchedBook || catalogMatches[0];
    const targetTitle = targetBook?.title || pages[0]?.book_name || coreTopic;
    const targetAuthor = targetBook?.author || pages[0]?.author_name || 'من علماء الموسوعة';
    const targetCategory = targetBook?.category || pages[0]?.category || 'التراث الإسلامي';
    const targetEra = targetBook?.era || '';
    const tocEntries: any[] = bookMetaAndToc?.toc?.entries || [];
    const totalPagesCount =
      bookMetaAndToc?.toc?.pages_total || targetBook?.pagesCount || pages.length;

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

  // If no pages/fatawa matched, check if we have catalogMatches (e.g. user asked about books/authors/categories in the encyclopedia)
  if (pages.length === 0 && fatawa.length === 0 && catalogMatches.length > 0) {
    const lines: string[] = [];
    lines.push(`📚 نتائج الدليل والفهرس العام للموسوعة الإباضية حول: «${coreTopic}»`);
    lines.push(
      `تضم الموسوعة الإباضية الشاملة (٢,٥٩٥) كتاباً مفهرساً في (٢٠) قسماً علمياً و(٥,٣٨٥) فتوى شرعية. وفيما يلي أبرز الكتب والمصنفات المطابقة لطلبك:`
    );
    lines.push('');
    catalogMatches.forEach((b, idx) => {
      lines.push(
        `${idx + 1}. كتاب «${b.title}» — للمؤلف: ${b.author} | القسم: ${b.category}${
          b.era ? ` | العصر: ${b.era}` : ''
        }`
      );
    });
    lines.push('');
    lines.push(
      `💡 يمكنك الضغط على أي كتاب أو اختياره من زر «تخصيص الدردشة لكتاب معين» لتلخيصه بالكامل أو توليد صورة إنفوجرافيك وعرض باوربوينت وملف Word/PDF خاص به.`
    );
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
      `2. إذا كنت تسأل عن كتاب معيّن، اختر الكتاب من زر «تحديد كتاب» أعلى الدردشة ثم اطلب تلخيصه أو تصميم إنفوجرافيك أو عرض باوربوينت له.`
    );
  }

  const uniqueBooks = Array.from(new Set(pages.map((p) => p.book_name).filter(Boolean)));
  const uniqueAuthors = Array.from(new Set(pages.map((p) => p.author_name).filter(Boolean)));

  // ============================================================================
  // CASE 2: INFOGRAPHIC VISUAL SUMMARY MODE (صورة إنفوجرافيك وخريطة بصرية)
  // ============================================================================
  if (mode === 'infographic') {
    const lines: string[] = [];
    lines.push(`🎨 بطاقة الإنفوجرافيك والخريطة البصرية: «${coreTopic}»`);
    lines.push(
      matchedBook
        ? `(مُستخلصة حصرياً من كتاب «${matchedBook.title}» — للمؤلف: ${matchedBook.author})`
        : `(مُؤصلة وموثقة من أمهات كتب وفتاوى الموسوعة الإباضية)`
    );
    lines.push('════════════════════════════════════════');
    lines.push('✨ تم توليد لوحة الإنفوجرافيك البصرية عالية الدقة أدناه (جاهزة للتحميل المباشر كصورة PNG):');
    lines.push('');

    pages.slice(0, 5).forEach((p, idx) => {
      const excerpt = cleanAndVocalize(p.fullBody || p.snippet, 420);
      lines.push(
        `🔹 المحور البصري (${idx + 1}) — من كتاب «${p.book_name}» (${p.author_name}، ج ${
          p.part || 1
        }، ص ${p.page_number}):`
      );
      lines.push(`«${excerpt}»`);
      lines.push('');
    });

    if (!matchedBook && fatawa.length > 0) {
      fatawa.slice(0, 2).forEach((f, idx) => {
        const excerpt = cleanAndVocalize(f.answer || f.answer_excerpt, 360);
        lines.push(
          `🔸 خلاصة الفتوى (${idx + 1}) — ${f.title} (المفتي: ${
            f.mufti?.name || 'خزانة الفتاوى'
          }، #${f.fatwa_id}):`
        );
        lines.push(`«${excerpt}»`);
        lines.push('');
      });
    }

    return lines.join('\n');
  }

  // ============================================================================
  // CASE 3: POWERPOINT PRESENTATION MODE (عرض باوربوينت وشرائح تقديمية)
  // ============================================================================
  if (mode === 'presentation') {
    const lines: string[] = [];
    lines.push(`📊 العرض التقديمي (شرائح PowerPoint): «${coreTopic}»`);
    lines.push(
      matchedBook
        ? `(مُعدّ حصرياً من كتاب «${matchedBook.title}» — للمؤلف: ${matchedBook.author})`
        : `(مُعدّ وموثق من متون وفتاوى الموسوعة الإباضية)`
    );
    lines.push('════════════════════════════════════════');
    lines.push('✨ يمكنك استعراض الشرائح تفاعلياً أدناه أو الضغط على زر «تحميل عرض باوربوينت (.pptx)» لتنزيل الملف كاملاً:');
    lines.push('');

    lines.push(`🖥️ [الشريحة ١]: عنوان العرض ومحاوره الرئيسة`);
    lines.push(`• الموضوع: ${coreTopic}`);
    lines.push(`• المصادر المعتمدة: ${uniqueBooks.slice(0, 4).join('، ')}`);
    lines.push('');

    pages.slice(0, 5).forEach((p, idx) => {
      const excerpt = cleanAndVocalize(p.fullBody || p.snippet, 480);
      lines.push(
        `🖥️ [الشريحة ${idx + 2}]: التأصيل من كتاب «${p.book_name}» (${p.author_name})`
      );
      lines.push(`• الشاهد النصي: «${excerpt}»`);
      lines.push(`• التوثيق: ج ${p.part || 1}، ص ${p.page_number} (${getNumberingLabel(p)}).`);
      lines.push('');
    });

    if (!matchedBook && fatawa.length > 0) {
      fatawa.slice(0, 2).forEach((f, idx) => {
        const excerpt = cleanAndVocalize(f.answer || f.answer_excerpt, 420);
        lines.push(
          `🖥️ [الشريحة ${pages.slice(0, 5).length + idx + 2}]: الفتاوى التطبيقية — ${f.title}`
        );
        lines.push(`• المفتي: ${f.mufti?.name || 'خزانة الفتاوى'} (فتوى رقم #${f.fatwa_id})`);
        lines.push(`• البيان الشرعي: «${excerpt}»`);
        lines.push('');
      });
    }

    return lines.join('\n');
  }

  // ============================================================================
  // CASE 4: FRIDAY SERMON MODE (خطبة جمعة منبرية بأسلوب الخطبة)
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
    lines.push(
      `أَمَّا بَعْدُ؛ فَيَا عِبَادَ اللَّهِ: إِنَّ تَطْبِيقَ أَحْكَامِ الشَّرِيعَةِ فِي («${coreTopic}») يَقْتَضِي مِنَّا الْفِقْهَ فِي الدِّينِ وَالْبَصِيرَةَ بِالْأَحْكَامِ:`
    );

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
        lines.push(
          `• وَجَاءَ فِي كِتَابِ (${p.book_name} — ${p.author_name}، ج ${p.part || 1}، ص ${
            p.page_number
          }):`
        );
        lines.push(`«${excerpt}»`);
        lines.push('');
      });
    }

    lines.push(
      'اللَّهُمَّ فَقِّهْنَا فِي الدِّينِ، وَعَلِّمْنَا التَّأْوِيلَ، وَاهْدِنَا لِأَحْسَنِ الْأَخْلَاقِ وَالْأَعْمَالِ لَا يَهْدِي لِأَحْسَنِهَا إِلَّا أَنْتَ، اللَّهُمَّ اغْفِرْ لِلْمُؤْمِينَ وَالْمُؤْمِنَاتِ، وَالْمُسْلِمِينَ وَالْمُسْلِمَاتِ، الْأَحْيَاءِ مِنْهُمْ وَالْأَمْوَاتِ، إِنَّكَ سَمِيعٌ قَرِيبٌ مُجِيبُ الدَّعَوَاتِ. عِبَادَ اللَّهِ: إِنَّ اللَّهَ يَأْمُرُ بِالْعَدْلِ وَالْإِحْسَانِ وَإِيتَاءِ ذِي الْقُرْبَى وَيَنْهَى عَنِ الْفَحْشَاءِ وَالْمُنْكَرِ وَالْبَغْيِ يَعِظُكُمْ لَعَلَّكُمْ تَذَكَّرُونَ.'
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
  // CASE 5: COMPREHENSIVE LESSON MODE (درس علمي شامل)
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
  // CASE 6: SCHOLARLY ARTICLE OR FORMAL DOCUMENT MODE (مقال علمي / مستند Word وPDF)
  // ============================================================================
  if (mode === 'article' || mode === 'document') {
    const lines: string[] = [];
    lines.push(
      mode === 'document'
        ? `📄 مستند وتقرير علمي موثق: «${coreTopic}»`
        : `✒️ مقال علمي مؤصل: «${coreTopic} في ضوء تراث الموسوعة الإباضية»`
    );
    if (matchedBook) {
      lines.push(`(قراءة علمية خاصة في كتاب «${matchedBook.title}» — ${matchedBook.author})`);
    }
    lines.push('════════════════════════════════════════');
    lines.push('');
    lines.push('▪ أولاً: المقدمة والتمهيد العلمي:');
    lines.push(
      `يُشكّل موضوع («${coreTopic}») أحد المباحث المهمة التي حظيت بعناية فائقة في المصنفات الإسلامية بالموسوعة الإباضية؛ حيث تناوله العلماء بالبيان والتأصيل والتحرير في (${totalBookHits.toLocaleString(
        'ar-EG'
      )}) موضعاً نصياً${
        !matchedBook ? ` و(${totalFatwaHits.toLocaleString('ar-EG')}) فتوى شرعية` : ''
      }. وفي هذا المستند نستجلي أبرز ما سطّره الأئمة والعلماء بالاقتصار الأمين على نصوصهم الموثقة.`
    );
    lines.push('');

    if (pages.length > 0) {
      lines.push('▪ ثانياً: التأصيل والتحرير في متون الكتب:');
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
      lines.push('▪ ثالثاً: الإفتاء والتطبيقات الفقهية:');
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

    lines.push('▪ رابعاً: الخاتمة وفهرس المصادر المعتمدة:');
    lines.push(
      `يتبين مما سبق دقة التأصيل العلمي لموضوع («${coreTopic}») في كتب الموسوعة، وفيما يلي ثبت المصادر التي اعتمد عليها المستند:`
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
  // CASE 7: TAFSIR & HADITH EXPLANATION MODE (تفسير آية أو شرح حديث)
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
  // CASE 8: GENERAL SCHOLARLY CHAT & Q&A (حوار ونقاش عام شامل)
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
 * 9. Generate smart contextual follow-up prompts (including Infographic, PowerPoint, Word, PDF)
 */
export function buildFollowUpSuggestions(
  coreTopic: string,
  mode: Exclude<AIChatMode, 'auto'>,
  matchedBook: CatalogBook | null
): string[] {
  if (matchedBook) {
    return [
      `صمم لي صورة إنفوجرافيك لكتاب ${matchedBook.title}`,
      `اعمل عرض باوربوينت تلخيصي لكتاب ${matchedBook.title}`,
      `اكتب لي درساً علمياً مستخلصاً من كتاب ${matchedBook.title}`,
      `أعطني ملف وورد و PDF يلخص كتاب ${matchedBook.title}`,
    ];
  }

  const topic = coreTopic.slice(0, 35);
  const suggestions: string[] = [];

  if (mode !== 'infographic') {
    suggestions.push(`صمم لي صورة إنفوجرافيك عن ${topic}`);
  }
  if (mode !== 'presentation') {
    suggestions.push(`اعمل عرض باوربوينت (شرائح) عن ${topic}`);
  }
  if (mode !== 'khutbah') {
    suggestions.push(`اكتب لي خطبة جمعة منبرية عن ${topic}`);
  }
  if (mode !== 'lesson') {
    suggestions.push(`اكتب لي درساً علمياً شاملاً في موضوع ${topic}`);
  }

  return suggestions.slice(0, 4);
}
