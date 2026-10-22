// Part of the engine injected into pages: plain functions instead of a static class keep it small,
// see engine-entry.ts.
import { canvasIntrinsics as intrinsics, withoutPrototype } from './intrinsics';
import { applyCanvasNoise } from './noise';
import { type CanvasTaint } from './taint';

/**
 * The largest protected canvas side, the largest canvas side Chromium supports.
 */
const MAX_CANVAS_SIDE = 32767;

/**
 * The largest protected canvas area, the largest canvas area Chromium supports.
 */
const MAX_CANVAS_AREA = 268435456;

/**
 * Pixel data of a readout in any supported format.
 */
type PixelData = Uint8ClampedArray | Float32Array;

/**
 * Tells whether converting a value can run page code. Only objects have
 * conversion hooks; the binding converts primitives itself.
 *
 * @param value Argument or option member.
 *
 * @returns Whether the value is an object or a function.
 */
const isObjectLike = (value: unknown): boolean => (
    value !== null && (typeof value === 'object' || typeof value === 'function')
);

/**
 * Moves every channel the noise changed in the 8-bit sRGB readout of the same
 * pixels by one 8-bit level: 1 in an 8-bit readout, 1/255 in a float one.
 * A channel that would leave the range moves the other way.
 *
 * @param data Readout in another color space or pixel format.
 * @param original The 8-bit sRGB readout before the noise.
 * @param noised The same readout after the noise.
 */
const transferNoise = (data: PixelData, original: Uint8ClampedArray, noised: Uint8ClampedArray): void => {
    const level = intrinsics.apply(intrinsics.typedTag, data, []) === 'Uint8ClampedArray' ? 1 : 1 / 255;
    const top = level === 1 ? 255 : 1;
    const length = intrinsics.apply(intrinsics.typedLength, noised, []) as number;
    for (let index = 0; index < length; index += 1) {
        const delta = (noised[index] - original[index]) * level;
        if (delta !== 0) {
            const value = data[index] + delta;
            data[index] = value < 0 || value > top ? data[index] - delta : value;
        }
    }
};

/**
 * Bindings of one canvas kind: an HTML canvas or an OffscreenCanvas, each with its 2D context.
 */
export interface SurfaceNatives {
    readonly create: (width: number, height: number) => object;
    readonly getContext: Function;
    readonly getContextAttributes: Function | undefined;
    readonly drawImage: Function;
    readonly putImageData: Function;
    readonly fillRect: Function;
    readonly setFillStyle: Function;
    readonly getImageData: Function;
    readonly contextCanvas: Function;
    readonly canvasWidth: Function;
    readonly canvasHeight: Function;
}

/**
 * OffscreenCanvas bindings, with the export method only it has.
 */
export interface OffscreenNatives extends SurfaceNatives {
    readonly convertToBlob: OffscreenCanvas['convertToBlob'];
}

/**
 * Getter of the canvas a bitmap renderer draws on.
 */
type BitmapContextCanvas = (this: ImageBitmapRenderingContext) => HTMLCanvasElement | OffscreenCanvas;

/**
 * Canvas intrinsics captured from the protected document before page code runs.
 */
export interface CanvasNatives {
    readonly toDataURL: HTMLCanvasElement['toDataURL'];
    readonly toBlob: HTMLCanvasElement['toBlob'];
    readonly getContext: HTMLCanvasElement['getContext'];
    readonly getContextAttributes: CanvasRenderingContext2D['getContextAttributes'];
    readonly exceptionName: (this: DOMException) => string;
    readonly drawImage: CanvasRenderingContext2D['drawImage'];
    readonly putImageData: CanvasRenderingContext2D['putImageData'];
    readonly fillRect: CanvasRenderingContext2D['fillRect'];
    readonly setFillStyle: (this: CanvasRenderingContext2D, value: string) => void;
    readonly createElement: Document['createElement'];
    readonly document: Document;
    readonly setCanvasWidth: (this: HTMLCanvasElement, value: number) => void;
    readonly setCanvasHeight: (this: HTMLCanvasElement, value: number) => void;
    readonly getImageData: CanvasRenderingContext2D['getImageData'];
    readonly contextCanvas: (this: CanvasRenderingContext2D) => HTMLCanvasElement;
    /**
     * Absent before Firefox 97, which has no `canvas` on a bitmap renderer.
     * TODO: remove when Firefox before 97 is no longer supported.
     */
    readonly bitmapContextCanvas: BitmapContextCanvas | undefined;
    readonly videoWidth: (this: HTMLVideoElement) => number;
    readonly canvasWidth: (this: HTMLCanvasElement) => number;
    readonly canvasHeight: (this: HTMLCanvasElement) => number;
    /**
     * Absent in browsers without a 2D OffscreenCanvas, such as Firefox before 105:
     * pages there cannot read one either.
     * TODO: remove when Firefox before 105 is no longer supported.
     */
    readonly offscreen: OffscreenNatives | undefined;
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
    // TODO: remove when Firefox before 105 is no longer supported.
    const offscreenContext = global.OffscreenCanvasRenderingContext2D?.prototype;
    return {
        toDataURL: canvas.toDataURL,
        toBlob: canvas.toBlob,
        getContext: canvas.getContext,
        getContextAttributes: context.getContextAttributes,
        exceptionName: getter(global.DOMException.prototype, 'name') as CanvasNatives['exceptionName'],
        drawImage: context.drawImage,
        putImageData: context.putImageData,
        fillRect: context.fillRect,
        setFillStyle: global.Object.getOwnPropertyDescriptor(context, 'fillStyle')!.set!,
        createElement: global.Document.prototype.createElement,
        document: global.document,
        setCanvasWidth: global.Object.getOwnPropertyDescriptor(canvas, 'width')!.set!,
        setCanvasHeight: global.Object.getOwnPropertyDescriptor(canvas, 'height')!.set!,
        getImageData: context.getImageData,
        contextCanvas: getter(context, 'canvas') as CanvasNatives['contextCanvas'],
        bitmapContextCanvas: global.Object.getOwnPropertyDescriptor(
            global.ImageBitmapRenderingContext.prototype,
            'canvas',
        )?.get as CanvasNatives['bitmapContextCanvas'],
        videoWidth: getter(global.HTMLVideoElement.prototype, 'videoWidth') as CanvasNatives['videoWidth'],
        canvasWidth: getter(canvas, 'width') as CanvasNatives['canvasWidth'],
        canvasHeight: getter(canvas, 'height') as CanvasNatives['canvasHeight'],
        offscreen: offscreenContext === undefined ? undefined : {
            create: (width, height) => new OffscreenCanvas(width, height),
            getContext: OffscreenCanvas.prototype.getContext,
            getContextAttributes: (offscreenContext as { getContextAttributes?: Function }).getContextAttributes,
            drawImage: offscreenContext.drawImage,
            putImageData: offscreenContext.putImageData,
            fillRect: offscreenContext.fillRect,
            setFillStyle: global.Object.getOwnPropertyDescriptor(offscreenContext, 'fillStyle')!.set!,
            getImageData: offscreenContext.getImageData,
            contextCanvas: getter(offscreenContext, 'canvas'),
            canvasWidth: getter(OffscreenCanvas.prototype, 'width'),
            canvasHeight: getter(OffscreenCanvas.prototype, 'height'),
            convertToBlob: OffscreenCanvas.prototype.convertToBlob,
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
    fillRect: native.fillRect,
    setFillStyle: native.setFillStyle,
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
    return width <= MAX_CANVAS_SIDE && height <= MAX_CANVAS_SIDE && width * height <= MAX_CANVAS_AREA;
}

/**
 * Reads through the browser binding once, modifying only eligible returned bytes.
 * A readout in another color space or pixel format reads once more in 8-bit sRGB,
 * so the noise is chosen on the same pixels.
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
            // The realm's own `Math.trunc` applies the same number conversion and throws in that realm;
            // the binding truncates a `long` anyway.
            if (isObjectLike(args[index])) {
                args[index] = native.trunc(args[index] as number);
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
        const data = native.apply(native.imageData, result, []) as PixelData;
        const tag = intrinsics.apply(intrinsics.typedTag, data, []);
        const colorSpace = native.apply(native.imageColorSpace, result, []);
        const isSrgb8 = tag === 'Uint8ClampedArray' && (colorSpace === undefined || colorSpace === 'srgb');
        if (!isSrgb8 && tag !== 'Uint8ClampedArray' && tag !== 'Float16Array' && tag !== 'Float32Array') {
            return result;
        }
        const canvasWidth = native.apply(surface.canvasWidth, canvas, []);
        const canvasHeight = native.apply(surface.canvasHeight, canvas, []);
        if (!isCanvasSizeProtected(canvasWidth, canvasHeight)) {
            return result;
        }
        // The page can ask for another color space or pixel format. The noise is
        // then chosen on an 8-bit sRGB readout of the same pixels, so every format
        // shows it at the same pixels.
        const view = isSrgb8 ? data as Uint8ClampedArray : native.apply(native.imageData, native.apply(
            target,
            receiver,
            [args[0], args[1], args[2], args[3], withoutPrototype({ colorSpace: 'srgb' })],
        ), []) as Uint8ClampedArray;
        const original = isSrgb8 ? view : new intrinsics.Uint8ClampedArray(view);
        const sx = native.trunc(+args[0]);
        const sy = native.trunc(+args[1]);
        applyCanvasNoise({
            data: view,
            width: native.apply(native.imageWidth, result, []),
            height: native.apply(native.imageHeight, result, []),
            originX: sx + intrinsics.min(0, native.trunc(+args[2])),
            originY: sy + intrinsics.min(0, native.trunc(+args[3])),
            canvasWidth,
            canvasHeight,
            colorSpace: 'srgb',
        }, seed);
        if (!isSrgb8) {
            transferNoise(data, original, view);
        }
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
 * @param offscreen Captured OffscreenCanvas bindings.
 * @param seed Captured site key.
 * @param taint Canvases that received fingerprintable rendering.
 *
 * @returns Nonconstructible callable preserving native receiver and argument validation.
 */
export function createOffscreenGetImageDataWrapper(
    native: CanvasNatives,
    offscreen: OffscreenNatives,
    seed: Uint8Array,
    taint: CanvasTaint,
): OffscreenCanvasRenderingContext2D['getImageData'] {
    return createReadWrapper(
        native,
        offscreen,
        seed,
        taint,
    ) as OffscreenCanvasRenderingContext2D['getImageData'];
}

/**
 * Paints the noised pixels onto a private copy with transparency. The noise
 * changes only opaque pixels, so each one is painted as an opaque 1×1 rectangle:
 * replaying nonopaque pixels would quantize their premultiplied values again, and
 * Chromium flushes the canvas on every `putImageData`, which makes many small
 * writes slow.
 *
 * @param noised Noised 8-bit sRGB pixels.
 * @param original The same pixels before the noise.
 * @param width Pixels per row.
 * @param fill Paints one pixel with the given opaque color.
 */
export function paintNoisedPixels(
    noised: Uint8ClampedArray,
    original: Uint8ClampedArray,
    width: number,
    fill: (x: number, y: number, color: string) => void,
): void {
    const length = intrinsics.apply(intrinsics.typedLength, noised, []) as number;
    for (let offset = 0; offset < length; offset += 4) {
        if (noised[offset] !== original[offset] || noised[offset + 1] !== original[offset + 1]
            || noised[offset + 2] !== original[offset + 2]) {
            const pixel = offset / 4;
            const x = pixel % width;
            fill(x, (pixel - x) / width, `rgb(${noised[offset]},${noised[offset + 1]},${noised[offset + 2]})`);
        }
    }
}

/**
 * Copies a drawn-on canvas into a private canvas of the same kind, color space
 * and pixel format, and noises the copy. Canvases outside coverage or without
 * opaque pixels keep their original serializer.
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
    let colorSpace: string | undefined;
    let colorType: string | undefined;
    if (owner !== null && surface.getContextAttributes !== undefined) {
        // Detached from Object.prototype, so a missing member cannot resolve to a page-defined one.
        const attributes = withoutPrototype(native.apply(
            surface.getContextAttributes,
            owner,
            [],
        ) as CanvasRenderingContext2DSettings & { colorType?: string });
        colorSpace = attributes.colorSpace;
        colorType = attributes.colorType;
    }
    const isSrgb8 = (colorSpace === undefined || colorSpace === 'srgb')
        && (colorType === undefined || colorType === 'unorm8');
    const copy = surface.create(width, height);
    const context = native.apply(
        surface.getContext,
        copy,
        isSrgb8 ? ['2d'] : ['2d', withoutPrototype({ colorSpace, colorType })],
    ) as object;
    // An 8-bit sRGB canvas is copied by drawing. Chromium draws a display-p3 float16
    // canvas inexactly, so another format is copied as its own pixels instead.
    const source = isSrgb8 ? context : owner!;
    if (isSrgb8) {
        native.apply(surface.drawImage, context, [receiver, 0, 0]);
    }
    let image: ImageData;
    let view: Uint8ClampedArray;
    try {
        image = native.apply(surface.getImageData, source, isSrgb8 ? [0, 0, width, height] : [
            0, 0, width, height,
            withoutPrototype({ colorSpace, pixelFormat: colorType === 'float16' ? 'rgba-float16' : 'rgba-unorm8' }),
        ]) as ImageData;
        view = native.apply(native.imageData, isSrgb8 ? image : native.apply(
            surface.getImageData,
            source,
            [0, 0, width, height, withoutPrototype({ colorSpace: 'srgb' })],
        ), []) as Uint8ClampedArray;
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
    const length = intrinsics.apply(intrinsics.typedLength, view, []) as number;
    let opaque = 0;
    for (let index = 3; index < length; index += 4) {
        if (view[index] === 255) {
            opaque += 1;
        }
    }
    if (opaque === 0) {
        return receiver;
    }
    // A fully opaque copy takes one write, so it needs no original to compare with.
    const whole = isSrgb8 && opaque === width * height;
    const original = whole ? view : new intrinsics.Uint8ClampedArray(view);
    applyCanvasNoise({
        data: view,
        width,
        height,
        originX: 0,
        originY: 0,
        canvasWidth: width,
        canvasHeight: height,
        colorSpace: 'srgb',
    }, seed);
    if (whole) {
        native.apply(surface.putImageData, context, [image, 0, 0]);
    } else if (isSrgb8) {
        paintNoisedPixels(view, original, width, (x, y, color) => {
            native.apply(surface.setFillStyle, context, [color]);
            native.apply(surface.fillRect, context, [x, y, 1, 1]);
        });
    } else {
        transferNoise(native.apply(native.imageData, image, []) as PixelData, original, view);
        native.apply(surface.putImageData, context, [image, 0, 0]);
    }
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
    if (isObjectLike(type)) {
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
 * @param offscreen Captured OffscreenCanvas bindings.
 * @param seed Captured site seed.
 * @param taint Canvases that received fingerprintable rendering.
 *
 * @returns Proxy retaining the native callable surface.
 */
export function createConvertToBlobWrapper(
    native: CanvasNatives,
    offscreen: OffscreenNatives,
    seed: Uint8Array,
    taint: CanvasTaint,
): OffscreenCanvas['convertToBlob'] {
    return new native.Proxy(offscreen.convertToBlob, withoutPrototype({
        apply: (target, receiver, args): Promise<Blob> => {
            try {
                native.apply(offscreen.canvasWidth, receiver, []);
            } catch {
                return native.apply(target, receiver, args);
            }
            // An omitted argument is not read: its index could resolve to a page-defined inherited accessor.
            const options = args.length > 0 ? args[0] : undefined;
            if (isObjectLike(options)) {
                const { quality } = options as ImageEncodeOptions;
                const convertedQuality = isObjectLike(quality) ? native.max(quality as number) : quality;
                const { type } = options as ImageEncodeOptions;
                args[0] = withoutPrototype({
                    quality: convertedQuality,
                    type: isObjectLike(type) ? native.String(type) : type,
                });
            }
            const source = taint.has(receiver) ? prepareExport(native, offscreen, seed, receiver) : receiver;
            return native.apply(target, source, args);
        },
    }));
}
