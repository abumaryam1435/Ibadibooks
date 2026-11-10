export type ThemeMode = 'night' | 'oled' | 'sepia' | 'day';

export type AIChatMode =
  | 'auto'
  | 'chat'
  | 'book_summary'
  | 'article'
  | 'tafsir_hadith'
  | 'khutbah'
  | 'lesson';

export interface CatalogBook {
  id: number;
  title: string;
  author: string;
  era: string;
  category: string;
  isPdf: boolean;
  cover: string;
  pagesCount?: number;
  volumesCount?: number;
}

export interface CategoryInfo {
  name: string;
  count: number;
  sampleBook: string;
}

export interface PageSearchResult {
  book_id: number;
  book_name: string;
  author_name: string;
  author_death?: string;
  death_year?: number | null;
  category: string;
  page_id: number;
  page_number: number;
  field_matched?: string;
  field_label?: string;
  snippet: string;
  numbering?: string;
  numbering_declared?: string;
  citable?: boolean;
  proximity_label?: string;
  proximity_span?: number | null;
}

export interface BookPageData {
  book_id: number;
  book_name: string;
  author_name: string;
  death_year?: number | null;
  category: string;
  page_id: number;
  page_number: number;
  part?: string;
  prev_page_id: number | null;
  next_page_id: number | null;
  chapter_chain?: { title_id: number; page_id: number; title: string }[];
  body: string;
  foot?: string;
  citable?: boolean;
  citable_as?: string;
  numbering?: string;
  numbering_declared?: string;
  numbering_note?: string;
}

export interface FatwaItem {
  fatwa_id: number;
  title: string;
  content_type?: string;
  content_type_label?: string;
  mufti?: { id: number; name: string };
  aired_at?: string;
  year_h?: number;
  topics?: string[];
  question_excerpt?: string;
  answer_excerpt?: string;
  question?: string;
  answer?: string;
}

export interface AISourcePage {
  book_id: number;
  book_name: string;
  author_name: string;
  author_death?: string;
  category: string;
  page_id: number;
  page_number: number;
  part?: string;
  numbering?: string;
  numbering_declared?: string;
  citable?: boolean;
  snippet: string;
}

export interface AISourceFatwa {
  fatwa_id: number;
  title: string;
  mufti: string;
  question: string;
  answer_excerpt: string;
}

export interface AIResearchResponse {
  question: string;
  modeUsed?: AIChatMode;
  modeLabel?: string;
  coreTopic?: string;
  searchQueryUsed: string;
  matchedBook?: {
    id: number;
    title: string;
    author: string;
    category: string;
    era?: string;
  } | null;
  answer: string;
  followUpSuggestions?: string[];
  sources: AISourcePage[];
  fatawaSources: AISourceFatwa[];
  totalBookHits: number;
  totalFatwaHits: number;
}

export interface AIChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  mode?: AIChatMode;
  modeLabel?: string;
  scopedBookName?: string;
  response?: AIResearchResponse;
  timestamp: number;
}

export interface BookmarkItem {
  id: string;
  type: 'book' | 'page' | 'fatwa' | 'ai';
  title: string;
  subtitle: string;
  bookId?: number;
  pageId?: number;
  pageNumber?: number;
  fatwaId?: number;
  snippet?: string;
  fullText?: string;
  savedAt: number;
}
