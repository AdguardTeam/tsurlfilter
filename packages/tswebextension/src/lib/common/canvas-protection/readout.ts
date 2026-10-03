import { canvasIntrinsics as intrinsics, withoutPrototype } from './intrinsics';
import { applyCanvasNoise } from './noise';
import { type CanvasTaint } from './taint';

/**
 * Bindings of one canvas kind: an HTML canvas or an OffscreenCanvas, each with its 2D context.
 */
export interface SurfaceNatives {
    readonly create: (width: number, height: number) => object;
    readonly getContext: Function;
    readonly getContextAttributes: Function | undefined;
    readonly drawImage: Function;
    readonly putImageData: Function;
    readonly getImageData: Function;
    readonly contextCanvas: Function;
    readonly canvasWidth: Function;
    readonly canvasHeight: Function;
}

/**
 * Canvas intrinsics captured from the protected document before page code runs.
 */
export interface CanvasNatives {
    readonly toDataURL: HTMLCanvasElement['toDataURL'];
    readonly toBlob: HTMLCanvasElement['toBlob'];
    readonly convertToBlob: OffscreenCanvas['convertToBlob'];
    readonly getContext: HTMLCanvasElement['getContext'];
    readonly getContextAttributes: CanvasRenderingContext2D['getContextAttributes'];
    readonly exceptionName: (this: DOMException) => string;
    readonly drawImage: CanvasRenderingContext2D['drawImage'];
    readonly putImageData: CanvasRenderingContext2D['putImageData'];
    readonly createElement: Document['createElement'];
    readonly document: Document;
    readonly setCanvasWidth: (this: HTMLCanvasElement, value: number) => void;
    readonly setCanvasHeight: (this: HTMLCanvasElement, value: number) => void;
    readonly getImageData: CanvasRenderingContext2D['getImageData'];
    readonly contextCanvas: (this: CanvasRenderingContext2D) => HTMLCanvasElement;
    readonly bitmapContextCanvas: (this: ImageBitmapRenderingContext) => HTMLCanvasElement | OffscreenCanvas;
    readonly videoWidth: (this: HTMLVideoElement) => number;
    readonly canvasWidth: (this: HTMLCanvasElement) => number;
    readonly canvasHeight: (this: HTMLCanvasElement) => number;
    readonly offscreen: SurfaceNatives;
    readonly Proxy: typeof Proxy;
    readonly apply: typeof Reflect.apply;
    readonly trunc: typeof Math.trunc;
    readonly max: typeof Math.max;
    readonly String: StringConstructor;
    readonly imageData: (this: ImageData) => Uint8ClampedArray;
    readonly imageWidth: (this: ImageData) => number;
    readonly imageHeight: (this: ImageData) => number;
    readonly imageColorSpace: (this: ImageData) => PredefinedColorSpace | undefined;
}

/**
 * Captures canvas bindings and accessors without creating any canvas context.
 *
 * @param realm Protected document's global object.
 *
 * @returns Native bindings owned by that realm.
 */
export function captureCanvasNatives(realm: Window): CanvasNatives {
    const global = realm as Window & typeof globalThis;
    const getter = (owner: object, name: string): Function => global.Object.getOwnPropertyDescriptor(owner, name)!.get!;
    const context = global.CanvasRenderingContext2D.prototype;
    const canvas = global.HTMLCanvasElement.prototype;
    const { OffscreenCanvas } = global;
    const offscreenContext = global.OffscreenCanvasRenderingContext2D.prototype;
    return {
        toDataURL: canvas.toDataURL,
        toBlob: canvas.toBlob,
        convertToBlob: OffscreenCanvas.prototype.convertToBlob,
        getContext: canvas.getContext,
        getContextAttributes: context.getContextAttributes,
        exceptionName: getter(global.DOMException.prototype, 'name') as CanvasNatives['exceptionName'],
        drawImage: context.drawImage,
        putImageData: context.putImageData,
        createElement: global.Document.prototype.createElement,
        document: global.document,
        setCanvasWidth: global.Object.getOwnPropertyDescriptor(canvas, 'width')!.set!,
        setCanvasHeight: global.Object.getOwnPropertyDescriptor(canvas, 'height')!.set!,
        getImageData: context.getImageData,
        contextCanvas: getter(context, 'canvas') as CanvasNatives['contextCanvas'],
        bitmapContextCanvas: getter(
            global.ImageBitmapRenderingContext.prototype,
            'canvas',
        ) as CanvasNatives['bitmapContextCanvas'],
        videoWidth: getter(global.HTMLVideoElement.prototype, 'videoWidth') as CanvasNatives['videoWidth'],
        canvasWidth: getter(canvas, 'width') as CanvasNatives['canvasWidth'],
        canvasHeight: getter(canvas, 'height') as CanvasNatives['canvasHeight'],
        offscreen: {
            create: (width, height) => new OffscreenCanvas(width, height),
            getContext: OffscreenCanvas.prototype.getContext,
            getContextAttributes: (offscreenContext as { getContextAttributes?: Function }).getContextAttributes,
            drawImage: offscreenContext.drawImage,
            putImageData: offscreenContext.putImageData,
            getImageData: offscreenContext.getImageData,
            contextCanvas: getter(offscreenContext, 'canvas'),
            canvasWidth: getter(OffscreenCanvas.prototype, 'width'),
            canvasHeight: getter(OffscreenCanvas.prototype, 'height'),
        },
        Proxy: global.Proxy,
        apply: global.Reflect.apply,
        trunc: global.Math.trunc,
        max: global.Math.max,
        String: global.String,
        imageData: getter(global.ImageData.prototype, 'data') as CanvasNatives['imageData'],
        imageWidth: getter(global.ImageData.prototype, 'width') as CanvasNatives['imageWidth'],
        imageHeight: getter(global.ImageData.prototype, 'height') as CanvasNatives['imageHeight'],
        // Absence is captured before page code can install a getter on older native ImageData surfaces.
        imageColorSpace: global.Object.getOwnPropertyDescriptor(global.ImageData.prototype, 'colorSpace')?.get
            ?? ((): undefined => undefined),
    };
}

/**
 * Presents the HTML canvas bindings in the shape shared with OffscreenCanvas.
 *
 * @param native Captured bindings.
 *
 * @returns HTML canvas bindings, with a factory of private canvases.
 */
const htmlSurface = (native: CanvasNatives): SurfaceNatives => ({
    create: (width, height): object => {
        const canvas = native.apply(native.createElement, native.document, ['canvas']) as HTMLCanvasElement;
        native.apply(native.setCanvasWidth, canvas, [width]);
        native.apply(native.setCanvasHeight, canvas, [height]);
        return canvas;
    },
    getContext: native.getContext,
    getContextAttributes: native.getContextAttributes,
    drawImage: native.drawImage,
    putImageData: native.putImageData,
    getImageData: native.getImageData,
    contextCanvas: native.contextCanvas,
    canvasWidth: native.canvasWidth,
    canvasHeight: native.canvasHeight,
});

/**
 * Applies the shared protection domain to captured original HTML canvas attributes.
 *
 * @param width Native original width.
 * @param height Native original height.
 *
 * @returns Whether readouts from this original canvas are within size coverage.
 */
export function isCanvasSizeProtected(width: number, height: number): boolean {
    return width <= 32767 && height <= 32767 && width * height <= 268435456;
}

/**
 * Reads through the browser binding once, modifying only eligible returned bytes.
 * Object coordinates are converted here, once and in native order, so the noise
 * uses the same values as the readout.
 *
 * @param native Captured native methods and accessors.
 * @param surface Bindings of the canvas kind being read.
 * @param seed Captured site key.
 * @param taint Canvases that received fingerprintable rendering.
 *
 * @returns Nonconstructible callable preserving native receiver and argument validation.
 */
const createReadWrapper = (
    native: CanvasNatives,
    surface: SurfaceNatives,
    seed: Uint8Array,
    taint: CanvasTaint,
): Function => new native.Proxy(surface.getImageData, withoutPrototype({
    apply: (target, receiver, args): ImageData => {
        let canvas: object;
        try {
            canvas = native.apply(surface.contextCanvas, receiver, []);
        } catch {
            // The native binding rejects this receiver before converting anything.
            return native.apply(target, receiver, args);
        }
        if (args.length < 4) {
            return native.apply(target, receiver, args);
        }
        for (let index = 0; index < 4; index += 1) {
            const argument = args[index];
            // Only objects run page code when converted; the binding converts primitives itself.
            // The realm's own `Math.trunc` applies the same number conversion and throws in that realm;
            // the binding truncates a `long` anyway.
            if (argument !== null && (typeof argument === 'object' || typeof argument === 'function')) {
                args[index] = native.trunc(argument as number);
            }
            // The binding rejects a value that is not a finite in-range `long` before converting later arguments.
            const value = args[index];
            if (typeof value === 'symbol' || typeof value === 'bigint'
                || !(+(value as number) > -2147483649 && +(value as number) < 2147483648)) {
                break;
            }
        }
        const result = native.apply(target, receiver, args) as ImageData;
        // Checked after the native call: argument conversion can draw on the canvas.
        if (!taint.has(canvas)) {
            return result;
        }
        const data = native.apply(native.imageData, result, []) as Uint8ClampedArray;
        const colorSpace = native.apply(native.imageColorSpace, result, []);
        if (intrinsics.apply(intrinsics.typedTag, data, []) !== 'Uint8ClampedArray'
            || (colorSpace !== undefined && colorSpace !== 'srgb')) {
            return result;
        }
        const canvasWidth = native.apply(surface.canvasWidth, canvas, []);
        const canvasHeight = native.apply(surface.canvasHeight, canvas, []);
        if (!isCanvasSizeProtected(canvasWidth, canvasHeight)) {
            return result;
        }
        const sx = native.trunc(+args[0]);
        const sy = native.trunc(+args[1]);
        applyCanvasNoise({
            data,
            width: native.apply(native.imageWidth, result, []),
            height: native.apply(native.imageHeight, result, []),
            originX: sx + intrinsics.min(0, native.trunc(+args[2])),
            originY: sy + intrinsics.min(0, native.trunc(+args[3])),
            canvasWidth,
            canvasHeight,
            colorSpace: 'srgb',
        }, seed);
        return result;
    },
}));

/**
 * Protects raw readouts of HTML canvases.
 *
 * @param native Captured native methods and accessors.
 * @param seed Captured site key.
 * @param taint Canvases that received fingerprintable rendering.
 *
 * @returns Nonconstructible callable preserving native receiver and argument validation.
 */
export function createGetImageDataWrapper(
    native: CanvasNatives,
    seed: Uint8Array,
    taint: CanvasTaint,
): CanvasRenderingContext2D['getImageData'] {
    return createReadWrapper(native, htmlSurface(native), seed, taint) as CanvasRenderingContext2D['getImageData'];
}

/**
 * Protects raw readouts of OffscreenCanvas objects used in the document.
 *
 * @param native Captured native methods and accessors.
 * @param seed Captured site key.
 * @param taint Canvases that received fingerprintable rendering.
 *
 * @returns Nonconstructible callable preserving native receiver and argument validation.
 */
export function createOffscreenGetImageDataWrapper(
    native: CanvasNatives,
    seed: Uint8Array,
    taint: CanvasTaint,
): OffscreenCanvasRenderingContext2D['getImageData'] {
    return createReadWrapper(
        native,
        native.offscreen,
        seed,
        taint,
    ) as OffscreenCanvasRenderingContext2D['getImageData'];
}

/**
 * Writes opaque pixels while preserving the copied raster's nonopaque storage.
 * Replaying nonopaque ImageData would quantize native premultiplied values again.
 *
 * @param image Noised pixels whose alpha is unchanged.
 * @param context Private serialization context.
 * @param write Pixel writer of that context's kind.
 * @param native Captured bindings.
 */
const writeOpaquePixels = (image: ImageData, context: object, write: Function, native: CanvasNatives): void => {
    const data = native.apply(native.imageData, image, []) as Uint8ClampedArray;
    const width = native.apply(native.imageWidth, image, []) as number;
    const height = native.apply(native.imageHeight, image, []) as number;
    const length = intrinsics.apply(intrinsics.typedLength, data, []) as number;
    let fullyOpaque = true;
    for (let offset = 3; offset < length; offset += 4) {
        if (data[offset] !== 255) {
            fullyOpaque = false;
            break;
        }
    }
    if (fullyOpaque) {
        native.apply(write, context, [image, 0, 0]);
        return;
    }
    for (let y = 0; y < height; y += 1) {
        let start = -1;
        for (let x = 0; x <= width; x += 1) {
            if (x < width && data[(y * width + x) * 4 + 3] === 255) {
                if (start === -1) {
                    start = x;
                }
            } else if (start !== -1) {
                native.apply(write, context, [image, 0, 0, start, y, x - start, 1]);
                start = -1;
            }
        }
    }
};

/**
 * Copies a drawn-on canvas into a private canvas of the same kind and noises the copy.
 * Canvases outside coverage, without opaque pixels or with non-sRGB or non-8-bit
 * storage keep their original serializer.
 *
 * @param native Captured browser bindings.
 * @param surface Bindings of the receiver's canvas kind.
 * @param seed Captured site seed.
 * @param receiver Original canvas.
 *
 * @returns The original or private canvas for the browser serializer.
 *
 * @throws Unexpected browser bitmap preparation errors.
 */
const prepareExport = (native: CanvasNatives, surface: SurfaceNatives, seed: Uint8Array, receiver: object): object => {
    const width = native.apply(surface.canvasWidth, receiver, []);
    const height = native.apply(surface.canvasHeight, receiver, []);
    if (!isCanvasSizeProtected(width, height) || width === 0 || height === 0) {
        return receiver;
    }
    let owner: object | null = null;
    try {
        owner = native.apply(surface.getContext, receiver, ['2d']);
    } catch {
        // An HTML canvas that transferred its control rejects every context request.
    }
    if (owner !== null && surface.getContextAttributes !== undefined) {
        // Detached from Object.prototype, so a missing member cannot resolve to a page-defined one.
        const attributes = withoutPrototype(native.apply(
            surface.getContextAttributes,
            owner,
            [],
        ) as CanvasRenderingContext2DSettings & { colorType?: string });
        if ((attributes.colorSpace !== undefined && attributes.colorSpace !== 'srgb')
            || (attributes.colorType !== undefined && attributes.colorType !== 'unorm8')) {
            return receiver;
        }
    }
    const copy = surface.create(width, height);
    const context = native.apply(surface.getContext, copy, ['2d']) as object;
    native.apply(surface.drawImage, context, [receiver, 0, 0]);
    let image: ImageData;
    try {
        image = native.apply(surface.getImageData, context, [0, 0, width, height]) as ImageData;
    } catch (error) {
        let name: string;
        try {
            name = native.apply(native.exceptionName, error, []);
        } catch {
            throw error;
        }
        if (name === 'SecurityError') {
            return receiver;
        }
        throw error;
    }
    const data = native.apply(native.imageData, image, []) as Uint8ClampedArray;
    const length = intrinsics.apply(intrinsics.typedLength, data, []) as number;
    let opaque = false;
    for (let index = 3; index < length; index += 4) {
        if (data[index] === 255) {
            opaque = true;
            break;
        }
    }
    if (!opaque) {
        return receiver;
    }
    applyCanvasNoise({
        data,
        width,
        height,
        originX: 0,
        originY: 0,
        canvasWidth: width,
        canvasHeight: height,
        colorSpace: 'srgb',
    }, seed);
    writeOpaquePixels(image, context, surface.putImageData, native);
    return copy;
};

/**
 * Serializes a drawn-on canvas from a private noised copy.
 * An object type is converted here, once and after native receiver and callback
 * validation, because that conversion can still draw on the canvas.
 *
 * @param native Captured browser bindings.
 * @param surface HTML canvas bindings.
 * @param seed Captured site seed.
 * @param taint Canvases that received fingerprintable rendering.
 * @param target Selected serializer.
 * @param receiver Original invocation receiver.
 * @param args Original arguments, including unchanged quality and callback.
 * @param typeIndex Position of the MIME type argument.
 *
 * @returns The native call's result.
 */
const exportCanvas = (
    native: CanvasNatives,
    surface: SurfaceNatives,
    seed: Uint8Array,
    taint: CanvasTaint,
    target: Function,
    receiver: HTMLCanvasElement,
    args: unknown[],
    typeIndex: number,
): unknown => {
    try {
        native.apply(native.canvasWidth, receiver, []);
    } catch {
        return native.apply(target, receiver, args);
    }
    if (typeIndex === 1 && (args.length === 0 || typeof args[0] !== 'function')) {
        return native.apply(target, receiver, args);
    }
    // An omitted argument is not read: its index could resolve to a page-defined inherited accessor.
    const type = args.length > typeIndex ? args[typeIndex] : undefined;
    // Only objects run page code when converted; the binding converts primitives itself.
    if (type !== null && (typeof type === 'object' || typeof type === 'function')) {
        args[typeIndex] = native.String(type);
    }
    const source = taint.has(receiver) ? prepareExport(native, surface, seed, receiver) : receiver;
    return native.apply(target, source, args);
};

/**
 * Serializes a private pointwise bitmap with native encoding.
 *
 * @param native Captured browser bindings.
 * @param seed Captured site seed.
 * @param taint Canvases that received fingerprintable rendering.
 *
 * @returns Proxy retaining the native callable surface.
 */
export function createToDataURLWrapper(
    native: CanvasNatives,
    seed: Uint8Array,
    taint: CanvasTaint,
): HTMLCanvasElement['toDataURL'] {
    const surface = htmlSurface(native);
    return new native.Proxy(native.toDataURL, withoutPrototype({
        apply: (target, receiver, args): string => (
            exportCanvas(native, surface, seed, taint, target, receiver, args, 0) as string
        ),
    }));
}

/**
 * Delivers the browser's one callback from a private call-time bitmap.
 *
 * @param native Captured browser bindings.
 * @param seed Captured site seed.
 * @param taint Canvases that received fingerprintable rendering.
 *
 * @returns Proxy retaining native callback validation and scheduling.
 */
export function createToBlobWrapper(
    native: CanvasNatives,
    seed: Uint8Array,
    taint: CanvasTaint,
): HTMLCanvasElement['toBlob'] {
    const surface = htmlSurface(native);
    return new native.Proxy(native.toBlob, withoutPrototype({
        apply: (target, receiver, args): void => {
            exportCanvas(native, surface, seed, taint, target, receiver, args, 1);
        },
    }));
}

/**
 * Encodes a drawn-on OffscreenCanvas from a private noised copy.
 * The option members are read and converted here, once and in native order,
 * because their getters and conversions can still draw on the canvas.
 *
 * @param native Captured browser bindings.
 * @param seed Captured site seed.
 * @param taint Canvases that received fingerprintable rendering.
 *
 * @returns Proxy retaining the native callable surface.
 */
export function createConvertToBlobWrapper(
    native: CanvasNatives,
    seed: Uint8Array,
    taint: CanvasTaint,
): OffscreenCanvas['convertToBlob'] {
    const isObject = (value: unknown): boolean => (
        value !== null && (typeof value === 'object' || typeof value === 'function')
    );
    return new native.Proxy(native.convertToBlob, withoutPrototype({
        apply: (target, receiver, args): Promise<Blob> => {
            try {
                native.apply(native.offscreen.canvasWidth, receiver, []);
            } catch {
                return native.apply(target, receiver, args);
            }
            // An omitted argument is not read: its index could resolve to a page-defined inherited accessor.
            const options = args.length > 0 ? args[0] : undefined;
            if (isObject(options)) {
                const { quality } = options as ImageEncodeOptions;
                const convertedQuality = isObject(quality) ? native.max(quality as number) : quality;
                const { type } = options as ImageEncodeOptions;
                args[0] = withoutPrototype({
                    quality: convertedQuality,
                    type: isObject(type) ? native.String(type) : type,
                });
            }
            const source = taint.has(receiver) ? prepareExport(native, native.offscreen, seed, receiver) : receiver;
            return native.apply(target, source, args);
        },
    }));
}
