import React, { useState, useEffect } from 'react';
import { Download, Smartphone, Share, PlusSquare, CheckCircle2, X, WifiOff, MoreVertical } from 'lucide-react';
import { AppLogo } from './AppLogo';

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

interface PWAInstallBannerProps {
  variant?: 'header-button' | 'card';
  themeCardClass?: string;
}

export const PWAInstallBanner: React.FC<PWAInstallBannerProps> = ({
  variant = 'header-button',
  themeCardClass = 'bg-[#181b21] border-white/10',
}) => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [showGuideModal, setShowGuideModal] = useState(false);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  useEffect(() => {
    const checkStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true;
    setIsStandalone(checkStandalone);

    const ua = window.navigator.userAgent.toLowerCase();
    const iosDevice = /iphone|ipad|ipod/.test(ua);
    setIsIOS(iosDevice);

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setIsStandalone(true);
      setDeferredPrompt(null);
      setShowGuideModal(false);
    };

    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setDeferredPrompt(null);
      }
    } else {
      setShowGuideModal(true);
    }
  };

  return (
    <>
      {isOffline && variant === 'header-button' && (
        <span className="px-2 py-1 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-300 text-[10px] font-bold flex items-center gap-1">
          <WifiOff className="w-3 h-3" />
          <span>وضع عدم الاتصال</span>
        </span>
      )}

      {variant === 'header-button' ? (
        !isStandalone && (
          <button
            type="button"
            onClick={handleInstallClick}
            className="px-2.5 py-1.5 rounded-xl bg-[#d4af37] text-black text-xs font-bold flex items-center gap-1 shadow-sm hover:brightness-110 active:scale-95 transition shrink-0"
            title="تثبيت التطبيق في شاشة الهاتف الرئيسية"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden xs:inline">تثبيت التطبيق</span>
            <span className="xs:hidden">تثبيت</span>
          </button>
        )
      ) : (
        <section className={`p-4 rounded-2xl border space-y-3 ${themeCardClass}`}>
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <AppLogo size="lg" />
              <div className="space-y-1 min-w-0">
                <h2 className="font-bold text-sm text-[#d4af37] flex items-center gap-1.5">
                  <Smartphone className="w-4 h-4 shrink-0" />
                  <span>تثبيت التطبيق في شاشة الهاتف الرئيسية</span>
                </h2>
                <p className="text-xs opacity-80 leading-relaxed">
                  {isStandalone
                    ? '✓ التطبيق مثبّت ويعمل حالياً بوضع ملء الشاشة المستقل على هاتفك.'
                    : 'ثبّت تطبيق الموسوعة الإباضية على شاشة هاتفك الرئيسية ليظهر بأيقونة رسمية مخصصة ويفتح فوراً بملء الشاشة مع دعم تصفح الفهرس دون إنترنت.'}
                </p>
              </div>
            </div>

            {!isStandalone ? (
              <button
                type="button"
                onClick={handleInstallClick}
                className="px-4 py-2.5 rounded-xl bg-[#d4af37] text-black font-bold text-xs flex items-center gap-1.5 shrink-0 shadow-md hover:brightness-110 active:scale-95 transition"
              >
                <Download className="w-4 h-4" />
                <span>تثبيت الآن</span>
              </button>
            ) : (
              <span className="px-3 py-1.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs font-bold flex items-center gap-1 shrink-0">
                <CheckCircle2 className="w-4 h-4" />
                <span>مثبّت</span>
              </span>
            )}
          </div>
        </section>
      )}

      {/* Interactive Home Screen Installation Guide Modal */}
      {showGuideModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-3xl bg-[#16181e] border border-[#d4af37]/40 text-[#e3ded4] p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2.5">
                <AppLogo size="md" />
                <div>
                  <h3 className="font-bold text-sm text-[#d4af37]">
                    تثبيت تطبيق الموسوعة على شاشة الهاتف
                  </h3>
                  <p className="text-[11px] text-gray-400">
                    أيقونة عالية الدقة (192×192 و512×512) متوافقة مع أندرويد وآيفون
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowGuideModal(false)}
                className="p-1.5 rounded-full hover:bg-white/10"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {deferredPrompt ? (
              <div className="space-y-3">
                <p className="text-xs leading-relaxed text-gray-300">
                  اضغط على الزر بالأسفل لإضافة التطبيق مباشرة إلى الشاشة الرئيسية لهاتفك بأيقونته الكاملة:
                </p>
                <button
                  type="button"
                  onClick={handleInstallClick}
                  className="w-full py-3 rounded-xl bg-[#d4af37] text-black font-bold text-xs flex items-center justify-center gap-2 shadow-lg"
                >
                  <Download className="w-4 h-4" />
                  <span>تثبيت التطبيق على الشاشة الرئيسية</span>
                </button>
              </div>
            ) : (
              <div className="space-y-3 text-xs leading-relaxed">
                {/* Android / Chrome Instructions */}
                <div className="p-3.5 rounded-2xl bg-black/30 border border-white/10 space-y-2">
                  <div className="font-bold text-[#d4af37] flex items-center gap-1.5">
                    <Smartphone className="w-4 h-4" />
                    <span>في هواتف أندرويد (متصفح Chrome):</span>
                  </div>
                  <ol className="list-decimal list-inside space-y-1.5 text-gray-200">
                    <li>
                      اضغط على قائمة المتصفح <MoreVertical className="w-3.5 h-3.5 inline text-[#d4af37]" /> (الثلاث نقاط أعلى يسار الشاشة).
                    </li>
                    <li>
                      اختر <strong>«تثبيت التطبيق» (Install app)</strong> أو <strong>«الإضافة إلى الشاشة الرئيسية»</strong>.
                    </li>
                    <li>
                      أكد التثبيت ليظهر التطبيق بأيقونته الذهبية بحجم مثالي على شاشتك الرئيسية.
                    </li>
                  </ol>
                </div>

                {/* iOS / Safari Instructions */}
                <div className="p-3.5 rounded-2xl bg-black/30 border border-white/10 space-y-2">
                  <div className="font-bold text-[#d4af37] flex items-center gap-1.5">
                    <Share className="w-4 h-4" />
                    <span>في هواتف آيفون وآيباد (متصفح Safari):</span>
                  </div>
                  <ol className="list-decimal list-inside space-y-1.5 text-gray-200">
                    <li>
                      اضغط على زر <strong>المشاركة (Share)</strong> <Share className="w-3.5 h-3.5 inline text-[#d4af37]" /> في الشريط السفلي للمتصفح.
                    </li>
                    <li>
                      مرر القائمة واختر <strong>«إضافة إلى الشاشة الرئيسية» (Add to Home Screen)</strong> <PlusSquare className="w-3.5 h-3.5 inline text-[#d4af37]" />.
                    </li>
                    <li>
                      اضغط <strong>«إضافة» (Add)</strong> ليظهر التطبيق بأيقونة 180×180 مخصصة لنظام iOS.
                    </li>
                  </ol>
                </div>

                {isIOS && (
                  <p className="text-[11px] text-emerald-400 text-center font-medium">
                    تم التعرف على جهازك (iOS) — اتبع خطوات Safari أعلاه لتثبيته فوراً.
                  </p>
                )}
              </div>
            )}

            <button
              type="button"
              onClick={() => setShowGuideModal(false)}
              className="w-full py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-xs font-bold"
            >
              حسناً، فهمت
            </button>
          </div>
        </div>
      )}
    </>
  );
};
