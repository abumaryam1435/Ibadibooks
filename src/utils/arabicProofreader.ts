/**
 * Classical Arabic Proofreader, Confirmed OCR Typo Fixer, Grammatical Vocalizer (Tashkeel),
 * and Strict Quranic Verse Protector (حماية الآيات القرآنية ومطابقتها للمصحف الشريف).
 *
 * CRITICAL RULES:
 * 1. Quranic verses (inside ﴿...﴾ or {...}) are SACROSANCT:
 *    - They are strictly isolated and protected before any general typo or word vocalization runs.
 *    - Partial verses quoted by the author remain partial (exact word boundaries as authored in the book).
 *    - Verified Uthmani Mushaf vocalization is applied ONLY when 100% matched to the exact partial/full span;
 *      otherwise the original Quranic text and tashkeel in the book are preserved untouched.
 * 2. Confirmed Typographical Errors (التصحيفات المطبعية المؤكدة مثل: الحج المبروز -> الحج المبرور):
 *    - Only 100% unambiguous typos outside Quranic verses are corrected.
 *    - Any unknown or ambiguous word is strictly left as-is.
 */

export interface ProofreadResult {
  text: string;
  corrections: { wrong: string; correct: string }[];
  quranCount: number;
}

// Verified Uthmani Mushaf exact segments (partial & full) frequently cited in Fiqh & Aqidah books.
// Each entry maps an unvocalized exact span to its exact Mushaf Uthmani vocalized span of the SAME length/words.
const VERIFIED_MUSHAF_SPANS: Array<[RegExp, string]> = [
  [/^بسم الله الرحمن الرحيم$/, 'بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ'],
  [/^الحمد لله رب العالمين$/, 'الْحَمْدُ لِلَّهِ رَبِّ الْعَالَمِينَ'],
  [/^وأقيموا الصلاة وآتوا الزكاة$/, 'وَأَقِيمُوا الصَّلَاةَ وَآتُوا الزَّكَاةَ'],
  [/^أقيموا الصلاة وآتوا الزكاة$/, 'أَقِيمُوا الصَّلَاةَ وَآتُوا الزَّكَاةَ'],
  [
    /^إن الصلاة كانت على المؤمنين كتابا موقوتا$/,
    'إِنَّ الصَّلَاةَ كَانَتْ عَلَى الْمُؤْمِنِينَ كِتَابًا مَوْقُوتًا',
  ],
  [
    /^ولله على الناس حج البيت من استطاع إليه سبيلا$/,
    'وَلِلَّهِ عَلَى النَّاسِ حِجُّ الْبَيْتِ مَنِ اسْتَطَاعَ إِلَيْهِ سَبِيلًا',
  ],
  [
    /^وأتموا الحج والعمرة لله$/,
    'وَأَتِمُّوا الْحَجَّ وَالْعُمْرَةَ لِلَّهِ',
  ],
  [
    /^فاسألوا أهل الذكر إن كنتم لا تعلمون$/,
    'فَاسْأَلُوا أَهْلَ الذِّكْرِ إِنْ كُنْتُمْ لَا تَعْلَمُونَ',
  ],
  [
    /^وما آتاكم الرسول فخذوه وما نهاكم عنه فانتهوا$/,
    'وَمَا آتَاكُمُ الرَّسُولُ فَخُذُوهُ وَمَا نَهَاكُمْ عَنْهُ فَانْتَهُوا',
  ],
  [
    /^يا أيها الذين آمنوا اتقوا الله وكونوا مع الصادقين$/,
    'يَا أَيُّهَا الَّذِينَ آمَنُوا اتَّقُوا اللَّهَ وَكُونُوا مَعَ الصَّادِقِينَ',
  ],
  [
    /^يا أيها الذين آمنوا اتقوا الله حق تقاته$/,
    'يَا أَيُّهَا الَّذِينَ آمَنُوا اتَّقُوا اللَّهَ حَقَّ تُقَاتِهِ',
  ],
  [
    /^إنما المؤمنون إخوة$/,
    'إِنَّمَا الْمُؤْمِنُونَ إِخْوَةٌ',
  ],
  [
    /^وتعاونوا على البر والتقوى ولا تعاونوا على الإثم والعدوان$/,
    'وَتَعَاوَنُوا عَلَى الْبِرِّ وَالتَّقْوَىٰ ۖ وَلَا تَعَاوَنُوا عَلَى الْإِثْمِ وَالْعُدْوَانِ',
  ],
  [
    /^لا يكلف الله نفسا إلا وسعها$/,
    'لَا يُكَلِّفُ اللَّهُ نَفْسًا إِلَّا وُسْعَهَا',
  ],
  [
    /^يريد الله بكم اليسر ولا يريد بكم العسر$/,
    'يُرِيدُ اللَّهُ بِكُمُ الْيُسْرَ وَلَا يُرِيدُ بِكُمُ الْعُسْرَ',
  ],
  [
    /^وما جعل عليكم في الدين من حرج$/,
    'وَمَا جَعَلَ عَلَيْكُمْ فِي الدِّينِ مِنْ حَرَجٍ',
  ],
  [
    /^خذ من أموالهم صدقة تطهرهم وتزكيهم بها$/,
    'خُذْ مِنْ أَمْوَالِهِمْ صَدَقَةً تُطَهِّرُهُمْ وَتُزَكِّيهِم بِهَا',
  ],
  [
    /^إنما الصدقات للفقراء والمساكين$/,
    'إِنَّمَا الصَّدَقَاتُ لِلْفُقَرَاءِ وَالْمَسَاكِينِ',
  ],
  [
    /^ليس كمثله شيء وهو السميع البصير$/,
    'لَيْسَ كَمِثْلِهِ شَيْءٌ ۖ وَهُوَ السَّمِيعُ الْبَصِيرُ',
  ],
  [
    /^لا تدركه الأبصار وهو يدرك الأبصار وهو اللطيف الخبير$/,
    'لَا تُدْرِكُهُ الْأَبْصَارُ وَهُوَ يُدْرِكُ الْأَبْصَارَ ۖ وَهُوَ اللَّطِيفُ الْخَبِيرُ',
  ],
];

// 1. Curated list of 100% certain typographical / OCR errors in non-Quranic Arabic texts
const CONFIRMED_TYPO_FIXES: Array<{
  pattern: RegExp;
  wrongLabel: string;
  replacement: string;
  replacementVocalized: string;
}> = [
  {
    pattern: /الحج\s+المبروز/g,
    wrongLabel: 'الحج المبروز',
    replacement: 'الحج المبرور',
    replacementVocalized: 'الْحَجُّ الْمَبْرُورُ',
  },
  {
    pattern: /حج\s+مبروز/g,
    wrongLabel: 'حج مبروز',
    replacement: 'حج مبرور',
    replacementVocalized: 'حَجٌّ مَبْرُورٌ',
  },
  {
    pattern: /والحج\s+المبروز/g,
    wrongLabel: 'والحج المبروز',
    replacement: 'والحج المبرور',
    replacementVocalized: 'وَالْحَجُّ الْمَبْرُورُ',
  },
  {
    pattern: /الحج\s+المبررو/g,
    wrongLabel: 'الحج المبررو',
    replacement: 'الحج المبرور',
    replacementVocalized: 'الْحَجُّ الْمَبْرُورُ',
  },
  {
    pattern: /صللى\s+الله/g,
    wrongLabel: 'صللى الله',
    replacement: 'صلى الله',
    replacementVocalized: 'صَلَّى اللَّهُ',
  },
  {
    pattern: /صلي\s+الله\s+عليه\s+وسلم/g,
    wrongLabel: 'صلي الله عليه وسلم',
    replacement: 'صلى الله عليه وسلم',
    replacementVocalized: 'صَلَّى اللَّهُ عَلَيْهِ وَسَلَّمَ',
  },
  {
    pattern: /ان\s+شاء\s+الله/g,
    wrongLabel: 'ان شاء الله',
    replacement: 'إن شاء الله',
    replacementVocalized: 'إِنْ شَاءَ اللَّهُ',
  },
  {
    pattern: /إنشاء\s+الله/g,
    wrongLabel: 'إنشاء الله',
    replacement: 'إن شاء الله',
    replacementVocalized: 'إِنْ شَاءَ اللَّهُ',
  },
  {
    pattern: /لا\s+اله\s+الا\s+الله/g,
    wrongLabel: 'لا اله الا الله',
    replacement: 'لا إله إلا الله',
    replacementVocalized: 'لَا إِلَٰهَ إِلَّا اللَّهُ',
  },
  {
    pattern: /القران\s+الكريم/g,
    wrongLabel: 'القران الكريم',
    replacement: 'القرآن الكريم',
    replacementVocalized: 'الْقُرْآنُ الْكَرِيمُ',
  },
  {
    pattern: /رضى\s+الله\s+عنه/g,
    wrongLabel: 'رضى الله عنه',
    replacement: 'رضي الله عنه',
    replacementVocalized: 'رَضِيَ اللَّهُ عَنْهُ',
  },
  {
    pattern: /رضى\s+الله\s+عنهم/g,
    wrongLabel: 'رضى الله عنهم',
    replacement: 'رضي الله عنهم',
    replacementVocalized: 'رَضِيَ اللَّهُ عَنْهُمْ',
  },
  {
    pattern: /رضى\s+الله\s+عنها/g,
    wrongLabel: 'رضى الله عنها',
    replacement: 'رضي الله عنها',
    replacementVocalized: 'رَضِيَ اللَّهُ عَنْهَا',
  },
  {
    pattern: /علية\s+السلام/g,
    wrongLabel: 'علية السلام',
    replacement: 'عليه السلام',
    replacementVocalized: 'عَلَيْهِ السَّلَامُ',
  },
  {
    pattern: /اللة(\s|$|[.،؛:])/g,
    wrongLabel: 'اللة',
    replacement: 'الله$1',
    replacementVocalized: 'اللَّهِ$1',
  },
];

// 2. Multi-word classical phrases with invariant grammatical vocalization (outside Quranic verses)
const INVARIANT_PHRASES: Array<[RegExp, string]> = [
  [/بسم الله الرحمن الرحيم/g, 'بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ'],
  [/الحمد لله رب العالمين/g, 'الْحَمْدُ لِلَّهِ رَبِّ الْعَالَمِينَ'],
  [/صلى الله عليه وسلم/g, 'صَلَّى اللَّهُ عَلَيْهِ وَسَلَّمَ'],
  [/صلى الله عليه وآله وسلم/g, 'صَلَّى اللَّهُ عَلَيْهِ وَآلِهِ وَسَلَّمَ'],
  [/عليه الصلاة والسلام/g, 'عَلَيْهِ الصَّلَاةُ وَالسَّلَامُ'],
  [/عليه السلام/g, 'عَلَيْهِ السَّلَامُ'],
  [/عليهم السلام/g, 'عَلَيْهِمُ السَّلَامُ'],
  [/رضي الله عنه/g, 'رَضِيَ اللَّهُ عَنْهُ'],
  [/رضي الله عنها/g, 'رَضِيَ اللَّهُ عَنْهَا'],
  [/رضي الله عنهم/g, 'رَضِيَ اللَّهُ عَنْهُمْ'],
  [/رضي الله عنهما/g, 'رَضِيَ اللَّهُ عَنْهُمَا'],
  [/رحمه الله تعالى/g, 'رَحِمَهُ اللَّهُ تَعَالَى'],
  [/رحمه الله/g, 'رَحِمَهُ اللَّهُ'],
  [/رحمهم الله/g, 'رَحِمَهُمُ اللَّهُ'],
  [/سبحانه وتعالى/g, 'سُبْحَانَهُ وَتَعَالَى'],
  [/عز وجل/g, 'عَزَّ وَجَلَّ'],
  [/تبارك وتعالى/g, 'تَبَارَكَ وَتَعَالَى'],
  [/جل جلاله/g, 'جَلَّ جَلَالُهُ'],
  [/والله أعلم/g, 'وَاللَّهُ أَعْلَمُ'],
  [/قال الله تعالى/g, 'قَالَ اللَّهُ تَعَالَى'],
  [/قال تعالى/g, 'قَالَ تَعَالَى'],
  [/قوله تعالى/g, 'قَوْلِهِ تَعَالَى'],
  [/لقوله تعالى/g, 'لِقَوْلِهِ تَعَالَى'],
  [/رسول الله/g, 'رَسُولِ اللَّهِ'],
  [/كتاب الله/g, 'كِتَابِ اللَّهِ'],
  [/سنة رسول الله/g, 'سُنَّةِ رَسُولِ اللَّهِ'],
  [/الحج المبرور/g, 'الْحَجُّ الْمَبْرُورُ'],
  [/القرآن الكريم/g, 'الْقُرْآنِ الْكَرِيمِ'],
  [/يوم القيامة/g, 'يَوْمِ الْقِيَامَةِ'],
  [/أهل العلم/g, 'أَهْلِ الْعِلْمِ'],
  [/أهل الحق والاستقامة/g, 'أَهْلِ الْحَقِّ وَالِاسْتِقَامَةِ'],
];

// 3. Unambiguous standalone functional words, particles, pronouns, and invariable words (المبنيات والحروف)
const INVARIANT_WORD_MAP: Record<string, string> = {
  في: 'فِي',
  من: 'مِنْ',
  عن: 'عَنْ',
  على: 'عَلَى',
  إلى: 'إِلَى',
  حتى: 'حَتَّى',
  منذ: 'مُنْذُ',
  قد: 'قَدْ',
  لقد: 'لَقَدْ',
  سوف: 'سَوْفَ',
  لم: 'لَمْ',
  لما: 'لَمَّا',
  لن: 'لَنْ',
  هل: 'هَلْ',
  بل: 'بَلْ',
  نعم: 'نَعَمْ',
  كلا: 'كَلَّا',
  أجل: 'أَجَلْ',
  ثم: 'ثُمَّ',
  أو: 'أَوْ',
  أم: 'أَمْ',
  لكن: 'لَٰكِنْ',
  ولكن: 'وَلَٰكِنْ',
  لعل: 'لَعَلَّ',
  ليت: 'لَيْتَ',
  كأن: 'كَأَنَّ',
  ربما: 'رُبَّمَا',
  كي: 'كَيْ',
  لكي: 'لِكَيْ',
  إذن: 'إِذَنْ',
  إذا: 'إِذَا',
  فإذا: 'فَإِذَا',
  وإذا: 'وَإِذَا',
  إذ: 'إِذْ',
  حيث: 'حَيْثُ',
  كيف: 'كَيْفَ',
  أين: 'أَيْنَ',
  متى: 'مَتَى',
  مهما: 'مَهْمَا',
  كلما: 'كُلَّمَا',
  لولا: 'لَوْلَا',
  لو: 'لَوْ',
  ولو: 'وَلَوْ',
  إلا: 'إِلَّا',
  وإلا: 'وَإِلَّا',
  فقط: 'فَقَطْ',
  أيضا: 'أَيْضًا',
  أيضاً: 'أَيْضًا',
  معا: 'مَعًا',
  معاً: 'مَعًا',
  جميعا: 'جَمِيعًا',
  جميعاً: 'جَمِيعًا',
  أبدا: 'أَبَدًا',
  أبداً: 'أَبَدًا',
  جدا: 'جِدًّا',
  جداً: 'جِدًّا',
  حقا: 'حَقًّا',
  حقاً: 'حَقًّا',
  مثلا: 'مَثَلًا',
  مثلاً: 'مَثَلًا',
  شرعا: 'شَرْعًا',
  شرعاً: 'شَرْعًا',
  اصطلاحا: 'اصْطِلَاحًا',
  لغة: 'لُغَةً',

  أنا: 'أَنَا',
  نحن: 'نَحْنُ',
  هو: 'هُوَ',
  فهو: 'فَهُوَ',
  وهو: 'وَهُوَ',
  هي: 'هِيَ',
  فهي: 'فَهِيَ',
  وهي: 'وَهِيَ',
  هم: 'هُمْ',
  وهم: 'وَهُمْ',
  فهم: 'فَهُمْ',
  هما: 'هُمَا',
  هن: 'هُنَّ',
  أنت: 'أَنْتَ',
  أنتم: 'أَنْتُمْ',
  أنتن: 'أَنْتُنَّ',
  هذا: 'هَٰذَا',
  وهذا: 'وَهَٰذَا',
  فهذا: 'فَهَٰذَا',
  لهذا: 'لِهَٰذَا',
  بهذا: 'بِهَٰذَا',
  هذه: 'هَٰذِهِ',
  وهذه: 'وَهَٰذِهِ',
  فهذه: 'فَهَٰذِهِ',
  ذلك: 'ذَٰلِكَ',
  وذلك: 'وَذَٰلِكَ',
  فذلك: 'فَذَٰلِكَ',
  كذلك: 'كَذَٰلِكَ',
  وكذلك: 'وَكَذَٰلِكَ',
  لذلك: 'لِذَٰلِكَ',
  ولذلك: 'وَلِذَٰلِكَ',
  تلك: 'تِلْكَ',
  وتلك: 'وَتِلْكَ',
  أولئك: 'أُولَٰئِكَ',
  هؤلاء: 'هَٰؤُلَاءِ',
  هنا: 'هُنَا',
  هناك: 'هُنَاكَ',
  هنالك: 'هُنَالِكَ',
  الذي: 'الَّذِي',
  والذي: 'وَالَّذِي',
  التي: 'الَّتِي',
  والتي: 'وَالَّتِي',
  الذين: 'الَّذِينَ',
  والذين: 'وَالَّذِينَ',

  قال: 'قَالَ',
  وقال: 'وَقَالَ',
  فقال: 'فَقَالَ',
  قالت: 'قَالَتْ',
  قالوا: 'قَالُوا',
  يقول: 'يَقُولُ',
  ويقول: 'وَيَقُولُ',
  قيل: 'قِيلَ',
  وقيل: 'وَقِيلَ',
  سئل: 'سُئِلَ',
  وسئل: 'وَسُئِلَ',
  فأجاب: 'فَأَجَابَ',
  أجاب: 'أَجَابَ',
  روى: 'رَوَى',
  وروى: 'وَرَوَى',
  روي: 'رُوِيَ',
  حدثنا: 'حَدَّثَنَا',
  أخبرنا: 'أَخْبَرَنَا',
  سمعت: 'سَمِعْتُ',
  كان: 'كَانَ',
  وكان: 'وَكَانَ',
  فكان: 'فَكَانَ',
  كانت: 'كَانَتْ',
  وكانت: 'وَكَانَتْ',
  يكون: 'يَكُونُ',
  ويكون: 'وَيَكُونُ',
  تكون: 'تَكُونُ',
  ليس: 'لَيْسَ',
  وليس: 'وَلَيْسَ',
  فليس: 'فَلَيْسَ',
  ليست: 'لَيْسَتْ',
  يجوز: 'يَجُوزُ',
  ويجوز: 'وَيَجُوزُ',
  تصح: 'تَصِحُّ',
  يصح: 'يَصِحُّ',
  يجب: 'يَجِبُ',
  ويجب: 'وَيَجِبُ',
  يلزم: 'يَلْزَمُ',
  ينبغي: 'يَنْبَغِي',
  اعلم: 'اعْلَمْ',
  فاعلم: 'فَاعْلَمْ',
  تعالى: 'تَعَالَى',
  سبحانه: 'سُبْحَانَهُ',

  النبي: 'النَّبِيِّ',
  الرسول: 'الرَّسُولِ',
  الإسلام: 'الْإِسْلَام',
  الإيمان: 'الْإِيمَان',
  الإحسان: 'الْإِحْسَان',
  القرآن: 'الْقُرْآن',
  التوحيد: 'التَّوْحِيد',
  العقيدة: 'الْعَقِيدَة',
  الفقه: 'الْفِقْه',
  الشريعة: 'الشَّرِيعَة',
  الصلاة: 'الصَّلَاة',
  الزكاة: 'الزَّكَاة',
  الصيام: 'الصِّيَام',
  الصوم: 'الصَّوْم',
  الحج: 'الْحَجّ',
  العمرة: 'الْعُمْرَة',
  الطهارة: 'الطَّهَارَة',
  الوضوء: 'الْوُضُوء',
  التيمم: 'التَّيَمُّم',
  النجاسة: 'النَّجَاسَة',
  القبلة: 'الْقِبْلَة',
  الجمعة: 'الْجُمُعَة',
  الجماعة: 'الْجَمَاعَة',
  المسافر: 'الْمُسَافِر',
  السفر: 'السَّفَر',
  المقيم: 'الْمُقِيم',
  الفقير: 'الْفَقِير',
  الفقراء: 'الْفُقَرَاء',
  المساكين: 'الْمَسَاكِين',
  المسكين: 'الْمِسْكِين',
  النكاح: 'النِّكَاح',
  الطلاق: 'الطَّلَاق',
  الميراث: 'الْمِيرَاث',
  الوصية: 'الْوَصِيَّة',
  البيع: 'الْبَيْع',
  الشراء: 'الشِّرَاء',
  الربا: 'الرِّبَا',
  القضاء: 'الْقَضَاء',
  الشهادة: 'الشَّهَادَة',
  الجواب: 'الْجَوَاب',
  السؤال: 'السُّؤَال',
  المسألة: 'الْمَسْأَلَة',
  الكتاب: 'الْكِتَاب',
  الباب: 'الْبَاب',
  الفصل: 'الْفَصْل',
  المتن: 'الْمَتْن',
  الحاشية: 'الْحَاشِيَة',
  المؤلف: 'الْمُؤَلِّف',
  المصنف: 'الْمُصَنِّف',
  العلماء: 'الْعُلَمَاء',
  الفقهاء: 'الْفُقَهَاء',
  الصحابة: 'الصَّحَابَة',
  التابعين: 'التَّابِعِينَ',
  الدليل: 'الدَّلِيل',
  الأدلة: 'الْأَدِلَّة',
  الإجماع: 'الْإِجْمَاع',
  القياس: 'الْقِيَاس',
  الحلال: 'الْحَلَال',
  الحرام: 'الْحَرَام',
  الواجب: 'الْوَاجِب',
  المندوب: 'الْمَنْدُوب',
  المستحب: 'الْمُسْتَحَبّ',
  المكروه: 'الْمَكْرُوه',
  المباح: 'الْمُبَاح',
};

const STRICT_PREPOSITIONS = new Set(['فِي', 'مِنْ', 'عَنْ', 'عَلَى', 'إِلَى', 'في', 'من', 'عن', 'على', 'إلى']);

const SAFE_GENITIVE_NOUNS: Record<string, string> = {
  الله: 'اللَّهِ',
  الكتاب: 'الْكِتَابِ',
  الباب: 'الْبَابِ',
  الفصل: 'الْفَصْلِ',
  المسألة: 'الْمَسْأَلَةِ',
  الصلاة: 'الصَّلَاةِ',
  الزكاة: 'الزَّكَاةِ',
  الصيام: 'الصِّيَامِ',
  الصوم: 'الصَّوْمِ',
  الحج: 'الْحَجِّ',
  العمرة: 'الْعُمْرَةِ',
  الطهارة: 'الطَّهَارَةِ',
  الوضوء: 'الْوُضُوءِ',
  التيمم: 'التَّيَمُّمِ',
  النجاسة: 'النَّجَاسَةِ',
  القبلة: 'الْقِبْلَةِ',
  الجمعة: 'الْجُمُعَةِ',
  الجماعة: 'الْجَمَاعَةِ',
  السفر: 'السَّفَرِ',
  الحضر: 'الْحَضَرِ',
  المسجد: 'الْمَسْجِدِ',
  البيت: 'الْبَيْتِ',
  القرآن: 'الْقُرْآنِ',
  السنة: 'السُّنَّةِ',
  الإسلام: 'الْإِسْلَامِ',
  الإيمان: 'الْإِيمَانِ',
  الشريعة: 'الشَّرِيعَةِ',
  الفقه: 'الْفِقْهِ',
  العلم: 'الْعِلْمِ',
  الحق: 'الْحَقِّ',
  الباطل: 'الْبَاطِلِ',
  الخير: 'الْخَيْرِ',
  الشر: 'الشَّرِّ',
  الدنيا: 'الدُّنْيَا',
  الآخرة: 'الْآخِرَةِ',
  الجنة: 'الْجَنَّةِ',
  النار: 'النَّارِ',
  الليل: 'اللَّيْلِ',
  النهار: 'النَّهَارِ',
  الأرض: 'الْأَرْضِ',
  السماء: 'السَّمَاءِ',
  الماء: 'الْمَاءِ',
  الذهب: 'الذَّهَبِ',
  الفضة: 'الْفِضَّةِ',
  البيع: 'الْبَيْعِ',
  الشراء: 'الشِّرَاءِ',
  النكاح: 'النِّكَاحِ',
  الطلاق: 'الطَّلَاقِ',
  الميراث: 'الْمِيرَاثِ',
  الوصية: 'الْوَصِيَّةِ',
  القضاء: 'الْقَضَاءِ',
};

/**
 * Normalizes broken Unicode diacritic combinations so Arabic fonts render existing tashkeel cleanly.
 */
export function normalizeUnicodeTashkeel(input: string): string {
  if (!input) return '';
  return (
    input
      .replace(/[\u200B-\u200D\uFEFF]/g, '')
      // Normalize Shadda + Haraka order: BaseChar + Shadda (\u0651) + Haraka (\u064B-\u0650)
      .replace(/([\u064B-\u0650\u0670])\u0651/g, '\u0651$1')
      // Remove duplicate identical consecutive harakat
      .replace(/([\u064B-\u0652])\1+/g, '$1')
  );
}

/**
 * Checks if a protected Quranic segment matches a verified Uthmani Mushaf span of the exact same partial/full words.
 * Otherwise keeps the author's exact Quranic text and tashkeel untouched.
 */
function formatProtectedQuranSpan(innerVerse: string): string {
  const trimmed = innerVerse.trim();
  const stripped = trimmed.replace(/[\u064B-\u0652\u0670]/g, '').replace(/\s+/g, ' ');
  // Only apply verified Mushaf vocalization if the verse in the book has no diacritics yet
  // AND matches the exact word boundaries of the verified Mushaf span (preserving partial quotes as-is).
  const existingDiacritics = (trimmed.match(/[\u064B-\u0652\u0670]/g) || []).length;
  if (existingDiacritics < 2) {
    for (const [regex, mushafText] of VERIFIED_MUSHAF_SPANS) {
      if (regex.test(stripped)) {
        return `﴿${mushafText}﴾`;
      }
    }
  }
  return `﴿${trimmed}﴾`;
}

/**
 * Proofreads Arabic text:
 * 1. Isolates and protects all Quranic verses (﴿...﴾ and {...}) so they are NEVER altered by general rules,
 *    preserving partial verse quotes exactly as authored in the book.
 * 2. Fixes 100% confirmed typographical errors (like الحج المبروز -> الحج المبرور) in non-Quranic text.
 * 3. Applies safe Classical Arabic grammatical & morphological vocalization (Tashkeel) to non-Quranic text.
 */
export function proofreadAndVocalizeArabic(
  rawText: string,
  options: { fixTypos?: boolean; applyTashkeel?: boolean } = { fixTypos: true, applyTashkeel: true }
): ProofreadResult {
  if (!rawText) return { text: '', corrections: [], quranCount: 0 };

  let text = normalizeUnicodeTashkeel(rawText);
  const corrections: { wrong: string; correct: string }[] = [];

  // Step 0: Isolate and protect all Quranic verses (in ﴿...﴾ or {...})
  // Shamela and Ibadi Encyclopedia books use {...} or ﴿...﴾ exclusively for Quranic verses/partial verses.
  const protectedVerses: string[] = [];
  text = text.replace(/﴿([^﴾]+)﴾|\{([^}]+)\}/g, (_match, g1, g2) => {
    const inner = g1 !== undefined ? g1 : g2;
    const formatted = formatProtectedQuranSpan(inner);
    const idx = protectedVerses.length;
    protectedVerses.push(formatted);
    return `__QURAN_PROTECTED_${idx}__`;
  });

  // Step 1: Fix 100% confirmed typos (التصحيفات المطبعية المؤكدة خارج الآيات القرآنية)
  if (options.fixTypos !== false) {
    for (const rule of CONFIRMED_TYPO_FIXES) {
      if (rule.pattern.test(text)) {
        if (rule.wrongLabel !== rule.replacement && !rule.replacement.includes('$1')) {
          if (!corrections.some((c) => c.wrong === rule.wrongLabel)) {
            corrections.push({ wrong: rule.wrongLabel, correct: rule.replacement });
          }
        }
        text = text.replace(
          rule.pattern,
          options.applyTashkeel ? rule.replacementVocalized : rule.replacement
        );
      }
    }
  }

  if (options.applyTashkeel) {
    // Step 2: Apply multi-word invariant classical phrases
    for (const [regex, vocalized] of INVARIANT_PHRASES) {
      text = text.replace(regex, vocalized);
    }

    // Step 3: Token-level deterministic vocalization & prepositional genitive (الجار والمجرور)
    const tokens = text.split(/(\s+|[.،؛:؟!«»"()[\]{}-]+)/);
    let lastWordToken = '';

    for (let i = 0; i < tokens.length; i++) {
      const tok = tokens[i];
      if (!tok || /^(\s+|[.،؛:؟!«»"()[\]{}-]+)$/.test(tok)) {
        if (/[.،؛:؟!«»"()[\]{}]/.test(tok)) {
          lastWordToken = '';
        }
        continue;
      }

      // Skip protected Quranic placeholders
      if (tok.startsWith('__QURAN_PROTECTED_')) {
        lastWordToken = '';
        continue;
      }

      const existingDiacritics = (tok.match(/[\u064B-\u0652\u0670]/g) || []).length;
      if (existingDiacritics >= 2) {
        lastWordToken = tok;
        continue;
      }

      const stripped = tok.replace(/[\u064B-\u0652\u0670]/g, '');

      if (STRICT_PREPOSITIONS.has(lastWordToken) && SAFE_GENITIVE_NOUNS[stripped]) {
        tokens[i] = SAFE_GENITIVE_NOUNS[stripped];
        lastWordToken = tokens[i];
        continue;
      }

      if (stripped.startsWith('بال') && stripped.length > 4) {
        const baseDef = stripped.slice(1);
        if (SAFE_GENITIVE_NOUNS[baseDef]) {
          tokens[i] = 'بِ' + SAFE_GENITIVE_NOUNS[baseDef];
          lastWordToken = tokens[i];
          continue;
        }
      }
      if (stripped.startsWith('كال') && stripped.length > 4) {
        const baseDef = stripped.slice(1);
        if (SAFE_GENITIVE_NOUNS[baseDef]) {
          tokens[i] = 'كَ' + SAFE_GENITIVE_NOUNS[baseDef];
          lastWordToken = tokens[i];
          continue;
        }
      }
      if (stripped.startsWith('لل') && stripped.length > 3) {
        const baseDef = 'ال' + stripped.slice(2);
        if (SAFE_GENITIVE_NOUNS[baseDef]) {
          tokens[i] = 'لِلْ' + SAFE_GENITIVE_NOUNS[baseDef].slice(3);
          lastWordToken = tokens[i];
          continue;
        }
      }

      if (INVARIANT_WORD_MAP[stripped]) {
        tokens[i] = INVARIANT_WORD_MAP[stripped];
      }

      lastWordToken = tokens[i];
    }

    text = tokens.join('');
  }

  // Step 4: Restore protected Quranic verses untouched
  text = text.replace(/__QURAN_PROTECTED_(\d+)__/g, (_m, idxStr) => {
    const idx = parseInt(idxStr, 10);
    return protectedVerses[idx] || _m;
  });

  return {
    text,
    corrections,
    quranCount: protectedVerses.length,
  };
}
