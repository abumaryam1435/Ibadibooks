import catalogData from '../data/catalog.json';
import categoriesData from '../data/categories.json';
import { CatalogBook, CategoryInfo } from '../types';

const allBooks: CatalogBook[] = catalogData as CatalogBook[];
const allCategories: CategoryInfo[] = categoriesData as CategoryInfo[];

export function normalizeArabicText(text: string): string {
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

export function getCategoriesSummary() {
  return {
    totalBooks: 2931,
    indexedCatalogCount: allBooks.length,
    totalPages: 790020,
    totalAuthors: 1371,
    totalFatawa: 30173,
    categories: allCategories,
  };
}

export function getLocalBookById(id: number): CatalogBook | undefined {
  return allBooks.find((b) => b.id === id);
}

export function searchLocalCatalog(params: {
  q?: string;
  category?: string;
  era?: 'all' | 'classic' | 'modern';
  format?: 'all' | 'text' | 'pdf';
  page?: number;
  limit?: number;
}) {
  const q = (params.q || '').trim();
  const category = (params.category || 'all').trim();
  const era = params.era || 'all';
  const format = params.format || 'all';
  const page = Math.max(1, params.page || 1);
  const limit = Math.max(1, params.limit || 24);

  let filtered = allBooks;

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
    const normQ = normalizeArabicText(q);
    const terms = normQ.split(/\s+/).filter(Boolean);

    const scoredBooks: { book: CatalogBook; score: number }[] = [];

    for (const b of filtered) {
      const normTitle = normalizeArabicText(b.title);
      const normFull = normalizeArabicText(`${b.title} ${b.author} ${b.category} ${b.era}`);

      let matchedCount = 0;
      let titleMatchedCount = 0;
      const positions: number[] = [];

      for (const term of terms) {
        const posInTitle = normTitle.indexOf(term);
        const posInFull = normFull.indexOf(term);
        if (posInFull !== -1) {
          matchedCount++;
          positions.push(posInFull);
        }
        if (posInTitle !== -1) {
          titleMatchedCount++;
        }
      }

      if (matchedCount === 0) continue;
      // Require all terms unless fewer than 2 terms
      if (terms.length > 1 && matchedCount < terms.length) continue;

      let span = 999;
      if (positions.length >= 2) {
        span = Math.max(...positions) - Math.min(...positions);
      }

      const exactTitlePhrase = normTitle.includes(normQ) ? 5000 : 0;
      const allInTitleBonus = titleMatchedCount === terms.length ? 3000 : titleMatchedCount * 500;
      const proximityBonus = Math.max(0, 1000 - span * 4);

      scoredBooks.push({
        book: b,
        score: exactTitlePhrase + allInTitleBonus + proximityBonus,
      });
    }

    scoredBooks.sort((a, b) => b.score - a.score);
    filtered = scoredBooks.map((item) => item.book);
  }

  const total = filtered.length;
  const startIndex = (page - 1) * limit;
  const results = filtered.slice(startIndex, startIndex + limit);

  return {
    total,
    page,
    limit,
    totalPages: Math.max(1, Math.ceil(total / limit)),
    results,
  };
}
