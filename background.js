const GOOGLE_TRANSLATE_API = 'https://translate.googleapis.com/translate_a/single';
const SUPPORTED_LANGUAGES = new Set(['zh-TW', 'en', 'ja', 'ko', 'es', 'it', 'ar']);
const DEFAULT_SOURCE_LANGUAGE = 'en';
const DEFAULT_TARGET_LANGUAGE = 'zh-TW';

function normalizeLanguage(language, fallbackLanguage) {
  return SUPPORTED_LANGUAGES.has(language) ? language : fallbackLanguage;
}

async function translateText(text, sourceLang = DEFAULT_SOURCE_LANGUAGE, targetLang = DEFAULT_TARGET_LANGUAGE) {
  if (!text || !text.trim()) {
    return text;
  }

  const params = new URLSearchParams({
    client: 'gtx',
    sl: sourceLang,
    tl: targetLang,
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

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type !== 'TRANSLATE_TEXTS') {
    return;
  }

  const texts = Array.isArray(message.texts) ? message.texts : [];
  const sourceLanguage = normalizeLanguage(message.sourceLanguage, DEFAULT_SOURCE_LANGUAGE);
  const targetLanguage = normalizeLanguage(message.targetLanguage, DEFAULT_TARGET_LANGUAGE);

  if (sourceLanguage === targetLanguage) {
    sendResponse({ ok: false, error: 'Source and target languages must be different' });
    return;
  }

  (async () => {
    const entries = await Promise.all(
      texts.map(async (text) => {
        try {
          const translated = await translateText(text, sourceLanguage, targetLanguage);
          return { text, translated, ok: true };
        } catch (error) {
          console.warn('Translation request failed for one snippet:', error.message);
          return { text, translated: text, ok: false };
        }
      })
    );

    sendResponse({
      ok: true,
      translations: Object.fromEntries(entries.map((entry) => [entry.text, entry.translated])),
      failedCount: entries.filter((entry) => !entry.ok).length
    });
  })();

  return true;
});
