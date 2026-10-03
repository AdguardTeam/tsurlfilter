import { canvasIntrinsics as intrinsics, withoutPrototype } from './intrinsics';

/**
 * Tells whether rendering that can carry a device fingerprint reached a canvas.
 */
export interface CanvasTaint {
    has(canvas: object): boolean;
}

/**
 * Native bindings the draw tracking needs. Their brand checks accept objects of any realm.
 */
export interface DrawTrackingNatives {
    readonly apply: typeof Reflect.apply;
    readonly contextCanvas: Function;
    readonly offscreen: { readonly contextCanvas: Function };
    readonly bitmapContextCanvas: Function;
    readonly videoWidth: (this: HTMLVideoElement) => number;
}

/**
 * Private taint state and the call handlers that feed it.
 */
export interface DrawTracking {
    readonly taint: CanvasTaint;
    readonly draw: NonNullable<ProxyHandler<Function>['apply']>;
    readonly drawImage: NonNullable<ProxyHandler<Function>['apply']>;
    readonly transferControlToOffscreen: NonNullable<ProxyHandler<Function>['apply']>;
}

/**
 * 2D context methods that cannot put device-dependent pixels on the bitmap:
 * state, transforms, path building, queries, clearing and caller-supplied bytes.
 * Every other method, including ones added by future browsers, marks the canvas.
 */
const INERT_CONTEXT_METHOD_NAMES = [
    'save', 'restore', 'reset', 'isContextLost', 'getContextAttributes',
    'scale', 'rotate', 'translate', 'transform', 'getTransform', 'setTransform', 'resetTransform',
    'createLinearGradient', 'createRadialGradient', 'createConicGradient', 'createPattern',
    'beginPath', 'closePath', 'moveTo', 'lineTo', 'bezierCurveTo', 'quadraticCurveTo',
    'arc', 'arcTo', 'ellipse', 'rect', 'roundRect',
    'clip', 'isPointInPath', 'isPointInStroke', 'scrollPathIntoView',
    'measureText', 'setLineDash', 'getLineDash',
    'clearRect', 'createImageData', 'getImageData', 'putImageData',
];

/**
 * Lookup of the inert method names. It has no prototype, because child realms are
 * protected after page code could have replaced collection methods.
 */
export const INERT_CONTEXT_METHODS: Readonly<Record<string, true>> = withoutPrototype(
    Object.fromEntries(INERT_CONTEXT_METHOD_NAMES.map((name) => [name, true as const])),
);

/**
 * Tracks which canvases received rendering, so untouched ones keep native readouts.
 * A canvas filled only from video frames or `putImageData` holds no rendering
 * fingerprint. The mark is permanent: clearing or resizing does not remove it.
 * One tracking serves every realm an engine instance protects, for HTML canvases,
 * OffscreenCanvas objects and bitmap renderers alike.
 *
 * @param native Captured bindings of the engine's own realm.
 *
 * @returns Taint lookup and handlers for the rendering methods.
 */
export function createDrawTracking(native: DrawTrackingNatives): DrawTracking {
    const contexts = new intrinsics.WeakSet<object>();
    const canvases = new intrinsics.WeakSet<object>();
    const placeholders = new intrinsics.WeakMap<object, object>();
    // An HTML 2D context, an OffscreenCanvas 2D context or a bitmap renderer: each getter accepts its own kind.
    const owners = [native.contextCanvas, native.offscreen.contextCanvas, native.bitmapContextCanvas];
    const mark = (context: unknown): void => {
        if (intrinsics.apply(intrinsics.weakHas, contexts, [context])) {
            return;
        }
        for (let index = 0; index < owners.length; index += 1) {
            let canvas: object;
            try {
                canvas = native.apply(owners[index], context, []);
            } catch {
                // Not a context of this kind. The native method rejects a receiver of no kind itself.
                continue;
            }
            intrinsics.apply(intrinsics.weakAdd, contexts, [context]);
            intrinsics.apply(intrinsics.weakAdd, canvases, [canvas]);
            // Rendering on a transferred OffscreenCanvas shows up in the HTML canvas it came from.
            const placeholder = intrinsics.apply(intrinsics.weakGet, placeholders, [canvas]);
            if (placeholder !== undefined) {
                intrinsics.apply(intrinsics.weakAdd, canvases, [placeholder]);
            }
            return;
        }
    };
    // The getter brand-checks its receiver, so a canvas posing as a video is rejected.
    const isVideo = (source: unknown): boolean => {
        try {
            native.apply(native.videoWidth, source, []);
            return true;
        } catch {
            return false;
        }
    };
    return {
        taint: {
            has: (canvas): boolean => intrinsics.apply(intrinsics.weakHas, canvases, [canvas]),
        },
        draw: (target, receiver, args): unknown => {
            mark(receiver);
            return native.apply(target, receiver, args);
        },
        drawImage: (target, receiver, args): unknown => {
            if (!intrinsics.apply(intrinsics.weakHas, contexts, [receiver]) && !isVideo(args[0])) {
                mark(receiver);
            }
            return native.apply(target, receiver, args);
        },
        transferControlToOffscreen: (target, receiver, args): unknown => {
            const offscreen = native.apply(target, receiver, args);
            intrinsics.apply(intrinsics.weakSet, placeholders, [offscreen, receiver]);
            return offscreen;
        },
    };
}
