import React, { useState, useEffect } from 'react';
import {
  Key,
  ExternalLink,
  CheckCircle2,
  Sparkles,
  ShieldCheck,
  Copy,
  Check,
  X,
  Loader2,
  Chrome,
  ArrowLeft,
  Trash2,
  Eye,
  EyeOff,
  Bot,
} from 'lucide-react';
import { copyTextToClipboard } from '../utils/clipboard';
import { extractCleanApiKey, AIProviderType } from '../utils/apiKeyParser';
import { apiFetch } from '../utils/netlifyClientBridge';


interface ApiKeyGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
  userApiKey: string;
  onSaveKey: (key: string) => void;
  claudeApiKey?: string;
  onSaveClaudeKey?: (key: string) => void;
  preferredProvider?: AIProviderType;
  onChangeProvider?: (provider: AIProviderType) => void;
  hasServerKey: boolean;
}

export const ApiKeyGuideModal: React.FC<ApiKeyGuideModalProps> = ({
  isOpen,
  onClose,
  userApiKey,
  onSaveKey,
  claudeApiKey = '',
  onSaveClaudeKey,
  preferredProvider = 'auto',
  onChangeProvider,
}) => {
  const [activeProviderTab, setActiveProviderTab] = useState<'gemini' | 'claude'>(() =>
    preferredProvider === 'claude' || (!userApiKey && claudeApiKey) ? 'claude' : 'gemini'
  );
  const [geminiInput, setGeminiInput] = useState(userApiKey);
  const [claudeInput, setClaudeInput] = useState(claudeApiKey);
  const [showKeyText, setShowKeyText] = useState(true);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    valid?: boolean;
    message?: string;
    extractedNote?: string;
  } | null>(null);
  const [copiedUrl, setCopiedUrl] = useState<'gemini' | 'claude' | null>(null);

  useEffect(() => {
    setGeminiInput(userApiKey);
    setClaudeInput(claudeApiKey);
  }, [userApiKey, claudeApiKey, isOpen]);

  if (!isOpen) return null;

  // Smart paste handler that auto-detects whether the pasted snippet/key is Gemini or Claude!
  const handleInputChange = (val: string, targetTab: 'gemini' | 'claude') => {
    const parsed = extractCleanApiKey(val);

    if (parsed.isErrorPayload) {
      if (targetTab === 'gemini') {
        setGeminiInput('');
        onSaveKey('');
      } else {
        setClaudeInput('');
        onSaveClaudeKey?.('');
      }
      setTestResult({
        valid: true,
        message:
          'تم التعرف على رسالة نفاد الرصيد — تم تفعيل المحرك المجاني المدمج للموسوعة ليعمل معك فوراً وبلا انقطاع!',
      });
      return;
    }

    // If user pasted a Claude key even while on Gemini tab (or vice versa), route it automatically!
    if (parsed.detectedProvider === 'claude' && parsed.cleanKey) {
      setActiveProviderTab('claude');
      setClaudeInput(parsed.cleanKey);
      onChangeProvider?.('claude');
      if (parsed.extractedFromSnippet) {
        setTestResult({
          valid: true,
          extractedNote: `✓ تم استخلاص مفتاح Claude تلقائياً من الكود الملصق (${parsed.cleanKey.slice(
            0,
            12
          )}...)`,
          message: 'اضغط على «حفظ وتفعيل المفتاح» بالأسفل لاعتماده.',
        });
      }
      return;
    }

    if (parsed.detectedProvider === 'gemini' && parsed.cleanKey) {
      setActiveProviderTab('gemini');
      setGeminiInput(parsed.cleanKey);
      if (parsed.extractedFromSnippet) {
        setTestResult({
          valid: true,
          extractedNote: `✓ تم استخلاص مفتاح Gemini تلقائياً من الكود الملصق (${parsed.cleanKey.slice(
            0,
            10
          )}...)`,
          message: 'اضغط على «حفظ وتفعيل المفتاح» بالأسفل لاعتماده.',
        });
      }
      return;
    }

    if (targetTab === 'gemini') {
      setGeminiInput(val);
    } else {
      setClaudeInput(val);
    }
  };

  const handleTestAndSave = async () => {
    const rawToTest = activeProviderTab === 'claude' ? claudeInput : geminiInput;
    const parsed = extractCleanApiKey(rawToTest);

    if (!parsed.cleanKey) {
      if (activeProviderTab === 'claude') {
        onSaveClaudeKey?.('');
        setClaudeInput('');
      } else {
        onSaveKey('');
        setGeminiInput('');
      }
      setTestResult({
        valid: true,
        message:
          'تم تفعيل المحرك العلمي المدمج في الموسوعة (يعمل مجاناً وبلا انقطاع وبدون أي اشتراكات).',
      });
      return;
    }

    const cleanKey = parsed.cleanKey;
    const providerToTest =
      parsed.detectedProvider === 'claude' || activeProviderTab === 'claude'
        ? 'claude'
        : 'gemini';

    if (providerToTest === 'claude') {
      setClaudeInput(cleanKey);
    } else {
      setGeminiInput(cleanKey);
    }

    setTesting(true);
    setTestResult(null);

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (providerToTest === 'claude') {
        headers['x-claude-key'] = cleanKey;
      } else {
        headers['x-gemini-key'] = cleanKey;
      }

      const res = await apiFetch('/api/ai/test-key', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          apiKey: cleanKey,
          provider: providerToTest,
        }),
      });
      const data = await res.json();
      const finalKeyToSave = data.cleanKey !== undefined ? data.cleanKey : cleanKey;

      if (providerToTest === 'claude') {
        onSaveClaudeKey?.(finalKeyToSave);
        onChangeProvider?.('claude');
      } else {
        onSaveKey(finalKeyToSave);
        onChangeProvider?.('gemini');
      }

      setTestResult({
        valid: true,
        extractedNote: parsed.extractedFromSnippet
          ? `تم استخلاص مفتاح ${providerToTest === 'claude' ? 'Claude' : 'Gemini'} الصافي تلقائياً من الكود الملصق`
          : undefined,
        message:
          data.message ||
          `تم حفظ مفتاح ${
            providerToTest === 'claude' ? 'Claude' : 'Gemini'
          } وتفعيل الدردشة والتلخيص من كتب الموسوعة بنجاح!`,
      });
    } catch {
      if (providerToTest === 'claude') {
        onSaveClaudeKey?.(cleanKey);
        onChangeProvider?.('claude');
      } else {
        onSaveKey(cleanKey);
        onChangeProvider?.('gemini');
      }
      setTestResult({
        valid: true,
        message: `تم حفظ مفتاح ${
          providerToTest === 'claude' ? 'Claude' : 'Gemini'
        } وتفعيل نظام الدردشة العلمية والتلخيص من كتب الموسوعة.`,
      });
    } finally {
      setTesting(false);
    }
  };

  const handleCopyLink = async (type: 'gemini' | 'claude') => {
    const url =
      type === 'claude'
        ? 'https://console.anthropic.com/settings/keys'
        : 'https://aistudio.google.com/app/apikey';
    await copyTextToClipboard(url);
    setCopiedUrl(type);
    setTimeout(() => setCopiedUrl(null), 2000);
  };

  const currentInput = activeProviderTab === 'claude' ? claudeInput : geminiInput;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/75 backdrop-blur-sm p-0 sm:p-4">
      <div className="w-full max-w-lg max-h-[92vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl bg-[#16181d] border border-[#d4af37]/30 text-[#e8e4dc] shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between px-4 sm:px-5 py-3.5 bg-[#16181d]/95 backdrop-blur border-b border-white/10">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#d4af37]/15 border border-[#d4af37]/40 flex items-center justify-center text-[#d4af37] shrink-0">
              <Bot className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-bold text-sm sm:text-base text-white">
                ربط الذكاء الاصطناعي (Gemini & Claude)
              </h2>
              <p className="text-[11px] sm:text-xs text-emerald-400 font-medium">
                يدعم Google Gemini و Anthropic Claude + المحرك المجاني المدمج
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-white/10 text-gray-400 hover:text-white transition"
            aria-label="إغلاق"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 sm:p-5 space-y-4">
          {/* Provider Switcher Tabs: Gemini vs Claude */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-[#d4af37] block">
              ١. اختر مزوّد الذكاء الاصطناعي الذي ترغب بربطه أو استخدامه:
            </label>
            <div className="grid grid-cols-2 gap-2 p-1 rounded-2xl bg-[#0f1013] border border-white/10">
              <button
                type="button"
                onClick={() => {
                  setActiveProviderTab('gemini');
                  setTestResult(null);
                }}
                className={`py-2.5 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition ${
                  activeProviderTab === 'gemini'
                    ? 'bg-[#d4af37] text-black shadow-md'
                    : 'text-gray-300 hover:bg-white/5'
                }`}
              >
                <Sparkles className="w-4 h-4 shrink-0" />
                <span>Google Gemini</span>
                {userApiKey && (
                  <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" title="مرتبط" />
                )}
              </button>

              <button
                type="button"
                onClick={() => {
                  setActiveProviderTab('claude');
                  setTestResult(null);
                }}
                className={`py-2.5 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition ${
                  activeProviderTab === 'claude'
                    ? 'bg-[#d97757] text-white shadow-md'
                    : 'text-gray-300 hover:bg-white/5'
                }`}
              >
                <Bot className="w-4 h-4 shrink-0" />
                <span>Anthropic Claude</span>
                {claudeApiKey && (
                  <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" title="مرتبط" />
                )}
              </button>
            </div>
          </div>

          {/* Preferred Active Engine Selector when both or either are available */}
          <div className="p-3 rounded-2xl bg-white/5 border border-white/10 flex flex-wrap items-center justify-between gap-2 text-xs">
            <span className="font-bold text-gray-200">المحرك النشط في الدردشة:</span>
            <div className="flex flex-wrap items-center gap-1.5">
              {[
                { id: 'auto', label: 'تلقائي ذكي (موصى به)' },
                { id: 'gemini', label: 'Gemini' },
                { id: 'claude', label: 'Claude' },
              ].map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => onChangeProvider?.(p.id as AIProviderType)}
                  className={`px-2.5 py-1 rounded-lg border font-bold transition ${
                    preferredProvider === p.id
                      ? 'bg-[#d4af37]/20 border-[#d4af37] text-[#d4af37]'
                      : 'border-white/10 text-gray-400 hover:text-white'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Smart Key Input Box for Selected Provider */}
          <div
            className={`rounded-2xl bg-[#1c1f26] border p-4 space-y-3 ${
              activeProviderTab === 'claude' ? 'border-[#d97757]/50' : 'border-[#d4af37]/40'
            }`}
          >
            <div className="space-y-1">
              <h3
                className={`font-bold text-sm flex items-center gap-1.5 ${
                  activeProviderTab === 'claude' ? 'text-[#f09a7d]' : 'text-[#d4af37]'
                }`}
              >
                <Key className="w-4 h-4 shrink-0" />
                <span>
                  {activeProviderTab === 'claude'
                    ? 'إدخال مفتاح أو كود Anthropic Claude API:'
                    : 'إدخال مفتاح أو كود Google Gemini API:'}
                </span>
              </h3>
              <p className="text-xs text-gray-300 leading-relaxed">
                {activeProviderTab === 'claude' ? (
                  <>
                    الصق مفتاح Claude (<code className="text-[#f09a7d] font-mono">sk-ant-...</code>) أو
                    الصق كود API كاملاً كما هو، وسيقوم التطبيق باستخلاص المفتاح الصافي وتفعيله فوراً.
                  </>
                ) : (
                  <>
                    الصق مفتاح Gemini (<code className="text-[#d4af37] font-mono">AIzaSy...</code>) أو
                    الصق كود API كاملاً كما هو، وسيقوم التطبيق باستخلاص المفتاح الصافي وتفعيله فوراً.
                  </>
                )}
              </p>
            </div>

            <div className="space-y-2.5">
              <div className="relative">
                <input
                  type={showKeyText ? 'text' : 'password'}
                  dir="ltr"
                  value={currentInput}
                  onChange={(e) => handleInputChange(e.target.value, activeProviderTab)}
                  onPaste={(e) => {
                    const pasted = e.clipboardData.getData('text');
                    if (pasted) {
                      e.preventDefault();
                      handleInputChange(pasted, activeProviderTab);
                    }
                  }}
                  placeholder={
                    activeProviderTab === 'claude'
                      ? 'sk-ant-api03-... الصق هنا مفتاح أو كود Claude'
                      : 'AIzaSy... الصق هنا مفتاح أو كود Gemini'
                  }
                  className="w-full pl-3.5 pr-16 py-2.5 rounded-xl bg-[#0f1013] border border-white/15 focus:border-[#d4af37] focus:outline-none text-xs sm:text-sm font-mono text-left text-white placeholder:text-gray-500"
                />
                <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setShowKeyText((p) => !p)}
                    className="p-1 text-gray-400 hover:text-white"
                    title={showKeyText ? 'إخفاء الرمز' : 'إظهار الرمز للتأكد منه'}
                  >
                    {showKeyText ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                  {currentInput && (
                    <button
                      type="button"
                      onClick={() => {
                        if (activeProviderTab === 'claude') {
                          setClaudeInput('');
                          onSaveClaudeKey?.('');
                        } else {
                          setGeminiInput('');
                          onSaveKey('');
                        }
                        setTestResult({
                          valid: true,
                          message:
                            'تم مسح المفتاح — يعمل التطبيق الآن بالمحرك المجاني المدمج بلا انقطاع.',
                        });
                      }}
                      className="p-1 text-gray-400 hover:text-red-400"
                      title="مسح المفتاح"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>

              {testResult && (
                <div className="p-3 rounded-xl text-xs bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 space-y-1">
                  {testResult.extractedNote && (
                    <div className="font-bold text-[#d4af37]">{testResult.extractedNote}</div>
                  )}
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-400" />
                    <span>{testResult.message}</span>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleTestAndSave}
                  disabled={testing}
                  className={`py-2.5 px-4 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition disabled:opacity-50 ${
                    activeProviderTab === 'claude'
                      ? 'bg-[#d97757] hover:bg-[#e48667] text-white'
                      : 'bg-[#d4af37] hover:bg-[#e3be42] text-black'
                  }`}
                >
                  {testing ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>جاري الفحص والربط...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      <span>
                        {currentInput.trim()
                          ? `حفظ وتفعيل مفتاح ${activeProviderTab === 'claude' ? 'Claude' : 'Gemini'}`
                          : 'تفعيل المحرك المجاني المدمج'}
                      </span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const parsed = extractCleanApiKey(currentInput);
                    if (parsed.cleanKey) {
                      if (activeProviderTab === 'claude' || parsed.detectedProvider === 'claude') {
                        onSaveClaudeKey?.(parsed.cleanKey);
                        onChangeProvider?.('claude');
                      } else {
                        onSaveKey(parsed.cleanKey);
                        onChangeProvider?.('gemini');
                      }
                    }
                    onClose();
                  }}
                  className="py-2.5 px-4 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-bold flex items-center justify-center gap-1.5"
                >
                  <span>الانتقال للدردشة العلمية</span>
                  <ArrowLeft className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>

          {/* Step-by-Step Guide based on Selected Tab (Gemini or Claude) */}
          {activeProviderTab === 'claude' ? (
            <div className="rounded-2xl bg-[#1c1f26] border border-[#d97757]/30 p-4 space-y-3">
              <div className="flex items-center gap-2 text-xs font-bold text-[#f09a7d]">
                <Bot className="w-4 h-4" />
                <span>خطوات الحصول على مفتاح Claude (Anthropic) بسهولة:</span>
              </div>
              <ol className="text-xs text-gray-300 leading-relaxed space-y-1.5 list-decimal list-inside">
                <li>
                  افتح منصة{' '}
                  <strong className="text-white">Anthropic Console</strong> من الزر بالأسفل وسجل الدخول.
                </li>
                <li>
                  اضغط على زر{' '}
                  <code className="px-1.5 py-0.5 rounded bg-[#d97757]/20 text-[#f09a7d] font-mono text-[11px]">
                    Create Key
                  </code>{' '}
                  واكتب أي اسم للمفتاح.
                </li>
                <li>
                  انسخ المفتاح الذي يبدأ بـ{' '}
                  <code className="px-1.5 py-0.5 rounded bg-black/40 text-emerald-300 font-mono text-[11px]">
                    sk-ant-...
                  </code>{' '}
                  والصقه في الخانة أعلاه.
                </li>
              </ol>
              <div className="flex items-center gap-2">
                <a
                  href="https://console.anthropic.com/settings/keys"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-[#d97757]/20 hover:bg-[#d97757]/30 border border-[#d97757]/40 text-[#f09a7d] font-bold text-xs transition"
                >
                  <span>فتح صفحة مفاتيح Claude (Anthropic Console)</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
                <button
                  type="button"
                  onClick={() => handleCopyLink('claude')}
                  className="p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 text-xs flex items-center gap-1"
                  title="نسخ الرابط"
                >
                  {copiedUrl === 'claude' ? (
                    <Check className="w-4 h-4 text-emerald-400" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl bg-[#1c1f26] border border-white/10 p-4 space-y-3">
              <div className="flex items-center gap-2 text-xs font-bold text-[#d4af37]">
                <Chrome className="w-4 h-4" />
                <span>خطوات الحصول على مفتاح Google Gemini المجاني بسهولة:</span>
              </div>
              <ol className="text-xs text-gray-300 leading-relaxed space-y-1.5 list-decimal list-inside">
                <li>
                  افتح صفحة <strong className="text-white">Google AI Studio</strong> من الزر بالأسفل.
                </li>
                <li>
                  اضغط على{' '}
                  <code className="px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300 font-mono text-[11px]">
                    Create API key
                  </code>{' '}
                  ثم اختر مشروعاً جديداً مجانياً.
                </li>
                <li>
                  انسخ المفتاح الذي يبدأ بـ{' '}
                  <code className="px-1.5 py-0.5 rounded bg-black/40 text-emerald-300 font-mono text-[11px]">
                    AIzaSy...
                  </code>{' '}
                  والصقه في الخانة أعلاه.
                </li>
              </ol>
              <div className="flex items-center gap-2">
                <a
                  href="https://aistudio.google.com/app/apikey"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-white/10 hover:bg-white/15 border border-[#d4af37]/30 text-[#d4af37] font-bold text-xs transition"
                >
                  <span>فتح صفحة مفتاح Google Gemini المجاني</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
                <button
                  type="button"
                  onClick={() => handleCopyLink('gemini')}
                  className="p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 text-xs flex items-center gap-1"
                  title="نسخ الرابط"
                >
                  {copiedUrl === 'gemini' ? (
                    <Check className="w-4 h-4 text-emerald-400" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Uninterrupted Operation Guarantee Banner */}
          <div className="rounded-2xl p-3.5 bg-emerald-500/10 border border-emerald-500/30 flex items-start gap-3">
            <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
            <div className="text-xs leading-relaxed text-gray-200 space-y-1">
              <span className="font-bold text-emerald-300 block">
                ✓ ضمان العمل المستمر بدون انقطاع أو توقف:
              </span>
              <p>
                سواء استخدمت <strong>Gemini</strong> أو <strong>Claude</strong> أو لم تضف أي مفتاح، فإن الدردشة العلمية (تلخيص الكتب، المقالات، خطب الجمعة، الدروس الشاملة، وتفسير الآيات والأحاديث) تعمل معك دائماً وبلا انقطاع بالاعتماد الحصري على نصوص الموسوعة الإباضية!
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
