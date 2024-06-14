document.addEventListener('DOMContentLoaded', () => {
    // Init
    const openAssistantButton = document.getElementById('openAssistant');
    openAssistantButton.addEventListener('click', async () => {
        await chrome.runtime.sendMessage({ type: 'OPEN_ASSISTANT' });
    });
});
