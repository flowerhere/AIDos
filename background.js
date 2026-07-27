const GOOGLE_TRANSLATE_API = 'https://translate.googleapis.com/translate_a/single';
const SUPPORTED_LANGUAGES = new Set(['zh-TW', 'en', 'ja', 'ko', 'es', 'it', 'ar']);
const DEFAULT_SOURCE_LANGUAGE = 'en';
const TARGET_LANGUAGE = 'zh-TW';
const MAX_CONCURRENT_REQUESTS = 8;
const translationCache = new Map();

function normalizeLanguage(language, fallbackLanguage) {
  return SUPPORTED_LANGUAGES.has(language) ? language : fallbackLanguage;
}

async function translateText(text, sourceLang = DEFAULT_SOURCE_LANGUAGE) {
  if (!text || !text.trim()) {
    return text;
  }

  const params = new URLSearchParams({
    client: 'gtx',
    sl: sourceLang,
    tl: TARGET_LANGUAGE,
    dt: 't',
    q: text
  });

  const response = await fetch(`${GOOGLE_TRANSLATE_API}?${params.toString()}`);
  if (!response.ok) {
    throw new Error(`Translate failed: ${response.status}`);
  }

  const data = await response.json();
  const segments = Array.isArray(data?.[0]) ? data[0] : [];
  return segments.map((segment) => segment?.[0] || '').join('') || text;
}

async function translateTexts(texts, sourceLanguage) {
  const results = new Array(texts.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < texts.length) {
      const index = nextIndex++;
      const text = texts[index];
      const cacheKey = `${sourceLanguage}\u0000${text}`;

      if (translationCache.has(cacheKey)) {
        results[index] = { text, translated: translationCache.get(cacheKey), ok: true };
        continue;
      }

      try {
        const translated = await translateText(text, sourceLanguage);
        translationCache.set(cacheKey, translated);
        results[index] = { text, translated, ok: true };
      } catch (error) {
        console.warn('Translation request failed for one snippet:', error.message);
        results[index] = { text, translated: text, ok: false };
      }
    }
  }

  const workerCount = Math.min(MAX_CONCURRENT_REQUESTS, texts.length);
  await Promise.all(Array.from({ length: workerCount }, worker));
  return results;
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type !== 'TRANSLATE_TEXTS') {
    return;
  }

  const texts = Array.isArray(message.texts) ? message.texts : [];
  const sourceLanguage = normalizeLanguage(message.sourceLanguage, DEFAULT_SOURCE_LANGUAGE);

  if (sourceLanguage === TARGET_LANGUAGE) {
    sendResponse({ ok: false, error: '網站內容已經是中文，無需翻譯' });
    return;
  }

  (async () => {
    const entries = await translateTexts(texts, sourceLanguage);

    sendResponse({
      ok: true,
      translations: Object.fromEntries(entries.map((entry) => [entry.text, entry.translated])),
      failedCount: entries.filter((entry) => !entry.ok).length
    });
  })();

  return true;
});
