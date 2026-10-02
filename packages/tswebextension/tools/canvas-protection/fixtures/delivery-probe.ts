import { type CanvasBootstrapSnapshot } from '../../../src/lib/common/canvas-protection/contracts';
import { resolveDocumentProtection } from '../../../src/lib/common/canvas-protection/policy';

/**
 * A delivery-only readout change proves that the first page script sees MAIN.
 *
 * @param snapshot Trusted fixture policy and generation prepared before registration.
 */
export const installDeliveryProbe = (snapshot: CanvasBootstrapSnapshot): void => {
    const context = resolveDocumentProtection(snapshot, {
        url: window.location.href,
        requestType: window === window.top ? 'document' : 'subdocument',
        inheritedTop: { status: 'unavailable', reason: 'captured-top-context-unavailable' },
        sourceUrl: { status: 'unavailable', reason: 'exact-request-source-unavailable' },
    });
    // The owned fixture records delivery separately from native output, without exposing a seed.
    Object.defineProperty(window, 'canvasFixtureDelivery', {
        configurable: true,
        value: {
            outcome: context.outcome,
            mode: context.site.status === 'available' ? context.site.value.mode : null,
            key: context.site.status === 'available' ? context.site.value.key : null,
            requestType: context.provenance.requestType,
            unavailableConditions: context.unavailableConditions,
            policyRevision: snapshot.policy.revision,
            capturedGeneration: snapshot.session.generation,
        },
    });
    if (!context.enabled) {
        return;
    }
    const native = CanvasRenderingContext2D.prototype.getImageData;
    CanvasRenderingContext2D.prototype.getImageData = new Proxy(native, {
        apply: (target, receiver, args): ImageData => {
            const data = Reflect.apply(target, receiver, args) as ImageData;
            if (data.data.length >= 4 && data.data[0] === 16 && data.data[3] === 255) {
                data.data[0] = 17;
            }
            return data;
        },
    });
};
