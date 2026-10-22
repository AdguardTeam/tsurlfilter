import { describe, expect, it } from 'vitest';

import { CanvasDeliveryUrl } from '../../../../src/lib/mv2/common/canvas-delivery';

describe('CanvasDeliveryUrl', () => {
    it('recognizes the reserved host with any web scheme and port', () => {
        expect(CanvasDeliveryUrl.isReserved('https://tswebextension.invalid/canvas-protection')).toBe(true);
        expect(CanvasDeliveryUrl.isReserved('http://tswebextension.invalid/x')).toBe(true);
        expect(CanvasDeliveryUrl.isReserved('wss://tswebextension.invalid:8443/')).toBe(true);
    });

    it('ignores other hosts and lookalikes', () => {
        expect(CanvasDeliveryUrl.isReserved('https://tswebextension.invalid.example.org/')).toBe(false);
        expect(CanvasDeliveryUrl.isReserved('https://example.org/tswebextension.invalid/')).toBe(false);
        expect(CanvasDeliveryUrl.isReserved('data:text/plain,tswebextension.invalid')).toBe(false);
        expect(CanvasDeliveryUrl.isReserved('https://xtswebextension.invalid/')).toBe(false);
    });

    it('uses a reserved URL its pattern covers', () => {
        expect(CanvasDeliveryUrl.isReserved(CanvasDeliveryUrl.URL)).toBe(true);
        expect(CanvasDeliveryUrl.PATTERN).toBe(`*://${new URL(CanvasDeliveryUrl.URL).host}/*`);
    });
});
