import {
    afterEach,
    describe,
    expect,
    it,
} from 'vitest';

import { StealthHelper } from '../../../src/lib/common/stealth-helper';

describe('StealthHelper', () => {
    describe('setDomSignal', () => {
        afterEach(() => {
            if ('globalPrivacyControl' in Navigator.prototype) {
                // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
                delete (Navigator.prototype as Record<string, unknown>).globalPrivacyControl;
            }
        });

        it('sets globalPrivacyControl on Navigator.prototype', () => {
            StealthHelper.setDomSignal();

            expect('globalPrivacyControl' in Navigator.prototype).toBe(true);
            expect((navigator as unknown as Record<string, unknown>).globalPrivacyControl).toBe(true);
        });

        it('does not override existing globalPrivacyControl', () => {
            Object.defineProperty(Navigator.prototype, 'globalPrivacyControl', {
                get: () => false,
                configurable: true,
                enumerable: true,
            });

            StealthHelper.setDomSignal();

            // Should not override the existing value
            expect((navigator as unknown as Record<string, unknown>).globalPrivacyControl).toBe(false);
        });
    });

    describe('hideDocumentReferrer', () => {
        let originalDescriptor: PropertyDescriptor | undefined;

        afterEach(() => {
            // Restore the original referrer descriptor
            if (originalDescriptor) {
                Object.defineProperty(Document.prototype, 'referrer', originalDescriptor);
            }
        });

        // Save the original descriptor before any test modifies it
        originalDescriptor = Object.getOwnPropertyDescriptor(Document.prototype, 'referrer');

        it('overrides document.referrer getter', () => {
            StealthHelper.hideDocumentReferrer();

            const descriptor = Object.getOwnPropertyDescriptor(Document.prototype, 'referrer');
            expect(descriptor).toBeDefined();
            expect(descriptor!.get).toBeDefined();
        });

        it('returns origin with trailing slash', () => {
            StealthHelper.hideDocumentReferrer();

            const expected = `${document.location.origin}/`;
            expect(document.referrer).toBe(expected);
        });

        it('does not produce double trailing slash', () => {
            StealthHelper.hideDocumentReferrer();

            expect(document.referrer).not.toMatch(/\/\/$/);
        });

        it('protects getter toString from native code detection', () => {
            const origGetter = Object.getOwnPropertyDescriptor(
                Document.prototype,
                'referrer',
            )!.get!;
            const origToString = origGetter.toString();

            StealthHelper.hideDocumentReferrer();

            const newGetter = Object.getOwnPropertyDescriptor(
                Document.prototype,
                'referrer',
            )!.get!;

            expect(newGetter.toString()).toBe(origToString);
        });

        it('does nothing if referrer descriptor is missing', () => {
            const origGetOwnPropertyDescriptor = Object.getOwnPropertyDescriptor;

            // Simulate missing descriptor by returning undefined for 'referrer'
            Object.getOwnPropertyDescriptor = (obj, prop): PropertyDescriptor | undefined => {
                if (obj === Document.prototype && prop === 'referrer') {
                    return undefined;
                }
                return origGetOwnPropertyDescriptor(obj, prop);
            };

            try {
                const referrerBefore = document.referrer;
                StealthHelper.hideDocumentReferrer();
                // Referrer should remain unchanged
                expect(document.referrer).toBe(referrerBefore);
            } finally {
                Object.getOwnPropertyDescriptor = origGetOwnPropertyDescriptor;
            }
        });
    });
});
