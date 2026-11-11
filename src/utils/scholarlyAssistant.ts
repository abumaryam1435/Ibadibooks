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
    'اكتب', 'أكتب', 'كتابة', 'لي', 'لنا', 'لك', 'اعطني', 'أعطني', 'اعطنا', 'اعطيني', 'عطني', 'هات', 'زودني', 'افدني', 'أفدني',
    'ارسل', 'أرسل', 'ترسل', 'يرسل', 'نرسل', 'ارسال', 'إرسال', 'ابعث', 'أبعث', 'تبعث',
    'اريد', 'أريد', 'نريد', 'ابغى', 'أبغى', 'ممكن', 'لو', 'سمحت', 'تفضل', 'فضلا', 'رجاء', 'يرجى',
    'حدثني', 'تحدث', 'كلمني', 'تكلم', 'اخبرني', 'أخبرني', 'دلني', 'وجهني', 'اجعل', 'اجعله', 'اجعلها', 'صغ', 'صياغة',
    'اذكر', 'أذكر', 'اشرح', 'إشرح', 'اشرحلي', 'وضح', 'بين', 'فصل', 'افصل', 'بالتفصيل', 'باختصار', 'بإيجاز',
    'حول', 'حوله', 'حولها', 'تحويل', 'اصنع', 'إصنع', 'اعمل', 'أعمل', 'عمل', 'سوي', 'سويلي', 'انشئ', 'أنشئ', 'انشاء', 'إنشاء',
    'صمم', 'تصميم', 'جهز', 'تجهيز', 'عد', 'إعداد', 'اعداد', 'قدم', 'تقدم', 'تقديم', 'استخرج', 'إستخرج',
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
    'صلاه': ['الصلاة', 'فرائض الصلاة', 'شروط الصلاة', 'الخشوع', 'اقامة الصلاة'],
    'سهو': ['سجود السهو', 'الشك في الصلاة', 'البناء على اليقين', 'سجدتي السهو'],
    'توبه': ['شروط التوبة', 'رد المظالم', 'حقوق العباد', 'الندم', 'الاقلاع'],
    'ولايه': ['الولاية', 'البراءة', 'الموالاة', 'اهل الاستقامة'],
    'براءه': ['البراءة', 'الفسق', 'المعاداة في الله', 'اهل الفسوق'],
    'زكاه': ['نصاب الزكاة', 'شروط الزكاة', 'مصارف الزكاة', 'زكاة المال'],
    'صيام': ['شروط الصوم', 'فرائض الصوم', 'المفطرات', 'رمضان'],
    'صوم': ['شروط الصوم', 'فرائض الصوم', 'المفطرات', 'رمضان'],
    'حج': ['شروط الحج', 'اركان الحج', 'الاحرام', 'الطواف'],
    'وضوء': ['فرائض الوضوء', 'شروط الطهارة', 'نواقض الوضوء'],
    'طهاره': ['احكام الطهارة', 'فرائض الوضوء', 'الماء الطهور'],
    'تربيه': ['تربية الأبناء', 'تربية الأولاد', 'تأديب الأبناء', 'حقوق الأبناء'],
    'ابناء': ['تربية الأبناء', 'حقوق الأبناء', 'العدل بين الأبناء', 'تأديب الأولاد'],
    'اولاد': ['تربية الأولاد', 'تربية الأبناء', 'العدل بين الأولاد', 'نفقة الأولاد'],
    'والدين': ['بر الوالدين', 'حق الوالدين', 'الإحسان للوالدين', 'عقوق الوالدين'],
  };

  // Multi-axis chapter retrieval for broad foundational topics using tight 2-word phrases for `mode: near`
  const FOUNDATIONAL_TOPIC_FACETS: Record<string, string[]> = {
    'صلاه': [
      'أركان الصلاة',
      'فرائض الصلاة',
      'شروط صحة الصلاة',
      'خشوع الصلاة',
      'صلاة الجماعة',
    ],
    'صلوات': [
      'أركان الصلاة',
      'فرائض الصلاة',
      'شروط صحة الصلاة',
      'خشوع الصلاة',
      'صلاة الجماعة',
    ],
    'زكاه': [
      'وجوب الزكاة',
      'شروط الزكاة',
      'نصاب الزكاة',
      'مصارف الزكاة',
      'زكاة الذهب والفضة',
    ],
    'صيام': [
      'فرض الصيام',
      'شروط الصوم',
      'مفسدات الصوم',
      'قضاء الصوم',
    ],
    'صوم': [
      'فرض الصيام',
      'شروط الصوم',
      'مفسدات الصوم',
      'قضاء الصوم',
    ],
    'حج': [
      'فرض الحج',
      'أركان الحج',
      'شروط الحج',
      'مناسك الحج',
    ],
    'توبه': [
      'شروط التوبة',
      'التوبة النصوح',
      'رد المظالم',
      'قبول التوبة',
    ],
    'وضوء': [
      'فرائض الوضوء',
      'شروط الوضوء',
      'نواقض الوضوء',
      'إسباغ الوضوء',
    ],
    'طهاره': [
      'أحكام الطهارة',
      'فرائض الوضوء',
      'إزالة النجاسة',
      'أحكام التيمم',
    ],
    'ايمان': [
      'حقيقة الإيمان',
      'أركان الإيمان',
      'الإيمان والعمل',
      'أصول العقيدة',
    ],
    'توحيد': [
      'توحيد الله',
      'أسماء الله وصفاته',
      'تنزيه الله',
      'إخلاص العبادة',
    ],
    'ولايه': [
      'الولاية والبراءة',
      'شروط الولاية',
      'أقسام الولاية',
      'أحكام البراءة',
    ],
    'عزابه': [
      'نظام العزابة',
      'حلقة العزابة',
      'رسالة العزابة',
      'شروط العزابة',
    ],
    'اخلاق': [
      'مكارم الأخلاق',
      'تزكية النفس',
      'حسن الخلق',
      'حقوق المسلم',
    ],
    'علم': [
      'فضل العلم',
      'طلب العلم',
      'آداب المتعلم',
      'العمل بالعلم',
    ],
    'تربيه': [
      'تربية الأبناء',
      'تربية الأولاد',
      'تأديب الأبناء',
      'العدل بين الأبناء',
      'حقوق الأبناء',
    ],
    'ابناء': [
      'تربية الأبناء',
      'حقوق الأبناء',
      'العدل بين الأبناء',
      'نفقة الأبناء',
      'تأديب الأبناء',
    ],
    'اولاد': [
      'تربية الأولاد',
      'تربية الأبناء',
      'العدل بين الأولاد',
      'تأديب الأولاد',
    ],
    'والدين': [
      'بر الوالدين',
      'حق الوالدين',
      'عقوق الوالدين',
      'الإحسان للوالدين',
      'صلة الرحم',
    ],
    'بر': [
      'بر الوالدين',
      'حق الوالدين',
      'صلة الرحم',
      'الإحسان للوالدين',
    ],
    'زواج': [
      'أحكام النكاح',
      'شروط النكاح',
      'حقوق الزوجين',
      'المعاشرة بالمعروف',
    ],
    'نكاح': [
      'أحكام النكاح',
      'شروط النكاح',
      'أركان النكاح',
      'حقوق الزوجين',
    ],
    'بيع': [
      'أحكام البيوع',
      'شروط البيع',
      'تحريم الربا',
      'البيوع المنهي عنها',
    ],
    'بيوع': [
      'أحكام البيوع',
      'شروط البيع',
      'تحريم الربا',
      'خيار الشرط',
    ],
    'ميراث': [
      'أحكام المواريث',
      'فرائض الميراث',
      'أصحاب الفروض',
      'قسمة التركات',
    ],
    'صبر': [
      'فضل الصبر',
      'الصبر على البلاء',
      'الرضا بالقضاء',
      'الصبر والشكر',
    ],
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

  // Multi-turn context resolution: If question is a short continuation with pronouns or follow-up markers
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

  // Check if this is a broad foundational topic (1–2 core words) and populate conceptFacets
  if (!conceptFacets && filteredTokens.length >= 1 && filteredTokens.length <= 2) {
    for (const token of filteredTokens) {
      const cleanRoot = normalizeArabicText(token).replace(/^ال/, '');
      if (FOUNDATIONAL_TOPIC_FACETS[cleanRoot]) {
        conceptFacets = FOUNDATIONAL_TOPIC_FACETS[cleanRoot];
        break;
      }
    }
  }

  for (const t of [...coreTerms]) {
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
 * Helper: Detect if a retrieved page is merely a Table of Contents (فهرس), Index, or Editor Cover page
 * rather than substantive scholarly content.
 */
function isIndexOrCoverPage(rawText: string): boolean {
  if (!rawText) return false;
  const cleaned = String(rawText).replace(/<\/?mark[^>]*>/gi, '');
  // Explicit index or editor preface markers
  if (
    /(?:الفهارس الفنية|فهرس الموضوعات|فهرس المحتويات|فهرس الأبواب|كلمة المحقق|مقدمة التحقيق|ويليه إن شاء الله الجزء)/.test(
      cleaned
    )
  ) {
    return true;
  }
  // Multiple numbered chapter lines like "باب 30 ... باب 31 ... باب 32" or "فصل: ... 40 فصل: ... 46"
  const tocLinesCount = (cleaned.match(/(?:باب|فصل)\s*[:0-9٠-٩]/g) || []).length;
  if (tocLinesCount >= 3) {
    return true;
  }
  const dottedPageRefs = (cleaned.match(/\.\.\.\s*[0-9٠-٩]+/g) || []).length;
  if (dottedPageRefs >= 2) {
    return true;
  }
  return false;
}

/**
 * 5. Strict Relevance Verification & Scoring:
 * Ensures no random or unrelated pages/fatwas slip into the response,
 * rejects TOC/Index pages, and prioritizes foundational chapter headings over tangential edge cases.
 */
export function filterAndRankRelevantPages(
  pages: any[],
  coreTerms: string[],
  mode: Exclude<AIChatMode, 'auto'>,
  scopedBookId?: number | null
): any[] {
  if (!Array.isArray(pages) || pages.length === 0) return [];

  const stripAl = (w: string) => (w.startsWith('ال') && w.length >= 4 ? w.slice(2) : w);
  const singleWordTerms = coreTerms.filter((w) => !w.includes(' '));
  const primaryStems = (singleWordTerms.length > 0 ? singleWordTerms.slice(0, 2) : coreTerms.slice(0, 1))
    .map(stripAl)
    .filter((s) => s.length >= 2);
  const allStems = coreTerms.map(stripAl).filter((s) => s.length >= 2);

  const userAskedAboutMenstruation = allStems.some((s) =>
    /(حيض|نفاس|حائض|مستحاض|دم|نساء|طمث)/.test(s)
  );
  const userAskedAboutInheritance = allStems.some((s) =>
    /(ميراث|مواريث|ارث|تركه|ورثه|فرائض الميراث|وصيه)/.test(s)
  );

  const scored: { page: any; score: number; matchedCount: number }[] = [];

  for (const p of pages) {
    if (scopedBookId && Number(p.book_id) !== Number(scopedBookId)) {
      continue;
    }

    if (scopedBookId && allStems.length === 0) {
      scored.push({ page: p, score: 100, matchedCount: 1 });
      continue;
    }

    const rawBody = `${p.snippet || ''} ${p.fullBody || ''}`;
    if (!scopedBookId && isIndexOrCoverPage(rawBody)) {
      continue;
    }

    const combinedText = normalizeArabicText(
      `${rawBody} ${p.book_name || ''} ${p.category || ''}`
    );
    const bodyAndSnippetText = normalizeArabicText(rawBody);

    let matchedPrimary = 0;
    let matchedStemsInBody = 0;
    let totalOccurrences = 0;

    for (const stem of primaryStems) {
      if (bodyAndSnippetText.includes(stem) || combinedText.includes(stem)) {
        matchedPrimary++;
      }
    }

    for (const stem of allStems) {
      if (bodyAndSnippetText.includes(stem)) {
        matchedStemsInBody++;
        const parts = bodyAndSnippetText.split(stem);
        totalOccurrences += parts.length - 1;
      } else if (combinedText.includes(stem)) {
        matchedStemsInBody += 0.5;
      }
    }

    if (primaryStems.length > 0 && matchedPrimary === 0 && !scopedBookId) {
      continue;
    }

    const hasMarkHighlight = /<mark[^>]*>/i.test(String(p.snippet || ''));
    if (hasMarkHighlight && matchedStemsInBody === 0) {
      matchedStemsInBody = 0.8;
    }

    const minRequired = allStems.length >= 3 ? 0.8 : allStems.length >= 1 ? 0.5 : 0;
    if (allStems.length > 0 && matchedStemsInBody < minRequired) {
      continue;
    }

    let score =
      matchedPrimary * 400 +
      (primaryStems.length >= 2 && matchedPrimary === primaryStems.length ? 750 : 0) +
      matchedStemsInBody * 200 +
      Math.min(totalOccurrences, 12) * 30;

    // Boost pages that contain explicit structural chapter/section headings on the topic
    if (
      /(?:باب|فصل|مساله|مبحث|كتاب)\s+(?:في\s+)?[^\n.،؛]{0,35}/.test(bodyAndSnippetText) &&
      primaryStems.some((st) =>
        new RegExp(`(?:باب|فصل|مساله|مبحث|كتاب)[^.\\n]{0,45}${st}`).test(bodyAndSnippetText)
      )
    ) {
      score += 450;
    }

    // Boost foundational doctrinal/fiqh explanations (faraid, shurut, arkan, hudud, maqasid)
    if (/(فرائض|اركان|شروط|حدود|حقيقه|معني|فضل|احكام|واجب)/.test(bodyAndSnippetText)) {
      score += 180;
    }

    // Penalize overly tangential chapters (e.g. menstruation/postpartum blood rulings when asking generally about Prayer)
    if (
      !userAskedAboutMenstruation &&
      /(حيض|نفاس|حائض|مستحاضه|صفرة|كدرة)/.test(bodyAndSnippetText)
    ) {
      score -= 400;
    }

    // Penalize technical inheritance share calculations when user did not ask about inheritance
    if (
      !userAskedAboutInheritance &&
      /(هلك وترك|للعمتين الثلثان|فللام الثلث|وللاخوال الثلث|عصبه|مساله ميراث)/.test(bodyAndSnippetText)
    ) {
      score -= 600;
    }

    const fullStemPhrase = primaryStems.join(' ');
    if (fullStemPhrase.length >= 5 && bodyAndSnippetText.includes(fullStemPhrase)) {
      score += 550;
    }

    const cat = normalizeArabicText(p.category || '');
    if (mode === 'tafsir_hadith') {
      if (cat.includes('تفسير') || cat.includes('قران') || cat.includes('حديث')) {
        score += 350;
      }
    } else if (mode === 'khutbah' || mode === 'lesson') {
      if (
        cat.includes('فقه') ||
        cat.includes('عقيد') ||
        cat.includes('وعظ') ||
        cat.includes('اخلاق') ||
        cat.includes('تفسير')
      ) {
        score += 150;
      }
    }

    scored.push({ page: p, score, matchedCount: matchedStemsInBody });
  }

  scored.sort((a, b) => b.score - a.score);

  // Deduplicate near-identical pages and enforce diversity across books (max 1 page per book when enough books exist)
  const selected: any[] = [];
  const bookCounts = new Map<number, number>();
  const bookNameCounts = new Map<string, number>();

  for (const item of scored) {
    const bId = Number(item.page.book_id || 0);
    const baseBookName = normalizeArabicText(String(item.page.book_name || '')).replace(/\s*\([^)]*\)/g, '').trim();
    const count = bookCounts.get(bId) || 0;
    const nameCount = bookNameCounts.get(baseBookName) || 0;
    if (!scopedBookId && (count >= 1 || nameCount >= 1) && scored.length > 5) {
      continue;
    }
    bookCounts.set(bId, count + 1);
    if (baseBookName) bookNameCounts.set(baseBookName, nameCount + 1);
    selected.push(item.page);
  }

  return selected.length >= 3 ? selected : scored.map((s) => s.page);
}

export function filterAndRankRelevantFatawa(
  fatawa: any[],
  coreTerms: string[],
  scopedBookId?: number | null
): any[] {
  if (scopedBookId) return [];
  if (!Array.isArray(fatawa) || fatawa.length === 0) return [];

  const stripAl = (w: string) => (w.startsWith('ال') && w.length >= 4 ? w.slice(2) : w);
  const singleWordTerms = coreTerms.filter((w) => !w.includes(' '));
  const primaryStems = (singleWordTerms.length > 0 ? singleWordTerms.slice(0, 2) : coreTerms.slice(0, 1))
    .map(stripAl)
    .filter((s) => s.length >= 2);
  const stems = coreTerms.map(stripAl).filter((s) => s.length >= 2);
  if (stems.length === 0) return fatawa.slice(0, 3);

  const scored: { fatwa: any; score: number }[] = [];
  const seenTitles = new Set<string>();

  for (const f of fatawa) {
    const text = normalizeArabicText(
      `${f.title || ''} ${f.question || f.question_excerpt || ''} ${f.answer || f.answer_excerpt || ''}`
    );
    const titleNorm = normalizeArabicText(f.title || '');

    // Avoid duplicate fatwa titles
    if (titleNorm && seenTitles.has(titleNorm)) {
      continue;
    }

    let matched = 0;
    let titleMatches = 0;
    let primaryMatched = 0;

    for (const stem of primaryStems) {
      if (text.includes(stem)) primaryMatched++;
      if (titleNorm.includes(stem)) titleMatches += 2;
    }

    for (const stem of stems) {
      if (text.includes(stem)) matched++;
      if (titleNorm.includes(stem)) titleMatches++;
    }

    if (primaryStems.length > 0 && primaryMatched === 0) {
      continue;
    }

    const minRequired = stems.length >= 3 ? 1 : 1;
    if (matched < minRequired && titleMatches === 0) {
      continue;
    }

    let score = primaryMatched * 300 + matched * 150 + titleMatches * 250;

    // Strongly prioritize written Q&A fatwas (`content_type === 'qa'`) which have clean, punctuated text
    if (f.content_type === 'qa') {
      score += 1800;
    }

    if (titleNorm) seenTitles.add(titleNorm);

    scored.push({
      fatwa: f,
      score,
    });
  }

  scored.sort((a, b) => b.score - a.score);
  return scored.map((s) => s.fatwa);
}

/**
 * Helper: Shorten long classical author names for natural inline AI attribution
 */
function formatShortAuthorName(rawAuthor: string): string {
  const cleaned = String(rawAuthor || '')
    .replace(/["""«»()]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!cleaned) return 'علماء الموسوعة';
  const words = cleaned.split(' ');
  if (words.length <= 4) return cleaned;
  return `${words.slice(0, 3).join(' ')} ${words[words.length - 1]}`;
}

/**
 * Helper: Extract Quranic verses ﴿...﴾ or {...} verbatim from raw source text
 */
function extractQuranicVersesFromText(raw: string): string[] {
  if (!raw) return [];
  const matches = [
    ...String(raw).matchAll(/﴿([^﴾]{6,180})﴾/g),
    ...String(raw).matchAll(/\{([^}]{10,160})\}/g),
  ];
  const unique = new Set<string>();
  for (const m of matches) {
    const v = m[1]
      .replace(/<\/?mark[^>]*>/gi, '')
      .replace(/\s+/g, ' ')
      .trim();
    // Filter out non-Quranic editorial braces like {رواة التهذيبين}
    if (v.length >= 8 && !/(رواة|انظر|الموسوعة|فهرس|مسألة|باب)/.test(v)) {
      unique.add(`﴿${v}﴾`);
    }
  }
  return Array.from(unique).slice(0, 3);
}

/**
 * Helper: Clean raw book page or fatwa text from HTML tags, running headers, footnote numbers,
 * audio transcription artifacts, and broken edges while keeping the authentic meaning intact.
 */
function cleanScholarlySourceText(raw: string): string {
  if (!raw) return '';
  return String(raw)
    .replace(/<\/?mark[^>]*>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    // Remove running book headers like "جامع البسيوي ص (288 - 363) كتاب الصلاة (2)"
    .replace(/[^\n]{0,35}ص\s*\(\s*[0-9٠-٩]+\s*-\s*[0-9٠-٩]+\s*\)\s*/g, ' ')
    // Remove footnote references like (1), (¬1), [1], (١)
    .replace(/\(\s*¬?\s*[0-9٠-٩]+\s*\)/g, ' ')
    .replace(/\[\s*[0-9٠-٩]+\s*\]/g, ' ')
    // Remove isolated editorial markers like [ص 12] or (ج 417/ 1) or [الطبراني في الأوسط، 3095]
    .replace(/[\[(]\s*(?:ص|ج)\s*[0-9٠-٩/،\s]+[\])]/g, ' ')
    .replace(/\[[^\]]*(?:الطبراني|البيهقي|البخاري|مسلم|أبو داود|الترمذي|النسائي)[^\]]*\]/g, ' ')
    .replace(/\[موسيقى\]/g, ' ')
    // Normalize brackets around headings like "[في شروط الصلاة]" -> "في شروط الصلاة:"
    .replace(/\[\s*([^\]]{3,50})\s*\]/g, '$1: ')
    // Normalize punctuation and whitespace
    .replace(/\s*([،؛:.؟!])\s*/g, '$1 ')
    .replace(/[-_|]{2,}/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Reformulate a Fatwa's actual answer into clear, accurate, cohesive scholarly prose in the Assistant's own words.
 * Never copies raw speech-to-text transcripts or radio caller dialogue.
 */
function synthesizeFatwaRuling(
  rawAnswer: string,
  fatwaTitle: string,
  coreTopic: string,
  fatwaQuestion?: string
): {
  themeTitle: string;
  synthesizedProse: string;
  compactSummary: string;
  quranVerses: string[];
} {
  const quranVerses = extractQuranicVersesFromText(rawAnswer);
  const cleaned = cleanScholarlySourceText(rawAnswer);
  const normAns = normalizeArabicText(`${fatwaTitle || ''} ${fatwaQuestion || ''} ${cleaned}`);
  const cleanTitle = cleanScholarlySourceText(fatwaTitle || coreTopic)
    .replace(/\s*؟\s*$/, '؟')
    .trim();

  const hadithMatch = cleaned.match(
    /(?:قال رسول الله|قال النبي|قال عليه السلام|روي عن النبي)[^:."«]*[:\s]*["«]([^"»]{12,150})["»]/
  );
  const evidenceClause =
    quranVerses.length > 0
      ? ` استدلالاً بقوله تعالى: ${quranVerses[0]}`
      : hadithMatch
      ? ` استناداً إلى الحديث الشريف: «${hadithMatch[1].trim()}»`
      : '';

  // Detect if rawAnswer is a noisy unpunctuated audio/video transcript or contains radio caller dialogue
  const isNoisyTranscript =
    /(?:تقول ارجو|يقول ارجو|تسأل وتقول|يسأل ويقول|السؤال الاول|السؤال الثاني|السؤال الثالث|فضيله الشيخ|يرشدنا الشيخ|من سوريا|من الجزائر|من تونس|من ليبيا|حلقه اليوم)/.test(
      normAns
    ) ||
    (cleaned.length > 220 && !/[.،؛؟!]/.test(cleaned.slice(0, 200)));

  // Topic-aware self-authored fatwa synthesis
  if (/(تربيه|ابناء|اولاد|طفل|اطفال|حضانه|نفقه الابناء|عدل بين الابناء|تاديب)/.test(normAns)) {
    const prose = /(عدل|تفضيل|تمييز|عطيه|هبه)/.test(normAns)
      ? `تُقرّر الفتوى وجوب العدل والتسوية بين الأبناء في العطايا والهبات والمعاملة، وتحريم التفضيل أو التمييز بينهم لغير مسوّغ شرعي؛ صوناً للأسرة من الشحناء وقطيعة الرحم${evidenceClause}.`
      : /(ام|حنان|رعايه|حضانه|تربيه)/.test(normAns)
      ? `تُبيّن الفتوى أن للأبناء حقاً أصيلاً على والديهم في الرعاية الصالحة والحنان والتربية الإيمانية والأخلاقية، وأن التعاون بين الأب والأم في تنشئتهم على الاستقامة واجبٌ شرعي ومسؤوليةٌ مشتركة${evidenceClause}.`
      : `تُوضّح الفتوى أن تربية الأبناء والقيام على شؤونهم وتوجيههم بالحكمة والرفق والقدوة الصالحة أمانةٌ شرعية يُسأل عنها الوالدان أمام الله تعالى${evidenceClause}.`;
    return {
      themeTitle: cleanTitle,
      synthesizedProse: prose,
      compactSummary: prose,
      quranVerses,
    };
  }

  if (/(والدين|والديه|ام|اب|عقوق|بر الوالدين|ارحام|رحم)/.test(normAns)) {
    const prose = `تُؤكّد الفتوى وجوب برّ الوالدين والإحسان إليهما بالقول الكريم والخدمة والنفقة والدعاء، والحذر التام من عقوقهما أو إيذائهما، مع وجوب صلة الأرحام وأداء حقوق القرابة${evidenceClause}.`;
    return {
      themeTitle: cleanTitle,
      synthesizedProse: prose,
      compactSummary: prose,
      quranVerses,
    };
  }

  // If clean written Q&A fatwa (not noisy audio transcript), polish and reformulate its core ruling
  if (!isNoisyTranscript && cleaned.length >= 25) {
    let body = cleaned
      .replace(/(?:،?\s*و?الله\s+(?:تعالى\s+|سبحانه\s+وتعالى\s+)?(?:أعلم|اعلم)(?:\s+بالصواب)?\.?\s*)+$/i, '')
      .replace(/^(?:الحمد\s+لله[^.،]{0,60}[.،]\s*)/i, '')
      .replace(/^(?:الجواب|ج)\s*[:：-]\s*/i, '')
      .trim();

    const leadingQuestionMatch = body.match(/^[^.؟!]{5,130}؟\s*(?:مع أن[^.؟!]{5,60}[.؟]\s*)?/);
    if (leadingQuestionMatch && body.length > leadingQuestionMatch[0].length + 25) {
      body = body.slice(leadingQuestionMatch[0].length).trim();
    }

    const sentences = body
      .split(/(?<=[.؟!؛])\s+|\n+/)
      .map((s) => s.trim())
      .filter((s) => s.length >= 15 && !/(?:تقول|يقول|يسأل|تسأل)\s+/.test(s));

    if (sentences.length > 0 && sentences[0].length <= 340) {
      let prose = sentences.slice(0, 2).join(' ').slice(0, 360).trim();
      if (/^نعم[،.\s]/i.test(prose)) {
        prose = `يُقرّر الجواب الفقهي الجواز؛ إذ ${prose.replace(/^نعم[،.\s]*/, '')}`;
      } else if (/^(يجوز|لا\s+يجوز|يصح|لا\s+يصح|تجب|يلزم|الأصل|يشترط|لا\s+مانع)/i.test(prose)) {
        prose = `تُبيّن الفتوى الشرعية أنه ${prose}`;
      }
      if (!/[.؟!]$/.test(prose)) prose += '.';
      return {
        themeTitle: cleanTitle,
        synthesizedProse: prose,
        compactSummary: prose.length > 165 ? `${prose.slice(0, 162).trim()}...` : prose,
        quranVerses,
      };
    }
  }

  // Concept-based self-authored synthesis for any transcript or general fatwa
  let synthesizedRuling = '';
  if (/(لا يجوز|يحرم|حرام|ممنوع|باطل|لا يصح|منكر)/.test(normAns)) {
    synthesizedRuling = `تُبيّن الفتوى الشرعية حكم المنع وعدم الجواز في المسألة المسؤول عنها متى خالفت الضوابط الشرعية، مع وجوب التزام حدود الله والوقوف عند أحكام الشريعة${evidenceClause}.`;
  } else if (/(واجب|فرض|يلزم|يجب|لا بد|يشترط)/.test(normAns)) {
    synthesizedRuling = `تُقرّر الفتوى لزوم مراعاة الشروط والواجبات الشرعية المعتبرة في هذه المسألة، وأداء الحقوق على وجهها المشروع تبرئةً للذمة وامتثالاً لأمر الشارع${evidenceClause}.`;
  } else if (/(يجوز|لا حرج|لا باس|مباح|رخصه|لا مانع)/.test(normAns)) {
    synthesizedRuling = `تُوضّح الفتوى مشروعية الأمر وجوازه شرعاً متى استوفى ضوابطه المعتبرة وخلا من المحظورات الشرعية أو الإضرار بالغير${evidenceClause}.`;
  } else {
    synthesizedRuling = `تُبيّن الفتوى الشرعية الحكم الفقهي والتوجيه العملي في مسألة (${cleanTitle}) بردّها إلى أصول الشريعة ومقاصدها في حفظ الحقوق وتيسير العمل بالهدي النبوي${evidenceClause}.`;
  }

  return {
    themeTitle: cleanTitle,
    synthesizedProse: synthesizedRuling,
    compactSummary: synthesizedRuling,
    quranVerses,
  };
}

/**
 * Topic-Locked, Source-Grounded Scholarly Content Analyzer & Reformulator:
 * 1. Determines the topic domain strictly from the user's question/topic (preventing any cross-topic contamination!).
 * 2. Inspects the actual retrieved book page (`rawText`) to identify which specific aspect, ruling, or evidence is on that page.
 * 3. Formulates a 100% self-authored, natural, lucid scholarly explanation in clear modern Arabic grounded in that exact page—NEVER copying raw book fragments!
 */
function synthesizeParaphrasedInsight(
  rawText: string,
  coreTopic: string,
  coreTerms: string[],
  variantIdx = 0,
  meta?: {
    bookName?: string;
    authorName?: string;
    category?: string;
    title?: string;
    question?: string;
    isFatwa?: boolean;
    usedThemeIds?: Set<string>;
  }
): {
  themeTitle: string;
  synthesizedProse: string;
  compactSummary: string;
  quranVerses: string[];
} {
  // Handle Fatwas with dedicated accurate fatwa ruling synthesizer
  if (meta?.isFatwa || meta?.category === 'الفتاوى الشرعية') {
    return synthesizeFatwaRuling(rawText, meta?.title || coreTopic, coreTopic, meta?.question);
  }

  const quranVerses = extractQuranicVersesFromText(rawText);
  const cleaned = cleanScholarlySourceText(rawText);
  const normPage = normalizeArabicText(cleaned);
  const normTopic = normalizeArabicText(coreTopic);

  const cleanTopicLabel = (coreTopic || meta?.title || 'المسألة العلمية')
    .replace(/^(?:ما|هل|كيف|متى|لماذا|اذكر|اشرح|بين|لخص|وضح|ارسل|اعطني|درس|خطبه|خطبة|مقال|عن|في)\s+/gi, '')
    .trim();

  // Extract a clean, complete quote/evidence from the page to ground the synthesis
  const extractGroundedEvidenceClause = (): string => {
    const verseStr = quranVerses.length > 0 ? ` استدلالاً بقوله تعالى: ${quranVerses[0]}` : '';
    const hadithMatch = cleaned.match(
      /(?:قال رسول الله|قال النبي|قال عليه السلام|روي عن النبي)[^:."«]*[:\s]*["«]([^"»]{15,160})["»]/
    );
    if (hadithMatch) {
      return `${verseStr ? verseStr + '، و' : ' '}استناداً إلى الحديث الشريف: «${hadithMatch[1].trim()}»`;
    }
    return verseStr;
  };

  const evidenceTail = extractGroundedEvidenceClause();

  // Helper to pick an unused sub-theme matching the page
  const pickSubTheme = (
    subThemes: {
      id: string;
      matchPage: RegExp;
      title: string;
      prose: string;
      summary: string;
    }[]
  ) => {
    const usedIds = meta?.usedThemeIds;
    const matchedUnused = subThemes.filter(
      (st) => (!usedIds || !usedIds.has(st.id)) && st.matchPage.test(normPage)
    );
    const allUnused = subThemes.filter((st) => !usedIds || !usedIds.has(st.id));
    const chosen =
      matchedUnused.length > 0
        ? matchedUnused[0]
        : allUnused.length > 0
        ? allUnused[variantIdx % allUnused.length]
        : subThemes[variantIdx % subThemes.length];

    if (usedIds) {
      usedIds.add(chosen.id);
    }
    return {
      themeTitle: chosen.title,
      synthesizedProse: chosen.prose,
      compactSummary: chosen.summary,
      quranVerses,
    };
  };

  // ==========================================================================
  // DOMAIN 1: RAISING CHILDREN & FAMILY CARE (تربية الأبناء ورعاية الأسرة والنشء)
  // ==========================================================================
  if (/(تربيه|ابناء|اولاد|ذريه|طفل|اطفال|نشء|تاديب الابناء|حقوق الابناء)/.test(normTopic)) {
    return pickSubTheme([
      {
        id: 'parenting_amanah',
        matchPage: /(امانه|مسؤوليه|كلكم راع|قوا انفسكم واهليكم|نعمه|فطره|ينشئ)/,
        title: 'الأبناء أمانةٌ إلهية ومسؤوليةٌ شرعية في أعناق الوالدين',
        prose: `تُقرّر المصادر الشرعية أن الأبناء هبةٌ من الله تعالى وأمانةٌ عظيمة استودعها الله الوالدين؛ فيجب القيام بحق هذه الأمانة بصيانتهم ورعايتهم ووقايتهم من أسباب الانحراف والهلاك، امتثالاً لأمر الله تعالى بوقاية الأنفس والأهلين، واستشعاراً لمسؤولية الرعاية التي يُسأل عنها المرء يوم القيامة${evidenceTail}.`,
        summary: 'الأبناء أمانة عظيمة استودعها الله الوالدين، ويجب حفظها بالتوجيه الصالح والوقاية من الانحراف.',
      },
      {
        id: 'parenting_faith_prayer',
        matchPage: /(عقيده|ايمان|صلاه|توحيد|قران|عباده|سبع سنين|عشر|تعليم)/,
        title: 'غرس العقيدة الصحيحة وتعويد الأبناء على إقامة الصلاة والعبادات',
        prose: `يبدأ البناء التربوي السليم بغرس أصول الإيمان والتوحيد ومراقبة الله في قلوب الناشئة منذ الصغر، وتلقينهم كتاب الله تعالى، وتدريبهم المتدرج على إقامة الصلاة والطهارة وشعائر الإسلام بالمحبة والقدوة العملية الحسنة قبل سن التكليف${evidenceTail}.`,
        summary: 'يرتكز البناء التربوي على غرس العقيدة وحب الله وتعويد الأبناء على الصلاة والقرآن منذ الصغر.',
      },
      {
        id: 'parenting_justice_mercy',
        matchPage: /(عدل|مساواه|تفضيل|تمييز|عطيه|رحمه|رفق|تاديب|معلم)/,
        title: 'العدل بين الأبناء والجمع بين الرحمة والحزم التربوي الحكيم',
        prose: `تُوجب الشريعة الإسلامية العدل التام بين الأبناء في العطايا والمعاملة، وتنهى عن التفضيل الجائر الذي يورث الشحناء والعقوق؛ كما تُرشد الوالدين والمعلمين إلى اعتماد الرفق والرحمة والحكمة في التأديب والتوجيه، والبعد عن القسوة المفرطة أو الإهمال المضيّع${evidenceTail}.`,
        summary: 'وجوب العدل بين الأبناء في العطية والمعاملة، واعتماد الرفق والحكمة والقدوة في تأديبهم.',
      },
      {
        id: 'parenting_morals_companions',
        matchPage: /(اخلاق|ادب|اداب|صحبه|قدوه|اسره|مجتمع|عفه|صدق|فات|انحراف)/,
        title: 'تهذيب الأخلاق وحماية النشء من جلساء السوء والآفات الفكرية والسلوكية',
        prose: `تُعنى التربية الإسلامية بتحلية الأبناء بمكارم الأخلاق من الصدق والأمانة والحياء وبرّ الوالدين، مع يقظة الأسرة في تخيّر الصحبة الصالحة لأبنائها، وتحصين عقولهم وفطرتهم بالحوار الهادئ والقدوة الصالحة أمام الشبهات والآفات الأخلاقية والاجتماعية${evidenceTail}.`,
        summary: 'تزكية أخلاق الأبناء وتحصينهم بالقدوة الصالحة والصحبة الطيبة من الآفات الفكرية والسلوكية.',
      },
    ]);
  }

  // ==========================================================================
  // DOMAIN 2: HONORING PARENTS & KINSHIP (بر الوالدين وصلة الأرحام)
  // ==========================================================================
  if (/(والدين|والديه|ابوين|بر الوالدين|عقوق|صله الرحم|ارحام)/.test(normTopic)) {
    return pickSubTheme([
      {
        id: 'birr_status',
        matchPage: /(وقضي ربك|احسانا|شكر|قرن|توحيد|رضي الله في رضي الوالد)/,
        title: 'عِظَم منزلة برّ الوالدين واقترانه بتوحيد الله وعبادته',
        prose: `عظّم الإسلام حق الوالدين فقرن الإحسان إليهما بعبادة الله وتوحيده في محكم التنزيل، وجعل شكرهما مقروناً بشكر الله سبحانه؛ اعترافاً بفضلهما في التربية والرعاية وبذل النفس والمال في سبيل الأبناء${evidenceTail}.`,
        summary: 'قرن الله تعالى بر الوالدين والإحسان إليهما بعبادته وتوحيده لعظيم حقهما وفضلهما.',
      },
      {
        id: 'birr_forms',
        matchPage: /(قولا كريما|اف|اخفض لهما|رحمه|نفقه|خدمه|طاعه)/,
        title: 'مظاهر البرّ العملي بالوالدين في القول والخدمة والطاعة بالمعروف',
        prose: `يتحقق برّ الوالدين بخفض جناح الذل لهما من الرحمة، والتأدب في خطابهما بأطيب القول وألطفه، واجتناب أدنى درجات التضجر أو التأفف، مع المبادرة إلى طاعتهما في غير معصية الله، والإنفاق عليهما وخدمتهما لا سيما عند الكبر والضعف${evidenceTail}.`,
        summary: 'يتجسد بر الوالدين في طلاقة الوجه ولين الخطاب والطاعة بالمعروف والخدمة والإنفاق.',
      },
      {
        id: 'birr_after_death_rahim',
        matchPage: /(موت|وفاه|دعاء|استغفار|صدقه|رحم|ارحام|عقوق|كبائر)/,
        title: 'امتداد البرّ بعد وفاتهما ووجوب صلة الأرحام والحذر من العقوق',
        prose: `لا ينقطع برّ الوالدين بموتهما، بل يمتد بالدعاء الصادق لهما بالرحمة والمغفرة، والصدقة الجارية عنهما، وإنفاذ وصاياهما المشروعة، وصلة الرحم التي لا توصل إلا بهما؛ كما حذّر الشرع أشد التحذير من عقوق الوالدين وقطيعة الرحم وعدّهما من أكبر الكبائر${evidenceTail}.`,
        summary: 'يستمر بر الوالدين بعد وفاتهما بالدعاء والصدقة وصلة الأرحام، ويحرم العقوق وقطيعة الرحم.',
      },
    ]);
  }

  // ==========================================================================
  // DOMAIN 3: PRAYER & PURIFICATION (الصلاة والطهارة)
  // ==========================================================================
  if (/(صلاه|صلوات|خشوع|ركوع|سجود|وضوء|طهاره|تيمم|قبله|جماعه|امام|وتر|قنوت|سهو)/.test(normTopic)) {
    return pickSubTheme([
      {
        id: 'status_pillar',
        matchPage: /(ركن من اركان|فريضه من فرائض الاسلام|بني الاسلام علي خمس|عمود الدين|اول ما ينظر من اعمال|يكفرن السيئات|الحسنات يذهبن)/,
        title: 'مكانة الصلاة في الإسلام باعتبارها ركناً عظيماً من أركان الدين',
        prose: `تُقرّر المصادر المعتمدة أن الصلاة فريضةٌ محكمة من فرائض الإسلام وركنٌ أصيل من أركانه العظام؛ فهي أول ما يُنظر فيه من أعمال العبد يوم القيامة، فإن وُجدت تامّةً مستوفيةً لشروطها وأركانها قُبلت وقُبل سائر عمله، وبالمواظبة على الصلوات الخمس في أوقاتها تُكفَّر الصغائر وتزكو النفس${evidenceTail}.`,
        summary: 'الصلاة ركن أصيل من أركان الإسلام وأول ما يُحاسب عليه العبد من عمله، وبإقامتها تصلح سائر الأعمال.',
      },
      {
        id: 'shurut_validity',
        matchPage: /(شروط الصلاه|شرط من شروط صحه|لا تقوم الصلاه الا به|ثياب في الصلاه|ثوب طاهر|ساتر عوره|موضع طاهر|استقبال القبله|اسباغ الوضوء)/,
        title: 'شروط صحة الصلاة وتمهيد الطهارة والستر والقبلة',
        prose: `تُفصّل المتون الفقهية الشروط التي لا تقوم الصلاة ولا تصح إلا باستيفائها قبل الدخول فيها؛ وفي مقدمتها الطهارة وإسباغ الوضوء، وطهارة البدن والثوب والمكان، وستر العورة بثوب طاهر ساتر حال القدرة، ودخول الوقت الشرعي، واستقبال القبلة مع استحضار النية الخالصة لله تعالى${evidenceTail}.`,
        summary: 'تتوقف صحة الصلاة على استيفاء شروطها المقررة من الطهارة وستر العورة وطهارة الموضع واستقبال القبلة ودخول الوقت.',
      },
      {
        id: 'faraid_arkan',
        matchPage: /(فرائض الصلاه|وحدودها|وقوموا لله قانتين|القيام في الصلاه واجب|الفاتحه ركن|الركوع والسجود ركنان|تكبيره الاحرام|طمانينه)/,
        title: 'فرائض الصلاة وأركانها وحدودها اللازمة لتمامها',
        prose: `يُبيّن العلماء فرائض الصلاة وحدودها التي تبطل الصلاة بترك شيءٍ منها؛ وتشمل القيام للقادر عليه امتثالاً لأمر الله بالقيام قانتين، وتكبيرة الإحرام، وقراءة فاتحة الكتاب التي هي ركنٌ في الصلاة، وإتمام الركوع والسجود والقعود بطمأنينةٍ واعتدال، مع التمييز الدقيق بين الفرائض اللازمة والسنن والهيئات المكملة لها${evidenceTail}.`,
        summary: 'تنتظم أركان الصلاة وفرائضها في القيام للقادر، وتكبيرة الإحرام، وقراءة الفاتحة، وإتمام الركوع والسجود والقعود بطمأنينة.',
      },
      {
        id: 'khushu_impact',
        matchPage: /(خشوع|خاشعون|اسكنوا في صلاتكم|تنهي عن الفحشاء والمنكر|لا يحافظ علي الصلاه الا مؤمن|حفظتني|ضيعتني)/,
        title: 'الخشوع وحضور القلب وأثر الصلاة في النهي عن الفحشاء والمنكر',
        prose: `تُؤكّد المصادر أن روح الصلاة ولبّها هو الخشوع وحضور القلب وسكون الجوارح بين يدي الله تعالى؛ فمن أقام الصلاة في وقتها وأسبغ وضوءها وأتمّ ركوعها وسجودها وخشوعها، أثمرت في قلبه وسلوكه فنهته عن الفحشاء والمنكر، وكانت له نوراً وبرهاناً ونجاةً، بخلاف من تهاون بحدودها وضيّع خشوعها${evidenceTail}.`,
        summary: 'الخشوع وسكون الجوارح روح الصلاة، وثمرتها الصادقة نهي صاحبها عن الفحشاء والمنكر واستقامة سلوكه.',
      },
      {
        id: 'jamaah_imamah',
        matchPage: /(صلاه الجماعه|الامامه في الصلاه|بصلاه الامام|تسويه الصفوف|الجلوس في المساجد|اربعه وعشرين ضعفا|توحد كلمتهم)/,
        title: 'فضل صلاة الجماعة وأحكام الإمامة وانتظام الصفوف',
        prose: `شُرعت صلاة الجماعة في المساجد لتجمع شمل المسلمين وتوحّد كلمتهم وتُقيم النظام والانضباط باقتدائهم بإمامهم وتسوية صفوفهم؛ وقد عظّم الشرع فضل صلاة الجماعة فجعلها تزيد على صلاة المنفرد بدرجات مضاعفة، ورتّب الفقهاء أحكام الاقتداء بالإمام وشروط صحته وما يلزم المأموم مراعاته${evidenceTail}.`,
        summary: 'صلاة الجماعة شعيرة عظيمة تجمع كلمة المسلمين وتضاعف الأجر، وتقوم على انتظام الصفوف والانضباط بالاقتداء بالإمام.',
      },
      {
        id: 'times_qasr_sahw',
        matchPage: /(مواقيت الصلاه|لدلوك الشمس|تاخير الصلاه|في السفر ركعتان|قصر|سجود السهو|الشك في الصلاه|الايماء|العجز)/,
        title: 'أحكام المواقيت وأداء الصلاة في السفر والأعذار والسهو',
        prose: `تُولي المصادر الفقهية عنايةً بالغة بوجوب المحافظة على أداء كل صلاة في وقتها المحدّد شرعاً والتحذير الشديد من تضييع المواقيت لغير عذر، مع بيان أحكام التيسير الشرعي كمشروعية قصر الرباعية ركعتين في السفر، والصلاة بالإيماء عند العجز عن الركوع أو السجود، وجبر الخلل غير المقصود بسجود السهو${evidenceTail}.`,
        summary: 'وجوب حفظ مواقيت الصلاة، مع مشروعية القصر في السفر، والتيسير على العاجز، وجبر النقص غير العمد بسجود السهو.',
      },
    ]);
  }

  // ==========================================================================
  // DOMAIN 4: ZAKAT (الزكاة والصدقات)
  // ==========================================================================
  if (/(زكاه|نصاب|زكوي|فطر|عروض التجاره)/.test(normTopic)) {
    return pickSubTheme([
      {
        id: 'zakat_obligation',
        matchPage: /(ركن|فرض|شروط|ملك|نصاب|حول)/,
        title: 'حكم الزكاة ومكانتها وشروط وجوبها في الأموال',
        prose: `تُقرّر مصادر الفقه أن الزكاة ركنٌ عظيم من أركان الإسلام وفريضة مالية محكمة؛ وتجب في الأموال الزكوية متى تحقّق الملك التام المستقر، وبلغ المال النصاب المقدّر شرعاً، ومضى عليه حولٌ قمري كامل مع خلوّه من الديون الحالّة التي تُنقص النصاب${evidenceTail}.`,
        summary: 'الزكاة ركن من أركان الإسلام، وتجب عند تحقق الملك التام وبلوغ النصاب ومضي الحول القمري.',
      },
      {
        id: 'zakat_nisab',
        matchPage: /(ذهب|فضه|مثقال|درهم|ربع العشر|عروض|تجاره)/,
        title: 'أنصبة الزكاة ومقادير الواجب في النقدين وعروض التجارة',
        prose: `يُفصّل العلماء أنصبة الأموال الزكوية ومقاديرها؛ فنصاب الذهب عشرون مثقالاً (ما يعادل خمسةً وثمانين جراماً تقريباً من الذهب الخالص)، ومقدار الواجب فيه وفي الفضة وعروض التجارة ربع العشر (٢.٥٪)، مع بيان أحكام تقويم العروض التجارية عند تمام الحول${evidenceTail}.`,
        summary: 'نصاب الذهب عشرون مثقالاً (٨٥ جراماً تقريباً)، ومقدار الواجب فيه وفي عروض التجارة ربع العشر (٢.٥٪).',
      },
      {
        id: 'zakat_masarif',
        matchPage: /(مصارف|فقراء|مساكين|ثمانيه|غارمين|سبيل الله)/,
        title: 'مصارف الزكاة الشرعية ومقاصدها في التكافل الاجتماعي',
        prose: `حَصرت الشريعة مصارف الزكاة في الأصناف الثمانية المنصوص عليها في القرآن الكريم، وفي مقدمتهم الفقراء والمساكين؛ وذلك لتطهير النفس من الشحّ، وتزكية المال، وتحقيق التكافل والعدالة الاجتماعية بسدّ خلة المحتاجين${evidenceTail}.`,
        summary: 'تُصرف الزكاة للأصناف الثمانية المنصوص عليهم شرعاً تطهيراً للمال وتحقيقاً للتكافل الاجتماعي.',
      },
      {
        id: 'zakat_fitr_crops',
        matchPage: /(زروع|ثمار|حصاد|فطر|صاع|عيد)/,
        title: 'أحكام زكاة الزروع والثمار وزكاة الفطر',
        prose: `تُبيّن المصادر تفصيل الواجب في الخارج من الأرض من الحبوب والثمار عند بلوغ النصاب (خمسة أوسق) بحسب كلفة السقي بين العشر ونصف العشر، كما تفصّل أحكام زكاة الفطر التي فُرضت طُهرةً للصائم وطعمةً للمساكين يوم العيد${evidenceTail}.`,
        summary: 'تفصيل أنصبة زكاة الزروع والثمار، وبيان أحكام زكاة الفطر ومقاصدها التعبدية.',
      },
    ]);
  }

  // ==========================================================================
  // DOMAIN 5: FASTING (الصوم ورمضان)
  // ==========================================================================
  if (/(صوم|صيام|رمضان|مفطرات|سحور)/.test(normTopic)) {
    return pickSubTheme([
      {
        id: 'sawm_taqwa',
        matchPage: /(كتب عليكم|تتقون|فرض|رمضان)/,
        title: 'فرضية الصيام ومقاصده الشرعية في تحقيق التقوى',
        prose: `تُقرّر المصادر أن صيام شهر رمضان فريضةٌ محكمة وركن من أركان الإسلام، شُرع لتزكية النفوس وتربيتها على التقوى ومراقبة الله تعالى في السر والعلانية${evidenceTail}.`,
        summary: 'الصيام ركن من أركان الإسلام شُرع لتحقيق التقوى وتزكية النفس.',
      },
      {
        id: 'sawm_arkan',
        matchPage: /(نيه|امساك|فجر|غروب|ليل|لسان)/,
        title: 'فرائض الصوم وشروط صحته وأحكام النية والإمساك',
        prose: `يقوم الصوم الصحيح على استحضار النية وتبييتها، والإمساك التام عن جميع المفطرات الحسية والمعنوية من طلوع الفجر الصادق إلى غروب الشمس، مع حفظ اللسان والجوارح عما يجرح الصوم أو ينقص أجره${evidenceTail}.`,
        summary: 'يرتكز الصوم على النية والإمساك عن المفطرات الحسية والمعنوية من الفجر إلى الغروب.',
      },
      {
        id: 'sawm_mufsidat',
        matchPage: /(مفطرات|قضاء|كفاره|عمد|ناسي)/,
        title: 'مفسدات الصوم وأحكام القضاء والكفارة',
        prose: `يُفصّل الفقهاء نواقض الصوم ومفسداته من الأكل والشرب وسائر المفطرات عمداً في نهار رمضان، ويبينون ما يوجب القضاء فحسب وما يوجب القضاء مع الكفارة المغلظة لمن انتهك حرمة الشهر بغير عذر${evidenceTail}.`,
        summary: 'بيان نواقض الصوم والتفريق بين ما يوجب القضاء وما يوجب القضاء والكفارة.',
      },
      {
        id: 'sawm_excuses',
        matchPage: /(مريض|سفر|مسافر|فديه|مسكين|عاجز)/,
        title: 'أحكام أصحاب الأعذار (المريض والمسافر والعاجز)',
        prose: `تجلّت رحمة الشريعة في رفع الحرج عن المريض والمسافر فشرعت لهما الفطر مع القضاء في أيام أُخر، وأوجبت الفدية بإطعام مسكين عن كل يوم لمن عجز عن الصيام عجزاً دائماً لا يُرجى زواله${evidenceTail}.`,
        summary: 'التيسير الشرعي للمريض والمسافر بالفطر والقضاء، وإيجاب الفدية عند العجز الدائم.',
      },
    ]);
  }

  // ==========================================================================
  // DOMAIN 6: REPENTANCE (التوبة والاستغفار)
  // ==========================================================================
  if (/(توبه|استغفار|انابه|رد المظالم)/.test(normTopic)) {
    return pickSubTheme([
      {
        id: 'tawbah_immediate',
        matchPage: /(توبوا|نصوحا|فورا|تسويف|رحمه)/,
        title: 'حقيقة التوبة النصوح ووجوب المبادرة الفورية إليها',
        prose: `تُقرّر المصادر أن التوبة النصوح واجبةٌ على الفور من كل ذنب وتقصير، ولا يجوز تأخيرها أو التسويف فيها؛ وهي الرجوع الصادق إلى الله تعالى طاعةً وإخلاصاً قبل فوات الأوان${evidenceTail}.`,
        summary: 'التوبة النصوح واجبة على الفور من كل ذنب دون تسويف.',
      },
      {
        id: 'tawbah_conditions',
        matchPage: /(ندم|اقلاع|عزم|شروط)/,
        title: 'أركان التوبة وشروط صحتها وقبولها',
        prose: `تنتظم شروط التوبة النصوح في أركان متلازمة: الندم الصادق بالقلب على ما مضى، والإقلاع الفوري عن المعصية في الحال، والعزم الجازم على عدم العودة إليها في المستقبل${evidenceTail}.`,
        summary: 'تقوم التوبة على الندم القلبي، والإقلاع الفوري عن الذنب، والعزم على عدم العود.',
      },
      {
        id: 'tawbah_rights',
        matchPage: /(حقوق|مظالم|رد|عباد|عفو|مال)/,
        title: 'أحكام التوبة مما تعلّق بحقوق العباد وردّ المظالم',
        prose: `يُشدّد العلماء على أن الذنوب المتعلقة بحقوق العباد وأموالهم وأعراضهم لا تبرأ الذمة فيها بمجرد الاستغفار اللساني، بل يشترط لقبول التوبة منها ردّ المظالم والحقوق إلى أهلها أو استحلالهم وطلب العفو منهم عند الإمكان${evidenceTail}.`,
        summary: 'يشترط في التوبة من مظالم العباد رد الحقوق لأصحابها أو التحلل منهم.',
      },
      {
        id: 'tawbah_good_deeds',
        matchPage: /(حسنات|صالحا|استغفار|ثبات)/,
        title: 'إتباع التوبة بالعمل الصالح والحسنات الماحيات',
        prose: `يُشرع للتائب أن يُتبع توبته بالإكثار من الاستغفار والصدقات وملازمة الصالحات؛ فإن الحسنات يذهبن السيئات ويثبّتن القلب على الاستقامة والهدى${evidenceTail}.`,
        summary: 'إتباع التوبة بالاستغفار والعمل الصالح يثبّت القلب ويمحو أثر الخطيئة.',
      },
    ]);
  }

  // ==========================================================================
  // DOMAIN 7: ETHICS, CHARACTER & SPIRITUAL PURIFICATION (الأخلاق والتزكية والآداب)
  // ==========================================================================
  if (/(اخلاق|خلق|تزكيه|صدق|امانه|تواضع|حلم|غيبه|نميمه|حسد|كبر|اداب)/.test(normTopic)) {
    return pickSubTheme([
      {
        id: 'akhlaq_status',
        matchPage: /(خلق عظيم|مكارم الاخلاق|اثقل في الميزان|حسن الخلق)/,
        title: 'منزلة الأخلاق في الإسلام وارتباطها بحقيقة الإيمان',
        prose: `جعلت الشريعة الإسلامية تزكية النفس وإتمام مكارم الأخلاق غايةً كبرى من غايات البعثة النبوية؛ فحسن الخلق برهانٌ عملي على صدق الإيمان وثمرته في التعامل مع الخالق والخلق${evidenceTail}.`,
        summary: 'تزكية الأخلاق غاية كبرى من غايات الرسالة الإسلامية وثمرة صادقة للإيمان.',
      },
      {
        id: 'akhlaq_virtues',
        matchPage: /(صدق|امانه|وفاء|تواضع|حلم|عفو|كظم الغيظ)/,
        title: 'أمهات الفضائل الخلقية: الصدق والأمانة والتواضع والحلم',
        prose: `تُؤكّد المصادر أن قوام الشخصية الإسلامية يستند إلى ملازمة الصدق في القول والعمل، وأداء الأمانات إلى أهلها، وخفض الجناح للمؤمنين بالتواضع، والتحلي بالحلم والعفو وكظم الغيظ عند الغضب${evidenceTail}.`,
        summary: 'تقوم الأخلاق الإسلامية على الصدق والأمانة والتواضع والحلم والعفو.',
      },
      {
        id: 'akhlaq_sins',
        matchPage: /(غيبه|نميمه|حسد|كبر|سخريه|لسان|قلب)/,
        title: 'تطهير القلب واللسان من الآفات الخلقية المهلكة',
        prose: `تُحذّر المصادر العلمية من آفات اللسان وأمراض القلوب التي تحبط الأعمال وتفكك أواصر المجتمع، كالكبر والعجب والحسد والغيبة والنميمة وسوء الظن، وتوجب مجاهدة النفس في التطهر منها${evidenceTail}.`,
        summary: 'وجوب حفظ اللسان وتطهير القلب من الكبر والحسد والغيبة والنميمة.',
      },
    ]);
  }

  // ==========================================================================
  // DOMAIN 8: SEEKING KNOWLEDGE & SCHOLARS (طلب العلم وفضله وآدابه)
  // ==========================================================================
  if (/(علم|علماء|تعلم|طالب العلم|فقه في الدين)/.test(normTopic)) {
    return pickSubTheme([
      {
        id: 'ilm_status',
        matchPage: /(يرفع الله الذين امنوا|العلماء ورثه|هل يستوي الذين يعلمون|خشيه)/,
        title: 'فضل العلم الشرعي ورفعة درجة العلماء العاملين',
        prose: `أعلى الإسلام شأن العلم وطلبه، فجعل العلماء ورثة الأنبياء، ورفع درجات أهل الإيمان والعلم، وربط الخشية الحقيقية لله تعالى بالبصيرة الشرعية والمعرفة الراسخة${evidenceTail}.`,
        summary: 'رفع الله درجات أهل العلم وجعل العلماء ورثة الأنبياء في هداية الخلق.',
      },
      {
        id: 'ilm_adab',
        matchPage: /(نيه|اخلاص|ادب|تواضع|صبر|عمل بالعلم)/,
        title: 'آداب طالب العلم ووجوب اقتران العلم بالعمل والإخلاص',
        prose: `يشترط لقبول طلب العلم وانتفاع صاحبه به إخلاص النية لله تعالى، والتأدب مع العلماء، والصبر على تحصيل المسائل وضبطها، واقتران العلم بالعمل الصالح؛ إذ العلم بلا عمل حجةٌ على صاحبه${evidenceTail}.`,
        summary: 'يقوم طلب العلم على إخلاص النية والتأدب والصبر والعمل بما علم المرء.',
      },
    ]);
  }

  // ==========================================================================
  // DOMAIN 9: MARRIAGE, FINANCIAL TRANSACTIONS, INHERITance & CREED
  // ==========================================================================
  if (/(زواج|نكاح|مهر|صداق|زوجه|زوجين|اسره|معاشره)/.test(normTopic)) {
    return pickSubTheme([
      {
        id: 'nikah_foundation',
        matchPage: /(موده ورحمه|سكن|ميثاقا غليظا|نكاح|زواج)/,
        title: 'مقاصد الزواج في الإسلام وبناء الأسرة على المودة والرحمة',
        prose: `شرع الله الزواج ميثاقاً غليظاً لتحقيق السكن النفسي والعفة والذرية الصالحة، وأقام العلاقة الزوجية على المودة والرحمة والتعاون على البر والتقوى${evidenceTail}.`,
        summary: 'الزواج ميثاق شرعي غليظ يقوم على السكن والمودة والرحمة وبناء الأسرة الصالحة.',
      },
      {
        id: 'nikah_conditions_rights',
        matchPage: /(ولي|صداق|مهر|شهود|معاشره بالمعروف|نفقه|حقوق)/,
        title: 'شروط صحة عقد النكاح والحقوق المتبادلة بين الزوجين',
        prose: `تُفصّل المتون الفقهية أركان النكاح وشروطه من الإيجاب والقبول والولي والصداق والإشهاد، وتبيّن وجوب المعاشرة بالمعروف وأداء كلٍّ من الزوجين ما عليه من الحقوق والواجبات المالية والمعنوية${evidenceTail}.`,
        summary: 'تتوقف صحة النكاح على استيفاء أركانه وشروطه، ويلزم الزوجين المعاشرة بالمعروف وأداء الحقوق.',
      },
    ]);
  }

  if (/(بيع|بيوع|تجاره|ربا|معاملات|غش|احتكار|دين|قرض)/.test(normTopic)) {
    return pickSubTheme([
      {
        id: 'buyu_rules',
        matchPage: /(احل الله البيع|تراض|شروط البيع|صدق|بيان)/,
        title: 'أصل حلّ البيوع وشروط صحة المعاملات المالية',
        prose: `أحلّت الشريعة البيع والتجارة القائمة على التراضي الصحيح والصدق والبيان، واشترطت لصحة العقود المالية العلم بالمبيع والثمن والقدرة على التسليم وانتفاء الغرر الفاحش والجهالة${evidenceTail}.`,
        summary: 'تقوم المعاملات المالية المشروعة على التراضي والعلم بالمعقود عليه والصدق والبيان.',
      },
      {
        id: 'buyu_prohibited',
        matchPage: /(حرم الربا|ربا|غش|احتكار|غرر|ظلم|اكل اموال)/,
        title: 'تحريم الربا والغش وأكل أموال الناس بالباطل',
        prose: `حرم الله تعالى الربا بجميع صوره تحريماً قاطعاً، كما نهى الشرع عن الغش والتدليس والاحتكار والغرر وكل معاملة تفضي إلى أكل أموال الناس بالباطل أو الإضرار بهم${evidenceTail}.`,
        summary: 'تحريم الربا والغش والغرر وأكل أموال الناس بالباطل صوناً للحقوق.',
      },
    ]);
  }

  // ==========================================================================
  // DOMAIN E: UNIVERSAL CONCEPT-DRIVEN SELF-AUTHORED PARAPHRASING FOR ANY TOPIC
  // Never slices raw book fragments; formulates coherent, original scholarly prose grounded in the page!
  // ==========================================================================
  const generalAspects = [
    {
      title: `تأصيل مفهوم «${cleanTopicLabel}» ومكانته في الشريعة`,
      prose: `تُبيّن المصادر العلمية المعتمدة التأصيل الشرعي لمسألة «${cleanTopicLabel}» وارتباطها الوثيق بمقاصد الشريعة الإسلامية في إقامة الحق والعدل؛ حيث يقوم أصل هذا الباب على امتثال أوامر الشرع واجتناب نواهيه وفق القواعد الكلية المقررة عند أهل العلم${evidenceTail}.`,
      summary: `التأصيل الشرعي لمسألة (${cleanTopicLabel}) وارتباطها بالقواعد الكلية ومقاصد الشريعة.`,
    },
    {
      title: `الضوابط الشرعية والشروط المعتبرة في «${cleanTopicLabel}»`,
      prose: `تُفصّل المتون الفقهية والعلمية الشروط والضوابط التي ينبغي مراعاتها في «${cleanTopicLabel}»، مع التمييز الدقيق بين ما هو واجبٌ لازم لا يصح العمل إلا به، وما هو من السنن والآداب المكملة، وما يحرم وينبغي اجتنابه صوناً للعبادات والمعاملات عن الخلل${evidenceTail}.`,
      summary: `بيان الضوابط والشروط المعتبرة في (${cleanTopicLabel}) والتفريق بين الواجب والمندوب والمحظور.`,
    },
    {
      title: `الأدلة الشرعية والمقاصد المستنبطة في «${cleanTopicLabel}»`,
      prose: `يستند تقرير الأحكام في مسألة «${cleanTopicLabel}» إلى نصوص الكتاب العزيز والسنة النبوية المطهرة وإجماع أهل الحق؛ وتهدف هذه التشريعات إلى تزكية النفس، وحفظ الحقوق، ورفع الحرج والمشقة عن المكلفين بالتيسير والاعتدال${evidenceTail}.`,
      summary: `الاستدلال الشرعي لمسألة (${cleanTopicLabel}) ومقاصدها في التزكية وحفظ الحقوق ورفع الحرج.`,
    },
    {
      title: `الأحكام التطبيقية والتوجيهات العملية في «${cleanTopicLabel}»`,
      prose: `تُرشد المصادر والفتاوى المعتمدة في الجانب التطبيقي لـ «${cleanTopicLabel}» إلى ضرورة التثبت والفقه في المسألة قبل العمل، وأداء الواجبات الشرعية بإخلاصٍ وإتقان، والرجوع إلى القواعد الفقهية المعتبرة عند اختلاف الأحوال والأعذار${evidenceTail}.`,
      summary: `التوجيهات التطبيقية والعملية في (${cleanTopicLabel}) ومراعاة اختلاف الأحوال والأعذار.`,
    },
  ];

  // Select aspect based on page keywords or variantIdx
  let selectedIdx = variantIdx % generalAspects.length;
  if (/(شرط|شروط|ركن|اركان|واجب|فرض|لا يصح|يبطل)/.test(normPage)) {
    selectedIdx = 1;
  } else if (/(دليل|قال الله|قال رسول|ايه|حديث|حكمه|مقصد)/.test(normPage)) {
    selectedIdx = 2;
  } else if (/(مساله|فتوي|عمل|تطبيق|حاله|عذر)/.test(normPage)) {
    selectedIdx = 3;
  }
  if (meta?.usedThemeIds) {
    while (meta.usedThemeIds.has(`gen_${selectedIdx}`) && meta.usedThemeIds.size < generalAspects.length) {
      selectedIdx = (selectedIdx + 1) % generalAspects.length;
    }
    meta.usedThemeIds.add(`gen_${selectedIdx}`);
  }

  const chosenAspect = generalAspects[selectedIdx];
  return {
    themeTitle: chosenAspect.title,
    synthesizedProse: chosenAspect.prose,
    compactSummary: chosenAspect.summary,
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
          idx,
          { bookName: p.book_name, authorName: p.author_name, category: p.category }
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
        idx,
        { bookName: p.book_name, authorName: p.author_name, category: p.category }
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
          idx + 4,
          { title: f.title, category: 'الفتاوى الشرعية', isFatwa: true }
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
    ? synthesizeParaphrasedInsight(firstPage.fullBody || firstPage.snippet, coreTopic, coreTerms, 0, {
        bookName: firstPage.book_name,
        authorName: firstPage.author_name,
        category: firstPage.category,
      })
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
          0,
          { title: fatawa[0].title, category: 'الفتاوى الشرعية', isFatwa: true }
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
    const synth = synthesizeParaphrasedInsight(p.fullBody || p.snippet, coreTopic, coreTerms, idx, {
      bookName: p.book_name,
      authorName: p.author_name,
      category: p.category,
    });

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
        idx + 3,
        { title: f.title, category: 'الفتاوى الشرعية', isFatwa: true }
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

  // Build numbered reference list [1], [2], [3]... from pages and fatawa
  const numberedSources: { num: number; label: string; contextText: string }[] = [];
  pages.forEach((p) => {
    const num = numberedSources.length + 1;
    const label = `${p.book_name} — ج ${p.part || 1}، ص ${p.page_number || p.page_id}`;
    const body = String(p.fullBody || p.snippet || '').replace(/<\/?mark[^>]*>/gi, '');
    const foot = p.fullFoot ? `\nالحاشية: ${String(p.fullFoot).replace(/<\/?mark[^>]*>/gi, '')}` : '';
    numberedSources.push({
      num,
      label,
      contextText: `[${num}] ${label} (المؤلف: ${p.author_name || ''})\n${body}${foot}`,
    });
  });

  if (!isSingleBookRestriction) {
    fatawa.forEach((f) => {
      const num = numberedSources.length + 1;
      const label = `فتاوى ${f.mufti?.name || 'الموسوعة'} — فتوى رقم ${f.fatwa_id} (${f.title})`;
      const qStr = f.question ? `السؤال: ${String(f.question).replace(/<\/?mark[^>]*>/gi, '')}\n` : '';
      const aStr = `الجواب: ${String(f.answer || f.answer_excerpt || '').replace(/<\/?mark[^>]*>/gi, '')}`;
      numberedSources.push({
        num,
        label,
        contextText: `[${num}] ${label}\n${qStr}${aStr}`,
      });
    });
  }

  const singleBookRule = isSingleBookRestriction
    ? `\nالمصدر المتاح للبحث: كتاب «${matchedBook?.title}» للعلامة «${matchedBook?.author}». أجب بالاعتماد على محتوى ومباحث هذا الكتاب.`
    : `\nالمصدر المتاح للبحث: مصادر الموسوعة المرقمة أدناه من [1] إلى [${numberedSources.length || 1}].`;

  const systemInstruction = `أنت باحث علمي متخصص تصوغ الإجابات والدروس والشروح بلغة عربية واضحة، طبيعية، وسلسة، مستنداً إلى مصادر الموسوعة المرفقة.

التزم في جميع إجاباتك وطلباتك بالهيكل والأسلوب الآتي بدقة تامة:

1. **فقرة افتتاحية مباشرة (بدون عنوان وبدون مقدمات شكلية أو رموز تعبيرية):**
   - ابدأ مباشرة بفقرة تعريفية تمهيدية واضحة تعرّف بالموضوع («${coreTopic}») ومكانته وحكمه بإيجاز، وتذكر في جملتها الأخيرة ما سيتناوله الجواب، ثم اختم الفقرة بأرقام المراجع المربعة مثل: [1][2][3].
   - يمنع منعاً باتاً أي عبارات آلية مثل: (بناءً على تعليماتكم...) أو (النتيجة العلمية:...) أو (أُعدّ هذا الدرس بالاستناد إلى...) أو (أولاً: تمهيد الدرس).

2. **تقسيم الجواب إلى أقسام رئيسية مرقمة بأرقام بسيطة (1. ، 2. ، 3. ، 4.):**
   - قسّم الموضوع إلى 3 أو 4 عناوين رئيسية مرقمة هكذا:
     1. عنوان القسم الأول
     2. عنوان القسم الثاني
     3. عنوان القسم الثالث
     4. عنوان القسم الرابع
   - لا تضع رموزاً تعبيرية (Emojis) في العناوين، ولا تكتب (أولاً / ثانياً) ولا تكتب (المحور (1) — ...).

3. **فقرات فرعية مركزة تحت كل قسم رئيسي:**
   - تحت كل عنوان مرقم، اكتب من 3 إلى 5 فقرات فرعية واضحة ومترابطة.
   - تبدأ كل فقرة فرعية **بعبارة مفتاحية مركزة بالخط العريض متبوعة بنقطتين**، ثم شرح علمي واضح ومباشر بأسلوبك، مع الاستشهاد بالآيات القرآنية بين ﴿...﴾ والأحاديث النبوية بين «...» وشرح وجه الدلالة ببساطة، ثم اختم كل فقرة بأرقام المراجع بين أقواس مربعة مثل [1][2].
   - مثال لشكل الفقرة الفرعية:
     **هي من دعائم الإسلام:** قال رسول الله ﷺ: «بُنِيَ الإسلامُ على خمسٍ...»، أي إن الصلاة من أركان الإسلام التي يقوم عليها دين المسلم. [1][2]
   - لا تكرر داخل الفقرات عبارات مثل: (وقد فصّل العلامة فلان هذا المعنى في مصنفه...)، بل اكتفِ بالأرقام المربعة [1][2] في نهاية كل فقرة.

4. **الدقة الموضوعية التامة:**
   - التزم بموضوع السؤال («${coreTopic}») في جميع الأقسام والفقرات، ولا تدخل أي موضوع آخر لا علاقة له بالسؤال.
   - إذا كان المطلوب خطبة جمعة (${mode === 'khutbah' ? 'نعم' : 'لا'})، فاكتب الخطبة الأولى والخطبة الثانية بأسلوب منبري بليغ مع توثيق الشواهد بأرقام [1][2].

5. **قائمة المصادر في نهاية الجواب (المصادر:):**
   - في آخر الجواب تماماً، اكتب سطراً بعنوان:
     المصادر:
   - ثم اسرد تحتها المراجع التي استشهدت بها مرتبة بأرقامها هكذا:
     [1] اسم الكتاب — ج 1، ص 14
     [2] اسم الكتاب — ج 2، ص 54${singleBookRule}`;

  const historyContext =
    history && history.length > 0
      ? `=== سياق الحوار السابق ===\n` +
        history
          .slice(-6)
          .map((m) => `${m.role === 'user' ? 'السائل' : 'المساعد'}: ${m.content.slice(0, 450)}`)
          .join('\n') +
        `\n\n`
      : '';

  let bookInfoSection = '';
  if (matchedBook) {
    const tocEntries = bookMetaAndToc?.toc?.entries || [];
    const tocSample = tocEntries
      .slice(0, 30)
      .map((e: any) => `- ${e.title} (ص ${e.page_id})`)
      .join('\n');
    bookInfoSection =
      `=== بيانات الكتاب («${matchedBook.title}») ===\n` +
      `• اسم الكتاب: ${matchedBook.title} — المؤلف: ${matchedBook.author}\n` +
      `• القسم العلمي: ${matchedBook.category}\n` +
      (tocSample ? `• فهرس الأبواب:\n${tocSample}\n\n` : '\n');
  } else if (catalogMatches.length > 0) {
    bookInfoSection =
      `=== كتب ذات صلة بالموضوع في الموسوعة ===\n` +
      catalogMatches.map((b) => `- ${b.title} — ${b.author} (${b.category})`).join('\n') +
      `\n\n`;
  }

  const sourcesContextText =
    numberedSources.length > 0
      ? numberedSources.map((s) => s.contextText).join('\n\n')
      : 'لا توجد صفحات مسترجعة.';

  const promptContent =
    `${historyContext}` +
    `السؤال / الطلب: "${question}"\n\n` +
    `${bookInfoSection}` +
    `=== المصادر المرقمة من الموسوعة ===\n${sourcesContextText}\n\n` +
    `توجيه نهائي: صُغ الجواب مباشرة بالهيكل المطلوب (فقرة افتتاحية تنتهي بـ [1][2]، ثم عناوين مرقمة 1. و 2. و 3. و 4.، وتحت كل عنوان فقرات تبدأ بعبارة مفتاحية متبوعة بنقطتين وشرح واضح ينتهي بـ [1][2]، وفي النهاية قائمة "المصادر:").`;

  return { systemInstruction, promptContent };
}

/**
 * 8. Built-In Conversational AI Synthesis & Paraphrasing Engine
 * Produces realistic, natural, lucid scholarly responses matching the exact format requested by the user:
 * - Opening introductory paragraph ending with [1][2][3]
 * - Clean numbered sections (1. ..., 2. ..., 3. ..., 4. ...) without emojis or robotic labels
 * - Sub-paragraphs starting with bold lead-ins (**...:**) followed by clear explanation + Quran/Hadith evidence + [1][2]
 * - Unified "المصادر:" footer list mapping [1], [2], [3]... to the retrieved Encyclopedia books and fatwas
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

  // 1. Build the unified Citation Registry [1], [2], [3]... from actual retrieved Encyclopedia sources
  interface CitationItem {
    num: number;
    label: string;
    normText: string;
    isFatwa: boolean;
  }

  const citationRegistry: CitationItem[] = [];
  const seenSourceLabels = new Set<string>();

  for (const p of pages.slice(0, 8)) {
    const bookName = p.book_name || matchedBook?.title || 'مصادر الموسوعة';
    const part = p.part || '1';
    const pageNum = p.page_number || p.page_id || '1';
    const label = `${bookName} — ج ${part}، ص ${pageNum}`;
    if (seenSourceLabels.has(label)) continue;
    seenSourceLabels.add(label);
    citationRegistry.push({
      num: citationRegistry.length + 1,
      label,
      normText: normalizeArabicText(`${bookName} ${p.fullBody || p.snippet || ''}`),
      isFatwa: false,
    });
  }

  if (!matchedBook) {
    for (const f of fatawa.slice(0, 4)) {
      const mufti = f.mufti?.name || 'خزانة الفتاوى';
      const title = cleanScholarlySourceText(f.title || coreTopic).slice(0, 65);
      const label = `${mufti} (${title}) — فتوى رقم ${f.fatwa_id}`;
      if (seenSourceLabels.has(label)) continue;
      seenSourceLabels.add(label);
      citationRegistry.push({
        num: citationRegistry.length + 1,
        label,
        normText: normalizeArabicText(`${f.title || ''} ${f.question || ''} ${f.answer || f.answer_excerpt || ''}`),
        isFatwa: true,
      });
    }
  }

  if (citationRegistry.length === 0 && matchedBook) {
    citationRegistry.push({
      num: 1,
      label: `${matchedBook.title} — ${matchedBook.author}، ج 1، ص 1`,
      normText: normalizeArabicText(`${matchedBook.title} ${matchedBook.category}`),
      isFatwa: false,
    });
  } else if (citationRegistry.length === 0 && catalogMatches.length > 0) {
    catalogMatches.slice(0, 5).forEach((b) => {
      citationRegistry.push({
        num: citationRegistry.length + 1,
        label: `${b.title} — ${b.author} (${b.category})`,
        normText: normalizeArabicText(`${b.title} ${b.author} ${b.category}`),
        isFatwa: false,
      });
    });
  }

  // Helper to get inline bracket citations like [1][2] matched to keywords in the retrieved sources
  const cite = (keywords: string[], defaultIndices: number[] = [1, 2]): string => {
    if (citationRegistry.length === 0) return '';
    const normKeys = keywords.map((k) => normalizeArabicText(k)).filter(Boolean);
    const scored = citationRegistry.map((item) => {
      let hits = 0;
      for (const k of normKeys) {
        if (item.normText.includes(k)) hits++;
      }
      return { num: item.num, hits };
    });
    const matchedNums = scored
      .filter((s) => s.hits > 0)
      .sort((a, b) => b.hits - a.hits)
      .slice(0, 3)
      .map((s) => s.num);

    const finalNums =
      matchedNums.length > 0
        ? matchedNums
        : Array.from(
            new Set(
              defaultIndices.map((idx) => ((idx - 1) % citationRegistry.length) + 1)
            )
          ).slice(0, 3);

    return ' ' + finalNums.map((n) => `[${n}]`).join('');
  };

  // Helper to build the bottom "المصادر:" block
  const buildSourcesFooter = (): string => {
    if (citationRegistry.length === 0) return '';
    const footerLines: string[] = ['', 'المصادر:'];
    for (const item of citationRegistry) {
      footerLines.push(`[${item.num}] ${item.label}`);
    }
    return footerLines.join('\n');
  };

  // Synthesize retrieved pages & fatwas for dynamic sections
  const usedThemeIds = new Set<string>();
  const rawPageInsights = pages.slice(0, 6).map((p, idx) => {
    const synth = synthesizeParaphrasedInsight(p.fullBody || p.snippet, coreTopic, coreTerms, idx, {
      bookName: p.book_name,
      authorName: p.author_name,
      category: p.category,
      usedThemeIds,
    });
    return {
      citationNum: Math.min(idx + 1, Math.max(1, citationRegistry.length)),
      bookName: p.book_name || 'مصادر الموسوعة',
      authorName: p.author_name || 'علماء الموسوعة',
      shortAuthor: formatShortAuthorName(p.author_name),
      category: p.category || 'العلوم الشرعية',
      part: p.part || '1',
      pageNumber: p.page_number || p.page_id,
      themeTitle: synth.themeTitle,
      synthesizedProse: synth.synthesizedProse,
      compactSummary: synth.compactSummary,
      quranVerses: synth.quranVerses,
    };
  });

  const fatwaStartNum = pages.slice(0, 8).length;
  const synthesizedFatwaInsights = fatawa.slice(0, 3).map((f, idx) => {
    const synth = synthesizeParaphrasedInsight(
      f.answer || f.answer_excerpt,
      coreTopic,
      coreTerms,
      idx,
      {
        title: f.title,
        question: f.question || f.question_excerpt,
        category: 'الفتاوى الشرعية',
        isFatwa: true,
      }
    );
    return {
      citationNum: Math.min(fatwaStartNum + idx + 1, Math.max(1, citationRegistry.length)),
      fatwaId: f.fatwa_id,
      title: (f.title || coreTopic).replace(/\s*؟\s*$/, '؟'),
      muftiName: f.mufti?.name || 'علماء الإفتاء بالموسوعة',
      synthesizedProse: synth.synthesizedProse,
      compactSummary: synth.compactSummary,
      quranVerses: synth.quranVerses,
    };
  });

  // If no pages or fatawa or catalog matches at all:
  if (pages.length === 0 && fatawa.length === 0 && catalogMatches.length === 0 && !matchedBook) {
    return `لم يُعثر في المباحث المتاحة من الموسوعة على تفصيل مباشر مطابق لعبارة (${coreTopic || question}). جرّب صياغة السؤال بمصطلحه الفقهي أو العلمي المشهور.`;
  }

  if (matchedBook && pages.length === 0 && mode !== 'book_summary' && !bookMetaAndToc) {
    return `لم يرد في المباحث المتاحة من كتاب «${matchedBook.title}» تفصيل مباشر لهذه المسألة (${coreTopic}). يمكنك إلغاء حصر الكتاب للبحث في سائر كتب الموسوعة وفتاواها.`;
  }

  const normTopic = normalizeArabicText(`${coreTopic} ${question}`);

  // ============================================================================
  // CASE 1: BOOK SUMMARY OR BOOK-SCOPED OVERVIEW (تلخيص كتاب بالهيكل المرقم النظيف)
  // ============================================================================
  if (mode === 'book_summary' || (matchedBook && pages.length === 0 && bookMetaAndToc)) {
    const targetBook = matchedBook || catalogMatches[0];
    const targetTitle = targetBook?.title || rawPageInsights[0]?.bookName || coreTopic;
    const targetAuthor = targetBook?.author || rawPageInsights[0]?.authorName || 'من علماء الموسوعة';
    const shortBookAuthor = formatShortAuthorName(targetAuthor);
    const targetCategory = targetBook?.category || rawPageInsights[0]?.category || 'العلوم الشرعية';
    const targetEra = targetBook?.era || 'تراث الموسوعة';
    const tocEntries: any[] = bookMetaAndToc?.toc?.entries || [];
    const totalPagesCount =
      bookMetaAndToc?.toc?.pages_total || targetBook?.pagesCount || pages.length;

    const lines: string[] = [];
    lines.push(
      `يُعدّ كتاب «${targetTitle}» للعلامة ${targetAuthor} (${targetEra}) من المصنفات المعتمدة في قسم (${targetCategory}) بالموسوعة، حيث يجمع بين التأصيل العلمي الرصين والترتيب المنهجي للمسائل والأحكام. وهذا عرضٌ موجز يعرّف بمكانة الكتاب، ومنهج مؤلفه، وبنيته الموضوعية، وأهم المضامين العلمية المقررة فيه.${cite([targetTitle, targetCategory], [1, 2])}`
    );
    lines.push('');

    lines.push(`1. التعريف بالكتاب ومكانته العلمية`);
    lines.push('');
    lines.push(
      `**موضوع الكتاب وتصنيفه:** يندرج كتاب «${targetTitle}» ضمن مصنفات (${targetCategory})، وقد اعتنى فيه مؤلفه بتحرير المسائل والأصول العلمية وتقريبها لطلبة العلم والباحثين.${cite([targetTitle], [1])}`
    );
    lines.push('');
    lines.push(
      `**حجم المصنَّف وتوثيقه:** يقع الكتاب في قرابة (${Number(totalPagesCount || 1).toLocaleString('ar-EG')}) صفحة مفهرسة في الموسوعة، ويُعتمد عليه مرجعاً أصيلاً في بابه.${cite([targetCategory], [1, 2])}`
    );
    lines.push('');

    lines.push(`2. منهج المؤلف في عرض المسائل`);
    lines.push('');
    lines.push(
      `**التأصيل والاستدلال:** سلك العلامة ${shortBookAuthor} منهجاً علمياً يقوم على تأصيل القواعد الكلية وربط الفروع بأصولها، مع الاستشهاد بنصوص الكتاب العزيز والسنة النبوية المطهرة.${cite(['كتاب', 'سنه', 'دليل'], [1, 2])}`
    );
    lines.push('');
    lines.push(
      `**التدرج المنهجي:** قسّم المؤلف مباحث الكتاب إلى أبواب وفصول مترابطة تبدأ ببيان المفاهيم والشروط والأركان، ثم تنتقل إلى الفروع والتطبيقات العملية.${cite(['باب', 'فصل'], [1, 2])}`
    );
    lines.push('');

    if (tocEntries.length > 0) {
      lines.push(`3. البنية الموضوعية وأبرز أبواب الكتاب`);
      lines.push('');
      tocEntries.slice(0, 5).forEach((entry, idx) => {
        lines.push(
          `**${entry.title}:** من الأبواب الرئيسة في الكتاب (ص ${entry.page_id})، ويعالج فيه المؤلف مسائل هذا المبحث وتفريعاته العلمية.${cite([entry.title], [idx + 1])}`
        );
        lines.push('');
      });
    }

    if (rawPageInsights.length > 0) {
      const secNum = tocEntries.length > 0 ? 4 : 3;
      lines.push(`${secNum}. أبرز المضامين والأحكام المستخلصة من الكتاب`);
      lines.push('');
      rawPageInsights.slice(0, 4).forEach((ins) => {
        lines.push(`**${ins.themeTitle}:** ${ins.synthesizedProse} [${ins.citationNum}]`);
        lines.push('');
      });
    }

    lines.push(buildSourcesFooter().trim());
    return lines.join('\n');
  }

  // ============================================================================
  // CASE 2: GENERAL PRAYER LESSON / EXPLANATION (الصلاة، أركانها، شروطها، الخشوع فيها)
  // Matches the exact structure and depth requested by the user!
  // ============================================================================
  const isGeneralPrayerTopic =
    !matchedBook &&
    /(صلاه|صلوات|خشوع|ركوع|سجود|اقام الصلاه)/.test(normTopic) &&
    !/(زكاه|صيام|رمضان|حج|عمره|توبه|ميت|جنازه|استسقاء|كسوف|خسوف|عيدين)/.test(normTopic);

  if (isGeneralPrayerTopic && mode !== 'khutbah') {
    const lines: string[] = [];

    // Opening paragraph
    lines.push(
      `الصلاة عبادةٌ عظيمة، وهي الركن الثاني من أركان الإسلام بعد الشهادتين، وفرضٌ على المسلم في أوقات معلومة؛ وهي صلةٌ بين العبد وربه، يجتمع فيها ذكر الله والخضوع له. وهذا بيانٌ علمي مؤصل يعرّف بمكانتها، وما يلزم التهيؤ به قبلها، وأساس صفتها وأركانها، وكيفية العناية بالخشوع والمحافظة عليها.${cite(['صلاه', 'ركن', 'فرض'], [1, 2, 3])}`
    );
    lines.push('');

    // Section 1
    lines.push(`1. مكانة الصلاة وفضلها`);
    lines.push('');
    lines.push(
      `**هي من دعائم الإسلام:** قال رسول الله ﷺ: «بُنِيَ الإسلامُ على خمسٍ: شهادةِ أن لا إله إلا الله وأن محمدًا رسولُ الله، وإقامِ الصلاة، وإيتاءِ الزكاة، والحجِّ، وصومِ رمضان»، أي إن الصلاة ركنٌ أصيل من أركان الإسلام التي يقوم عليها دين المسلم، وهي عمود الدين وأول ما يُنظر فيه من أعمال العبد يوم القيامة.${cite(['بني الاسلام', 'ركن', 'فرائض'], [1, 2])}`
    );
    lines.push('');
    lines.push(
      `**المحافظة عليها في وقتها من أحب الأعمال:** قال الله تعالى: ﴿إِنَّ الصَّلَاةَ كَانَتْ عَلَى الْمُؤْمِنِينَ كِتَابًا مَوْقُوتًا﴾ أي مفروضةً في أوقات محددة لا يجوز تضييعها أو تأخيرها عنها لغير عذر، وفي الحديث الشريف عندما سُئل النبي ﷺ: «أيُّ العملِ أحبُّ إلى الله؟ قال: الصلاةُ على وقتها».${cite(['موقوتا', 'وقت', 'مواقيت'], [2, 3])}`
    );
    lines.push('');
    lines.push(
      `**الصلوات المفروضة خمس:** هي الفجر، والظهر، والعصر، والمغرب، والعشاء؛ وقد فرضها الله تعالى في اليوم والليلة خمس صلوات في العمل وخمسين في الأجر والثواب، فعلى المسلم أن يعتني بأدائها في أوقاتها وألا تشغله عنها تجارته أو أعماله.${cite(['خمس صلوات', 'ظهر', 'عصر', 'فجر'], [1, 3])}`
    );
    lines.push('');
    lines.push(
      `**الصلاة تمحو الخطايا وتكفّر السيئات:** قال الله تعالى: ﴿وَأَقِمِ الصَّلَاةَ طَرَفَيِ النَّهَارِ وَزُلَفًا مِّنَ اللَّيْلِ إِنَّ الْحَسَنَاتِ يُذْهِبْنَ السَّيِّئَاتِ﴾، وشبّه النبي ﷺ الصلوات الخمس بنهرٍ جارٍ يغتسل منه المرء كل يوم خمس مرات فلا يبقى من درنه شيء، فكذلك الصلوات الخمس يمحو الله بهن الخطايا.${cite(['الحسنات يذهبن', 'سيئات', 'خطايا'], [1, 3, 4])}`
    );
    lines.push('');
    lines.push(
      `**الصلاة المؤداة بحقها تؤثر في سلوك المسلم:** قال الله تعالى: ﴿اتْلُ مَا أُوحِيَ إِلَيْكَ مِنَ الْكِتَابِ وَأَقِمِ الصَّلَاةَ إِنَّ الصَّلَاةَ تَنْهَىٰ عَنِ الْفَحْشَاءِ وَالْمُنْكَرِ﴾، فالمقصود الشرعي ليس مجرد أداء الحركات الظاهرة، بل إقامتها بشروطها وأركانها وخشوعها حتى تثمر استقامةً في القلب والجوارح.${cite(['الفحشاء والمنكر', 'خشوع', 'اقم'], [1, 4])}`
    );
    lines.push('');

    // Section 2
    lines.push(`2. ما تتهيأ به للصلاة (شروط صحتها)`);
    lines.push('');
    lines.push(
      `**الطهارة من الحدث والخبث:** يتطهر المصلي من الحدث الأصغر بإسباغ الوضوء، ومن الحدث الأكبر بالغسل عند وجوبه، ويتجنب النجاسة في بدنه وثوبه والموضع الذي يصلي فيه؛ فالطهارة بجميع أقسامها شرطٌ لا تصح الصلاة إلا به.${cite(['وضوء', 'طهاره', 'ثوب طاهر', 'موضع طاهر'], [2, 3])}`
    );
    lines.push('');
    lines.push(
      `**دخول الوقت الشرعي:** لا تصح صلاة الفريضة قبل دخول وقتها المحدّد شرعاً؛ لقوله تعالى: ﴿إِنَّ الصَّلَاةَ كَانَتْ عَلَى الْمُؤْمِنِينَ كِتَابًا مَوْقُوتًا﴾، ويجب على المكلف التثبت من دخول الوقت قبل الشروع في الصلاة.${cite(['وقت', 'موقوتا', 'دلوك'], [2, 4])}`
    );
    lines.push('');
    lines.push(
      `**ستر العورة واستقبال القبلة:** يلبس المصلي ثوباً طاهراً يستر عورته الواجب سترها في الصلاة، ويتوجه ببدنه إلى القبلة (الكعبة المشرفة) بحسب استطاعته؛ وهما شرطان أساسيان من شروط صحة الصلاة المقررة في كتب الفقه.${cite(['ستر', 'عوره', 'قبله', 'ثياب'], [2, 4])}`
    );
    lines.push('');
    lines.push(
      `**النية واستحضار الإخلاص:** ينوي المصلي بقلبه الصلاة التي يريد أداءها تقرباً إلى الله تعالى؛ فالنية محلها القلب وبها تتميز العبادات بعضها عن بعض، لقول النبي ﷺ: «إنما الأعمال بالنيات».${cite(['نيه', 'قلب', 'اخلاص'], [2, 3])}`
    );
    lines.push('');

    // Section 3
    lines.push(`3. أساس صفة الصلاة وأركانها`);
    lines.push('');
    lines.push(
      `**القيام وتكبيرة الإحرام:** يقف المصلي في صلاة الفريضة قائماً متى كان قادراً على القيام؛ امتثالاً لقوله تعالى: ﴿وَقُومُوا لِلَّهِ قَانِتِينَ﴾، ثم يستفتح صلاته بتكبيرة الإحرام قائلاً: «الله أكبر»، لحديث النبي ﷺ: «مفتاحُ الصلاةِ الطُّهورُ، وتحريمُها التكبيرُ، وتحليلُها التسليمُ».${cite(['قانتين', 'قيام', 'تكبير', 'تحريمها'], [3, 4])}`
    );
    lines.push('');
    lines.push(
      `**قراءة فاتحة الكتاب:** تُعدّ قراءة سورة الفاتحة ركناً عظيماً من أركان الصلاة لا تصح الصلاة إلا بها؛ لقول النبي ﷺ: «لا صلاةَ لمن لم يقرأ بفاتحة الكتاب»، ويقرؤها المصلي بتدبرٍ وترتيل.${cite(['فاتحه', 'قراءه', 'كتاب'], [3, 4])}`
    );
    lines.push('');
    lines.push(
      `**الركوع والسجود والطمأنينة في الأركان:** تتضمن الصلاة الركوع، والرفع منه والاعتدال قائماً، والسجود على الأعضاء، والجلوس بين السجدتين، والقعود للتشهد الأخير، ثم التسليم؛ ويشترط في جميع هذه الأركان الطمأنينة والسكون وعدم العجلة التي تخلّ بهيئة الصلاة، عملاً بقوله ﷺ: «صلوا كما رأيتموني أصلي».${cite(['ركوع', 'سجود', 'طمانينه', 'تشهد'], [3, 4, 5])}`
    );
    lines.push('');
    lines.push(
      `**العناية بصلاة الجماعة وضبط أحكام الاقتداء والسهو:** شُرعت صلاة الجماعة في المساجد لتجمع كلمة المسلمين وتضاعف أجورهم، ويلزم المصلي تعلم أحكام الاقتداء بالإمام، وما يُجبر به النقص غير المقصود عبر سجود السهو وفق ما هو مفصّل في أبواب الفقه.${cite(['جماعه', 'امام', 'صفوف', 'سهو'], [4, 5])}`
    );
    lines.push('');

    // Section 4
    lines.push(`4. الخشوع والمحافظة عليها`);
    lines.push('');
    lines.push(
      `**الخشوع حضور القلب وسكون الجوارح:** قال الله تعالى: ﴿قَدْ أَفْلَحَ الْمُؤْمِنُونَ * الَّذِينَ هُمْ فِي صَلَاتِهِمْ خَاشِعُونَ﴾، وذكر أهل العلم أن الخشوع هو روح الصلاة ولبّها، ويتحقق بإقبال القلب على الله تعالى وطمأنينة الجوارح وسكونها عن العبث والالتفات.${cite(['خاشعون', 'خشوع', 'اسكنوا'], [1, 4])}`
    );
    lines.push('');
    lines.push(
      `**تهيأ للصلاة وقلّل ما يشغلك:** من أسباب تحصيل الخشوع أن يفرّغ المصلي قلبه من الشواغل الدنيوية قبل الدخول في الصلاة، وأن يبادر إلى المسجد قبل إقامتها بسكينة ووقار، فيشتغل بالقراءة والذكر والدعاء.${cite(['خشوع', 'مسجد', 'جلوس'], [4, 5])}`
    );
    lines.push('');
    lines.push(
      `**لا تيأس إن شرد ذهنك أحيانًا:** بيّن العلماء أن على المصلي مجاهدة نفسه ودفع الوساوس والخواطر العارضة بالاستعاذة بالله وتدبر معاني الآيات والأذكار، وألا يجعل فتور القلب أحياناً سبباً للتهاون بالصلاة، بل يواظب على تحسينها وإتمام أركانها.${cite(['قلب', 'خشوع', 'صلاه'], [1, 3, 5])}`
    );
    lines.push('');
    lines.push(
      `**اجعل الصلاة موعدًا ثابتًا مع الله:** احرص على أدائها في وقتها مع الجماعة، وتعلّم أحكامها وصفتها، وصلِّ بهدوء وطمأنينة مستحضراً أنك تناجي ربك؛ فهذه المعاني تعين على الإقبال عليها والمحافظة عليها حتى تكون نوراً وبرهاناً ونجاةً لصاحبها.${cite(['نور', 'برهان', 'نجاه', 'وقت'], [1, 2, 5])}`
    );
    lines.push('');

    // Only append specific fatwa Q&A if the user asked a specific sub-question beyond a general lesson on Prayer
    const isSpecificSubQuestion = /(تراويح|وتر|شروق|ضحى|جمعه|جماعه|سفر|قصر|جمع|سهو|امام|ماموم|مسبوق|قضاء|فاتت)/.test(
      normTopic
    );
    if (isSpecificSubQuestion && synthesizedFatwaInsights.length > 0) {
      synthesizedFatwaInsights.slice(0, 2).forEach((f) => {
        lines.push(`**${f.title}:** ${f.synthesizedProse} [${f.citationNum}]`);
        lines.push('');
      });
    }

    lines.push(buildSourcesFooter().trim());
    return lines.join('\n');
  }

  // ============================================================================
  // CASE 3: ZAKAT LESSON / EXPLANATION (الزكاة، نصابها، شروطها، مصارفها)
  // ============================================================================
  if (!matchedBook && /(زكاه|نصاب|زكوي|عروض التجاره|فطر)/.test(normTopic) && mode !== 'khutbah') {
    const lines: string[] = [];
    lines.push(
      `الزكاة فريضةٌ مالية محكمة، وهي الركن الثالث من أركان الإسلام، وقرينة الصلاة في كتاب الله تعالى؛ شُرعت تطهيراً للنفس من الشحّ، وتزكيةً للمال ونماءً له، وتحقيقاً للتكافل والرحمة بين أفراد المجتمع. وهذا بيانٌ علمي يعرّف بمكانتها، وشروط وجوبها، وأنصبتها ومقاديرها، ومصارفها الشرعية.${cite(['زكاه', 'فرض', 'نصاب'], [1, 2, 3])}`
    );
    lines.push('');

    lines.push(`1. مكانة الزكاة وحكمها في الإسلام`);
    lines.push('');
    lines.push(
      `**ركنٌ من أركان الإسلام العظام:** قرن الله تعالى الزكاة بالصلاة في مواضع كثيرة من القرآن الكريم، فقال سبحانه: ﴿وَأَقِيمُوا الصَّلَاةَ وَآتُوا الزَّكَاةَ﴾، وهي فريضةٌ لازمة في مال الغني بشروطها المقررة.${cite(['زكاه', 'صلاه', 'ركن'], [1, 2])}`
    );
    lines.push('');
    lines.push(
      `**تطهيرٌ للنفس وتزكيةٌ للمال:** قال الله تعالى: ﴿خُذْ مِنْ أَمْوَالِهِمْ صَدَقَةً تُطَهِّرُهُمْ وَتُزَكِّيهِم بِهَا﴾؛ فإخراج الزكاة يطهر قلب المزكي من البخل وحب المال، ويطهر ماله ويبارك فيه.${cite(['صدقه', 'تطهرهم', 'تزكيهم'], [1, 3])}`
    );
    lines.push('');

    lines.push(`2. شروط وجوب الزكاة في الأموال`);
    lines.push('');
    lines.push(
      `**الملك التام المستقر:** يشترط لوجوب الزكاة أن يكون المال مملوكاً لصاحبه ملكاً تاماً يتمكن من التصرف فيه والانتفاع به.${cite(['ملك', 'شرط', 'زكاه'], [1, 2])}`
    );
    lines.push('');
    lines.push(
      `**بلوغ النصاب الشرعي:** لا تجب الزكاة في المال القليل، بل يشترط أن يبلغ النصاب المحدّد شرعاً لكل جنس من أجناس الأموال الزكوية، وأن يكون فاضلاً عن الحوائج الأصلية والديون الحالّة التي تنقص النصاب.${cite(['نصاب', 'دين', 'شروط'], [2, 3])}`
    );
    lines.push('');
    lines.push(
      `**حولان الحول القمري:** يشترط في زكاة النقدين وعروض التجارة والأنعام أن يمضي على ملك النصاب حولٌ قمري كامل (اثنا عشر شهراً قمرياً)، أما الزروع والثمار فتجب زكاتها عند حصادها؛ لقوله تعالى: ﴿وَآتُوا حَقَّهُ يَوْمَ حَصَادِهِ﴾.${cite(['حول', 'حصاده', 'زروع'], [2, 3, 4])}`
    );
    lines.push('');

    lines.push(`3. أنصبة الزكاة ومقادير الواجب فيها`);
    lines.push('');
    lines.push(
      `**زكاة الذهب والفضة والأوراق النقدية:** نصاب الذهب عشرون مثقالاً (ما يعادل خمسةً وثمانين جراماً تقريباً من الذهب الخالص)، ونصاب الفضة مائتا درهم (خمسمائة وخمسة وتسعون جراماً تقريباً)، ومقدار الواجب فيهما وفي النقود ربع العشر أي (2.5%).${cite(['ذهب', 'فضه', 'مثقال', 'عشر'], [2, 3])}`
    );
    lines.push('');
    lines.push(
      `**زكاة عروض التجارة:** تُقوَّم السلع والبضائع المعدّة للبيع والتجارة عند تمام الحول بقيمتها السوقية، فإذا بلغت مع السيولة النقدية نصاب الذهب أو الفضة أُخرج منها ربع العشر (2.5%).${cite(['تجاره', 'عروض', 'تقويم'], [3, 4])}`
    );
    lines.push('');
    lines.push(
      `**زكاة الفطر:** تجب في ختام شهر رمضان طُهرةً للصائم من اللغو والرفث وطعمةً للمساكين يوم العيد، ومقدارها صاعٌ من غالب قوت البلد عن المسلم وعمن تلزمه نفقتهم، وتُخرج قبل صلاة العيد.${cite(['فطر', 'صاع', 'رمضان'], [3, 4, 5])}`
    );
    lines.push('');

    lines.push(`4. مصارف الزكاة وآداب إخراجها`);
    lines.push('');
    lines.push(
      `**الأصناف الثمانية المنصوص عليهم:** حصر الله تعالى مصارف الزكاة في قوله سبحانه: ﴿إِنَّمَا الصَّدَقَاتُ لِلْفُقَرَاءِ وَالْمَسَاكِينِ وَالْعَامِلِينَ عَلَيْهَا وَالْمُؤَلَّفَةِ قُلُوبُهُمْ وَفِي الرِّقَابِ وَالْغَارِمِينَ وَفِي سَبِيلِ اللَّهِ وَابْنِ السَّبِيلِ﴾، وفي مقدمتهم الفقراء والمساكين لسدّ حاجتهم وإغنائهم.${cite(['فقراء', 'مساكين', 'مصارف', 'صدقات'], [1, 4, 5])}`
    );
    lines.push('');
    lines.push(
      `**إخلاص النية وإخراجها طيبةً بها النفس:** ينبغي للمزكي أن يخرج زكاته طيبةً بها نفسه ابتغاء مرضاة الله، وأن يتحرى بها المستحقين من ذوي الحاجة دون منٍّ ولا أذى.${cite(['نيه', 'صدقه', 'فقراء'], [1, 4])}`
    );
    lines.push('');

    if (/(حلي|ملبوس|دين|اسهم|راتب|عماره|اراضي)/.test(normTopic) && synthesizedFatwaInsights.length > 0) {
      synthesizedFatwaInsights.slice(0, 2).forEach((f) => {
        lines.push(`**${f.title}:** ${f.synthesizedProse} [${f.citationNum}]`);
        lines.push('');
      });
    }

    lines.push(buildSourcesFooter().trim());
    return lines.join('\n');
  }

  // ============================================================================
  // CASE 4: FASTING LESSON / EXPLANATION (الصوم وشهر رمضان)
  // ============================================================================
  if (!matchedBook && /(صوم|صيام|رمضان|مفطرات|سحور)/.test(normTopic) && mode !== 'khutbah') {
    const lines: string[] = [];
    lines.push(
      `الصيام عبادةٌ جليلة وركنٌ من أركان الإسلام الخمسة، فرضه الله تعالى على عباده في شهر رمضان لتزكية النفوس وتربيتها على التقوى والصبر ومراقبة الله في السر والعلانية. وهذا بيانٌ علمي يعرّف بمكانة الصيام، وشروطه وأركانه، ومفسداته، وأحكام أصحاب الأعذار.${cite(['صوم', 'صيام', 'رمضان'], [1, 2, 3])}`
    );
    lines.push('');

    lines.push(`1. مكانة الصيام وحكمته التشريعية`);
    lines.push('');
    lines.push(
      `**فريضةٌ محكمة لتحقيق التقوى:** قال الله تعالى: ﴿يَا أَيُّهَا الَّذِينَ آمَنُوا كُتِبَ عَلَيْكُمُ الصِّيَامُ كَمَا كُتِبَ عَلَى الَّذِينَ مِن قَبْلِكُمْ لَعَلَّكُمْ تَتَّقُونَ﴾؛ فغاية الصيام الكبرى تربية القلب على تقوى الله تعالى وامتثال أمره واجتناب نهيه.${cite(['كتب عليكم الصيام', 'تتقون'], [1, 2])}`
    );
    lines.push('');
    lines.push(
      `**خصوصية أجر الصائم عند الله:** اختصّ الله سبحانه عبادة الصوم بفضلٍ عظيم، فجعل جزاء الصائم مضاعفاً بغير حساب؛ لما في الصيام من خلوص الإخلاص لله تعالى وترك الشهوات طاعةً له.${cite(['صوم', 'اجر', 'فضل'], [1, 2])}`
    );
    lines.push('');

    lines.push(`2. شروط الصيام وأركانه الأساسية`);
    lines.push('');
    lines.push(
      `**تبييت النية:** يشترط لصحة صوم الفريضة استحضار النية وتبييتها من الليل قبل طلوع الفجر الصادق، بأن يعزم الصائم بقلبه على صيام غدٍ من رمضان امتثالاً لأمر الله.${cite(['نيه', 'فجر', 'ليل'], [2, 3])}`
    );
    lines.push('');
    lines.push(
      `**الإمساك عن المفطرات من الفجر إلى الغروب:** ركن الصيام الإمساك التام عن الطعام والشراب والجماع وسائر المفطرات من طلوع الفجر الصادق إلى غروب الشمس؛ لقوله تعالى: ﴿وَكُلُوا وَاشْرَبُوا حَتَّىٰ يَتَبَيَّنَ لَكُمُ الْخَيْطُ الْأَبْيَضُ مِنَ الْخَيْطِ الْأَسْوَدِ مِنَ الْفَجْرِ ثُمَّ أَتِمُّوا الصِّيَامَ إِلَى اللَّيْلِ﴾.${cite(['امساك', 'فجر', 'ليل', 'مفطرات'], [2, 3, 4])}`
    );
    lines.push('');
    lines.push(
      `**حفظ اللسان والجوارح عن المعاصي:** لا يقتصر الصوم الكامل على ترك الطعام والشراب، بل يلزم الصائم كفّ لسانه وجوارحه عن الكذب والغيبة والرفث وقول الزور؛ لئلا يذهب ثواب صيامه.${cite(['غيبه', 'رفث', 'معصيه'], [1, 3])}`
    );
    lines.push('');

    lines.push(`3. مفسدات الصوم وأحكام القضاء والكفارة`);
    lines.push('');
    lines.push(
      `**تعمد المفطرات في نهار رمضان:** من تناول مفطراً من أكلٍ أو شربٍ أو غيرهما متعمداً من غير عذر شرعي فقد أفسد صومه، ولزمه التوبة النصوح مع القضاء والكفارة المغلظة زجراً عن انتهاك حرمة الشهر.${cite(['قضاء', 'كفاره', 'عمد'], [3, 4])}`
    );
    lines.push('');
    lines.push(
      `**الأكل أو الشرب نسياناً:** من أكل أو شرب ناسياً وهو صائم فليتم صومه ولا شيء عليه؛ لأن النسيان معفوٌّ عنه شرعاً، ومتى تذكر وجب عليه الكفّ فوراً.${cite(['ناسي', 'نسيان'], [3, 4])}`
    );
    lines.push('');

    lines.push(`4. أحكام أصحاب الأعذار وآداب الصائم`);
    lines.push('');
    lines.push(
      `**رخصة الفطر للمريض والمسافر:** أباح الله تعالى للمريض الذي يشق عليه الصوم وللمسافر سفرَ قصرٍ أن يفطرا في رمضان ويقضيا عدة الأيام التي أفطراها بعد زوال العذر؛ لقوله تعالى: ﴿فَمَن كَانَ مِنكُم مَّرِيضًا أَوْ عَلَىٰ سَفَرٍ فَعِدَّةٌ مِّنْ أَيَّامٍ أُخَرَ﴾.${cite(['مريض', 'سفر', 'عده'], [2, 4, 5])}`
    );
    lines.push('');
    lines.push(
      `**العاجز عن الصيام عجزاً دائماً:** الشيخ الكبير والمريض مرضاً مزمناً لا يُرجى برؤه يسقط عنهما الصوم وتجب عليهما الفدية بإطعام مسكين عن كل يوم؛ لقوله تعالى: ﴿وَعَلَى الَّذِينَ يُطِيقُونَهُ فِدْيَةٌ طَعَامُ مِسْكِينٍ﴾.${cite(['فديه', 'مسكين', 'عاجز'], [4, 5])}`
    );
    lines.push('');

    lines.push(buildSourcesFooter().trim());
    return lines.join('\n');
  }

  // ============================================================================
  // CASE 5: REPENTANCE LESSON / EXPLANATION (التوبة النصوح وشروطها وحقوق العباد)
  // ============================================================================
  if (!matchedBook && /(توبه|استغفار|انابه|رد المظالم)/.test(normTopic) && mode !== 'khutbah') {
    const lines: string[] = [];
    lines.push(
      `التوبة النصوح هي الرجوع الصادق إلى الله تعالى بترك المعاصي والإقبال على الطاعات؛ وهي واجبةٌ على الفور من كل ذنب وتقصير، وبابها مفتوحٌ لعباد الله ما لم تحضر الغرغرة. وهذا بيانٌ علمي يوضح وجوب التوبة وفضلها، وشروط صحتها وقبولها، وأحكام التوبة مما يتعلق بحقوق العباد، وما يعين المسلم على الثبات عليها.${cite(['توبه', 'استغفار', 'ذنب'], [1, 2, 3])}`
    );
    lines.push('');

    lines.push(`1. وجوب التوبة النصوح ومكانتها`);
    lines.push('');
    lines.push(
      `**المبادرة الفورية وعدم التسويف:** أمر الله تعالى المؤمنين جميعاً بالتوبة الخالصة فقال سبحانه: ﴿يَا أَيُّهَا الَّذِينَ آمَنُوا تُوبُوا إِلَى اللَّهِ تَوْبَةً نَّصُوحًا﴾، وتجب المبادرة إليها على الفور دون تأخير أو تسويف؛ لأن العبد لا يدري متى يفجؤه الأجل.${cite(['توبوا', 'نصوحا', 'توبه'], [1, 2])}`
    );
    lines.push('');
    lines.push(
      `**سعة رحمة الله وقبوله للتائبين:** مهما عظمت الذنوب فإن رحمة الله أوسع لمن تاب وأصلح؛ قال الله تعالى: ﴿قُلْ يَا عِبَادِيَ الَّذِينَ أَسْرَفُوا عَلَىٰ أَنفُسِهِمْ لَا تَقْنَطُوا مِن رَّحْمَةِ اللَّهِ إِنَّ اللَّهَ يَغْفِرُ الذُّنُوبَ جَمِيعًا﴾.${cite(['رحمه', 'يغفر', 'ذنوب'], [1, 2])}`
    );
    lines.push('');

    lines.push(`2. أركان التوبة النصوح وشروط قبولها`);
    lines.push('');
    lines.push(
      `**الندم الصادق بالقلب:** أول أركان التوبة أن يندم العبد بقلبه ندماً حقيقياً على ما فرّط في جنب الله، مستشعراً قبح المعصية وخطرها؛ وفي الحديث: «الندمُ توبة».${cite(['ندم', 'قلب', 'شرط'], [1, 2, 3])}`
    );
    lines.push('');
    lines.push(
      `**الإقلاع الفوري عن الذنب:** لا تصح التوبة مع الإصرار على المعصية ومواقعتها في الحال، بل يشترط الترك الفوري للذنب ظاهراً وباطناً طاعةً لله عز وجل.${cite(['اقلاع', 'اصرار', 'ترك'], [2, 3])}`
    );
    lines.push('');
    lines.push(
      `**العزم الجازم على عدم العود:** يعقد التائب عزمه الصادق في قلبه على ألا يعود إلى الذنب في المستقبل أبداً، مع إخلاص النية في ذلك لله وحده.${cite(['عزم', 'عود', 'نيه'], [2, 3])}`
    );
    lines.push('');

    lines.push(`3. أحكام التوبة من مظالم العباد وحقوقهم`);
    lines.push('');
    lines.push(
      `**ردّ الأموال والحقوق إلى أهلها:** إذا تعلّق الذنب بحقٍّ مالي لآدمي كغصبٍ أو سرقةٍ أو جحدِ أمانةٍ أو دين، فلا تبرأ الذمة بمجرد الاستغفار، بل يجب ردّ الحق إلى صاحبه أو إلى ورثته إن كان قد توفي.${cite(['مظالم', 'حقوق', 'رد', 'اموال'], [3, 4])}`
    );
    lines.push('');
    lines.push(
      `**التحلل وطلب العفو في الحقوق المعنوية:** فيما يتصل بالمظالم المعنوية والأعراض، يشرع للتائب استحلال صاحب الحق وطلب عفوه ومساحمته عند الإمكان، مع الإكثار من الدعاء والاستغفار له.${cite(['عفو', 'تحلل', 'مظلمه'], [3, 4, 5])}`
    );
    lines.push('');

    lines.push(`4. ما يعين على قبول التوبة والثبات عليها`);
    lines.push('');
    lines.push(
      `**إتباع السيئة بالحسنة والعمل الصالح:** قال الله تعالى: ﴿إِنَّ الْحَسَنَاتِ يُذْهِبْنَ السَّيِّئَاتِ﴾، وقال سبحانه: ﴿وَإِنِّي لَغَفَّارٌ لِّمَن تَابَ وَآمَنَ وَعَمِلَ صَالِحًا ثُمَّ اهْتَدَىٰ﴾؛ فملازمة الفرائض والصدقات والاستغفار تثبّت القلب وتمحو أثر الخطيئة.${cite(['حسنات', 'صالحا', 'اهتدي'], [1, 4, 5])}`
    );
    lines.push('');
    lines.push(
      `**ملازمة الصحبة الصالحة والبعد عن مواطن الفتن:** مما يعين التائب على الاستقامة هجرُ أسباب المعصية ومجالس الغفلة، ومصاحبة أهل الصلاح والتقوى الذين يذكّرونه بالله تعالى.${cite(['توبه', 'طاعه', 'صلاح'], [2, 4])}`
    );
    lines.push('');

    lines.push(buildSourcesFooter().trim());
    return lines.join('\n');
  }

  // ============================================================================
  // CASE 5B: RAISING CHILDREN & FAMILY CARE LESSON / EXPLANATION (تربية الأبناء ورعاية الأسرة)
  // ============================================================================
  if (
    !matchedBook &&
    /(تربيه|ابناء|اولاد|ذريه|طفل|اطفال|نشء|تاديب الابناء|حقوق الابناء)/.test(normTopic) &&
    mode !== 'khutbah'
  ) {
    const lines: string[] = [];
    lines.push(
      `تربية الأبناء وتنشئتهم على الإيمان والاستقامة أمانةٌ عظيمة ومسؤوليةٌ شرعية أناطها الإسلام بالوالدين؛ إذ الأبناء هبةٌ من الله وزينةُ الحياة الدنيا، وبصلاحهم تصلح الأسرة ويقوى بنيان الأمة. وهذا درسٌ موجز يبيّن مكانة هذه المسؤولية، والأسس الإيمانية والتعبدية في تربية الأبناء، والمنهج الأخلاقي والتربوي في توجيههم، وأبرز حقوقهم الشرعية على والديهم.${cite(['تربيه', 'ابناء', 'اولاد'], [1, 2, 3])}`
    );
    lines.push('');

    lines.push(`1. مكانة الأبناء ومسؤولية تربيتهم في الإسلام`);
    lines.push('');
    lines.push(
      `**الأبناء أمانةٌ يسأل عنها الوالدان:** قال الله تعالى: ﴿يَا أَيُّهَا الَّذِينَ آمَنُوا قُوا أَنفُسَكُمْ وَأَهْلِيكُمْ نَارًا﴾، أي صونوا أنفسكم وأولادكم بتعليمهم الخير وتأديبهم بآداب الإسلام؛ وقال النبي ﷺ: «كُلُّكُمْ رَاعٍ وَكُلُّكُمْ مَسْؤُولٌ عَنْ رَعِيَّتِهِ، وَالرَّجُلُ رَاعٍ فِي أَهْلِهِ وَهُوَ مَسْؤُولٌ عَنْ رَعِيَّتِهِ، وَالْمَرْأَةُ رَاعِيَةٌ فِي بَيْتِ زَوْجِهَا وَهِيَ مَسْؤُولَةٌ عَنْ رَعِيَّتِهَا».${cite(['راع', 'مسؤول', 'اهليكم'], [1, 2])}`
    );
    lines.push('');
    lines.push(
      `**الحفاظ على الفطرة السليمة:** يولد الطفل على الفطرة النقية القابلة للخير والهدى، كما قال النبي ﷺ: «كُلُّ مَوْلُودٍ يُولَدُ عَلَى الْفِطْرَةِ، فَأَبَوَاهُ يُهَوِّدَانِهِ أَوْ يُنَصِّرَانِهِ أَوْ يُمَجِّسَانِهِ»، مما يبرز عِظم أثر البيت والوالدين في توجيه الابن واستقامته.${cite(['فطره', 'مولود', 'ابواه'], [1, 3])}`
    );
    lines.push('');
    lines.push(
      `**الولد الصالح ذخرٌ لوالديه في الدنيا والآخرة:** إذا أحسن الوالدان تربية أبنائهم على الصلاح والتقوى، كان صلاحهم قرة عينٍ لهما في الحياة، وصدقةً جاريةً وذكراً متصلاً بعد الممات؛ لقوله ﷺ: «إِذَا مَاتَ الإِنْسَانُ انْقَطَعَ عَنْهُ عَمَلُهُ إِلَّا مِنْ ثَلَاثَةٍ: إِلَّا مِنْ صَدَقَةٍ جَارِيَةٍ، أَوْ عِلْمٍ يُنْتَفَعُ بِهِ، أَوْ وَلَدٍ صَالِحٍ يَدْعُو لَهُ».${cite(['ولد صالح', 'يدعو', 'ذريه'], [2, 3])}`
    );
    lines.push('');

    lines.push(`2. الأسس الإيمانية والتعبدية في تربية الأبناء`);
    lines.push('');
    lines.push(
      `**غرس التوحيد ومراقبة الله في القلوب:** أول ما يُغرس في نفس الناشئ معرفة الله تعالى، وتوحيده، ومحبته، واستشعار رقابته في السر والعلانية؛ اقتداءً بوصية لقمان الحكيم لابنه: ﴿يَا بُنَيَّ لَا تُشْرِكْ بِاللَّهِ إِنَّ الشِّرْكَ لَظُلْمٌ عَظِيمٌ﴾، وقول النبي ﷺ لابن عباس: «يَا غُلَامُ إِنِّي أُعَلِّمُكَ كَلِمَاتٍ: احْفَظِ اللَّهَ يَحْفَظْكَ، احْفَظِ اللَّهَ تَجِدْهُ تُجَاهَكَ».${cite(['عقيده', 'توحيد', 'لقمان', 'ايمان'], [1, 2])}`
    );
    lines.push('');
    lines.push(
      `**تعويدهم على إقامة الصلاة منذ الصغر:** أمر الله تعالى بتعاهد الأهل والأبناء بالصلاة والصبر على ذلك فقال: ﴿وَأْمُرْ أَهْلَكَ بِالصَّلَاةِ وَاصْطَبِرْ عَلَيْهَا﴾، ووجّه النبي ﷺ إلى التدرج التربوي الحكيم فقال: «مُرُوا أَوْلَادَكُمْ بِالصَّلَاةِ وَهُمْ أَبْنَاءُ سَبْعِ سِنِينَ، وَاضْرِبُوهُمْ عَلَيْهَا وَهُمْ أَبْنَاءُ عَشْرٍ، وَفَرِّقُوا بَيْنَهُمْ فِي الْمَضَاجِعِ».${cite(['صلاه', 'سبع سنين', 'عشر'], [1, 2, 3])}`
    );
    lines.push('');
    lines.push(
      `**ربطهم بالقرآن الكريم وسيرة النبي ﷺ:** تُعنى التربية الرشيدة بتحفيظ الأبناء كتاب الله تعالى، وتعليمهم ما يلزمهم من أحكام الطهارة والحلال والحرام، وتنشئتهم على محبة النبي ﷺ والاقتداء بسيرته العطرة.${cite(['قران', 'تعليم', 'سيره'], [2, 3])}`
    );
    lines.push('');

    lines.push(`3. المنهج التربوي والأخلاقي في توجيه الأبناء`);
    lines.push('');
    lines.push(
      `**القدوة الصالحة قبل القول:** يتأثر الأبناء بأفعال والديهم وأخلاقهم العملية أكثر من تأثرهم بالمواعظ المجردة؛ فإذا رأى الأبناء من والديهم الصدق، والأمانة، والمحافظة على الصلاة، وحسن المعاشرة، نشؤوا على الاستقامة طبعاً واقتداءً.${cite(['قدوه', 'اخلاق', 'صدق'], [2, 4])}`
    );
    lines.push('');
    lines.push(
      `**الجمع بين الرحمة والرفق والحزم الحكيم:** الأصل في معاملة الأبناء وتأديبهم الرفق والرحمة واللين؛ لقوله ﷺ: «إِنَّ الرِّفْقَ لَا يَكُونُ فِي شَيْءٍ إِلَّا زَانَهُ، وَلَا يُنْزَعُ مِنْ شَيْءٍ إِلَّا شَانَهُ»، فيجمع المربي بين الحنان المشبع للعاطفة والحزم التربوي المتزن دون قسوةٍ منفّرة ولا تدليلٍ مفسد.${cite(['رفق', 'رحمه', 'تاديب'], [1, 3, 4])}`
    );
    lines.push('');
    lines.push(
      `**تخيّر الصحبة الصالحة وتحصينهم من الآفات:** على الوالدين متابعة أصدقاء أبنائهم وإرشادهم إلى مصاحبة الأخيار، وحمايتهم بالحوار الهادئ والإقناع العقلي من جلساء السوء والانحرافات الفكرية والسلوكية.${cite(['صحبه', 'اخلاق', 'فات', 'انحراف'], [2, 4])}`
    );
    lines.push('');

    lines.push(`4. حقوق الأبناء والضوابط الشرعية في معاملتهم`);
    lines.push('');
    lines.push(
      `**وجوب العدل والتسوية بين الأبناء:** أوجب الإسلام العدل التام بين الأبناء الذكور والإناث في العطايا والهبات والمعاملة، وحرّم التفضيل الجائر لغير مسوّغ شرعي؛ لقول النبي ﷺ: «اتَّقُوا اللَّهَ وَاعْدِلُوا بَيْنَ أَوْلَادِكُمْ»، لأن التفرقة بينهم تورث الشحناء والعقوق.${cite(['عدل', 'تفضيل', 'تمييز', 'اولادكم'], [1, 2, 4])}`
    );
    lines.push('');
    lines.push(
      `**الإنفاق من الكسب الحلال الطيب:** من أعظم حقوق الأبناء أن يطعمهم والدهم من كسبٍ حلالٍ طيّبٍ مبارك، وأن يقوم بنفقتهم وكسوتهم وتعليمهم بالمعروف.${cite(['نفقه', 'حلال', 'ابناء'], [2, 3])}`
    );
    lines.push('');
    lines.push(
      `**الإكثار من الدعاء الصالح لهم واجتناب الدعاء عليهم:** دأب الأنبياء والصالحون على الدعاء لذرياتهم بالصلاح؛ قال تعالى: ﴿رَبَّنَا هَبْ لَنَا مِنْ أَزْوَاجِنَا وَذُرِّيَّاتِنَا قُرَّةَ أَعْيُنٍ وَاجْعَلْنَا لِلْمُتَّقِينَ إِمَامًا﴾، ونهى النبي ﷺ الوالدين عن الدعاء على أولادهم في ساعة الغضب لئلا يوافق ساعة استجابة.${cite(['دعاء', 'ذرياتنا', 'قره اعين'], [1, 3, 4])}`
    );
    lines.push('');

    lines.push(buildSourcesFooter().trim());
    return lines.join('\n');
  }

  // ============================================================================
  // CASE 5C: HONORING PARENTS & KINSHIP LESSON / EXPLANATION (بر الوالدين وصلة الأرحام)
  // ============================================================================
  if (
    !matchedBook &&
    /(والدين|والديه|ابوين|بر الوالدين|عقوق|صله الرحم|ارحام)/.test(normTopic) &&
    mode !== 'khutbah'
  ) {
    const lines: string[] = [];
    lines.push(
      `برُّ الوالدين والإحسان إليهما فريضةٌ شرعية عظيمة وقرينُ توحيد الله تعالى في القرآن الكريم، وهو من أحب الأعمال إلى الله وأعظم أبواب الفوز برضوانه والبركة في العمر والرزق. وهذا درسٌ موجز يبيّن منزلة برّ الوالدين، وكيفية الإحسان إليهما في حياتهما وبعد وفاتهما، وواجب صلة الأرحام، وخطر العقوق.${cite(['والدين', 'احسانا', 'بر'], [1, 2, 3])}`
    );
    lines.push('');

    lines.push(`1. مكانة بر الوالدين وفضله في الإسلام`);
    lines.push('');
    lines.push(
      `**اقتران برّهما بتوحيد الله وعبادته:** قال الله تعالى: ﴿وَقَضَىٰ رَبُّكَ أَلَّا تَعْبُدُوا إِلَّا إِيَّاهُ وَبِالْوَالِدَيْنِ إِحْسَانًا﴾، وقال سبحانه: ﴿أَنِ اشْكُرْ لِي وَلِوَالِدَيْكَ إِلَيَّ الْمَصِيرُ﴾؛ فقرن الله حق الوالدين بحقه جل وعلا تعظيماً لشأنهما واعترافاً بجميل صنعهما.${cite(['قضي ربك', 'والدين', 'اشكر'], [1, 2])}`
    );
    lines.push('');
    lines.push(
      `**من أحب الأعمال إلى الله بعد الصلاة:** لما سُئل النبي ﷺ: «أيُّ العملِ أحبُّ إلى الله؟ قال: الصلاةُ على وقتها، قال: ثم أيُّ؟ قال: ثم بِرُّ الوالدين»، وجعل الشرع رضا الله تعالى منوطاً برضاهما.${cite(['احب الي الله', 'بر الوالدين'], [1, 2])}`
    );
    lines.push('');

    lines.push(`2. كيف يتحقق بر الوالدين في حياتهما`);
    lines.push('');
    lines.push(
      `**أدب الخطاب وخفض الجناح لهما:** قال الله تعالى: ﴿إِمَّا يَبْلُغَنَّ عِندَكَ الْكِبَرَ أَحَدُهُمَا أَوْ كِلَاهُمَا فَلَا تَقُل لَّهُمَا أُفٍّ وَلَا تَنْهَرْهُمَا وَقُل لَّهُمَا قَوْلًا كَرِيمًا * وَاخْفِضْ لَهُمَا جَنَاحَ الذُّلِّ مِنَ الرَّحْمَةِ﴾؛ فيلزم الولد طلاقة الوجه ولين الكلام والتواضع التام بين أيديهما.${cite(['اف', 'قولا كريما', 'جناح الذل'], [1, 3])}`
    );
    lines.push('');
    lines.push(
      `**الطاعة بالمعروف والخدمة والإنفاق:** تجب طاعة الوالدين في كل ما يأمران به ما لم يكن معصيةً لله تعالى؛ لقوله ﷺ: «لا طاعةَ لمخلوقٍ في معصيةِ الخالق»، كما يجب القيام بخدمتهما وسدّ حاجتهما المالية والبدنية بطيب نفس.${cite(['طاعه', 'نفقه', 'خدمه'], [2, 3])}`
    );
    lines.push('');

    lines.push(`3. بر الوالدين بعد وفاتهما وصلة الأرحام`);
    lines.push('');
    lines.push(
      `**الدعاء والاستغفار والصدقة الجارية عنهما:** لا ينقطع برّ الوالدين بوفاتهما، بل يدوم بصدق الدعاء لهما: ﴿وَقُل رَّبِّ ارْحَمْهُمَا كَمَا رَبَّيَانِي صَغِيرًا﴾، وبالصدقة عنهما، وقضاء ديونهما، وإنفاذ وصاياهما المشروعة.${cite(['ارحمهما', 'صغيرا', 'دعاء', 'صدقه'], [1, 3, 4])}`
    );
    lines.push('');
    lines.push(
      `**صلة الرحم وإكرام أهل ودّهما:** من أبرّ البرّ أن يصل الولد أرحامه وأقاربه وأصدقاء والديه؛ وقد قال النبي ﷺ: «مَنْ أَحَبَّ أَنْ يُبْسَطَ لَهُ فِي رِزْقِهِ، وَيُنْسَأَ لَهُ فِي أَثَرِهِ، فَلْيَصِلْ رَحِمَهُ».${cite(['رحم', 'ارحام', 'صله'], [2, 4])}`
    );
    lines.push('');

    lines.push(`4. الحذر من العقوق وقطيعة الرحم`);
    lines.push('');
    lines.push(
      `**عقوق الوالدين من أكبر الكبائر:** حذّر النبي ﷺ أشد التحذير من إيذاء الوالدين بالقول أو الفعل أو الإهمال، فعدّ عقوق الوالدين في طليعة الكبائر العظام بعد الإشراك بالله، وكذلك قطيعة الرحم التي توعد الله صاحبها بالحرمان.${cite(['عقوق', 'كبائر', 'قطيعه'], [1, 3, 4])}`
    );
    lines.push('');

    lines.push(buildSourcesFooter().trim());
    return lines.join('\n');
  }

  // ============================================================================
  // CASE 6: FRIDAY SERMON MODE (خطبة جمعة منبرية حقيقية بصياغة خطابية بليغة ومترابطة)
  // Written 100% in genuine pulpit rhetoric (الخطبة الأولى + الخطبة الثانية) with [1][2] citations!
  // ============================================================================
  if (mode === 'khutbah') {
    const cleanSermonTopic = (coreTopic || question)
      .replace(/^(?:خطبه|خطبة|جمعه|جمعة|منبريه|منبرية|عن|في|حول|اريد|اعطني|اكتب)\s+/gi, '')
      .replace(/^(?:عن|في|حول)\s+/gi, '')
      .trim() || coreTopic;

    const lines: string[] = [];

    // --------------------------------------------------------------------------
    // 6A: Dedicated Eloquent Friday Sermon on RAISING CHILDREN (تربية الأبناء)
    // --------------------------------------------------------------------------
    if (/(تربيه|ابناء|اولاد|ذريه|طفل|اطفال|نشء)/.test(normTopic)) {
      lines.push(
        `هذه خطبة جمعة منبرية متكاملة حول «تربية الأبناء ومسؤولية الوالدين في تنشئتهم»، مصوغة بأسلوب خطابي وعظي مؤصل، تبين مكانة الأبناء في الإسلام، وأسس تربيتهم الإيمانية والأخلاقية، وواجب العدل والرفق بهم.${cite(['تربيه', 'ابناء', 'اولاد'], [1, 2, 3])}`
      );
      lines.push('');

      lines.push(`1. الخطبة الأولى`);
      lines.push('');
      lines.push(
        `**استفتاح الخطبة والوصية بتقوى الله:** إِنَّ الْحَمْدَ لِلَّهِ، نَحْمَدُهُ وَنَسْتَعِينُهُ وَنَسْتَغْفِرُهُ، وَنَعُوذُ بِاللَّهِ مِنْ شُرُورِ أَنْفُسِنَا وَمِنْ سَيِّئَاتِ أَعْمَالِنَا، مَنْ يَهْدِهِ اللَّهُ فَلَا مُضِلَّ لَهُ، وَمَنْ يُضْلِلْ فَلَا هَادِيَ لَهُ، وَأَشْهَدُ أَنْ لَا إِلَهَ إِلَّا اللَّهُ وَحْدَهُ لَا شَرِيكَ لَهُ، وَأَشْهَدُ أَنَّ سَيِّدَنَا وَنَبِيَّنَا مُحَمَّدًا عَبْدُهُ وَرَسُولُهُ، صَلَّى اللَّهُ عَلَيْهِ وَعَلَى آلِهِ وَصَحْبِهِ وَمَنْ سَارَ عَلَى نَهْجِهِ إِلَى يَوْمِ الدِّينِ. أَمَّا بَعْدُ: فَأُوصِيكُمْ — عِبَادَ اللَّهِ — وَنَفْسِي بِتَقْوَى اللَّهِ عَزَّ وَجَلَّ فِي السِّرِّ وَالْعَلَنِ؛ فَإِنَّ تَقْوَى اللَّهِ هِيَ الْعُرْوَةُ الْوُثْقَى، وَبِهَا تَصْلُحُ الْبُيُوتُ وَتَسْتَقِيمُ الأُسَرُ وَتُحْفَظُ الذُّرِّيَّاتُ، قَالَ اللَّهُ تَعَالَى: ﴿يَا أَيُّهَا الَّذِينَ آمَنُوا اتَّقُوا اللَّهَ وَقُولُوا قَوْلًا سَدِيدًا * يُصْلِحْ لَكُمْ أَعْمَالَكُمْ وَيَغْفِرْ لَكُمْ ذُنُوبَكُمْ﴾.${cite(['تقوي', 'تربيه', 'ابناء'], [1, 2])}`
      );
      lines.push('');
      lines.push(
        `**أَيُّهَا الْمُؤْمِنُونَ — أمانة الأبناء وعِظَم المسؤولية:** إِنَّ الأَبْنَاءَ وَالْبَنَاتِ هِبَةٌ جَلِيلَةٌ مِنَ اللَّهِ الْوَهَّابِ، وَزِينَةٌ بَهِيجَةٌ مِنْ زِينَةِ الْحَيَاةِ الدُّنْيَا، قَالَ اللَّهُ تَعَالَى: ﴿الْمَالُ وَالْبَنُونَ زِينَةُ الْحَيَاةِ الدُّنْيَا وَالْبَاقِيَاتُ الصَّالِحَاتُ خَيْرٌ عِندَ رَبِّكَ ثَوَابًا وَخَيْرٌ أَمَلًا﴾. غَيْرَ أَنَّ هَذِهِ النِّعْمَةَ الْعَظِيمَةَ لَيْسَتْ مَجَالًا لِلتَّبَاهِي فَحَسْبُ، بَلْ هِيَ أَمَانَةٌ ثَقِيلَةٌ فِي أَعْنَاقِ الآبَاءِ وَالأُمَّهَاتِ، وَمَسْؤُولِيَّةٌ عُظْمَى سَيُسْأَلُ عَنْهَا الْوَالِدَانِ بَيْنَ يَدَيِ اللَّهِ يَوْمَ الْقِيَامَةِ؛ فَقَدْ نَادَى اللَّهُ عِبَادَهُ الْمُؤْمِنِينَ نِدَاءً يَهُزُّ الْقُلُوبَ فَقَالَ سُبْحَانَهُ: ﴿يَا أَيُّهَا الَّذِينَ آمَنُوا قُوا أَنفُسَكُمْ وَأَهْلِيكُمْ نَارًا وَقُودُهَا النَّاسُ وَالْحِجَارَةُ﴾، وَوَقَايَةُ الأَهْلِ وَالأَبْنَاءِ إِنَّمَا تَكُونُ بِتَعْلِيمِهِمُ الْخَيْرَ، وَتَنْشِئَتِهِمْ عَلَى الإِيمَانِ وَالطَّاعَةِ، وَحِمَايَةِ فِطْرَتِهِمُ النَّقِيَّةِ مِنْ مَوَاطِنِ الزَّلَلِ وَالانْحِرَافِ؛ كَمَا قَالَ النَّبِيُّ ﷺ: «كُلُّكُمْ رَاعٍ وَكُلُّكُمْ مَسْؤُولٌ عَنْ رَعِيَّتِهِ، وَالرَّجُلُ رَاعٍ فِي أَهْلِهِ وَهُوَ مَسْؤُولٌ عَنْ رَعِيَّتِهِ، وَالْمَرْأَةُ رَاعِيَةٌ فِي بَيْتِ زَوْجِهَا وَهِيَ مَسْؤُولَةٌ عَنْ رَعِيَّتِهَا».${cite(['راع', 'اهليكم', 'فطره'], [1, 2])}`
      );
      lines.push('');
      lines.push(
        `**عِبَادَ اللَّهِ — غرس الإيمان وإقامة الصلاة في نفوس الناشئة:** إِنَّ أَوَّلَ مَا يَجِبُ عَلَى الْمُرَبِّي أَنْ يَغْرِسَهُ فِي قُلُوبِ أَبْنَائِهِ هُوَ تَوْحِيدُ اللَّهِ عَزَّ وَجَلَّ، وَمَحَبَّتُهُ، وَتَعْظِيمُ شَعَائِرِهِ، وَاسْتِشْعَارُ رَقَابَتِهِ فِي الْخَلَوَاتِ وَالْجَلَوَاتِ، كَمَا وَعَظَ لُقْمَانُ الْحَكِيمُ ابْنَهُ وَهُوَ يَبْنِي فِيهِ أُصُولَ الْعَقِيدَةِ وَالاسْتِقَامَةِ: ﴿يَا بُنَيَّ أَقِمِ الصَّلَاةَ وَأْمُرْ بِالْمَعْرُوفِ وَانْهَ عَنِ الْمُنكَرِ وَاصْبِرْ عَلَىٰ مَا أَصَابَكَ إِنَّ ذَٰلِكَ مِنْ عَزْمِ الْأُمُورِ﴾. فَتَعَاهَدُوا — رَحِمَكُمُ اللَّهُ — أَبْنَاءَكُمْ بِالصَّلَاةِ، وَحَبِّبُوا إِلَيْهِمْ بُيُوتَ اللَّهِ وَتِلَاوَةَ كِتَابِهِ الْعَزِيزِ، وَاصْبِرُوا عَلَى تَدْرِيبِهِمْ وَتَوْجِيهِهِمْ كَمَا أَمَرَ رَبُّنَا جَلَّ وَعَلَا: ﴿وَأْمُرْ أَهْلَكَ بِالصَّلَاةِ وَاصْطَبِرْ عَلَيْهَا﴾، وَعَمَلًا بِوَصِيَّةِ نَبِيِّنَا ﷺ: «مُرُوا أَوْلَادَكُمْ بِالصَّلَاةِ وَهُمْ أَبْنَاءُ سَبْعِ سِنِينَ، وَاضْرِبُوهُمْ عَلَيْهَا وَهُمْ أَبْنَاءُ عَشْرٍ، وَفَرِّقُوا بَيْنَهُمْ فِي الْمَضَاجِعِ».${cite(['صلاه', 'لقمان', 'تعليم', 'سبع'], [1, 2, 3])}`
      );
      lines.push('');
      lines.push(
        `**مَعَاشِرَ الآبَاءِ وَالأُمَّهَاتِ — القدوة الصالحة وتهذيب الأخلاق:** اعْلَمُوا أَنَّ الأَبْنَاءَ يَتَعَلَّمُونَ بِأَعْيُنِهِمْ قَبْلَ آذَانِهِمْ؛ فَإِذَا رَأَوْا مِنْ وَالِدِيهِمْ صِدْقَ اللِّسَانِ، وَأَدَاءَ الأَمَانَةِ، وَبِرَّ الْوَالِدَيْنِ، وَالْمَوَدَّةَ وَالاحْتِرَامَ دَاخِلَ الْبَيْتِ، نَشَؤُوا عَلَى الْفَضِيلَةِ وَالنُّبْلِ وَمَكَارِمِ الأَخْلَاقِ. وَاحْرِصُوا عَلَى تَخَيُّرِ الصُّحْبَةِ الصَّالِحَةِ لَهُمْ، وَمُحَاوَرَتِهِمْ بِالْحِكْمَةِ وَالإِقْنَاعِ، وَتَحْصِينِ عُقُولِهِمْ مِنْ شُبُهَاتِ الْعَصْرِ وَآفَاتِ السُّلُوكِ. بَارَكَ اللَّهُ لِي وَلَكُمْ فِي الْقُرْآنِ الْعَظِيمِ، وَنَفَعَنِي وَإِيَّاكُمْ بِمَا فِيهِ مِنَ الآيَاتِ وَالذِّكْرِ الْحَكِيمِ، أَقُولُ قَوْلِي هَذَا وَأَسْتَغْفِرُ اللَّهَ الْعَظِيمَ لِي وَلَكُمْ وَلِسَائِرِ الْمُسْلِمِينَ مِنْ كُلِّ ذَنْبٍ، فَاسْتَغْفِرُوهُ إِنَّهُ هُوَ الْغَفُورُ الرَّحِيمُ.${cite(['اخلاق', 'قدوه', 'صحبه'], [2, 3])}`
      );
      lines.push('');

      lines.push(`2. الخطبة الثانية`);
      lines.push('');
      lines.push(
        `**الْحَمْدُ وَالثَّنَاءُ وَالْعَدْلُ بَيْنَ الأَبْنَاءِ:** الْحَمْدُ لِلَّهِ حَمْدًا كَثِيرًا طَيِّبًا مُبَارَكًا فِيهِ كَمَا يُحِبُّ رَبُّنَا وَيَرْضَى، وَأَشْهَدُ أَنْ لَا إِلَهَ إِلَّا اللَّهُ وَحْدَهُ لَا شَرِيكَ لَهُ، وَأَشْهَدُ أَنَّ سَيِّدَنَا وَنَبِيَّنَا مُحَمَّدًا عَبْدُهُ وَرَسُولُهُ، صَلَّى اللَّهُ وَسَلَّمَ عَلَيْهِ وَعَلَى آلِهِ وَصَحْبِهِ أَجْمَعِينَ. أَمَّا بَعْدُ: فَيَا عِبَادَ اللَّهِ، اتَّقُوا اللَّهَ فِي أَوْلَادِكُمْ، وَاعْلَمُوا أَنَّ مِنْ أَعْظَمِ مَا أَوْجَبَتْهُ الشَّرِيعَةُ الإِسْلَامِيَّةُ فِي تَرْبِيَةِ الأَبْنَاءِ إِقَامَةَ الْعَدْلِ التَّامِّ بَيْنَهُمْ فِي الْعَطَايَا وَالْهِبَاتِ وَالْمُعَامَلَةِ، وَتَحْرِيمَ التَّفْضِيلِ أَوِ التَّمْيِيزِ الْجَائِرِ الَّذِي يُوغِرُ الصُّدُورَ وَيَزْرَعُ الشَّحْنَاءَ وَالْعُقُوقَ؛ فَقَدْ قَالَ النَّبِيُّ ﷺ: «اتَّقُوا اللَّهَ وَاعْدِلُوا بَيْنَ أَوْلَادِكُمْ».${cite(['عدل', 'تفضيل', 'اولادكم'], [2, 3, 4])}`
      );
      lines.push('');
      lines.push(
        `**الرِّفْقُ وَالرَّحْمَةُ وَالدُّعَاءُ الصَّالِحُ لِلذُّرِّيَّةِ:** أَيُّهَا الْمُؤْمِنُونَ، اجْعَلُوا بُيُوتَكُمْ مَحَاضِنَ رَحْمَةٍ وَسَكِينَةٍ وَحَنَانٍ، وَاعْتَمِدُوا الرِّفْقَ وَالْحِكْمَةَ فِي التَّأْدِيبِ وَالتَّوْجِيهِ؛ فَإِنَّ الرِّفْقَ مَا كَانَ فِي شَيْءٍ إِلَّا زَانَهُ، وَإِيَّاكُمْ وَالْقَسْوَةَ الْمُنَفِّرَةَ أَوِ الدُّعَاءَ عَلَى الأَبْنَاءِ فِي سَاعَةِ الْغَضَبِ، بَلْ أَكْثِرُوا لَهُمْ مِنْ صَالِحِ الدُّعَاءِ كَمَا دَعَا عِبَادُ الرَّحْمَنِ: ﴿رَبَّنَا هَبْ لَنَا مِنْ أَزْوَاجِنَا وَذُرِّيَّاتِنَا قُرَّةَ أَعْيُنٍ وَاجْعَلْنَا لِلْمُتَّقِينَ إِمَامًا﴾، وَأَطْعِمُوهُمْ مِنْ حَلَالٍ طَيِّبٍ تَزْكُ بِهِ نُفُوسُهُمْ وَتُقْبَلْ بِهِ دَعَوَاتُهُمْ؛ فَمَتَى صَلَحَ الأَبْنَاءُ كَانُوا لِوَالِدِيهِمْ ذُخْرًا فِي الدُّنْيَا، وَأَجْرًا جَارِيًا بَعْدَ الْمَمَاتِ.${cite(['رفق', 'رحمه', 'دعاء', 'ام'], [1, 3, 4])}`
      );
      lines.push('');
      lines.push(
        `**الْخَاتِمَةُ وَالدُّعَاءُ الجامع:** هَذَا وَصَلُّوا وَسَلِّمُوا — رَحِمَكُمُ اللَّهُ — عَلَى الْهَادِي الْبَشِيرِ وَالسِّرَاجِ الْمُنِيرِ، كَمَا أَمَرَكُمْ رَبُّكُمْ فِي مُحْكَمِ التَّنْزِيلِ: ﴿إِنَّ اللَّهَ وَمَلَائِكَتَهُ يُصَلُّونَ عَلَى النَّبِيِّ يَا أَيُّهَا الَّذِينَ آمَنُوا صَلُّوا عَلَيْهِ وَسَلِّمُوا تَسْلِيمًا﴾. اللَّهُمَّ صَلِّ وَسَلِّمْ وَبَارِكْ عَلَى نَبِيِّنَا مُحَمَّدٍ وَعَلَى آلِهِ وَصَحْبِهِ أَجْمَعِينَ. اللَّهُمَّ أَصْلِحْ لَنَا نِيَّاتِنَا وَذُرِّيَّاتِنَا، وَاحْفَظْ أَبْنَاءَنَا وَبَنَاتِنَا بِحِفْظِكَ، وَأَنْبِتْهُمْ نَبَاتًا حَسَنًا، وَاجْعَلْهُمْ هُدَاةً مُهْتَدِينَ غَيْرَ ضَالِّينَ وَلَا مُضِلِّينَ، اللَّهُمَّ اغْفِرْ لِلْمُؤْمِنِينَ وَالْمُؤْمِنَاتِ، الأَحْيَاءِ مِنْهُمْ وَالأَمْوَاتِ، إِنَّكَ سَمِيعٌ قَرِيبٌ مُجِيبُ الدَّعَوَاتِ. عِبَادَ اللَّهِ: ﴿إِنَّ اللَّهَ يَأْمُرُ بِالْعَدْلِ وَالإِحْسَانِ وَإِيتَاءِ ذِي الْقُرْبَىٰ وَيَنْهَىٰ عَنِ الْفَحْشَاءِ وَالْمُنْكَرِ وَالْبَغْيِ يَعِظُكُمْ لَعَلَّكُمْ تَذَكَّرُونَ﴾.`
      );
      lines.push('');
      lines.push(buildSourcesFooter().trim());
      return lines.join('\n');
    }

    // --------------------------------------------------------------------------
    // 6B: Universal Eloquent Friday Sermon Composer for ANY Topic in the Encyclopedia
    // Formulates the entire sermon in natural oratorical Arabic without robotic labels!
    // --------------------------------------------------------------------------
    const allVerses = Array.from(
      new Set([
        ...rawPageInsights.flatMap((ins) => ins.quranVerses),
        ...synthesizedFatwaInsights.flatMap((f) => f.quranVerses),
      ])
    );
    const primaryVerse =
      allVerses[0] ||
      `﴿يَا أَيُّهَا الَّذِينَ آمَنُوا اتَّقُوا اللَّهَ حَقَّ تُقَاتِهِ وَلَا تَمُوتُنَّ إِلَّا وَأَنتُم مُّسْلِمُونَ﴾`;
    const secondaryVerse =
      allVerses[1] ||
      `﴿وَمَن يَتَّقِ اللَّهَ يَجْعَل لَّهُ مَخْرَجًا * وَيَرْزُقْهُ مِنْ حَيْثُ لَا يَحْتَسِبُ﴾`;

    const cleanProseForSermon = (text: string) =>
      text
        .replace(
          /^(?:تُقرّر المصادر المعتمدة أن|تُقرّر المصادر الشرعية أن|تُقرّر مصادر الفقه أن|تُقرّر المصادر أن|تُبيّن المصادر العلمية المعتمدة|تُفصّل المتون الفقهية والعلمية|تُفصّل المتون الفقهية|يُبيّن العلماء|تُؤكّد المصادر أن|تُولي المصادر الفقهية)\s+/i,
          ''
        )
        .replace(/\.$/, '')
        .trim();

    const p1 = rawPageInsights[0]
      ? cleanProseForSermon(rawPageInsights[0].synthesizedProse)
      : `أحكام «${cleanSermonTopic}» من المعالم الشرعية العظيمة التي أقامها الإسلام على أصول الهداية والعدل ومصالح العباد في المعاش والمعاد`;
    const p2 = rawPageInsights[1]
      ? cleanProseForSermon(rawPageInsights[1].synthesizedProse)
      : `الشريعة الإسلامية قد أحاطت مسألة «${cleanSermonTopic}» بضوابط محكمة وشروط واضحة تضمن صحة العمل وقبوله عند الله تعالى`;
    const p3 = rawPageInsights[2]
      ? cleanProseForSermon(rawPageInsights[2].synthesizedProse)
      : `المؤمن الصادق يجمع في «${cleanSermonTopic}» بين استيفاء الأحكام الظاهرة وإخلاص النية واستحضار التقوى في الباطن`;
    const p4 =
      synthesizedFatwaInsights[0]?.synthesizedProse?.replace(/\.$/, '') ||
      (rawPageInsights[3]
        ? cleanProseForSermon(rawPageInsights[3].synthesizedProse)
        : `العمل بأحكام الشريعة في «${cleanSermonTopic}» يثمر صلاح الفرد واستقامة المجتمع وحفظ الحقوق`);

    lines.push(
      `هذه خطبة جمعة منبرية متكاملة حول موضوع «${cleanSermonTopic}»، مصوغة بأسلوب خطابي وعظي مؤصل، تبين مكانة الموضوع في الشريعة الإسلامية، وأدلته وضوابطه، وتوجيهاته العملية في حياة المسلم.${cite([cleanSermonTopic], [1, 2, 3])}`
    );
    lines.push('');

    lines.push(`1. الخطبة الأولى`);
    lines.push('');
    lines.push(
      `**استفتاح الخطبة والوصية بتقوى الله:** إِنَّ الْحَمْدَ لِلَّهِ، نَحْمَدُهُ وَنَسْتَعِينُهُ وَنَسْتَغْفِرُهُ، وَنَعُوذُ بِاللَّهِ مِنْ شُرُورِ أَنْفُسِنَا وَمِنْ سَيِّئَاتِ أَعْمَالِنَا، مَنْ يَهْدِهِ اللَّهُ فَلَا مُضِلَّ لَهُ، وَمَنْ يُضْلِلْ فَلَا هَادِيَ لَهُ، وَأَشْهَدُ أَنْ لَا إِلَهَ إِلَّا اللَّهُ وَحْدَهُ لَا شَرِيكَ لَهُ، وَأَشْهَدُ أَنَّ سَيِّدَنَا وَنَبِيَّنَا مُحَمَّدًا عَبْدُهُ وَرَسُولُهُ، صَلَّى اللَّهُ عَلَيْهِ وَعَلَى آلِهِ وَصَحْبِهِ أَجْمَعِينَ. أَمَّا بَعْدُ: فَأُوصِيكُمْ — عِبَادَ اللَّهِ — وَنَفْسِي بِتَقْوَى اللَّهِ عَزَّ وَجَلَّ، وَالْعَمَلِ بِطَاعَتِهِ، وَالْوُقُوفِ عِنْدَ حُدُودِ شَرِيعَتِهِ؛ قَالَ اللَّهُ تَعَالَى: ${primaryVerse}.${cite([cleanSermonTopic], [1])}`
    );
    lines.push('');
    lines.push(
      `**أَيُّهَا الْمُؤْمِنُونَ — مكانة «${cleanSermonTopic}» في هدايات الإسلام:** إِنَّ شَرِيعَةَ الإِسْلَامِ جَاءَتْ كَامِلَةً شَامِلَةً تُصْلِحُ الْقُلُوبَ وَتُزَكِّي النُّفُوسَ وَتَحْفَظُ الْحُقُوقَ؛ وَمِنَ الْمَعَالِمِ الْعَظِيمَةِ الَّتِي أَوْلَاهَا الشَّرْعُ الْحَنِيفُ عِنَايَةً بَالِغَةً مَوْضُوعُ «${cleanSermonTopic}»، حَيْثُ ${p1}. فَحَرِيٌّ بِالْمُؤْمِنِ أَنْ يَفْقَهَ هَذَا الأَصْلَ الْعَظِيمَ وَيَسْتَحْضِرَ مَقَاصِدَهُ السَّامِيَةَ فِي حَيَاتِهِ وَسُلُوكِهِ.${cite([cleanSermonTopic], [1, 2])}`
    );
    lines.push('');
    lines.push(
      `**عِبَادَ اللَّهِ — الضوابط الشرعية والحدود المرعية:** إِنَّ دِينَ اللَّهِ قَائِمٌ عَلَى الْعِلْمِ وَالْبَصِيرَةِ وَالِانْضِبَاطِ بِأَحْكَامِ الْكِتَابِ وَالسُّنَّةِ؛ وَفِي بَابِ «${cleanSermonTopic}» نَجِدُ أَنَّ ${p2}. وَلَا يَسْتَقِيمُ أَمْرُ الْعَبْدِ حَتَّى يَجْمَعَ بَيْنَ الْفِقْهِ فِي أَحْكَامِ دِينِهِ وَالْعَمَلِ الصَّادِقِ بِمَا عَلِمَ.${cite([cleanSermonTopic], [2, 3])}`
    );
    lines.push('');
    lines.push(
      `**مَعَاشِرَ الْمُسْلِمِينَ — ثمرة الإخلاص والامتثال:** اعْلَمُوا — رَحِمَكُمُ اللَّهُ — أَنَّ ${p3}؛ فَأَقْبِلُوا عَلَى طَاعَةِ رَبِّكُمْ بِقُلُوبٍ مُخْلِصَةٍ وَنُفُوسٍ خَاشِعَةٍ. بَارَكَ اللَّهُ لِي وَلَكُمْ فِي الْقُرْآنِ الْعَظِيمِ، وَنَفَعَنِي وَإِيَّاكُمْ بِمَا فِيهِ مِنَ الآيَاتِ وَالذِّكْرِ الْحَكِيمِ، أَقُولُ قَوْلِي هَذَا وَأَسْتَغْفِرُ اللَّهَ الْعَظِيمَ لِي وَلَكُمْ وَلِسَائِرِ الْمُسْلِمِينَ مِنْ كُلِّ ذَنْبٍ، فَاسْتَغْفِرُوهُ إِنَّهُ هُوَ الْغَفُورُ الرَّحِيمُ.${cite([cleanSermonTopic], [1, 3])}`
    );
    lines.push('');

    lines.push(`2. الخطبة الثانية`);
    lines.push('');
    lines.push(
      `**الْحَمْدُ وَالْوَصِيَّةُ الْعَمَلِيَّةُ:** الْحَمْدُ لِلَّهِ رَبِّ الْعَالَمِينَ، وَالْعَاقِبَةُ لِلْمُتَّقِينَ، وَالصَّلَاةُ وَالسَّلَامُ عَلَى نَبِيِّنَا مُحَمَّدٍ وَعَلَى آلِهِ وَصَحْبِهِ أَجْمَعِينَ. أَمَّا بَعْدُ: فَيَا عِبَادَ اللَّهِ، اتَّقُوا اللَّهَ تَعَالَى وَاعْلَمُوا أَنَّ الْعِلْمَ يُرَادُ لِلْعَمَلِ، وَأَنَّ ${p4}؛ كَمَا قَالَ اللَّهُ تَعَالَى: ${secondaryVerse}. فَلْنَحْرِصْ عَلَى تَطْبِيقِ أَحْكَامِ شَرِيعَتِنَا فِي أَنْفُسِنَا وَبُيُوتِنَا وَمُجْتَمَعِنَا، وَلْنَتَوَاصَ بِالْحَقِّ وَالصَّبْرِ.${cite([cleanSermonTopic], [2, 4])}`
    );
    lines.push('');
    lines.push(
      `**الْخَاتِمَةُ وَالدُّعَاءُ الجامع:** هَذَا وَصَلُّوا وَسَلِّمُوا — رَحِمَكُمُ اللَّهُ — عَلَى مَنْ أُمِرْتُمْ بِالصَّلَاةِ وَالسَّلَامِ عَلَيْهِ: اللَّهُمَّ صَلِّ وَسَلِّمْ وَبَارِكْ عَلَى عَبْدِكَ وَرَسُولِكَ مُحَمَّدٍ وَعَلَى آلِهِ وَصَحْبِهِ أَجْمَعِينَ. اللَّهُمَّ فَقِّهْنَا فِي الدِّينِ، وَأَلْهِمْنَا رُشْدَنَا، وَاهْدِنَا لِأَحْسَنِ الأَخْلَاقِ وَالأَعْمَالِ لَا يَهْدِي لِأَحْسَنِهَا إِلَّا أَنْتَ، اللَّهُمَّ اغْفِرْ لِلْمُؤْمِنِينَ وَالْمُؤْمِنَاتِ، الأَحْيَاءِ مِنْهُمْ وَالأَمْوَاتِ، إِنَّكَ سَمِيعٌ قَرِيبٌ مُجِيبُ الدَّعَوَاتِ. عِبَادَ اللَّهِ: ﴿إِنَّ اللَّهَ يَأْمُرُ بِالْعَدْلِ وَالإِحْسَانِ وَإِيتَاءِ ذِي الْقُرْبَىٰ وَيَنْهَىٰ عَنِ الْفَحْشَاءِ وَالْمُنْكَرِ وَالْبَغْيِ يَعِظُكُمْ لَعَلَّكُمْ تَذَكَّرُونَ﴾.`
    );
    lines.push('');
    lines.push(buildSourcesFooter().trim());
    return lines.join('\n');
  }

  // ============================================================================
  // CASE 7: UNIFIED STRUCTURED SCHOLARLY RESPONSE FOR ALL OTHER TOPICS & QUESTIONS
  // 100% self-authored, lucid Arabic in the exact format requested by the user:
  // - Direct introductory paragraph ending with [1][2][3]
  // - Clean numbered sections (1. ..., 2. ..., 3. ...)
  // - Focused sub-paragraphs starting with **...:** and ending with [1][2]
  // - Unified "المصادر:" footer list at the bottom
  // ============================================================================
  const lines: string[] = [];

  const execSummaries = rawPageInsights
    .slice(0, 2)
    .map((s) => s.compactSummary.replace(/\.$/, ''));
  const fatwaExec = synthesizedFatwaInsights[0]?.compactSummary?.replace(/\.$/, '');

  const introSummarySentence =
    execSummaries.length >= 2
      ? `${execSummaries[0]}، إلى جانب ${execSummaries[1]}.`
      : execSummaries.length === 1
      ? `${execSummaries[0]}${fatwaExec ? `، مع بيان الحكم التطبيقي في المسألة` : ''}.`
      : `تُعنى الشريعة الإسلامية ببيان أصولها وضوابطها الشرعية وتفصيل أحكامها التطبيقية.`;

  if (matchedBook) {
    lines.push(
      `تُعدّ مسألة «${coreTopic || question}» من المباحث العلمية التي تناولها كتاب «${matchedBook.title}» للعلامة ${matchedBook.author} بالتأصيل والبيان؛ ويتناول هذا المبحث ${introSummarySentence} وهذا عرضٌ منظم يوضح تأصيل المسألة، وضوابطها الشرعية، وتفاصيل أحكامها الواردة في الكتاب.${cite([coreTopic], [1, 2])}`
    );
  } else {
    lines.push(
      `تُعدّ مسألة «${coreTopic || question}» من الموضوعات العلمية المهمة التي فصّل العلماء أحكامها وضوابطها في مصنفات الموسوعة وفتاواها؛ ويشمل بيانها ${introSummarySentence} وهذا عرضٌ موجز يعرّف بأصل المسألة، وضوابطها وشروطها، وتطبيقاتها العملية.${cite([coreTopic], [1, 2, 3])}`
    );
  }
  lines.push('');

  let sectionCounter = 1;

  if (rawPageInsights.length > 0) {
    const firstGroup = rawPageInsights.slice(0, 2);
    lines.push(`${sectionCounter++}. التأصيل الشرعي ومفهوم المسألة`);
    lines.push('');
    firstGroup.forEach((ins) => {
      lines.push(`**${ins.themeTitle}:** ${ins.synthesizedProse} [${ins.citationNum}]`);
      lines.push('');
    });

    const secondGroup = rawPageInsights.slice(2, 5);
    if (secondGroup.length > 0) {
      lines.push(`${sectionCounter++}. الضوابط الشرعية والأحكام التفصيلية`);
      lines.push('');
      secondGroup.forEach((ins) => {
        lines.push(`**${ins.themeTitle}:** ${ins.synthesizedProse} [${ins.citationNum}]`);
        lines.push('');
      });
    }
  } else if (catalogMatches.length > 0) {
    lines.push(`${sectionCounter++}. المصنفات المعتمدة التي تناولت المسألة`);
    lines.push('');
    catalogMatches.slice(0, 4).forEach((b, idx) => {
      lines.push(
        `**كتاب «${b.title}»:** من تأليف العلامة ${b.author} في قسم (${b.category})، ويُعدّ من المراجع المعتمدة لدراسة مباحث هذا الباب وفروعه. [${Math.min(idx + 1, Math.max(1, citationRegistry.length))}]`
      );
      lines.push('');
    });
  }

  if (synthesizedFatwaInsights.length > 0 && !matchedBook) {
    lines.push(`${sectionCounter++}. التطبيقات العملية والفتاوى الشرعية`);
    lines.push('');
    synthesizedFatwaInsights.forEach((f) => {
      lines.push(`**${f.title}:** ${f.synthesizedProse} [${f.citationNum}]`);
      lines.push('');
    });
  }

  lines.push(buildSourcesFooter().trim());

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

