import React, { useState } from 'react';
import { BookOpen } from 'lucide-react';

interface BookCoverProps {
  title: string;
  author?: string | null;
  coverUrl?: string | null;
  bookId?: number;
  category?: string | null;
  size?: 'sm' | 'md' | 'lg' | 'responsive';
  className?: string;
  onClick?: () => void;
  showHoverIcon?: boolean;
}

// 4 Regal heritage Islamic leather palettes with authentic gold filigree tooling
const LEATHER_THEMES = [
  {
    id: 'emerald',
    name: 'أخضر إسلامي مذهب',
    gradient: 'from-[#0e3b26] via-[#09281a] to-[#04130c]',
    border: '#d4af37',
    spine: 'from-[#144d32] to-[#071d13]',
    accent: '#e7c86a',
    medallion: '#d4af37',
  },
  {
    id: 'burgundy',
    name: 'عنابي سلطاني مذهب',
    gradient: 'from-[#4a121c] via-[#310b13] to-[#1a0509]',
    border: '#d4af37',
    spine: 'from-[#611925] to-[#24060c]',
    accent: '#f0d278',
    medallion: '#d4af37',
  },
  {
    id: 'moroccan-leather',
    name: 'جلد مغربي عتيق',
    gradient: 'from-[#3d2411] via-[#29170a] to-[#170c04]',
    border: '#d4af37',
    spine: 'from-[#523017] to-[#1f1006]',
    accent: '#e5be62',
    medallion: '#d4af37',
  },
  {
    id: 'lapislazuli',
    name: 'كحلي أندلسي مذهب',
    gradient: 'from-[#102742] via-[#0a1829] to-[#040c14]',
    border: '#d4af37',
    spine: 'from-[#17375d] to-[#06111f]',
    accent: '#d8b656',
    medallion: '#d4af37',
  },
];

export const BookCover: React.FC<BookCoverProps> = ({
  title,
  author,
  coverUrl,
  bookId = 1,
  category,
  size = 'responsive',
  className = '',
  onClick,
  showHoverIcon = true,
}) => {
  const [imageError, setImageError] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);

  // Pick deterministic regal leather theme based on bookId
  const themeIndex = Math.abs(bookId) % LEATHER_THEMES.length;
  const theme = LEATHER_THEMES[themeIndex];

  const hasValidCover = Boolean(coverUrl) && !imageError;

  return (
    <div
      onClick={onClick}
      className={`relative select-none overflow-hidden rounded-xl border border-[#d4af37]/30 shadow-md group ${
        onClick ? 'cursor-pointer' : ''
      } ${className}`}
      title={`${title}${author ? ` — ${author}` : ''}`}
    >
      {/* 1. If valid cover URL exists, try rendering image */}
      {hasValidCover && (
        <img
          src={coverUrl!}
          alt={title}
          loading="lazy"
          onLoad={() => setImageLoaded(true)}
          onError={() => setImageError(true)}
          className={`w-full h-full object-cover transition duration-300 group-hover:scale-105 ${
            imageLoaded ? 'opacity-100' : 'opacity-0'
          }`}
        />
      )}

      {/* 2. Fallback: Luxury Antique Islamic Leather Bound Cover (بديل الصورة السوداء) */}
      {(!hasValidCover || !imageLoaded) && (
        <div
          className={`w-full h-full absolute inset-0 bg-gradient-to-br ${theme.gradient} flex flex-col justify-between p-1.5 sm:p-2 text-center text-[#d4af37] font-amiri overflow-hidden shadow-inner`}
        >
          {/* Leather Embossed Spine on Right (for RTL Arabic Books) */}
          <div
            className={`absolute top-0 bottom-0 right-0 w-2.5 sm:w-3.5 bg-gradient-to-l ${theme.spine} border-l border-[#d4af37]/40 flex flex-col justify-around items-center py-2 shadow-md`}
          >
            {/* Gilded Book Spine Tooling Ribs (عوارض كعب التجليد المذهبة) */}
            <div className="w-full h-0.5 bg-[#d4af37]/70 shadow-xs" />
            <div className="w-full h-0.5 bg-[#d4af37]/70 shadow-xs" />
            <div className="w-1.5 h-1.5 rounded-full bg-[#d4af37]/60" />
            <div className="w-full h-0.5 bg-[#d4af37]/70 shadow-xs" />
            <div className="w-full h-0.5 bg-[#d4af37]/70 shadow-xs" />
          </div>

          {/* Book Content Container with Margins for Spine & Gilded Outer Double Frame */}
          <div className="w-full h-full mr-2 sm:mr-3 border border-[#d4af37]/50 rounded-lg p-1 sm:p-1.5 flex flex-col justify-between relative bg-black/20 backdrop-blur-2xs">
            {/* Gilded Corner Arabesque Ornaments */}
            <span className="absolute top-0.5 left-0.5 text-[8px] sm:text-[10px] text-[#d4af37]/80 leading-none">
              ✤
            </span>
            <span className="absolute top-0.5 right-0.5 text-[8px] sm:text-[10px] text-[#d4af37]/80 leading-none">
              ✤
            </span>
            <span className="absolute bottom-0.5 left-0.5 text-[8px] sm:text-[10px] text-[#d4af37]/80 leading-none">
              ✤
            </span>
            <span className="absolute bottom-0.5 right-0.5 text-[8px] sm:text-[10px] text-[#d4af37]/80 leading-none">
              ✤
            </span>

            {/* Inner Thin Border */}
            <div className="w-full h-full border border-[#d4af37]/25 rounded-md p-1 flex flex-col justify-between items-center relative overflow-hidden">
              {/* Top Islamic Arch / Medallion Header */}
              <div className="pt-0.5 flex flex-col items-center">
                <div className="w-4 h-1 border-t border-b border-[#d4af37]/60" />
                <span className="text-[7px] sm:text-[9px] font-sans font-bold tracking-wider text-[#d4af37]/80 uppercase mt-0.5">
                  {category ? category.split(' ')[0] : 'الموسوعة الإباضية'}
                </span>
              </div>

              {/* Center Medallion (شمسة إسلامية مذهبة مع عنوان الكتاب) */}
              <div className="my-auto px-0.5 py-1 w-full flex flex-col items-center justify-center">
                {/* Islamic Eight-Pointed Star / Medallion Icon */}
                <div className="relative mb-0.5 flex items-center justify-center opacity-85">
                  <svg
                    viewBox="0 0 24 24"
                    className="w-5 h-5 sm:w-6 sm:h-6 text-[#d4af37] drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)] fill-[#d4af37]/15 stroke-current stroke-1"
                  >
                    {/* Eight-pointed Star (Rub El Hizb) */}
                    <path d="M12 2l2.4 4.8 5.3-1.8-1.8 5.3L22 12l-4.8 2.4 1.8 5.3-5.3-1.8L12 22l-2.4-4.8-5.3 1.8 1.8-5.3L2 12l4.8-2.4-1.8-5.3 5.3 1.8z" />
                    <circle cx="12" cy="12" r="2.5" fill="#d4af37" />
                  </svg>
                </div>

                {/* Elegant Book Title in Gold Calligraphy Style */}
                <h4
                  className="font-bold text-[9px] sm:text-[11px] leading-tight text-[#fcedc2] line-clamp-3 text-center drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)] px-0.5"
                  dir="rtl"
                >
                  {title}
                </h4>
              </div>

              {/* Bottom Gilded Footer with Author Name */}
              <div className="w-full pb-0.5 flex flex-col items-center">
                {author && (
                  <p
                    className="text-[7px] sm:text-[8px] text-[#e7c86a]/90 truncate max-w-full font-medium drop-shadow-[0_1px_1px_rgba(0,0,0,0.8)] px-0.5"
                    dir="rtl"
                  >
                    {author}
                  </p>
                )}
                <div className="w-3 h-0.5 bg-[#d4af37]/50 mt-0.5 rounded-full" />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Hover Quick Open Overlay */}
      {showHoverIcon && onClick && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition duration-200">
          <div className="w-7 h-7 rounded-full bg-[#d4af37] text-black flex items-center justify-center shadow-lg transform group-hover:scale-110 transition">
            <BookOpen className="w-4 h-4" />
          </div>
        </div>
      )}
    </div>
  );
};
