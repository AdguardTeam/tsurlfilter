/**
 * @typedef {import('./assistant').Assistant} AssistantRef
 */
/**
 * @file
 * In the content script, we need access to @adguard/assistant only when
 * the user clicks 'block ad manually'.
 * Therefore, we exclude @adguard/assistant from the bundled content-script code
 * and load it on-demand. We also added a required field to the configuration
 * object to ensure the assistant is bundled inside the final extension,
 * allowing tswebextension to load it on-demand.
 *
 * Schema:
 * - Buildtime:
 *  -- [tswebext]  Script to inject assistant from the URL provided by the extension. <--- current file.
 *  -- [tswebext]  Assistant management script for interacting with the assistant.
 *  -- [tswebext]  Assistant messages listener on the content-script side.
 *  -- [extension] Entry point script for injecting the assistant
 * - Runtime:
 *  -- [tswebext] Content script injects into every new tab without the assistant.
 *  -- [tswebext] On-demand content script dynamically injects the assistant.
 *  -- [tswebext] After injection, the content script interacts with the assistant.
 *
 * Reference code: ASSISTANT_INJECT.
 *
 * Injection will be done by {@link AssistantRef.openAssistant}.
 *
 * IMPORTANT: This file should be listed inside 'sideEffects' field
 * in the package.json, because it has side effects: we do not export anything
 * from it, just evaluate the code (via injection).
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
