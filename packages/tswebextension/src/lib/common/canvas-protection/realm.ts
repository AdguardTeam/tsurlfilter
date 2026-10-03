import { canvasIntrinsics as intrinsics, withoutPrototype } from './intrinsics';
import { createNativeMasking } from './masking';
import { type InstallationTokens } from './noise';
import {
    captureCanvasNatives,
    createConvertToBlobWrapper,
    createGetImageDataWrapper,
    createOffscreenGetImageDataWrapper,
    createToBlobWrapper,
    createToDataURLWrapper,
} from './readout';
import { type CanvasTaint, createDrawTracking, INERT_CONTEXT_METHODS } from './taint';

type Realm = Window & typeof globalThis;
type ApplyHandler = NonNullable<ProxyHandler<Function>['apply']>;

/**
 * Installs the readout wrappers and draw tracking into realms sharing one site seed.
 */
export interface RealmProtection {
    protect(realm: Window): void;
}

/**
 * Frame element members that hand the page a child window or its document.
 */
const FRAME_MEMBERS: readonly (readonly [string, string, 'get' | 'value'])[] = [
    ['HTMLIFrameElement', 'contentWindow', 'get'],
    ['HTMLIFrameElement', 'contentDocument', 'get'],
    ['HTMLIFrameElement', 'getSVGDocument', 'value'],
    ['HTMLFrameElement', 'contentWindow', 'get'],
    ['HTMLFrameElement', 'contentDocument', 'get'],
    ['HTMLObjectElement', 'contentWindow', 'get'],
    ['HTMLObjectElement', 'contentDocument', 'get'],
    ['HTMLObjectElement', 'getSVGDocument', 'value'],
    ['HTMLEmbedElement', 'getSVGDocument', 'value'],
];

/**
 * Sends a token to the realm's current `getImageData`, which only a wrapper of
 * this browser run answers. The native method rejects the call.
 *
 * @param realm Document's global object.
 * @param token Private request.
 * @param reply Private expected answer.
 *
 * @returns Whether a wrapper answered.
 */
export function sendInstallationToken(realm: Window, token: string, reply: string): boolean {
    try {
        const method = (realm as Realm).CanvasRenderingContext2D.prototype.getImageData;
        return intrinsics.apply(method, undefined, [token]) === reply;
    } catch {
        return false;
    }
}

/**
 * Tells whether a document never receives the engine by itself and therefore
 * takes its protection from the document that created it.
 *
 * @param href Document URL.
 *
 * @returns Whether the URL is an `about:` or `blob:` one.
 */
const isInheritedUrl = (href: string): boolean => (
    intrinsics.apply(intrinsics.slice, href, [0, 6]) === 'about:'
    || intrinsics.apply(intrinsics.slice, href, [0, 5]) === 'blob:'
);

/**
 * Creates one engine instance for the engine's own document and the same-origin
 * `about:blank`, `about:srcdoc` and `blob:` frames below it. They share the seed,
 * the draw marks and the native-representation masking. Nothing is defined on
 * any global object: realms are recognized by private tokens and private sets.
 *
 * @param own Global object of the engine's own document, before page code runs.
 * @param seed Captured site key.
 * @param tokens Private strings shared by the engine instances of this browser run.
 *
 * @returns The realm installer.
 */
export function createRealmProtection(own: Window, seed: Uint8Array, tokens: InstallationTokens): RealmProtection {
    const ownNative = captureCanvasNatives(own);
    const masking = createNativeMasking();
    const tracking = createDrawTracking(ownNative);
    // Canvas prototypes identify realms: a frame keeps its WindowProxy across navigations.
    const protectedRealms = new intrinsics.WeakSet<object>();
    const foreignRealms = new intrinsics.WeakSet<object>();
    const seenFrames = new intrinsics.WeakSet<object>();
    const observedDocuments = new intrinsics.WeakSet<object>();
    const frameCount = intrinsics.getOwnPropertyDescriptor(own, 'length')!.get!;
    const defaultView = intrinsics.getOwnPropertyDescriptor((own as Realm).Document.prototype, 'defaultView')!.get!;
    const Observer = (own as Realm).MutationObserver;
    const { observe } = Observer.prototype;
    const has = (set: WeakSet<object>, value: unknown): boolean => intrinsics.apply(intrinsics.weakHas, set, [value]);
    const add = (set: WeakSet<object>, value: unknown): void => {
        intrinsics.apply(intrinsics.weakAdd, set, [value]);
    };
    // Child realms are protected after page code ran, so nothing here may reach a
    // page-defined member through Object.prototype or call a replaceable method.
    const describe = (owner: object, name: string): PropertyDescriptor | undefined => {
        const descriptor = intrinsics.getOwnPropertyDescriptor(owner, name);
        return descriptor === undefined ? undefined : withoutPrototype(descriptor);
    };
    const hook = (owner: object, name: string, key: 'get' | 'value', apply: ApplyHandler): void => {
        const descriptor = describe(owner, name);
        if (descriptor !== undefined && typeof descriptor[key] === 'function') {
            intrinsics.defineProperty(owner, name, withoutPrototype({
                ...descriptor, [key]: masking.wrap(descriptor[key], apply),
            }));
        }
    };

    const protect = (realm: Window, adopted: boolean): void => {
        const global = realm as Realm;
        const native = captureCanvasNatives(realm);
        // An adopted realm belongs to a document whose own engine decided to protect it.
        // Any other realm stays protected while it shows the document it was found with,
        // or another one that cannot receive the engine by itself.
        const state = { adopted, document: realm.document };
        const isActive = (): boolean => (
            state.adopted || realm.document === state.document || isInheritedUrl(realm.location.href)
        );
        const taint: CanvasTaint = { has: (canvas) => tracking.taint.has(canvas) && isActive() };

        const scan = (): void => {
            if (!isActive()) {
                return;
            }
            const count = intrinsics.apply(frameCount, realm, []);
            for (let index = 0; index < count; index += 1) {
                const child = realm[index];
                if (!has(seenFrames, child)) {
                    add(seenFrames, child);
                    // eslint-disable-next-line @typescript-eslint/no-use-before-define -- Mutually recursive.
                    protectChild(child);
                }
            }
        };
        // Frames inserted by markup load their content later; the observer reaches them first.
        const watch = (): void => {
            const { document } = realm;
            if (!has(observedDocuments, document)) {
                add(observedDocuments, document);
                intrinsics.apply(observe, new Observer(scan), [
                    document, withoutPrototype({ childList: true, subtree: true }),
                ]);
            }
            scan();
        };

        const context2d = global.CanvasRenderingContext2D.prototype;
        const canvas = global.HTMLCanvasElement.prototype;
        const offscreen2d = global.OffscreenCanvasRenderingContext2D.prototype;
        const contexts = [context2d, offscreen2d];
        for (let kind = 0; kind < contexts.length; kind += 1) {
            const names = intrinsics.getOwnPropertyNames(contexts[kind]);
            for (let index = 0; index < names.length; index += 1) {
                const name = names[index];
                if (name !== 'constructor' && INERT_CONTEXT_METHODS[name] !== true) {
                    hook(contexts[kind], name, 'value', name === 'drawImage' ? tracking.drawImage : tracking.draw);
                }
            }
        }
        hook(global.ImageBitmapRenderingContext.prototype, 'transferFromImageBitmap', 'value', tracking.draw);
        hook(canvas, 'transferControlToOffscreen', 'value', tracking.transferControlToOffscreen);
        const getImageData = createGetImageDataWrapper(native, seed, taint);
        hook(context2d, 'getImageData', 'value', (_target, receiver, args) => {
            if (receiver === undefined && args.length === 1) {
                if (args[0] === tokens.probe) {
                    return tokens.reply;
                }
                if (args[0] === tokens.adopt) {
                    state.adopted = true;
                    watch();
                    return tokens.reply;
                }
            }
            return native.apply(getImageData, receiver, args);
        });
        const toDataURL = createToDataURLWrapper(native, seed, taint);
        hook(canvas, 'toDataURL', 'value', (_target, receiver, args) => native.apply(toDataURL, receiver, args));
        const toBlob = createToBlobWrapper(native, seed, taint);
        hook(canvas, 'toBlob', 'value', (_target, receiver, args) => native.apply(toBlob, receiver, args));
        const offscreenRead = createOffscreenGetImageDataWrapper(native, seed, taint);
        hook(offscreen2d, 'getImageData', 'value', (_target, receiver, args) => (
            native.apply(offscreenRead, receiver, args)
        ));
        const convertToBlob = createConvertToBlobWrapper(native, seed, taint);
        hook(global.OffscreenCanvas.prototype, 'convertToBlob', 'value', (_target, receiver, args) => (
            native.apply(convertToBlob, receiver, args)
        ));

        for (let index = 0; index < FRAME_MEMBERS.length; index += 1) {
            const member = FRAME_MEMBERS[index];
            const name = member[1];
            hook(global[member[0] as 'HTMLIFrameElement'].prototype, name, member[2], (target, receiver, args) => {
                const result = native.apply(target, receiver, args);
                const child = result === null || name === 'contentWindow'
                    ? result : intrinsics.apply(defaultView, result, []);
                if (child !== null && isActive()) {
                    // eslint-disable-next-line @typescript-eslint/no-use-before-define -- Mutually recursive.
                    protectChild(child);
                }
                return result;
            });
        }
        masking.learnErrors(global.Error);
        const serializer = describe(global.Function.prototype, 'toString')!;
        intrinsics.defineProperty(global.Function.prototype, 'toString', withoutPrototype({
            ...serializer, value: masking.serializer(serializer.value),
        }));
        add(protectedRealms, context2d);
        watch();
    };

    const protectChild = (child: Window): void => {
        let href: string;
        let key: object;
        try {
            // A cross-origin frame rejects both reads; it receives the engine by itself.
            href = child.location.href;
            key = (child as Realm).CanvasRenderingContext2D.prototype;
        } catch {
            return;
        }
        if (has(protectedRealms, key) || has(foreignRealms, key)) {
            return;
        }
        if (!isInheritedUrl(href) || sendInstallationToken(child, tokens.probe, tokens.reply)) {
            add(foreignRealms, key);
            return;
        }
        try {
            protect(child, false);
        } catch {
            // The page reached this frame first and changed it. Its own calls must not fail because of the engine.
            add(foreignRealms, key);
        }
    };

    return { protect: (realm) => protect(realm, true) };
}
