import engineSource from 'virtual:canvas-engine';

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
        return `(()=>{
${engineSource}
canvasEngine.bootstrapCanvasProtection(${CanvasProtectionCode.serialize(snapshot)});})();`;
    }

    /**
     * Generates an expression for a content script world that cannot run code in the page world
     * directly. It decides whether the document is protected and evaluates to the text of a page
     * script carrying only the site key, or to `undefined` for a document that is not protected.
     * The page can read an inserted script, so the session root, which keys every site, stays
     * in the content script world. The engine is passed on as the source text of its own function.
     *
     * @param snapshot Browser-acknowledged seed and prepared policy.
     *
     * @returns JavaScript expression.
     */
    public static createPageScriptExpression(snapshot: CanvasBootstrapSnapshot): string {
        return `(function(){var engine=function(){
${engineSource}
return canvasEngine;};
var seed=engine().resolveCanvasSeed(${CanvasProtectionCode.serialize(snapshot)});
return seed===undefined?undefined:'('+engine+')().bootstrapSeededCanvasProtection("'+seed+'");';})()`;
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
