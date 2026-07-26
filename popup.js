function getActiveTab() {
  return chrome.tabs.query({ active: true, currentWindow: true }).then((tabs) => tabs[0]);
}

const LANGUAGE_OPTIONS = [
  { code: 'zh-TW', label: '中文' },
  { code: 'en', label: '英文' },
  { code: 'ja', label: '日文' },
  { code: 'ko', label: '韓文' },
  { code: 'es', label: '西班牙文' },
  { code: 'it', label: '義大利文' },
  { code: 'ar', label: '阿拉伯文' }
];

const DEFAULT_SOURCE_LANGUAGE = 'en';
const DEFAULT_TARGET_LANGUAGE = 'zh-TW';
const SOURCE_LANGUAGE_KEY = 'aidosSourceLanguage';
const TARGET_LANGUAGE_KEY = 'aidosTargetLanguage';

async function sendToActiveTab(message) {
  const tab = await getActiveTab();
  if (!tab?.id) {
    throw new Error('無法取得目前分頁：請確認分頁已開啟且已載入完成');
  }

  return chrome.tabs.sendMessage(tab.id, message);
}

function setStatus(text) {
  const status = document.getElementById('status');
  status.textContent = text;
}

function populateLanguageSelect(select, selectedLanguage) {
  select.replaceChildren(
    ...LANGUAGE_OPTIONS.map((language) => {
      const option = document.createElement('option');
      option.value = language.code;
      option.textContent = language.label;
      option.selected = language.code === selectedLanguage;
      return option;
    })
  );
}

function getSelectedLanguages() {
  const sourceLanguage = document.getElementById('source-language').value;
  const targetLanguage = document.getElementById('target-language').value;
  return { sourceLanguage, targetLanguage };
}

function saveSelectedLanguages() {
  const { sourceLanguage, targetLanguage } = getSelectedLanguages();
  localStorage.setItem(SOURCE_LANGUAGE_KEY, sourceLanguage);
  localStorage.setItem(TARGET_LANGUAGE_KEY, targetLanguage);
}

function initializeLanguageControls() {
  const savedSourceLanguage = localStorage.getItem(SOURCE_LANGUAGE_KEY) || DEFAULT_SOURCE_LANGUAGE;
  const savedTargetLanguage = localStorage.getItem(TARGET_LANGUAGE_KEY) || DEFAULT_TARGET_LANGUAGE;
  const sourceLanguageSelect = document.getElementById('source-language');
  const targetLanguageSelect = document.getElementById('target-language');

  populateLanguageSelect(sourceLanguageSelect, savedSourceLanguage);
  populateLanguageSelect(targetLanguageSelect, savedTargetLanguage);

  sourceLanguageSelect.addEventListener('change', saveSelectedLanguages);
  targetLanguageSelect.addEventListener('change', saveSelectedLanguages);
}

async function handleTranslate() {
  try {
    const { sourceLanguage, targetLanguage } = getSelectedLanguages();

    if (sourceLanguage === targetLanguage) {
      setStatus('網站語言與目標語言不可相同');
      return;
    }

    saveSelectedLanguages();
    setStatus('翻譯中...');
    const result = await sendToActiveTab({
      type: 'TRANSLATE_PAGE',
      sourceLanguage,
      targetLanguage
    });

    if (!result?.ok) {
      throw new Error(result?.error || '翻譯失敗');
    }

    const failedText = result.failedCount ? `（${result.failedCount} 段翻譯失敗）` : '';
    setStatus(`已翻譯 ${result.translatedNodes} 個文字節點${failedText}`);
  } catch (error) {
    setStatus(error.message);
  }
}

async function handleRestore() {
  try {
    const result = await sendToActiveTab({ type: 'RESTORE_PAGE' });

    if (!result?.ok) {
      throw new Error(result?.error || '還原失敗');
    }

    setStatus(`已還原 ${result.restoredNodes} 個文字節點`);
  } catch (error) {
    setStatus(error.message);
  }
}

initializeLanguageControls();
document.getElementById('translate').addEventListener('click', handleTranslate);
document.getElementById('restore').addEventListener('click', handleRestore);
