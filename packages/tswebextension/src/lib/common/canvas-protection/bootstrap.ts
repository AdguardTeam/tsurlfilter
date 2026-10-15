// Part of the engine injected into pages: plain functions instead of a static class keep it small,
// see engine-entry.ts.
import { type CanvasBootstrapSnapshot, type DocumentPolicyInput } from './contracts';
import {
    deriveInstallationTokens,
    deriveSiteSeed,
    formatKey,
    parseKey,
} from './noise';
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
 * Reads the document's own URL and what the browser reveals about its top
 * document. No page-provided marker is trusted for that context.
 *
 * @param realm Delivered document's global object.
 *
 * @returns Synchronous input of the document's protection decision.
 */
export function readDocumentPolicyInput(realm: Window): DocumentPolicyInput {
    const url = realm.location.href;
    if (realm === realm.top) {
        return { url, topUrl: url };
    }
    // Firefox lists ancestor origins since version 148.
    const origins = realm.location.ancestorOrigins as DOMStringList | undefined;
    return { url, topUrl: readAncestorUrl(realm.top!, origins?.[origins.length - 1]) };
}

/**
 * Installs the readouts with the draw tracking that selects the canvases they protect.
 * Nothing is defined on the global object; the seed stays reachable only through
 * private wrapper closures.
 *
 * @param seed The site key of this document.
 */
const protectDocument = (seed: Uint8Array): void => {
    // The engine can be delivered twice, and the parent document protects a frame
    // while it still shows `about:blank`. Existing wrappers then serve this document.
    const tokens = deriveInstallationTokens(seed);
    if (sendInstallationToken(window, tokens.adopt, tokens.reply)) {
        return;
    }
    createRealmProtection(window, seed, tokens).protect(window);
};

/**
 * Decides synchronously whether this document is protected and protects it.
 * A document that is not protected is left untouched.
 *
 * @param snapshot Trusted browser-acknowledged delivery state.
 */
export function bootstrapCanvasProtection(snapshot: CanvasBootstrapSnapshot): void {
    const site = resolveProtectedSite(snapshot.policy, readDocumentPolicyInput(window));
    if (site !== undefined) {
        protectDocument(deriveSiteSeed(snapshot.session, site));
    }
}

/**
 * Makes the protection decision in a content script world, so that a script
 * inserted into the page carries the site key only and never the session root,
 * which keys every site.
 *
 * @param snapshot Trusted browser-acknowledged delivery state.
 *
 * @returns The site key in hex, or `undefined` for a document that is not protected.
 */
export function resolveCanvasSeed(snapshot: CanvasBootstrapSnapshot): string | undefined {
    const site = resolveProtectedSite(snapshot.policy, readDocumentPolicyInput(window));
    return site === undefined ? undefined : formatKey(deriveSiteSeed(snapshot.session, site), 16);
}

/**
 * Protects the document with a site key resolved by {@link resolveCanvasSeed}.
 *
 * @param seed The site key in hex.
 */
export function bootstrapSeededCanvasProtection(seed: string): void {
    protectDocument(parseKey(seed));
}
