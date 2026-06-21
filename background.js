const GOOGLE_TRANSLATE_API = 'https://translate.googleapis.com/translate_a/single';

async function translateText(text, sourceLang = 'en', targetLang = 'zh-CN') {
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

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== 'TRANSLATE_TEXTS') {
    return;
  }

  const texts = Array.isArray(message.texts) ? message.texts : [];

  (async () => {
    const entries = await Promise.all(
      texts.map(async (text) => {
        try {
          const translated = await translateText(text);
          return { text, translated, ok: true };
        } catch (error) {
          console.warn('Translation failed for text snippet:', { text, error: error.message });
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
