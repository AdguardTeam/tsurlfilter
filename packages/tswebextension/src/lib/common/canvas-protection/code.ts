import engineSource from 'virtual:canvas-engine';

import { type CanvasBootstrapSnapshot } from './contracts';
import { deriveInstallationTokens } from './noise';

/**
 * Serializes trusted state as a script-safe JavaScript literal.
 *
 * @param value Trusted JSON-compatible state.
 *
 * @returns Literal that cannot close a script element or break a line.
 */
const serialize = (value: unknown): string => JSON.stringify(value).replace(/</g, '\\u003c')
    .replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');

/**
 * Generates a private standalone engine with safely serialized trusted state.
 * The installation tokens are derived here, so a document that only reuses
 * existing wrappers never handles the root in the page.
 *
 * @param snapshot Browser-acknowledged seed and prepared policy.
 *
 * @returns Code ready for a synchronous page-world registration.
 */
export function createCanvasProtectionCode(snapshot: CanvasBootstrapSnapshot): string {
    const tokens = deriveInstallationTokens(snapshot.session);
    // Chromium names a user script by its extension URL in stack traces, so the script is renamed.
    // Firefox already reports registered code as anonymous.
    const name = snapshot.policy.browser === 'chromium-mv3' ? '\n//# sourceURL=<anonymous>' : '';
    return `(()=>{
${engineSource}
canvasEngine.bootstrapCanvasProtection(${serialize(snapshot)},${serialize(tokens)});})();${name}`;
}
