/**
 * @file
 * In this file we doing only lazy-load assistant and save it to the global
 * scope of the current content-script.
 */
import { adguardAssistant, Assistant } from '@adguard/assistant';

declare global {
    interface Window {
        adguardAssistant: Assistant | undefined;
    }
}

if (!window.adguardAssistant) {
    window.adguardAssistant = adguardAssistant();
}
