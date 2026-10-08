import engineSource from 'virtual:canvas-engine';

import { CanvasPolicyBrowser } from './constants';
import { type CanvasBootstrapSnapshot } from './contracts';

/**
 * Generator of the script delivered to pages.
 */
export class CanvasProtectionCode {
    /**
     * Generates a private standalone engine with safely serialized trusted state.
     *
     * @param snapshot Browser-acknowledged seed and prepared policy.
     *
     * @returns Code ready for a synchronous page-world registration.
     */
    public static create(snapshot: CanvasBootstrapSnapshot): string {
        // Chromium names a user script by its extension URL in stack traces, so the script is renamed.
        // Firefox already reports registered code as anonymous.
        const name = snapshot.policy.browser === CanvasPolicyBrowser.ChromiumMv3 ? '\n//# sourceURL=<anonymous>' : '';
        return `(()=>{
${engineSource}
canvasEngine.bootstrapCanvasProtection(${CanvasProtectionCode.serialize(snapshot)});})();${name}`;
    }

    /**
     * Serializes trusted state as a script-safe JavaScript literal.
     *
     * @param value Trusted JSON-compatible state.
     *
     * @returns Literal that cannot close a script element or break a line.
     */
    private static serialize(value: unknown): string {
        return JSON.stringify(value).replace(/</g, '\\u003c')
            .replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
    }
}
