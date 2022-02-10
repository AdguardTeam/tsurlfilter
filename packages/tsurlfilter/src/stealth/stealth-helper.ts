/**
 * This module applies stealth actions in page context
 */
export default class StealthHelper {
    /**
     * Sends a Global Privacy Control DOM signal
     */
    public static setDomSignal(): void {
        try {
            if ('globalPrivacyControl' in Navigator.prototype) {
                return;
            }

            Object.defineProperty(Navigator.prototype, 'globalPrivacyControl', {
                get: () => true,
                configurable: true,
                enumerable: true,
            });
        } catch (ex) {
            // Ignore
        }
    }
}
