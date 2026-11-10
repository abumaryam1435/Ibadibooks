/**
 * Smart API Key Extractor & Sanitizer for Gemini & Claude (Anthropic)
 * Handles any raw text or code snippet pasted as-is by the user:
 * - Raw Google Gemini API keys (AIzaSy...)
 * - Raw Anthropic Claude API keys (sk-ant-...)
 * - Full code snippets from Google AI Studio or Anthropic Console (JS, Python, cURL, .env, JSON)
 * - Keys wrapped in quotes, spaces, newlines, or RTL/LTR invisible Unicode markers
 * - Error JSON payloads accidentally copied from the browser
 */

export type AIProviderType = 'gemini' | 'claude' | 'auto';

export interface ExtractedKeyResult {
  cleanKey: string;
  detectedProvider: 'gemini' | 'claude' | 'unknown';
  extractedFromSnippet: boolean;
  isErrorPayload: boolean;
  errorCode?: number;
}

export function extractCleanApiKey(rawInput: string | null | undefined): ExtractedKeyResult {
  if (!rawInput || typeof rawInput !== 'string') {
    return {
      cleanKey: '',
      detectedProvider: 'unknown',
      extractedFromSnippet: false,
      isErrorPayload: false,
    };
  }

  // Strip invisible directional Unicode characters and zero-width spaces
  const normalized = rawInput
    .replace(/[\u200B-\u200F\u202A-\u202E\u2066-\u2069\uFEFF]/g, '')
    .trim();

  if (
    !normalized ||
    normalized === 'MY_GEMINI_API_KEY' ||
    normalized === 'YOUR_API_KEY' ||
    normalized === 'ANTHROPIC_API_KEY'
  ) {
    return {
      cleanKey: '',
      detectedProvider: 'unknown',
      extractedFromSnippet: false,
      isErrorPayload: false,
    };
  }

  // Check if the user pasted a JSON error object (e.g. {"error":{"code":402,...}})
  if (
    normalized.startsWith('{') &&
    (normalized.includes('"error"') ||
      normalized.includes('RESOURCE_EXHAUSTED') ||
      normalized.includes('prepayment credits') ||
      normalized.includes('credit balance is too low'))
  ) {
    const codeMatch = normalized.match(/"code"\s*:\s*(\d+)/);
    return {
      cleanKey: '',
      detectedProvider: 'unknown',
      extractedFromSnippet: false,
      isErrorPayload: true,
      errorCode: codeMatch ? parseInt(codeMatch[1], 10) : 402,
    };
  }

  // 1. Look for a standard Anthropic Claude API key pattern (sk-ant-... followed by valid characters)
  const claudeKeyMatch = normalized.match(/(sk-ant-[0-9A-Za-z_-]{20,140})/);
  if (claudeKeyMatch && claudeKeyMatch[1]) {
    const key = claudeKeyMatch[1].trim();
    const wasSnippet = normalized.length > key.length + 2;
    return {
      cleanKey: key,
      detectedProvider: 'claude',
      extractedFromSnippet: wasSnippet,
      isErrorPayload: false,
    };
  }

  // 2. Look for a standard Google Gemini API key pattern (AIza followed by 30-45 valid characters)
  const googleKeyMatch = normalized.match(/(AIza[0-9A-Za-z_-]{30,45})/);
  if (googleKeyMatch && googleKeyMatch[1]) {
    const key = googleKeyMatch[1].trim();
    const wasSnippet = normalized.length > key.length + 2;
    return {
      cleanKey: key,
      detectedProvider: 'gemini',
      extractedFromSnippet: wasSnippet,
      isErrorPayload: false,
    };
  }

  // 3. Fallback: Strip common assignment prefixes, quotes, Bearer, and whitespace
  const cleaned = normalized
    .replace(
      /^(export\s+)?(VITE_)?(GEMINI_API_KEY|GOOGLE_API_KEY|ANTHROPIC_API_KEY|CLAUDE_API_KEY|API_KEY|x-api-key|apiKey|key)\s*[:=]\s*/i,
      ''
    )
    .replace(/^Bearer\s+/i, '')
    .replace(/^["'`]+|["'`;,]+$/g, '')
    .replace(/\s+/g, '')
    .trim();

  if (cleaned.length >= 20 && !/[{}[\]"'<>]/.test(cleaned)) {
    const detectedProvider = cleaned.startsWith('sk-ant')
      ? 'claude'
      : cleaned.startsWith('AIza')
      ? 'gemini'
      : 'unknown';
    return {
      cleanKey: cleaned,
      detectedProvider,
      extractedFromSnippet: normalized !== cleaned,
      isErrorPayload: false,
    };
  }

  return {
    cleanKey: '',
    detectedProvider: 'unknown',
    extractedFromSnippet: false,
    isErrorPayload: false,
  };
}
