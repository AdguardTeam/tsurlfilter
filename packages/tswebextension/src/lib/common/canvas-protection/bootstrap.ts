// Part of the engine injected into pages: plain functions instead of a static class keep it small,
// see engine-entry.ts.
import { CanvasPolicyRequestType } from './constants';
import { type CanvasBootstrapSnapshot, type DocumentPolicyInput } from './contracts';
import { deriveSiteSeed, type InstallationTokens } from './noise';
import { resolveProtectedSite } from './policy';
import { createRealmProtection, sendInstallationToken } from './realm';

/**
 * Reads the URL of an ancestor document from sources page code cannot forge.
 *
 * @param ancestor Ancestor window.
 * @param origin The origin the browser lists for that ancestor, if it lists any.
 *
 * @returns The complete URL of a same-origin ancestor, the origin of a cross-origin one,
 * or `undefined` when the browser reveals neither.
 */
const readAncestorUrl = (ancestor: Window, origin: string | undefined): string | undefined => {
    try {
        return ancestor.location.href;
    } catch {
        // A cross-origin ancestor hides its location.
    }
    // An opaque or hidden origin is listed as "null".
    return origin === undefined || origin === 'null' ? undefined : `${origin}/`;
};

/**
 * Reads the document's own URL and what the browser reveals about its top and
 * parent documents. No page-provided marker is trusted for that context.
 *
 * @param realm Delivered document's global object.
 *
 * @returns Synchronous input of the document's protection decision.
 */
export function readDocumentPolicyInput(realm: Window): DocumentPolicyInput {
    const url = realm.location.href;
    if (realm === realm.top) {
        return {
            url, requestType: CanvasPolicyRequestType.Document, topUrl: url, sourceUrl: url,
        };
    }
    // Firefox lists ancestor origins since version 148.
    const origins = realm.location.ancestorOrigins as DOMStringList | undefined;
    const topUrl = readAncestorUrl(realm.top!, origins?.[origins.length - 1]);
    return {
        url,
        requestType: CanvasPolicyRequestType.Subdocument,
        topUrl,
        sourceUrl: realm.parent === realm.top ? topUrl : readAncestorUrl(realm.parent, origins?.[0]),
    };
}

/**
 * Decides synchronously whether this document is protected and installs the
 * readouts with the draw tracking that selects the canvases they protect.
 * A document that is not protected is left untouched. Nothing is defined on the
 * global object; the seed stays reachable only through private wrapper closures.
 *
 * @param snapshot Trusted browser-acknowledged delivery state.
 * @param tokens Private strings shared by the engine instances of this browser run.
 */
export function bootstrapCanvasProtection(snapshot: CanvasBootstrapSnapshot, tokens: InstallationTokens): void {
    const site = resolveProtectedSite(snapshot.policy, readDocumentPolicyInput(window));
    if (site === undefined) {
        return;
    }
    // The engine can be delivered twice, and the parent document protects a frame
    // while it still shows `about:blank`. Existing wrappers then serve this document.
    if (sendInstallationToken(window, tokens.adopt, tokens.reply)) {
        return;
    }
    createRealmProtection(window, deriveSiteSeed(snapshot.session, site), tokens).protect(window);
}
