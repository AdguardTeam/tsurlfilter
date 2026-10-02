import { type CanvasBootstrapSnapshot, type DocumentPolicyInput } from './contracts';
import { withoutPrototype } from './intrinsics';
import { createNativeMasking } from './masking';
import { deriveSiteSeed } from './noise';
import { resolveDocumentProtection } from './policy';
import {
    captureCanvasNatives,
    createGetImageDataWrapper,
    createToBlobWrapper,
    createToDataURLWrapper,
} from './readout';

/**
 * Callable references expose no seed or captured policy information.
 */
export interface CanvasMethodReferences {
    readonly toDataURL: HTMLCanvasElement['toDataURL'];
    readonly toBlob: HTMLCanvasElement['toBlob'];
    readonly getImageData: CanvasRenderingContext2D['getImageData'];
}

/**
 * A non-callable document-local installation marker prevents duplicate hooks.
 */
export interface CanvasInstallationRecord {
    readonly outcome: 'disabled' | 'excluded' | 'unsupported' | 'installed';
    readonly methods: CanvasMethodReferences;
}

const installationKey = Symbol.for('adguard.canvas.installation');
const installationRealm = window as Window & { readonly __adguardCanvasInstallation?: CanvasInstallationRecord };
const { defineProperty } = Object;
const { freeze } = Object;

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
 * Seals one realm's original installation outcome and callable references.
 *
 * @param outcome Resolved outcome for this document.
 * @param methods Captured native methods or installed wrappers.
 */
export function sealCanvasInstallation(
    outcome: CanvasInstallationRecord['outcome'],
    methods: CanvasMethodReferences,
): void {
    const record = freeze(withoutPrototype({ outcome, methods: freeze(withoutPrototype(methods)) }));
    const descriptor = {
        value: record, writable: false, enumerable: false, configurable: false,
    };
    defineProperty(installationRealm, installationKey, descriptor);
    defineProperty(installationRealm, '__adguardCanvasInstallation', descriptor);
}

/**
 * Captures a synchronous document decision before installing its three readouts.
 * The prepared seed remains reachable only through private wrapper closures.
 *
 * @param snapshot Trusted browser-acknowledged delivery state.
 */
export function bootstrapCanvasProtection(snapshot: CanvasBootstrapSnapshot): void {
    // eslint-disable-next-line no-underscore-dangle -- Fixed immutable own-realm installation anchor.
    if (installationRealm.__adguardCanvasInstallation) {
        return;
    }
    const methods: CanvasMethodReferences = {
        toDataURL: HTMLCanvasElement.prototype.toDataURL,
        toBlob: HTMLCanvasElement.prototype.toBlob,
        getImageData: CanvasRenderingContext2D.prototype.getImageData,
    };
    const context = resolveDocumentProtection(snapshot, readDocumentPolicyInput(window));
    if (!context.enabled || context.site.status !== 'available') {
        sealCanvasInstallation(context.outcome === 'enabled' ? 'unsupported' : context.outcome, methods);
        return;
    }
    const native = {
        ...captureCanvasNatives(window),
        exportPlatform: snapshot.policy.browser === 'firefox-mv2' ? 'firefox' as const : 'chromium' as const,
    };
    const seed = deriveSiteSeed(snapshot.session, context.site.value.key);
    const masking = createNativeMasking(Function.prototype.toString);
    const install = <T extends Function>(owner: object, name: string, target: T, wrapper: T): T => {
        const masked = masking.wrap(target, (_target, receiver, args) => native.apply(wrapper, receiver, args));
        Object.defineProperty(owner, name, { ...Object.getOwnPropertyDescriptor(owner, name), value: masked });
        return masked;
    };
    const installed: CanvasMethodReferences = {
        toDataURL: install(
            HTMLCanvasElement.prototype,
            'toDataURL',
            native.toDataURL,
            createToDataURLWrapper(native, seed),
        ),
        toBlob: install(HTMLCanvasElement.prototype, 'toBlob', native.toBlob, createToBlobWrapper(native, seed)),
        getImageData: install(
            CanvasRenderingContext2D.prototype,
            'getImageData',
            native.getImageData,
            createGetImageDataWrapper(native, seed),
        ),
    };
    // eslint-disable-next-line no-extend-native -- Same-realm native stringification masks only owned wrappers.
    Object.defineProperty(Function.prototype, 'toString', {
        ...Object.getOwnPropertyDescriptor(Function.prototype, 'toString'), value: masking.toString,
    });
    sealCanvasInstallation('installed', installed);
}
