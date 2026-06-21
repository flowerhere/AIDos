function getActiveTab() {
  return chrome.tabs.query({ active: true, currentWindow: true }).then((tabs) => tabs[0]);
}

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

async function handleTranslate() {
  try {
    setStatus('翻譯中...');
    const result = await sendToActiveTab({ type: 'TRANSLATE_PAGE' });

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

document.getElementById('translate').addEventListener('click', handleTranslate);
document.getElementById('restore').addEventListener('click', handleRestore);
