// Disable jest coverage for this file, because it will insert
// line comments, and code to count lines covered by tests, for example:
// /* istanbul ignore next */
// cov_uqm40oh03().f[0]++;
// cov_uqm40oh03().s[2]++;
// And we cannot test these strings correctly, because the names of these
// functions with counters are generated at runtime

/* istanbul ignore file */
/**
 * This module applies stealth actions in page context.
 */
export class StealthHelper {
    /**
     * Sends a Global Privacy Control DOM signal.
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

    /**
     * Hides document referrer.
     */
    public static hideDocumentReferrer(): void {
        const origDescriptor = Object.getOwnPropertyDescriptor(Document.prototype, 'referrer');
        if (!origDescriptor || !origDescriptor.get || !origDescriptor.configurable) {
            return;
        }

        const returnEmptyReferrerFunc = (): string => '';
        // Protect getter from native code check
        returnEmptyReferrerFunc.toString = origDescriptor.get.toString.bind(origDescriptor.get);

        Object.defineProperty(Document.prototype, 'referrer', {
            get: returnEmptyReferrerFunc,
        });
    }
}
