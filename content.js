const originalNodeText = new Map();

function isSkippableNode(node) {
  const parent = node.parentElement;
  if (!parent) {
    return true;
  }

  const tag = parent.tagName;
  return ['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEXTAREA', 'INPUT', 'CODE', 'PRE'].includes(tag);
}

function shouldTranslateText(text) {
  if (!text) {
    return false;
  }

  const trimmed = text.trim();
  if (!trimmed || trimmed.length > 500) {
    return false;
  }

  return /[A-Za-z]/.test(trimmed);
}

function collectTranslatableNodes(root) {
  const nodes = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);

  let currentNode = walker.nextNode();
  while (currentNode) {
    if (!isSkippableNode(currentNode) && shouldTranslateText(currentNode.nodeValue)) {
      nodes.push(currentNode);
    }
    currentNode = walker.nextNode();
  }

  return nodes;
}

function requestTranslations(texts) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({ type: 'TRANSLATE_TEXTS', texts }, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }

      if (!response?.ok) {
        reject(new Error('Failed to translate texts'));
        return;
      }

      resolve(response.translations || {});
    });
  });
}

async function translatePage() {
  const candidates = collectTranslatableNodes(document.body).filter((node) => !originalNodeText.has(node));
  const uniqueTexts = [...new Set(candidates.map((node) => node.nodeValue.trim()))];

  if (!uniqueTexts.length) {
    return { translatedNodes: 0 };
  }

  const translations = await requestTranslations(uniqueTexts);

  let translatedNodes = 0;
  for (const node of candidates) {
    const original = node.nodeValue;
    const translated = translations[original.trim()];

    if (!translated || translated === original) {
      continue;
    }

    originalNodeText.set(node, original);
    node.nodeValue = translated;
    translatedNodes += 1;
  }

  return { translatedNodes };
}

function restorePage() {
  let restoredNodes = 0;

  for (const [node, originalText] of originalNodeText.entries()) {
    if (!node.isConnected) {
      originalNodeText.delete(node);
      continue;
    }

    node.nodeValue = originalText;
    originalNodeText.delete(node);
    restoredNodes += 1;
  }

  return { restoredNodes };
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === 'TRANSLATE_PAGE') {
    translatePage()
      .then((result) => sendResponse({ ok: true, ...result }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (message?.type === 'RESTORE_PAGE') {
    const result = restorePage();
    sendResponse({ ok: true, ...result });
    return;
  }
});
