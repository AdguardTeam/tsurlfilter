import { describe, expect, it } from 'vitest';

import { CanvasDeliveryUrl } from '../../../../src/lib/mv2/common/canvas-delivery';

describe('CanvasDeliveryUrl', () => {
    const EXTENSION_ID = 'abcdefghijklmnopabcdefghijklmnop';

    it('builds a URL on an unsafe port of a host of the extension', () => {
        expect(CanvasDeliveryUrl.getUrl(EXTENSION_ID))
            .toBe(`https://${EXTENSION_ID}.tswebextension.invalid:1/canvas-protection`);
    });

    it('gives every extension its own host', () => {
        const other = 'ponmlkjihgfedcbaponmlkjihgfedcba';
        expect(new URL(CanvasDeliveryUrl.getUrl(EXTENSION_ID)).hostname)
            .not.toBe(new URL(CanvasDeliveryUrl.getUrl(other)).hostname);
    });

    it('builds a pattern that covers the URL of the same extension', () => {
        expect(CanvasDeliveryUrl.getPattern(EXTENSION_ID))
            .toBe(`*://${new URL(CanvasDeliveryUrl.getUrl(EXTENSION_ID)).hostname}/*`);
    });

    it('recognizes reserved hosts of any extension with any web scheme and port', () => {
        expect(CanvasDeliveryUrl.isReserved(CanvasDeliveryUrl.getUrl(EXTENSION_ID))).toBe(true);
        expect(CanvasDeliveryUrl.isReserved('https://tswebextension.invalid/canvas-protection')).toBe(true);
        expect(CanvasDeliveryUrl.isReserved('http://other.tswebextension.invalid/x')).toBe(true);
        expect(CanvasDeliveryUrl.isReserved('wss://tswebextension.invalid:8443/')).toBe(true);
    });

    it('ignores other hosts and lookalikes', () => {
        expect(CanvasDeliveryUrl.isReserved('https://tswebextension.invalid.example.org/')).toBe(false);
        expect(CanvasDeliveryUrl.isReserved('https://a.tswebextension.invalid.example.org/')).toBe(false);
        expect(CanvasDeliveryUrl.isReserved('https://example.org/tswebextension.invalid/')).toBe(false);
        expect(CanvasDeliveryUrl.isReserved('https://example.org/?x=.tswebextension.invalid/')).toBe(false);
        expect(CanvasDeliveryUrl.isReserved('https://tswebextension.invalid@example.org/')).toBe(false);
        expect(CanvasDeliveryUrl.isReserved('data:text/plain,tswebextension.invalid')).toBe(false);
        expect(CanvasDeliveryUrl.isReserved('https://xtswebextension.invalid/')).toBe(false);
    });
});
