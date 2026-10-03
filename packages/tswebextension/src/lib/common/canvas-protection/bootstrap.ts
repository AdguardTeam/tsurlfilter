import { type CanvasBootstrapSnapshot, type DocumentPolicyInput } from './contracts';
import { deriveSiteSeed, type InstallationTokens } from './noise';
import { resolveDocumentProtection } from './policy';
import { createRealmProtection, sendInstallationToken } from './realm';

/**
 * Reads only the document's own native URL and frame relationship.
 * No page marker authenticates inherited policy or request-source semantics.
 *
 * @param realm Delivered document's global object.
 *
 * @returns Exact own-document input with explicit unavailable inheritance.
 */
export function readDocumentPolicyInput(realm: Window): DocumentPolicyInput {
    return {
        url: realm.location.href,
        requestType: realm === realm.top ? 'document' : 'subdocument',
        inheritedTop: { status: 'unavailable', reason: 'trusted-top-context-unavailable' },
        sourceUrl: { status: 'unavailable', reason: 'request-source-unavailable' },
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
    const context = resolveDocumentProtection(snapshot, readDocumentPolicyInput(window));
    if (!context.enabled || context.site.status !== 'available') {
        return;
    }
    // The engine can be delivered twice, and the parent document protects a frame
    // while it still shows `about:blank`. Existing wrappers then serve this document.
    if (sendInstallationToken(window, tokens.adopt, tokens.reply)) {
        return;
    }
    createRealmProtection(window, deriveSiteSeed(snapshot.session, context.site.value.key), tokens).protect(window);
}
