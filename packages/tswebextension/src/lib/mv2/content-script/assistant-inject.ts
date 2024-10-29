// FIXME assistants for mv2 and mv3 should be the same, and follow the same logic
/**
 * @file
 * In this file we doing only lazy-load assistant and save it to the global
 * scope of the current content-script.
 */
import { adguardAssistant, type Assistant } from '@adguard/assistant';

declare global {
    interface Window {
        adguardAssistant: Assistant | undefined;
    }
}

if (!window.adguardAssistant) {
    window.adguardAssistant = adguardAssistant();
}
