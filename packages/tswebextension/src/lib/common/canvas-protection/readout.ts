import { type CanvasReadout } from './contracts';
import { canvasIntrinsics as intrinsics, withoutPrototype } from './intrinsics';
import { applyCanvasNoise } from './noise';

/**
 * Canvas intrinsics captured from the protected document before page code runs.
 */
export interface CanvasNatives {
    readonly exportPlatform?: 'chromium' | 'firefox';
    readonly toDataURL: HTMLCanvasElement['toDataURL'];
    readonly toBlob: HTMLCanvasElement['toBlob'];
    readonly getContext: HTMLCanvasElement['getContext'];
    readonly transferControlToOffscreen: HTMLCanvasElement['transferControlToOffscreen'];
    readonly offscreenGetContext: OffscreenCanvas['getContext'];
    readonly offscreenDrawImage: OffscreenCanvasRenderingContext2D['drawImage'];
    readonly offscreenGetImageData: OffscreenCanvasRenderingContext2D['getImageData'];
    readonly offscreenPutImageData: OffscreenCanvasRenderingContext2D['putImageData'];
    readonly exceptionName: (this: DOMException) => string;
    readonly drawImage: CanvasRenderingContext2D['drawImage'];
    readonly putImageData: CanvasRenderingContext2D['putImageData'];
    readonly createElement: Document['createElement'];
    readonly document: Document;
    readonly VideoFrame: typeof VideoFrame;
    readonly frameFormat: (this: VideoFrame) => VideoPixelFormat | null;
    readonly frameColorSpace: (this: VideoFrame) => VideoColorSpace;
    readonly frameWidth: (this: VideoFrame) => number;
    readonly frameHeight: (this: VideoFrame) => number;
    readonly frameClose: VideoFrame['close'];
    readonly colorPrimaries: (this: VideoColorSpace) => string | null;
    readonly setCanvasWidth: (this: HTMLCanvasElement, value: number) => void;
    readonly setCanvasHeight: (this: HTMLCanvasElement, value: number) => void;
    readonly getImageData: CanvasRenderingContext2D['getImageData'];
    readonly contextCanvas: (this: CanvasRenderingContext2D) => HTMLCanvasElement;
    readonly canvasWidth: (this: HTMLCanvasElement) => number;
    readonly canvasHeight: (this: HTMLCanvasElement) => number;
    readonly Proxy: typeof Proxy;
    readonly apply: typeof Reflect.apply;
    readonly get: typeof Reflect.get;
    readonly toPrimitive: symbol;
    readonly ownKeys: typeof Reflect.ownKeys;
    readonly getOwnPropertyDescriptor: typeof Reflect.getOwnPropertyDescriptor;
    readonly getPrototypeOf: typeof Reflect.getPrototypeOf;
    readonly trunc: typeof Math.trunc;
    readonly imageData: (this: ImageData) => Uint8ClampedArray;
    readonly imageWidth: (this: ImageData) => number;
    readonly imageHeight: (this: ImageData) => number;
    readonly imageColorSpace: (this: ImageData) => PredefinedColorSpace | undefined;
}

/**
 * Already-observed coordinate primitives and the corresponding native bitmap bounds.
 */
export interface NativeArgumentObservation {
    readonly coordinates: number[];
    originX?: number;
    originY?: number;
    canvasWidth?: number;
    canvasHeight?: number;
    readout?: CanvasReadout;
    exportContext?: {
        readonly native: CanvasNatives;
        readonly seed: Uint8Array;
        readonly canvas: HTMLCanvasElement;
    };
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
    const context = global.CanvasRenderingContext2D.prototype;
    const canvas = global.HTMLCanvasElement.prototype;
    const offscreenContext = global.OffscreenCanvasRenderingContext2D.prototype;
    return {
        toDataURL: canvas.toDataURL,
        toBlob: canvas.toBlob,
        getContext: canvas.getContext,
        transferControlToOffscreen: canvas.transferControlToOffscreen,
        offscreenGetContext: global.OffscreenCanvas.prototype.getContext,
        offscreenDrawImage: offscreenContext.drawImage,
        offscreenGetImageData: offscreenContext.getImageData,
        offscreenPutImageData: offscreenContext.putImageData,
        exceptionName: global.Object.getOwnPropertyDescriptor(global.DOMException.prototype, 'name')!.get!,
        drawImage: context.drawImage,
        putImageData: context.putImageData,
        createElement: global.Document.prototype.createElement,
        document: global.document,
        VideoFrame: global.VideoFrame,
        frameFormat: global.Object.getOwnPropertyDescriptor(global.VideoFrame.prototype, 'format')!.get!,
        frameColorSpace: global.Object.getOwnPropertyDescriptor(global.VideoFrame.prototype, 'colorSpace')!.get!,
        frameWidth: global.Object.getOwnPropertyDescriptor(global.VideoFrame.prototype, 'displayWidth')!.get!,
        frameHeight: global.Object.getOwnPropertyDescriptor(global.VideoFrame.prototype, 'displayHeight')!.get!,
        frameClose: global.VideoFrame.prototype.close,
        colorPrimaries: global.Object.getOwnPropertyDescriptor(global.VideoColorSpace.prototype, 'primaries')!.get!,
        setCanvasWidth: global.Object.getOwnPropertyDescriptor(canvas, 'width')!.set!,
        setCanvasHeight: global.Object.getOwnPropertyDescriptor(canvas, 'height')!.set!,
        getImageData: context.getImageData,
        contextCanvas: global.Object.getOwnPropertyDescriptor(context, 'canvas')!.get!,
        canvasWidth: global.Object.getOwnPropertyDescriptor(canvas, 'width')!.get!,
        canvasHeight: global.Object.getOwnPropertyDescriptor(canvas, 'height')!.get!,
        Proxy: global.Proxy,
        apply: global.Reflect.apply,
        get: global.Reflect.get,
        toPrimitive: global.Symbol.toPrimitive,
        ownKeys: global.Reflect.ownKeys,
        getOwnPropertyDescriptor: global.Reflect.getOwnPropertyDescriptor,
        getPrototypeOf: global.Reflect.getPrototypeOf,
        trunc: global.Math.trunc,
        imageData: global.Object.getOwnPropertyDescriptor(global.ImageData.prototype, 'data')!.get!,
        imageWidth: global.Object.getOwnPropertyDescriptor(global.ImageData.prototype, 'width')!.get!,
        imageHeight: global.Object.getOwnPropertyDescriptor(global.ImageData.prototype, 'height')!.get!,
        // Absence is captured before page code can install a getter on older native ImageData surfaces.
        imageColorSpace: global.Object.getOwnPropertyDescriptor(global.ImageData.prototype, 'colorSpace')?.get
            ?? ((): undefined => undefined),
    };
}

/**
 * Applies the shared protection domain to captured original HTML canvas attributes.
 *
 * @param width Native original width after argument-conversion effects.
 * @param height Native original height after argument-conversion effects.
 *
 * @returns Whether readouts from this original canvas are within size coverage.
 */
export function isCanvasSizeProtected(width: number, height: number): boolean {
    return width <= 32767 && height <= 32767 && width * height <= 268435456;
}

/**
 * Observes a primitive after user conversion, leaving native numeric validation intact.
 *
 * @param value Conversion result.
 * @param native Captured intrinsics for numeric normalization.
 * @param observation Per-call coordinates.
 * @param index Coordinate argument index.
 */
const recordPrimitive = (
    value: unknown,
    native: CanvasNatives,
    observation: NativeArgumentObservation,
    index: number,
): void => {
    if (typeof value !== 'object' && typeof value !== 'function'
        && typeof value !== 'symbol' && typeof value !== 'bigint') {
        observation.coordinates[index] = native.trunc(+(value as number));
    } else if (value === null) {
        observation.coordinates[index] = 0;
    }
};

/**
 * Observes conversion through a fresh carrier without modifying frozen original methods.
 * Native ToPrimitive owns lookup order, fallback and rejection. Firefox-requested
 * diagnostic reflection is forwarded, while brand-specific formatter behavior may differ.
 *
 * @param value Original argument.
 * @param native Captured intrinsics.
 * @param observation Per-call coordinates.
 * @param index Argument index.
 *
 * @returns Argument observed by the native binding.
 */
const observeArgument = (
    value: unknown,
    native: CanvasNatives,
    observation: NativeArgumentObservation,
    index: number,
): unknown => {
    if (value === null || (typeof value !== 'object' && typeof value !== 'function')) {
        recordPrimitive(value, native, observation, index);
        return value;
    }
    let formatting = false;
    return new native.Proxy({}, withoutPrototype({
        get: (_target, property): unknown => {
            if (property === 'toSource') {
                formatting = true;
            }
            const method = native.get(value, property, value);
            const conversionMethod = !formatting
                && (property === native.toPrimitive || property === 'valueOf' || property === 'toString');
            if ((!conversionMethod && property !== 'toSource') || typeof method !== 'function') {
                return method;
            }
            return new native.Proxy(method, withoutPrototype({
                apply: (callable, _receiver, args): unknown => {
                    const primitive = native.apply(callable, value, args);
                    if (conversionMethod) {
                        recordPrimitive(primitive, native, observation, index);
                    }
                    return primitive;
                },
            }));
        },
        ownKeys: (): (string | symbol)[] => native.ownKeys(value),
        getOwnPropertyDescriptor: (_target, property): PropertyDescriptor | undefined => {
            const descriptor = native.getOwnPropertyDescriptor(value, property);
            return descriptor === undefined ? undefined : { ...descriptor, configurable: true };
        },
        getPrototypeOf: (): object | null => native.getPrototypeOf(value),
    }));
};

/**
 * Reads through the browser binding once, modifying only eligible returned bytes.
 * Each invocation owns its observation; nested calls never share bitmap or conversion state.
 *
 * @param native Captured native methods and accessors.
 * @param seed Captured site key.
 *
 * @returns Nonconstructible callable preserving native receiver and argument validation.
 */
export function createGetImageDataWrapper(
    native: CanvasNatives,
    seed: Uint8Array,
): CanvasRenderingContext2D['getImageData'] {
    return new native.Proxy(native.getImageData, withoutPrototype({
        apply: (target, receiver, args): ImageData => {
            const observation: NativeArgumentObservation = withoutPrototype({
                coordinates: withoutPrototype<number[]>([]),
            });
            const observedArgs: unknown[] = withoutPrototype([]);
            for (let index = 0; index < args.length; index += 1) {
                observedArgs[index] = index < 4
                    ? observeArgument(args[index], native, observation, index) : args[index];
            }
            const result = native.apply(target, receiver, observedArgs) as ImageData;
            const canvas = native.apply(native.contextCanvas, receiver, []) as HTMLCanvasElement;
            const data = native.apply(native.imageData, result, []) as Uint8ClampedArray;
            const colorSpace = native.apply(native.imageColorSpace, result, []);
            if (intrinsics.apply(intrinsics.typedTag, data, []) !== 'Uint8ClampedArray'
                || (colorSpace !== undefined && colorSpace !== 'srgb')) {
                return result;
            }
            const sx = observation.coordinates[0];
            const sy = observation.coordinates[1];
            const sw = observation.coordinates[2];
            const sh = observation.coordinates[3];
            observation.originX = sx + intrinsics.min(0, sw);
            observation.originY = sy + intrinsics.min(0, sh);
            observation.canvasWidth = native.apply(native.canvasWidth, canvas, []);
            observation.canvasHeight = native.apply(native.canvasHeight, canvas, []);
            if (!isCanvasSizeProtected(observation.canvasWidth!, observation.canvasHeight!)) {
                return result;
            }
            observation.readout = {
                data,
                width: native.apply(native.imageWidth, result, []),
                height: native.apply(native.imageHeight, result, []),
                originX: observation.originX,
                originY: observation.originY,
                canvasWidth: observation.canvasWidth!,
                canvasHeight: observation.canvasHeight!,
                colorSpace: 'srgb',
            };
            applyCanvasNoise(observation.readout, seed);
            return result;
        },
    }));
}

/**
 * Writes opaque pixels while preserving the copied raster's nonopaque storage.
 * Replaying nonopaque ImageData would quantize native premultiplied values again.
 *
 * @param image Noised pixels whose alpha is unchanged.
 * @param context Private serialization context.
 * @param write Captured context-specific pixel writer.
 * @param native Captured invocation binding.
 */
const writeOpaquePixels = (
    image: ImageData,
    context: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
    write: CanvasRenderingContext2D['putImageData'],
    native: CanvasNatives,
): void => {
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
 * Copies the original bitmap after type conversion into a private serialization receiver.
 * Native frame metadata identifies the export bitmap's mode and dimensions. A bitmap
 * without opaque pixels retains the original serializer's color conversion and profile.
 * Ordinary non-2D owners retain their original native HTML serializer.
 * Firefox transferred placeholders use a private Offscreen owner to preserve publication.
 *
 * @param receiver Original canvas.
 * @param observation Per-call captured bindings, seed and private serialization receiver.
 *
 * @returns The original or private bitmap for the browser serializer.
 *
 * @throws Unexpected browser bitmap preparation errors.
 */
export function prepareCanvasExport(
    receiver: HTMLCanvasElement,
    observation: NativeArgumentObservation,
): HTMLCanvasElement {
    const { native, seed, canvas } = observation.exportContext!;
    let width = native.apply(native.canvasWidth, receiver, []);
    let height = native.apply(native.canvasHeight, receiver, []);
    if (!isCanvasSizeProtected(width, height)) {
        return receiver;
    }
    native.apply(native.setCanvasWidth, canvas, [width]);
    native.apply(native.setCanvasHeight, canvas, [height]);
    if (width === 0 || height === 0) {
        return receiver;
    }
    const context = native.apply(native.getContext, canvas, ['2d']) as CanvasRenderingContext2D;
    native.apply(native.drawImage, context, [receiver, 0, 0]);
    let image: ImageData;
    try {
        image = native.apply(native.getImageData, context, [0, 0, width, height]) as ImageData;
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
    let opaque = false;
    const originalData = native.apply(native.imageData, image, []) as Uint8ClampedArray;
    const originalLength = intrinsics.apply(intrinsics.typedLength, originalData, []) as number;
    for (let index = 3; index < originalLength; index += 4) {
        if (originalData[index] === 255) {
            opaque = true;
            break;
        }
    }
    if (!opaque) {
        return receiver;
    }
    const frame = new native.VideoFrame(receiver, withoutPrototype({ timestamp: 0 }));
    let exportCanvas = canvas;
    let exportContext: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D = context;
    let write = native.putImageData;
    try {
        const color = native.apply(native.frameColorSpace, frame, []) as VideoColorSpace;
        if (native.apply(native.colorPrimaries, color, []) === 'smpte432'
            || native.apply(native.frameFormat, frame, []) === null) {
            return receiver;
        }
        let transferred = false;
        try {
            if (native.apply(native.getContext, receiver, ['2d']) === null) {
                return receiver;
            }
        } catch (error) {
            let name: string;
            try {
                name = native.apply(native.exceptionName, error, []);
            } catch {
                throw error;
            }
            if (name !== 'InvalidStateError') {
                throw error;
            }
            transferred = true;
        }
        const frameWidth = native.apply(native.frameWidth, frame, []);
        const frameHeight = native.apply(native.frameHeight, frame, []);
        if (frameWidth !== width || frameHeight !== height) {
            width = frameWidth;
            height = frameHeight;
            native.apply(native.setCanvasWidth, canvas, [width]);
            native.apply(native.setCanvasHeight, canvas, [height]);
            native.apply(native.drawImage, context, [frame, 0, 0]);
            image = native.apply(native.getImageData, context, [0, 0, width, height]) as ImageData;
        }
        if (native.exportPlatform === 'firefox' && transferred) {
            exportCanvas = native.apply(native.createElement, native.document, ['canvas']) as HTMLCanvasElement;
            native.apply(native.setCanvasWidth, exportCanvas, [width]);
            native.apply(native.setCanvasHeight, exportCanvas, [height]);
            const offscreen = native.apply(native.transferControlToOffscreen, exportCanvas, []) as OffscreenCanvas;
            exportContext = native.apply(
                native.offscreenGetContext,
                offscreen,
                ['2d'],
            ) as OffscreenCanvasRenderingContext2D;
            native.apply(native.offscreenDrawImage, exportContext, [frame, 0, 0]);
            image = native.apply(native.offscreenGetImageData, exportContext, [0, 0, width, height]) as ImageData;
            write = native.offscreenPutImageData;
        }
    } finally {
        native.apply(native.frameClose, frame, []);
    }
    applyCanvasNoise({
        data: native.apply(native.imageData, image, []),
        width,
        height,
        originX: 0,
        originY: 0,
        canvasWidth: width,
        canvasHeight: height,
        colorSpace: 'srgb',
    }, seed);
    writeOpaquePixels(image, exportContext, write, native);
    return exportCanvas;
}

/**
 * One page-owned property lookup and its optional conversion method outcome.
 */
interface ConversionRead {
    readonly property: string | symbol;
    value?: unknown;
    returned?: unknown;
    getThrown?: unknown;
    methodThrown?: unknown;
    getThrows?: boolean;
    methodThrows?: boolean;
}

/**
 * Cached ToPrimitive result for replay through the selected browser binding.
 */
interface StringObservation {
    readonly status: 'primitive' | 'user-throw' | 'rejected';
    readonly primitive?: unknown;
    readonly thrown?: unknown;
    readonly reads: ConversionRead[];
}

/**
 * Identifies an ECMAScript primitive without invoking user conversion.
 *
 * @param value Original value or conversion result.
 *
 * @returns Whether ToPrimitive can return this value.
 */
const isPrimitive = (value: unknown): boolean => (
    value === null || (typeof value !== 'object' && typeof value !== 'function')
);

/**
 * Observes page-owned ToPrimitive once with the DOMString string hint.
 * Failures are cached so the native binding still owns rejection and formatting.
 *
 * @param value Original type argument.
 * @param native Captured conversion operations.
 *
 * @returns Original conversion result or failure and the observed lookup outcomes.
 */
const observeStringArgument = (value: unknown, native: CanvasNatives): StringObservation => {
    const reads: ConversionRead[] = withoutPrototype([]);
    if (isPrimitive(value)) {
        return withoutPrototype({ status: 'primitive', primitive: value, reads });
    }
    const read = (property: string | symbol): ConversionRead => {
        const entry: ConversionRead = withoutPrototype({ property });
        reads[reads.length] = entry;
        try {
            entry.value = native.get(value as object, property, value);
        } catch (error) {
            entry.getThrows = true;
            entry.getThrown = error;
        }
        return entry;
    };
    const call = (entry: ConversionRead, args: unknown[]): void => {
        try {
            entry.returned = native.apply(entry.value as Function, value, args);
        } catch (error) {
            entry.methodThrows = true;
            entry.methodThrown = error;
        }
    };
    const exotic = read(native.toPrimitive);
    if (exotic.getThrows) {
        return withoutPrototype({ status: 'user-throw', thrown: exotic.getThrown, reads });
    }
    if (exotic.value !== undefined && exotic.value !== null) {
        if (typeof exotic.value !== 'function') {
            return withoutPrototype({ status: 'rejected', reads });
        }
        call(exotic, ['string']);
        if (exotic.methodThrows) {
            return withoutPrototype({ status: 'user-throw', thrown: exotic.methodThrown, reads });
        }
        return isPrimitive(exotic.returned)
            ? withoutPrototype({ status: 'primitive', primitive: exotic.returned, reads })
            : withoutPrototype({ status: 'rejected', reads });
    }
    for (let index = 0; index < 2; index += 1) {
        const entry = read(index === 0 ? 'toString' : 'valueOf');
        if (entry.getThrows) {
            return withoutPrototype({ status: 'user-throw', thrown: entry.getThrown, reads });
        }
        if (typeof entry.value === 'function') {
            call(entry, []);
            if (entry.methodThrows) {
                return withoutPrototype({ status: 'user-throw', thrown: entry.methodThrown, reads });
            }
            if (isPrimitive(entry.returned)) {
                return withoutPrototype({ status: 'primitive', primitive: entry.returned, reads });
            }
        }
    }
    return withoutPrototype({ status: 'rejected', reads });
};

/**
 * Replays the cached conversion through native DOMString validation, forwarding
 * browser-requested diagnostic reflection to the unchanged original argument.
 *
 * @param value Original argument.
 * @param observation Its one observed ToPrimitive outcome.
 * @param native Captured reflection operations.
 *
 * @returns Fresh private argument carrier.
 */
const replayStringArgument = (
    value: unknown,
    observation: StringObservation,
    native: CanvasNatives,
): object => {
    let formatting = false;
    return new native.Proxy({}, withoutPrototype({
        get: (_target, property): unknown => {
            if (property === 'toSource') {
                formatting = true;
            }
            if (!formatting && property === native.toPrimitive) {
                if (observation.status === 'primitive') {
                    return (): unknown => observation.primitive;
                }
                if (observation.status === 'user-throw') {
                    return (): never => { throw observation.thrown; };
                }
            }
            let entry: ConversionRead | undefined;
            if (!formatting) {
                for (let index = 0; index < observation.reads.length; index += 1) {
                    if (observation.reads[index].property === property) {
                        entry = observation.reads[index];
                        break;
                    }
                }
            }
            if (entry) {
                if (entry.getThrows) {
                    throw entry.getThrown;
                }
                if (typeof entry.value === 'function') {
                    return (): unknown => {
                        if (entry.methodThrows) {
                            throw entry.methodThrown;
                        }
                        return entry.returned;
                    };
                }
                return entry.value;
            }
            if (isPrimitive(value)) {
                return undefined;
            }
            const reflected = native.get(value as object, property, value);
            if (property === 'toSource' && typeof reflected === 'function') {
                return (...args: unknown[]): unknown => native.apply(reflected, value, args);
            }
            return reflected;
        },
        ownKeys: (): (string | symbol)[] => (isPrimitive(value) ? [] : native.ownKeys(value as object)),
        getOwnPropertyDescriptor: (_target, property): PropertyDescriptor | undefined => {
            const descriptor = isPrimitive(value)
                ? undefined : native.getOwnPropertyDescriptor(value as object, property);
            return descriptor === undefined ? undefined : { ...descriptor, configurable: true };
        },
        getPrototypeOf: (): object | null => (
            isPrimitive(value) ? intrinsics.objectPrototype : native.getPrototypeOf(value as object)
        ),
    }));
};

/**
 * Selects one serialization receiver after observing type conversion exactly once.
 * Invalid receivers and callbacks remain entirely owned by the selected browser binding.
 *
 * @param native Captured browser bindings.
 * @param seed Captured site seed.
 * @param target Selected serializer.
 * @param receiver Original invocation receiver.
 * @param args Original arguments, including unchanged quality and callback.
 * @param typeIndex Position of the MIME type argument.
 *
 * @returns The single selected native call's result.
 */
const exportCanvas = (
    native: CanvasNatives,
    seed: Uint8Array,
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
    const type = args.length > typeIndex ? args[typeIndex] : undefined;
    const converted = observeStringArgument(type, native);
    const observedArgs: unknown[] = withoutPrototype([]);
    for (let index = 0; index < args.length; index += 1) {
        observedArgs[index] = args[index];
    }
    observedArgs[typeIndex] = replayStringArgument(type, converted, native);
    let exportReceiver = receiver;
    if (converted.status === 'primitive' && typeof converted.primitive !== 'symbol') {
        const canvas = native.apply(native.createElement, native.document, ['canvas']) as HTMLCanvasElement;
        const observation: NativeArgumentObservation = withoutPrototype({
            coordinates: withoutPrototype<number[]>([]), exportContext: withoutPrototype({ native, seed, canvas }),
        });
        exportReceiver = prepareCanvasExport(receiver, observation);
    }
    return native.apply(target, exportReceiver, observedArgs);
};

/**
 * Serializes a private pointwise bitmap with native type conversion and encoding.
 *
 * @param native Captured browser bindings.
 * @param seed Captured site seed.
 *
 * @returns Proxy retaining the native callable surface.
 */
export function createToDataURLWrapper(native: CanvasNatives, seed: Uint8Array): HTMLCanvasElement['toDataURL'] {
    return new native.Proxy(native.toDataURL, withoutPrototype({
        apply: (target, receiver, args): string => exportCanvas(native, seed, target, receiver, args, 0) as string,
    }));
}

/**
 * Delivers the browser's one callback from a private call-time bitmap.
 *
 * @param native Captured browser bindings.
 * @param seed Captured site seed.
 *
 * @returns Proxy retaining native callback validation and scheduling.
 */
export function createToBlobWrapper(native: CanvasNatives, seed: Uint8Array): HTMLCanvasElement['toBlob'] {
    return new native.Proxy(native.toBlob, withoutPrototype({
        apply: (target, receiver, args): void => {
            exportCanvas(native, seed, target, receiver, args, 1);
        },
    }));
}
