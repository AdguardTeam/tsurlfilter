import { type CanvasBootstrapSnapshot } from './contracts';
import { CANVAS_ENGINE_SOURCE } from './generated/engine-source';

/**
 * Generates a private standalone engine with safely serialized trusted state.
 *
 * @param snapshot Browser-acknowledged seed and prepared policy.
 *
 * @returns Code ready for a synchronous page-world registration.
 */
export function createCanvasProtectionCode(snapshot: CanvasBootstrapSnapshot): string {
    const serialized = JSON.stringify(snapshot).replace(/</g, '\\u003c')
        .replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
    return `(()=>{if(this.__adguardCanvasInstallation)return;
${CANVAS_ENGINE_SOURCE}
canvasEngine.bootstrapCanvasProtection(${serialized});})();`;
}
