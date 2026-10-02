/* eslint-disable no-await-in-loop -- Readouts retain their observable call order. */
import { strict as assert } from 'node:assert';

import { referenceSipHash, referenceSourceNoise } from '../../test/e2e/canvas-protection/noise-reference';

import { type BuiltSuiteContext } from './delivery.suite';

/**
 * Built-engine evidence remains incomplete until every mandatory family is exercised.
 */
/**
 * Observable result from the owned browser fixture.
 */
type ObserveTransferredOwnerResult = Promise<
    | {
        owner: string;
        status: string;
        reason: string;
        htmlWidth?: undefined;
        htmlHeight?: undefined;
        sourceWidth?: undefined;
        sourceHeight?: undefined;
        source?: undefined;
        published?: undefined;
        frames?: undefined;
        url?: undefined;
        blob?: undefined;
        callbacks?: undefined;
        callbackSynchronous?: undefined;
        after?: undefined;
        glPixels?: undefined;
        glAfter?: undefined;
        glError?: undefined;
        errors?: undefined;
    }
    | {
        owner: string;
        status: string;
        htmlWidth: number;
        htmlHeight: number;
        sourceWidth: number;
        sourceHeight: number;
        source: number[];
        published: readonly number[];
        frames: number;
        url: { width: number; height: number; pixels: number[] } | null;
        blob: { width: number; height: number; pixels: number[] } | null;
        callbacks: number;
        callbackSynchronous: boolean;
        after: number[];
        glPixels: readonly number[] | null;
        glAfter: readonly number[] | null;
        glError: number | null;
        errors: string[];
        reason?: undefined;
    }
>;

/**
 * Observable result from the owned browser fixture.
 */
type ObserveReadoutBoundsResult = Promise<
    {
        width: number;
        height: number;
        crop: unknown;
        url: unknown;
        blob: unknown;
        callbacks: number;
        callbackSynchronous: boolean;
        mode: string;
        sourcePixel: number[];
        converted: boolean;
        transitions: { api: string; initial: number[]; final: number[]; conversions: number }[];
        inDomain: boolean;
        urlDecoded: unknown;
        blobDecoded: unknown;
        source: unknown;
    }[]
>;

/**
 * Observable result from the owned browser fixture.
 */
type ObserveUnprotectedVectorsResult = Promise<{
    methods: {
        name: 'getImageData' | 'toDataURL' | 'toBlob';
        functionName: string;
        length: number;
        toString: string;
        keys: string[];
        writable: boolean | undefined;
        enumerable: boolean | undefined;
        configurable: boolean | undefined;
    }[];
    pixels: number[];
    workerPixels: readonly number[];
    offscreenExport: { type: string; bytes: number[] };
    exposed: string[];
    otherVectors: {
        audio:
        | 'string'
        | 'number'
        | 'bigint'
        | 'boolean'
        | 'symbol'
        | 'undefined'
        | 'object'
        | 'function';
        rtc:
        | 'string'
        | 'number'
        | 'bigint'
        | 'boolean'
        | 'symbol'
        | 'undefined'
        | 'object'
        | 'function';
        fonts:
        | 'string'
        | 'number'
        | 'bigint'
        | 'boolean'
        | 'symbol'
        | 'undefined'
        | 'object'
        | 'function';
    };
}>;

export const engineCaseNames = [
    'built omitted configuration retains native first reads',
    'built consumer changes representative first-read hash',
    'built consumer diversifies one hundred resolved site contexts',
    'built consumer preserves ordinary export owner coverage',
    'built consumer protects transferred source pixels through native PNG layouts',
    'built consumer keeps oversized original readouts native',
    'keeps frame-local context immutable across unknown top sites',
    'built consumer records masking privacy and unprotected fingerprinting vectors',
    'built consumer classifies actual color space and pixel format readouts',
] as const;

/**
 * Builds the empty-filter configuration used by the actual extension application.
 *
 * @param browser Browser architecture.
 * @param enabled Optional canvas opt-in.
 * @param revision Prepared policy revision.
 *
 * @returns A seed-free consumer configuration.
 */
export const createBuiltConfiguration = (
    browser: BuiltSuiteContext['browser'],
    enabled?: boolean,
    revision = 'built-initial',
): Record<string, unknown> => ({
    ...(browser === 'chromium'
        ? {
            staticFiltersIds: [],
            customFilters: [],
            filtersPath: '/',
            rulesetsPath: '/',
            declarativeLogEnabled: false,
        }
        : { filters: [] }),
    allowlist: [],
    trustedDomains: [],
    userrules: { content: '' },
    verbose: false,
    ...(enabled === undefined
        ? {}
        : {
            canvasProtectionPolicy: {
                schemaVersion: 1,
                revision,
                browser: browser === 'chromium' ? 'chromium-mv3' : 'firefox-mv2',
                selectors: {
                    matches: ['http://127.0.0.1/*', 'http://localhost/*', 'http://*.localhost/*'],
                    excludeMatches: [],
                },
                ownFrameExclusions: [],
                documentExclusions: [],
                unavailableConditions: [],
            },
        }),
    settings: {
        filteringEnabled: true,
        stealthModeEnabled: true,
        collectStats: false,
        debugScriptlets: false,
        allowlistInverted: false,
        allowlistEnabled: false,
        assistantUrl: '/assistant-inject.js',
        ...(browser === 'chromium'
            ? {
                gpcScriptUrl: '/gpc.mv3.js',
                hideDocumentReferrerScriptUrl: '/hide-document-referrer.mv3.js',
            }
            : {}),
        stealth: {
            blockChromeClientData: false,
            hideReferrer: false,
            hideSearchQueries: false,
            sendDoNotTrack: false,
            blockWebRTC: false,
            selfDestructThirdPartyCookies: false,
            selfDestructThirdPartyCookiesTime: 3600,
            selfDestructFirstPartyCookies: false,
            selfDestructFirstPartyCookiesTime: 3600,
            ...(enabled === undefined ? {} : { protectCanvas: enabled }),
        },
    },
});

/**
 * Derives an independent expected bitmap inside the privileged fixture only.
 * Neither the root nor the derived key is returned or sent to a document.
 *
 * @param session Actual captured session from extension storage.
 * @param session.root Private hexadecimal session root.
 * @param session.generation Actual stored session generation.
 * @param host Complete resolved fixture hostname.
 * @param pixels Known native fixture source bytes.
 * @param width Source width.
 * @param height Source height.
 *
 * @returns Independent protected source bytes.
 */
export const createPrivilegedReference = (
    session: { readonly root: string; readonly generation: string },
    host: string,
    pixels: readonly number[],
    width: number,
    height: number,
): readonly number[] => {
    const root = Uint8Array.from(
        Array.from({ length: 16 }, (_value, index) => parseInt(session.root.slice(index * 2, index * 2 + 2), 16)),
    );
    const generation = new TextEncoder().encode(session.generation);
    const site = new TextEncoder().encode(
        host
            .replace(/^www\./, '')
            .replace(/\.$/, '')
            .toLowerCase(),
    );
    const message = new Uint8Array(9 + generation.length + site.length);
    const view = new DataView(message.buffer);
    view.setUint32(1, generation.length, true);
    message.set(generation, 5);
    view.setUint32(5 + generation.length, site.length, true);
    message.set(site, 9 + generation.length);
    const seed = new Uint8Array(16);
    for (let index = 0; index < 2; index += 1) {
        message[0] = 16 + index;
        new DataView(seed.buffer).setBigUint64(index * 8, referenceSipHash(root, message), true);
    }
    return Array.from(
        referenceSourceNoise(
            { data: new Uint8ClampedArray(pixels), width, height } as ImageData,
            seed,
        ),
    );
};

/**
 * Executes the corpus from the page's first synchronous script.
 * This owned fixture records observations; the protection engine has no collector.
 *
 * @param id Fixture identifier.
 * @param collector Local result endpoint.
 * @param count Number of independently constructed bitmaps.
 * @param reads Number of repeated full reads per bitmap.
 *
 * @returns Completion after its observations reach the local collector.
 */
export async function collectBuiltEnginePage(
    id: string,
    collector: string,
    count: number,
    reads: number,
): Promise<void> {
    const nativeGetImageData = CanvasRenderingContext2D.prototype.getImageData;
    const exportUrl = HTMLCanvasElement.prototype.toDataURL;
    const exportBlob = HTMLCanvasElement.prototype.toBlob;
    const installation = Reflect.get(window, '__adguardCanvasInstallation') as
        { outcome: string } | undefined;
    const failures: string[] = [];
    const observations: unknown[] = [];
    let changed = 0;
    let eligible = 0;
    let firstPixel: number[] = [];
    let firstHash = '';
    let firstNativeHash = '';
    let firstPixels: number[] = [];
    let firstAt = 0;
    /**
     * Hashes fixture bytes without depending on implementation hash helpers.
     *
     * @param bytes Observed bitmap bytes.
     *
     * @returns Stable 64-bit fixture hash.
     */
    const hash = (bytes: Uint8ClampedArray): string => {
        let value = 14695981039346656037n;
        for (const byte of bytes) {
            value = BigInt.asUintN(64, (value ^ BigInt(byte)) * 1099511628211n);
        }
        return value.toString(16).padStart(16, '0');
    };
    /**
     * Compares every byte and retains a concrete first mismatch.
     *
     * @param actual Observed bytes.
     * @param expected Independently constructed reference.
     * @param label Observation boundary.
     */
    const equal = (actual: Uint8ClampedArray, expected: Uint8ClampedArray, label: string): void => {
        const index = actual.findIndex((byte, offset) => byte !== expected[offset]);
        if (actual.length !== expected.length || index !== -1) {
            failures.push(`${label}: ${index}, ${actual[index]} != ${expected[index]}`);
        }
    };
    /**
     * Decodes one actual native serializer result through unprotected Offscreen APIs.
     *
     * @param blob Actual callback or data URL result.
     *
     * @returns Decoded default-mode bytes.
     */
    const decode = async (blob: Blob): Promise<Uint8ClampedArray> => {
        const bitmap = await createImageBitmap(blob);
        const scratch = new OffscreenCanvas(bitmap.width, bitmap.height);
        const context = scratch.getContext('2d')!;
        context.drawImage(bitmap, 0, 0);
        bitmap.close();
        return context.getImageData(0, 0, scratch.width, scratch.height).data;
    };
    for (let fixture = 0; fixture < count; fixture += 1) {
        const canvas = document.createElement('canvas');
        canvas.width = 64;
        canvas.height = 64;
        const context = canvas.getContext('2d')!;
        const original = new Uint8ClampedArray(64 * 64 * 4);
        for (let pixel = 0; pixel < 64 * 64; pixel += 1) {
            original[pixel * 4] = (pixel * 7 + fixture * 13) & 255;
            original[pixel * 4 + 1] = (pixel * 31 + fixture * 17) & 255;
            original[pixel * 4 + 2] = (pixel * 3 + fixture * 23) & 255;
            original[pixel * 4 + 3] = 255;
        }
        context.putImageData(new ImageData(original, 64, 64), 0, 0);
        const initial = Reflect.apply(nativeGetImageData, context, [0, 0, 64, 64]).data;
        if (fixture === 0) {
            firstAt = Date.now();
            firstPixel = Array.from(initial.slice(0, 4));
            firstHash = hash(initial);
            firstNativeHash = hash(original);
            firstPixels = Array.from(initial);
            (
                window as typeof window & { canvasFixtureRead?: () => readonly number[] }
            ).canvasFixtureRead = (): number[] => {
                return Array.from(Reflect.apply(nativeGetImageData, context, [0, 0, 64, 64]).data);
            };
        }
        for (let read = 1; read < reads; read += 1) {
            equal(
                Reflect.apply(nativeGetImageData, context, [0, 0, 64, 64]).data,
                initial,
                `repeat-${fixture}-${read}`,
            );
        }
        for (let pixel = 0; pixel < 64 * 64; pixel += 1) {
            let channels = 0;
            for (let channel = 0; channel < 4; channel += 1) {
                const delta = initial[pixel * 4 + channel] - original[pixel * 4 + channel];
                if (delta !== 0) {
                    channels += 1;
                    if (channel === 3 || Math.abs(delta) !== 1) {
                        failures.push(`non-unit-rgb-${fixture}-${pixel}-${channel}`);
                    }
                }
            }
            if (channels > 1) {
                failures.push(`multiple-channels-${fixture}-${pixel}`);
            }
            changed += Number(channels > 0);
            eligible += 1;
        }
        const cropped = Reflect.apply(nativeGetImageData, context, [13, 17, 31, 29]).data;
        for (let row = 0; row < 29; row += 1) {
            equal(
                cropped.subarray(row * 31 * 4, (row + 1) * 31 * 4),
                initial.subarray(((row + 17) * 64 + 13) * 4, ((row + 17) * 64 + 44) * 4),
                `crop-${fixture}-${row}`,
            );
        }
        const url = Reflect.apply(exportUrl, canvas, []);
        const urlPixels = await decode(await (await fetch(url)).blob());
        equal(urlPixels, initial, `data-url-${fixture}`);
        let callbacks = 0;
        let synchronous = true;
        let deliveredSynchronously = false;
        const pendingBlob = new Promise<Blob>((resolve) => {
            Reflect.apply(exportBlob, canvas, [
                (blob: Blob | null): void => {
                    callbacks += 1;
                    deliveredSynchronously = synchronous;
                    if (blob === null) {
                        failures.push(`null-blob-${fixture}`);
                        resolve(new Blob());
                    } else {
                        resolve(blob);
                    }
                },
            ]);
        });
        synchronous = false;
        const blobPixels = await decode(await pendingBlob);
        equal(blobPixels, initial, `blob-${fixture}`);
        if (callbacks !== 1 || deliveredSynchronously) {
            failures.push(`callback-${fixture}-${callbacks}-${deliveredSynchronously}`);
        }
        const source = new OffscreenCanvas(64, 64);
        const sourceContext = source.getContext('2d')!;
        sourceContext.drawImage(canvas, 0, 0);
        equal(sourceContext.getImageData(0, 0, 64, 64).data, original, `source-${fixture}`);
        observations.push({
            fixture,
            width: canvas.width,
            height: canvas.height,
            mode: 'uint8-srgb',
            hash: hash(initial),
            callbacks,
            deliveredSynchronously,
        });
    }
    let topAccessible = false;
    try {
        topAccessible = !!window.top!.location.href;
    } catch {
        /* A cross-origin top remains unavailable. */
    }
    await fetch(collector, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            kind: 'first-read',
            id,
            url: window.location.href,
            origin: window.origin,
            referrer: document.referrer,
            topAccessible,
            pixel: firstPixel,
            at: firstAt,
            documentTimeOrigin: performance.timeOrigin,
            private: null,
            engine: {
                outcome: installation?.outcome ?? null,
                hash: firstHash,
                nativeHash: firstNativeHash,
                pixels: firstPixels,
                changed,
                eligible,
                fixtures: count,
                reads,
                failures,
                observations,
            },
        }),
    });
}

/**
 * Complete observable output from one ordinary canvas owner.
 */
interface OrdinaryOwnerObservation {
    readonly owner: string;
    readonly api: 'url' | 'blob';
    readonly variant: string;
    readonly status: 'unsupported' | 'observed';
    readonly reason?: string;
    readonly creationErrors: readonly string[];
    readonly width?: number;
    readonly height?: number;
    readonly source?: readonly number[];
    readonly beforeBlob?: readonly number[];
    readonly after?: readonly number[];
    readonly url?: {
        readonly width: number;
        readonly height: number;
        readonly pixels: readonly number[];
        readonly type: string;
    } | null;
    readonly blob?: {
        readonly width: number;
        readonly height: number;
        readonly pixels: readonly number[];
        readonly type: string;
    } | null;
    readonly callbacks?: number;
    readonly callbackSynchronous?: boolean;
    readonly typeEffects?: number;
    readonly ownerUnchanged?: boolean;
    readonly glPixels?: readonly number[] | null;
    readonly glState?: unknown;
    readonly glAfter?: unknown;
    readonly nativeErrors?: readonly unknown[];
    readonly gpuImmediate?: {
        readonly before: readonly number[];
        readonly after: readonly number[];
    };
    readonly gpuExpiration?: readonly number[];
}

/**
 * Runs ordinary canvas owners against their actual serializers in one document.
 *
 * @returns Native source, decoded exports and observable owner state.
 */
export async function observeOrdinaryOwners(): Promise<readonly OrdinaryOwnerObservation[]> {
    const entries: OrdinaryOwnerObservation[] = [];
    /**
     * Decodes a browser-produced PNG without using protected HTML readouts.
     *
     * @param blob Actual native export.
     *
     * @returns Its encoded dimensions and complete RGBA.
     */
    const decode = async (
        blob: Blob | null,
    ): Promise<{ width: number; height: number; pixels: number[]; type: string } | null> => {
        if (!blob) {
            return null;
        }
        const image = await createImageBitmap(blob);
        const scratch = new OffscreenCanvas(image.width, image.height);
        const context = scratch.getContext('2d')!;
        context.drawImage(image, 0, 0);
        const value = {
            width: image.width,
            height: image.height,
            pixels: Array.from(context.getImageData(0, 0, image.width, image.height).data),
            type: blob.type,
        };
        image.close();
        return value;
    };
    for (const owner of ['2d', 'webgl', 'webgl2', 'bitmaprenderer', 'webgpu']) {
        for (const api of ['url', 'blob'] as const) {
            for (const variant of [
                'small',
                'opaque',
                'mixed',
                'clamped',
                'type-resize',
                'reentrant',
                'mime-fallback',
                'quality',
                'callback-snapshot',
            ]) {
                const canvas = document.createElement('canvas');
                canvas.width = variant === 'small' ? 1 : 16;
                canvas.height = variant === 'small' ? 1 : 16;
                const creationErrors: string[] = [];
                canvas.addEventListener('webglcontextcreationerror', (event) => creationErrors.push(event.type));
                const context = canvas.getContext(owner as '2d', {
                    preserveDrawingBuffer: true,
                }) as unknown as
                    | CanvasRenderingContext2D
                    | WebGLRenderingContext
                    | WebGL2RenderingContext
                    | ImageBitmapRenderingContext
                    | null;
                if (!context) {
                    entries.push({
                        owner,
                        api,
                        variant,
                        status: 'unsupported',
                        reason: 'Actual getContext returned null',
                        creationErrors,
                    });
                    continue;
                }
                let gpuDevice: { destroy(): void } | undefined;
                let renderGpu: ((mutate?: boolean) => void) | undefined;
                if (owner === 'webgpu') {
                    const { gpu } = navigator as Navigator & {
                        gpu?: {
                            requestAdapter(): Promise<{
                                requestDevice(): Promise<{
                                    queue: {
                                        submit(commands: readonly object[]): void;
                                        onSubmittedWorkDone(): Promise<void>;
                                    };
                                    createCommandEncoder(): {
                                        beginRenderPass(options: unknown): { end(): void };
                                        finish(): object;
                                    };
                                    destroy(): void;
                                }>;
                            } | null>;
                            getPreferredCanvasFormat(): string;
                        };
                    };
                    const adapter = await gpu?.requestAdapter();
                    if (!adapter) {
                        entries.push({
                            owner,
                            api,
                            variant,
                            status: 'unsupported',
                            reason: gpu ? 'Actual adapter unavailable' : 'Actual GPU API unavailable',
                            creationErrors,
                        });
                        continue;
                    }
                    const device = await adapter.requestDevice();
                    gpuDevice = device;
                    document.body.append(canvas);
                    const gpuContext = context as unknown as {
                        configure(options: unknown): void;
                        getCurrentTexture(): { createView(): object };
                    };
                    gpuContext.configure({
                        device,
                        format: gpu!.getPreferredCanvasFormat(),
                        usage: 18,
                        alphaMode: 'premultiplied',
                    });
                    renderGpu = (mutate = false): void => {
                        const encoder = device.createCommandEncoder();
                        const pass = encoder.beginRenderPass({
                            colorAttachments: [
                                {
                                    view: gpuContext.getCurrentTexture().createView(),
                                    clearValue: mutate ? {
                                        r: 111 / 255, g: 123 / 255, b: 135 / 255, a: 1,
                                    } : {
                                        r: variant === 'clamped' ? 0 : 35 / 255,
                                        g: variant === 'clamped' ? 1 : 69 / 255,
                                        b: variant === 'clamped' ? 0 : 103 / 255,
                                        a: variant === 'mixed' ? 0.5 : 1,
                                    },
                                    loadOp: 'clear',
                                    storeOp: 'store',
                                },
                            ],
                        });
                        pass.end();
                        device.queue.submit([encoder.finish()]);
                    };
                }
                let glPixels: readonly number[] | null = null;
                let glState: unknown = null;
                if (owner === '2d') {
                    const two = context as CanvasRenderingContext2D;
                    const pixels = new Uint8ClampedArray(16 * 16 * 4);
                    for (let pixel = 0; pixel < 256; pixel += 1) {
                        pixels.set(
                            variant === 'clamped'
                                ? [0, 255, 0, 255]
                                : [35, 69, 103, variant === 'mixed' && pixel < 128 ? 0 : 255],
                            pixel * 4,
                        );
                    }
                    two.putImageData(new ImageData(pixels, 16, 16), 0, 0);
                } else if (owner.startsWith('webgl')) {
                    const gl = context as WebGLRenderingContext;
                    gl.clearColor(
                        variant === 'clamped' ? 0 : 35 / 255,
                        variant === 'clamped' ? 1 : 69 / 255,
                        variant === 'clamped' ? 0 : 103 / 255,
                        variant === 'mixed' ? 0.5 : 1,
                    );
                    gl.clear(gl.COLOR_BUFFER_BIT);
                    if (variant === 'mixed') {
                        gl.enable(gl.SCISSOR_TEST);
                        gl.scissor(0, 0, 16, 8);
                        gl.clearColor(35 / 255, 69 / 255, 103 / 255, 1);
                        gl.clear(gl.COLOR_BUFFER_BIT);
                    }
                    glPixels = Array.from(new Uint8Array(16 * 16 * 4));
                    const pixels = new Uint8Array(16 * 16 * 4);
                    gl.readPixels(0, 0, 16, 16, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
                    glPixels = Array.from(pixels);
                    glState = {
                        error: gl.getError(),
                        width: gl.drawingBufferWidth,
                        height: gl.drawingBufferHeight,
                    };
                } else if (owner === 'bitmaprenderer') {
                    const source = new OffscreenCanvas(16, 16);
                    const two = source.getContext('2d')!;
                    two.fillStyle = 'rgb(35,69,103)';
                    two.fillRect(0, 0, 16, 16);
                    (context as ImageBitmapRenderingContext).transferFromImageBitmap(
                        source.transferToImageBitmap(),
                    );
                }
                /**
                 * Captures actual source through an unprotected raster boundary.
                 *
                 * @returns Current source pixels.
                 */
                const snapshot = (): number[] => {
                    const scratch = new OffscreenCanvas(canvas.width, canvas.height);
                    const two = scratch.getContext('2d')!;
                    two.drawImage(canvas, 0, 0);
                    return Array.from(two.getImageData(0, 0, canvas.width, canvas.height).data);
                };
                let typeEffects = 0;
                let type: string | { toString(): string } = 'image/png';
                if (variant === 'type-resize') {
                    type = {
                        toString: (): string => {
                            typeEffects += 1; canvas.width = 17; return 'image/png';
                        },
                    };
                } else if (variant === 'reentrant') {
                    type = {
                        toString: (): string => {
                            typeEffects += 1; canvas.toDataURL('image/png'); return 'image/png';
                        },
                    };
                } else if (variant === 'mime-fallback') { type = 'image/x-owned-unsupported'; }
                const quality = variant === 'quality' ? {
                    valueOf: (): number => { typeEffects += 1; return 0.6; },
                } : undefined;
                renderGpu?.();
                const before = snapshot();
                let callbacks = 0;
                let synchronous = true;
                let callbackSynchronous = false;
                let url: string | undefined;
                let pending: Promise<Blob | null> | undefined;
                if (api === 'url') {
                    url = canvas.toDataURL(type as string, quality as unknown as number);
                } else {
                    pending = new Promise<Blob | null>((resolve) => {
                        canvas.toBlob((blob) => {
                            callbacks += 1;
                            callbackSynchronous = synchronous;
                            resolve(blob);
                        }, type as string, quality as unknown as number);
                    });
                }
                // Observe the native source before asynchronous decoders can present a WebGPU frame.
                const source = snapshot();
                const beforeBlob = source;
                synchronous = false;
                if (variant === 'callback-snapshot' && api === 'blob') {
                    if (owner === '2d') {
                        (context as CanvasRenderingContext2D).fillStyle = 'rgb(111,123,135)';
                        (context as CanvasRenderingContext2D).fillRect(0, 0, canvas.width, canvas.height);
                    } else if (owner.startsWith('webgl')) {
                        const gl = context as WebGLRenderingContext;
                        gl.clearColor(111 / 255, 123 / 255, 135 / 255, 1);
                        gl.clear(gl.COLOR_BUFFER_BIT);
                    } else if (owner === 'bitmaprenderer') {
                        const replacement = new OffscreenCanvas(canvas.width, canvas.height);
                        const two = replacement.getContext('2d')!;
                        two.fillStyle = 'rgb(111,123,135)';
                        two.fillRect(0, 0, canvas.width, canvas.height);
                        (context as ImageBitmapRenderingContext).transferFromImageBitmap(
                            replacement.transferToImageBitmap(),
                        );
                    } else {
                        renderGpu!(true);
                    }
                }
                const after = snapshot();
                let glAfter: unknown = null;
                if (owner.startsWith('webgl')) {
                    const gl = context as WebGLRenderingContext;
                    const pixels = new Uint8Array(gl.drawingBufferWidth * gl.drawingBufferHeight * 4);
                    gl.readPixels(
                        0,
                        0,
                        gl.drawingBufferWidth,
                        gl.drawingBufferHeight,
                        gl.RGBA,
                        gl.UNSIGNED_BYTE,
                        pixels,
                    );
                    glAfter = {
                        pixels: Array.from(pixels),
                        error: gl.getError(),
                        width: gl.drawingBufferWidth,
                        height: gl.drawingBufferHeight,
                    };
                }
                const ownerUnchanged = canvas.getContext(owner as '2d') === context;
                const urlDecoded = url === undefined ? undefined : await decode(await (await fetch(url)).blob());
                const blobDecoded = pending === undefined ? undefined : await decode(await pending);
                const nativeErrors = [];
                for (const method of ['toDataURL', 'toBlob'] as const) {
                    let conversions = 0;
                    let error: unknown;
                    try {
                        const invalidType = {
                            toString: (): string => {
                                conversions += 1;
                                throw new RangeError('Owned conversion failure');
                            },
                        };
                        if (method === 'toDataURL') {
                            canvas.toDataURL(invalidType as unknown as string);
                        } else {
                            canvas.toBlob(() => undefined, invalidType as unknown as string);
                        }
                    } catch (value) {
                        const exception = value as Error;
                        error = { name: exception.name, message: exception.message };
                    }
                    nativeErrors.push({ method, conversions, error });
                }
                entries.push({
                    owner,
                    api,
                    variant,
                    status: 'observed',
                    width: canvas.width,
                    height: canvas.height,
                    source,
                    beforeBlob,
                    after,
                    url: urlDecoded,
                    blob: blobDecoded,
                    callbacks,
                    callbackSynchronous,
                    typeEffects,
                    ownerUnchanged,
                    glPixels,
                    glState,
                    glAfter,
                    nativeErrors,
                    gpuImmediate: renderGpu ? {
                        before,
                        after: source,
                    } : undefined,
                    gpuExpiration: renderGpu ? snapshot() : undefined,
                    creationErrors,
                });
                gpuDevice?.destroy();
                canvas.remove();
            }
        }
    }
    return entries;
}

/**
 * Requires independent exporter observations and observable conversion/snapshot effects.
 *
 * @param entries Actual browser observations, including unsupported native owners.
 */
export const assertOrdinaryOwnerCoverage = (entries: readonly OrdinaryOwnerObservation[]): void => {
    for (const owner of ['2d', 'webgl', 'webgl2', 'bitmaprenderer', 'webgpu']) {
        for (const api of ['url', 'blob'] as const) {
            const rows = entries.filter((entry) => entry.owner === owner && entry.api === api);
            assert.equal(rows.length, 9, `${owner}/${api}: independently initialized exporter cases`);
            for (const row of rows) {
                if (row.status === 'unsupported') {
                    continue;
                }
                assert.equal(
                    row.typeEffects,
                    ['type-resize', 'reentrant'].includes(row.variant) ? 1 : 0,
                    `${owner}/${api}/${row.variant}: actual conversion count`,
                );
                if (row.variant === 'type-resize') {
                    assert.equal(row.width, 17, `${owner}/${api}: conversion resized this source`);
                }
                assert.equal(row[api]!.type, 'image/png', `${owner}/${api}/${row.variant}: MIME`);
                if (api === 'blob' && row.variant === 'callback-snapshot') {
                    assert.notDeepEqual(row.after, row.beforeBlob, `${owner}: actual post-call mutation`);
                    if (owner !== '2d') {
                        assert.deepEqual(row.blob!.pixels, row.beforeBlob, `${owner}: native call-time snapshot`);
                    }
                }
            }
        }
    }
};

/**
 * Compares actual ordinary owners with native controls from the same browser.
 *
 * @param context Built consumer command and document transport.
 *
 * @returns Completion after exact native owner and independently protected byte comparisons.
 */
export const verifyOrdinaryOwners = async (context: BuiltSuiteContext): Promise<void> => {
    await context.command({
        id: 'owners-native-disable',
        operation: 'consumer-configure',
        configuration: createBuiltConfiguration(context.browser, false, 'owners-native'),
    });
    await context.read('owners-native');
    const script = `const __name=(value)=>value; return (${observeOrdinaryOwners.toString()})();`;
    const native = await context.evaluate<readonly OrdinaryOwnerObservation[]>(
        context.browser === 'chromium' ? `(()=>{${script}})()` : script,
    );
    await context.command({
        id: 'owners-protected-enable',
        operation: 'consumer-configure',
        configuration: createBuiltConfiguration(context.browser, true, 'owners-protected'),
    });
    await context.read('owners-protected');
    const protectedEntries = await context.evaluate<readonly OrdinaryOwnerObservation[]>(
        context.browser === 'chromium' ? `(()=>{${script}})()` : script,
    );
    assertOrdinaryOwnerCoverage(native);
    assertOrdinaryOwnerCoverage(protectedEntries);
    for (let index = 0; index < native.length; index += 1) {
        const baseline = native[index];
        const actual = protectedEntries[index];
        assert.equal(actual.owner, baseline.owner);
        assert.equal(actual.api, baseline.api);
        assert.equal(actual.status, baseline.status);
        if (actual.status === 'unsupported') {
            continue;
        }
        assert.equal(actual.callbacks, actual.api === 'blob' ? 1 : 0);
        assert.equal(actual.ownerUnchanged, true);
        assert.equal(actual.callbackSynchronous, false);
        assert.deepEqual(actual.creationErrors, []);
        for (const field of [
            'source',
            'beforeBlob',
            'after',
            'width',
            'height',
            'typeEffects',
            'ownerUnchanged',
            'glState',
            'glPixels',
            'glAfter',
            'nativeErrors',
            'gpuImmediate',
        ] as const) {
            assert.deepEqual(
                actual[field],
                baseline[field],
                `${actual.owner}/${actual.variant}/${field}`,
            );
        }
        if (actual.owner !== '2d') {
            assert.deepEqual(
                actual.url,
                baseline.url,
                `${actual.owner}/${actual.variant}/native URL`,
            );
            assert.deepEqual(
                actual.blob,
                baseline.blob,
                `${actual.owner}/${actual.variant}/native Blob`,
            );
        } else {
            for (const [api, sourceField] of [
                ['url', 'source'],
                ['blob', 'beforeBlob'],
            ] as const) {
                if (actual.api !== api) {
                    continue;
                }
                const expected = await context.command({
                    id: `owner-oracle-${index}-${api}`,
                    operation: 'consumer-oracle',
                    host: '127.0.0.1',
                    pixels: baseline[sourceField]!,
                    width: baseline.width!,
                    height: baseline.height!,
                });
                assert.equal(expected.status, 'succeeded', JSON.stringify(expected));
                assert.deepEqual(
                    actual[api]!.pixels,
                    (expected.value as { result: { pixels: readonly number[] } }).result.pixels,
                    `2d/${actual.variant}/${api}`,
                );
            }
        }
    }
    context.cases.push({
        name: engineCaseNames[3],
        status: 'passed',
        reason: 'Native owners, protected 2D oracle, source/state preservation and callback snapshots',
        evidence: {
            native,
            protected: protectedEntries,
            nativeFingerprintOwnerGap: ['webgl', 'webgl2', 'bitmaprenderer'],
            webgpu: 'Actual native adapter request; rendering and original-native exports compared when available',
        },
    });
};

/**
 * Records actual child-local behavior without inventing inherited top metadata.
 *
 * @param context Built consumer and owned document transport.
 *
 * @returns Completion after actual same/cross-origin local context assertions.
 */
export const verifyFrameLocalContexts = async (context: BuiltSuiteContext): Promise<void> => {
    const results = [];
    for (const host of ['127.0.0.1', 'site-1.localhost', 'site-2.localhost']) {
        const observation = await context.read(`frame-local-${host}`, {
            route: '/engine-frame',
            host,
        });
        assert.equal(new URL(observation.url).hostname, '127.0.0.1');
        assert.deepEqual(observation.engine!.failures, []);
        assert.equal(observation.engine!.outcome, 'installed');
        assert.equal(observation.topAccessible, host === '127.0.0.1');
        results.push({
            topHost: host,
            capturedTopGeneration: 'unavailable',
            capturedTopRevision: 'unavailable',
            inheritedCoverage: 'unavailable',
            protocol: 'HTTP',
            observation,
        });
    }
    assert.deepEqual(results[1].observation.engine!.pixels, results[0].observation.engine!.pixels);
    assert.deepEqual(results[2].observation.engine!.pixels, results[0].observation.engine!.pixels);
    const excluded = createBuiltConfiguration(context.browser, true, 'frame-source-excluded');
    const policy = excluded.canvasProtectionPolicy as { selectors: { excludeMatches: string[] } };
    policy.selectors.excludeMatches = ['http://127.0.0.1/*'];
    const acknowledgment = await context.command({
        id: 'frame-source-exclusion',
        operation: 'consumer-configure',
        configuration: excluded,
    });
    assert.equal(acknowledgment.status, 'succeeded', JSON.stringify(acknowledgment));
    const native = await context.read('frame-excluded-local', {
        route: '/engine-frame',
        host: 'site-1.localhost',
    });
    assert.equal(native.engine!.hash, native.engine!.nativeHash);
    context.cases.push({
        name: engineCaseNames[6],
        status: 'passed',
        reason: 'Stable frame-local output and exact source exclusion; inherited metadata unavailable',
        evidence: {
            results,
            acknowledgment,
            native,
            trustedTopChannel: 'unavailable',
            lateReply: 'No production trusted channel exists',
        },
    });
};

/**
 * Captures a transferred owner's native source and both actual HTML encoders.
 *
 * @param owner Native transferred context.
 * @param expected Independent opaque reference bitmap, if this is the native serializer stage.
 * @param mixed Whether half the source has native nonopaque alpha.
 *
 * @returns Complete source, layout, callback and exporter observations.
 */
export async function observeTransferredOwner(
    owner: string,
    expected?: readonly number[],
    mixed = false,
): ObserveTransferredOwnerResult {
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    document.body.append(canvas);
    const offscreen = canvas.transferControlToOffscreen();
    offscreen.width = 32;
    offscreen.height = 24;
    const context = offscreen.getContext(owner as '2d', { preserveDrawingBuffer: true });
    if (!context) {
        return {
            owner,
            status: 'unsupported',
            reason: 'Actual transferred getContext returned null',
        };
    }
    const nextFrame = window.requestAnimationFrame.bind(window);
    const errors: string[] = [];
    canvas.addEventListener('webglcontextcreationerror', (event) => errors.push(event.type));
    let glPixels: readonly number[] | null = null;
    if (owner === '2d') {
        const two = context as OffscreenCanvasRenderingContext2D;
        const pixels = expected
            ?? Array.from({ length: 32 * 24 * 4 }, (_value, offset) => {
                if (offset % 4 !== 3) { return [35, 69, 103][offset % 4]; }
                return mixed && offset < 32 * 12 * 4 ? 128 : 255;
            });
        two.putImageData(new ImageData(new Uint8ClampedArray(pixels), 32, 24), 0, 0);
    } else {
        const gl = context as unknown as WebGLRenderingContext;
        gl.clearColor(35 / 255, 69 / 255, 103 / 255, mixed ? 0.5 : 1);
        gl.clear(gl.COLOR_BUFFER_BIT);
        gl.enable(gl.SCISSOR_TEST);
        gl.scissor(0, 0, 32, 12);
        gl.clearColor(152 / 255, 118 / 255, 84 / 255, 1);
        gl.clear(gl.COLOR_BUFFER_BIT);
        const pixels = new Uint8Array(32 * 24 * 4);
        gl.readPixels(0, 0, 32, 24, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
        glPixels = Array.from(pixels);
    }
    /**
     * Reads transferred source coordinates through unprotected Offscreen raster APIs.
     *
     * @param source Native published or source raster.
     *
     * @returns Complete source-coordinate RGBA.
     */
    const snapshot = (source: CanvasImageSource): number[] => {
        const scratch = new OffscreenCanvas(32, 24);
        const two = scratch.getContext('2d')!;
        two.drawImage(source, 0, 0);
        return Array.from(two.getImageData(0, 0, 32, 24).data);
    };
    // Reading an Offscreen WebGL bitmap before publication can prevent its pending
    // placeholder update in Chromium, so source inspection follows native publication.
    for (let attempt = 0; attempt < 8 && (canvas.width !== 32 || canvas.height !== 24); attempt += 1) {
        await new Promise<void>((resolve) => {
            nextFrame(() => resolve());
        });
    }
    const sourceRaster = new OffscreenCanvas(32, 24);
    const sourceRasterContext = sourceRaster.getContext('2d')!;
    sourceRasterContext.drawImage(offscreen, 0, 0);
    const source = Array.from(sourceRasterContext.getImageData(0, 0, 32, 24).data);
    let published: readonly number[] = [];
    let frames = 0;
    for (; frames < 8; frames += 1) {
        await new Promise<void>((resolve) => {
            nextFrame(() => resolve());
        });
        const frame = new VideoFrame(canvas, { timestamp: 0 });
        published = snapshot(frame);
        frame.close();
        if (JSON.stringify(published) === JSON.stringify(source)) {
            break;
        }
    }
    if (JSON.stringify(published) !== JSON.stringify(source)) {
        Reflect.set(window, 'canvasFixtureTransferredFailure', {
            owner,
            mixed,
            htmlWidth: canvas.width,
            htmlHeight: canvas.height,
            sourceWidth: offscreen.width,
            sourceHeight: offscreen.height,
            frames,
            source,
            published,
            glPixels,
        });
        const difference = source.findIndex((value, offset) => value !== published[offset]);
        throw new Error(
            `Transferred ${owner}/${mixed ? 'mixed' : 'opaque'} source never matched native publication;`
                + ` frames=${frames} html=${canvas.width}x${canvas.height} firstChannel=${difference}`,
        );
    }
    /**
     * Decodes the actual native serializer layout through an unprotected API.
     *
     * @param blob Actual native encoder output.
     *
     * @returns Its exact encoded dimensions and complete RGBA.
     */
    const decode = async (
        blob: Blob | null,
    ): Promise<{ width: number; height: number; pixels: number[] } | null> => {
        if (!blob) {
            return null;
        }
        const image = await createImageBitmap(blob);
        const scratch = new OffscreenCanvas(image.width, image.height);
        const two = scratch.getContext('2d')!;
        two.drawImage(image, 0, 0);
        const result = {
            width: image.width,
            height: image.height,
            pixels: Array.from(two.getImageData(0, 0, image.width, image.height).data),
        };
        image.close();
        return result;
    };
    const url = await decode(await (await fetch(canvas.toDataURL())).blob());
    let callbacks = 0;
    let synchronous = true;
    let callbackSynchronous = false;
    const pending = new Promise<Blob | null>((resolve) => {
        canvas.toBlob((blob) => {
            callbacks += 1;
            callbackSynchronous = synchronous;
            resolve(blob);
        });
    });
    synchronous = false;
    const blob = await decode(await pending);
    const after = snapshot(offscreen);
    let glAfter: readonly number[] | null = null;
    let glError: number | null = null;
    if (owner !== '2d') {
        const gl = context as unknown as WebGLRenderingContext;
        const pixels = new Uint8Array(32 * 24 * 4);
        gl.readPixels(0, 0, 32, 24, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
        glAfter = Array.from(pixels);
        glError = gl.getError();
    }
    (
        window as typeof window & {
            canvasFixtureReference?: (pixels: readonly number[]) => Promise<unknown>;
        }
    ).canvasFixtureReference = async (pixels): Promise<unknown> => {
        const frame = document.createElement('iframe');
        const loaded = new Promise<void>((resolve) => {
            frame.onload = (): void => resolve();
        });
        frame.src = '/native-reference';
        document.body.append(frame);
        await loaded;
        const realm = frame.contentWindow!;
        const reference = realm.document.createElement('canvas');
        reference.width = canvas.width;
        reference.height = canvas.height;
        realm.document.body.append(reference);
        const referenceOffscreen = reference.transferControlToOffscreen();
        referenceOffscreen.width = 32;
        referenceOffscreen.height = 24;
        const referenceContext = referenceOffscreen.getContext('2d')!;
        referenceContext.drawImage(sourceRaster, 0, 0);
        for (let pixel = 0; pixel < 32 * 24; pixel += 1) {
            const offset = pixel * 4;
            if (
                pixels
                    .slice(offset, offset + 4)
                    .some((value, channel) => value !== source[offset + channel])
            ) {
                if (source[offset + 3] !== 255) {
                    throw new Error('Independent oracle changed a nonopaque source pixel');
                }
                referenceContext.putImageData(
                    new ImageData(new Uint8ClampedArray(pixels.slice(offset, offset + 4)), 1, 1),
                    pixel % 32,
                    Math.floor(pixel / 32),
                );
            }
        }
        const expectedSource = Array.from(referenceContext.getImageData(0, 0, 32, 24).data);
        let nativePublished: readonly number[] = [];
        for (let attempt = 0; attempt < 8; attempt += 1) {
            await new Promise<void>((resolve) => {
                nextFrame(() => resolve());
            });
            const publishedFrame = new VideoFrame(reference, { timestamp: 0 });
            nativePublished = snapshot(publishedFrame);
            publishedFrame.close();
            if (JSON.stringify(nativePublished) === JSON.stringify(expectedSource)) {
                break;
            }
        }
        if (JSON.stringify(nativePublished) !== JSON.stringify(expectedSource)) {
            throw new Error(
                'Native reference publication never matched independently protected source',
            );
        }
        const nativeUrl = await decode(await (await fetch(reference.toDataURL())).blob());
        const nativeBlob = await decode(
            await new Promise<Blob | null>((resolve) => {
                reference.toBlob(resolve);
            }),
        );
        const outcome = Reflect.get(realm, '__adguardCanvasInstallation') ?? null;
        const result = {
            source: expectedSource,
            published: nativePublished,
            url: nativeUrl,
            blob: nativeBlob,
            outcome,
            htmlWidth: reference.width,
            htmlHeight: reference.height,
        };
        frame.remove();
        return result;
    };
    canvas.remove();
    return {
        owner,
        status: 'observed',
        htmlWidth: canvas.width,
        htmlHeight: canvas.height,
        sourceWidth: offscreen.width,
        sourceHeight: offscreen.height,
        source,
        published,
        frames,
        url,
        blob,
        callbacks,
        callbackSynchronous,
        after,
        glPixels,
        glAfter,
        glError,
        errors,
    };
}

/**
 * Verifies independently protected transferred coordinates through actual native layouts.
 *
 * @param context Actual built application and document transport.
 *
 * @returns Completion after each available transferred native owner.
 */
export const verifyTransferredOwners = async (context: BuiltSuiteContext): Promise<void> => {
    const cases = [];
    for (const owner of ['2d', 'webgl', 'webgl2']) {
        for (const mixed of [false, true]) {
            const configuration = createBuiltConfiguration(
                context.browser,
                true,
                'transferred-protected',
            );
            (
                configuration.canvasProtectionPolicy as { selectors: { excludeMatches: string[] } }
            ).selectors.excludeMatches = ['http://127.0.0.1/native-reference*'];
            await context.command({
                id: `transferred-enable-${owner}-${mixed}`,
                operation: 'consumer-configure',
                configuration,
            });
            await context.read(`transferred-protected-${owner}-${mixed}`);
            const operation = `(${observeTransferredOwner.toString()})(${JSON.stringify(owner)},undefined,${mixed})`;
            const actual = await context.evaluate<
                Awaited<ReturnType<typeof observeTransferredOwner>>
            >(
                context.browser === 'chromium'
                    ? `(()=>{const __name=(value)=>value; return ${operation};})()`
                    : `const __name=(value)=>value; return ${operation};`,
            );
            if (actual.status === 'unsupported') {
                cases.push({ owner, mixed, actual });
                continue;
            }
            assert.deepEqual(actual.source, actual.after);
            assert.deepEqual(actual.source, actual.published);
            assert.deepEqual(actual.glPixels, actual.glAfter);
            assert.ok(actual.glError === null || actual.glError === 0);
            assert.deepEqual(actual.errors, []);
            assert.equal(actual.callbacks, 1);
            assert.equal(actual.callbackSynchronous, false);
            const oracle = await context.command({
                id: `transferred-oracle-${owner}-${mixed}`,
                operation: 'consumer-oracle',
                host: '127.0.0.1',
                pixels: actual.source!,
                width: 32,
                height: 24,
            });
            assert.equal(oracle.status, 'succeeded', JSON.stringify(oracle));
            const expected = (
                oracle.value as {
                    result: { pixels: readonly number[]; generation: string; revision: string };
                }
            ).result;
            assert.notDeepEqual(expected.pixels, actual.source);
            const referenceCall = `window.canvasFixtureReference(${JSON.stringify(expected.pixels)})`;
            const reference = await context.evaluate<{
                source: readonly number[];
                published: readonly number[];
                url: unknown;
                blob: unknown;
                outcome: unknown;
                htmlWidth: number;
                htmlHeight: number;
            }>(
                context.browser === 'chromium'
                    ? referenceCall
                    : `return window.canvasFixtureReference(${JSON.stringify(expected.pixels)});`,
            );
            assert.equal(reference.outcome, null);
            assert.deepEqual(reference.source, expected.pixels);
            assert.deepEqual(reference.published, expected.pixels);
            assert.deepEqual(
                actual.url,
                reference.url,
                `${owner}/${mixed} URL native serializer stage`,
            );
            assert.deepEqual(
                actual.blob,
                reference.blob,
                `${owner}/${mixed} Blob native serializer stage`,
            );
            assert.equal(reference.htmlWidth, actual.htmlWidth);
            assert.equal(reference.htmlHeight, actual.htmlHeight);
            cases.push({
                owner,
                mixed,
                actual,
                oracle: {
                    ...oracle,
                    value: {
                        ...(oracle.value as object),
                        result: { generation: expected.generation, revision: expected.revision },
                    },
                },
                reference,
                sourceOracle:
                    'Independent BigInt SipHash/source sampler using private actual snapshot',
                serializerOracle:
                    'Native transferred serializer retains premultiplied raster; only opaque selected pixels written',
            });
        }
    }
    context.cases.push({
        name: engineCaseNames[4],
        status: 'passed',
        reason: 'Opaque/mixed transferred 2D/WebGL source, independent noise and full native layouts',
        evidence: { cases },
    });
};

/**
 * Exercises original canvas bounds through native results, crops and callbacks.
 *
 * @returns Actual original sizes, native errors/results and callback ordering.
 */
export async function observeReadoutBounds(): ObserveReadoutBoundsResult {
    const results = [];
    const decodeBitmap = window.createImageBitmap.bind(window);
    for (const [width, height, converted, initialWidth = 16, initialHeight = 16] of [
        [32767, 1, false], [1, 32767, false], [16384, 16384, false],
        [32768, 1, false], [1, 32768, false], [16385, 16384, false],
        [32767, 1, true], [32768, 1, true], [1, 32768, true], [16385, 16384, true],
        [32767, 1, true, 32768, 1], [1, 32767, true, 1, 32768],
        [16384, 16384, true, 16385, 16384],
    ] as const) {
        const cropWidth = height === 1 ? width : Math.min(width, 32);
        const cropHeight = width === 1 ? height : Math.min(height, 32);
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d')!;
        const resize = (): void => {
            canvas.width = width;
            canvas.height = height;
            context.fillStyle = 'rgb(35,69,103)';
            context.fillRect(0, 0, cropWidth, cropHeight);
        };
        let conversions = 0;
        const transitions = [];
        /**
         * Restores the original dimensions before each independently observed readout.
         *
         * @returns Native dimensions immediately before argument conversion.
         */
        const reset = (): number[] => {
            conversions = 0;
            if (converted) {
                canvas.width = initialWidth;
                canvas.height = initialHeight;
            } else {
                resize();
            }
            return [canvas.width, canvas.height];
        };
        const error = (exception: unknown): { name: string; message: string } => ({
            name: (exception as Error).name, message: (exception as Error).message,
        });
        const decode = async (value: Blob): Promise<unknown> => {
            const bitmap = await decodeBitmap(value);
            const target = new OffscreenCanvas(cropWidth, cropHeight);
            const reader = target.getContext('2d')!;
            reader.drawImage(bitmap, 0, 0);
            const observation = {
                width: bitmap.width,
                height: bitmap.height,
                pixels: Array.from(reader.getImageData(0, 0, target.width, target.height).data),
            };
            bitmap.close();
            return observation;
        };
        let crop: unknown; let url: unknown; let blob: unknown;
        let urlDecoded: unknown; let blobDecoded: unknown;
        let callbacks = 0; let synchronous = true; let callbackSynchronous = false;
        const argument = { valueOf: (): number => { conversions += 1; resize(); return 0; } };
        const type = { toString: (): string => { conversions += 1; resize(); return 'image/png'; } };
        const rawInitial = reset();
        try {
            crop = Array.from(context.getImageData(
                converted ? argument as unknown as number : 0,
                0,
                cropWidth,
                cropHeight,
            ).data);
        } catch (exception) { crop = error(exception); }
        transitions.push({
            api: 'getImageData', initial: rawInitial, final: [canvas.width, canvas.height], conversions,
        });
        const urlInitial = reset();
        try {
            url = canvas.toDataURL(converted ? type as unknown as string : 'image/png');
            if (typeof url === 'string' && url !== 'data:,') {
                urlDecoded = await decode(await (await fetch(url)).blob());
            }
        } catch (exception) { url = error(exception); }
        transitions.push({
            api: 'toDataURL', initial: urlInitial, final: [canvas.width, canvas.height], conversions,
        });
        const blobInitial = reset();
        try {
            const result = new Promise<Blob | null>((resolve) => {
                canvas.toBlob(
                    (value) => { callbacks += 1; callbackSynchronous = synchronous; resolve(value); },
                    converted ? type as unknown as string : 'image/png',
                );
            });
            synchronous = false;
            const value = await result;
            blob = value ? { type: value.type, bytes: Array.from(new Uint8Array(await value.arrayBuffer())) } : null;
            if (value) { blobDecoded = await decode(value); }
        } catch (exception) { blob = error(exception); }
        transitions.push({
            api: 'toBlob', initial: blobInitial, final: [canvas.width, canvas.height], conversions,
        });
        const copied = new OffscreenCanvas(cropWidth, cropHeight);
        const copiedContext = copied.getContext('2d')!;
        let source: unknown;
        try {
            copiedContext.drawImage(canvas, 0, 0);
            source = Array.from(copiedContext.getImageData(0, 0, copied.width, copied.height).data);
        } catch (exception) { source = error(exception); }
        results.push({
            width: canvas.width,
            height: canvas.height,
            converted,
            transitions,
            inDomain: width <= 32767 && height <= 32767 && width * height <= 2 ** 28,
            crop,
            url,
            blob,
            urlDecoded,
            blobDecoded,
            source,
            callbacks,
            callbackSynchronous,
            mode: 'uint8-srgb',
            sourcePixel: [35, 69, 103, 255],
        });
        canvas.width = 0; canvas.height = 0;
    }
    return results;
}

/**
 * Observes native returned modes rather than inferring coverage from context options.
 *
 * @returns Complete raw results, native exceptions and source-preservation evidence.
 */
export async function observeReadoutModes(): Promise<{
    storage: string;
    settings: unknown;
    attributes: unknown;
    observations: { metadata?: { array: string; colorSpace: string | undefined;
        colorSpaceType: string; colorSpacePresent: boolean; pixelFormat: unknown;
        pixelFormatType: string; pixelFormatPresent: boolean; };
    pixels?: number[]; error?: { name: string; message: string }; effects: string[]; }[];
    sourceBefore: number[];
    sourceAfter: number[];
}[]> {
    const entries = [];
    for (const storage of ['default', 'display-p3', 'float16']) {
        const canvas = document.createElement('canvas');
        canvas.width = 32;
        canvas.height = 24;
        const options = {
            default: {}, 'display-p3': { colorSpace: 'display-p3' }, float16: { colorType: 'float16' },
        }[storage]!;
        const two = canvas.getContext('2d', options as CanvasRenderingContext2DSettings)!;
        two.fillStyle = '#234567';
        two.fillRect(0, 0, 32, 24);
        const scratch = new OffscreenCanvas(32, 24);
        const scratchContext = scratch.getContext('2d')!;
        /**
         * Samples the original raster through an uncovered Offscreen readout.
         *
         * @returns Full native source pixels.
         */
        const source = (): number[] => {
            scratchContext.clearRect(0, 0, 32, 24);
            scratchContext.drawImage(canvas, 0, 0);
            return Array.from(scratchContext.getImageData(0, 0, 32, 24).data);
        };
        for (const settings of [undefined, {}, { colorSpace: 'srgb' }, { colorSpace: 'display-p3' },
            { pixelFormat: 'rgba-float16' }, { colorSpace: 'display-p3', pixelFormat: 'rgba-float16' },
            { colorSpace: 'invalid' }, { pixelFormat: 'invalid' }]) {
            const sourceBefore = source();
            const observations = [];
            for (let repeat = 0; repeat < 2; repeat += 1) {
                const effects: string[] = [];
                const converted = settings === undefined ? undefined : Object.fromEntries(
                    Object.keys(settings).map((key) => [key, undefined]),
                );
                if (converted) {
                    for (const key of Object.keys(settings!)) {
                        Object.defineProperty(converted, key, {
                            get: () => {
                                effects.push(key);
                                return Reflect.get(settings!, key);
                            },
                        });
                    }
                }
                try {
                    const result = Reflect.apply(two.getImageData, two, [0, 0, 32, 24, converted]) as ImageData;
                    observations.push({
                        metadata: {
                            array: result.data.constructor.name,
                            colorSpace: result.colorSpace,
                            colorSpaceType: typeof result.colorSpace,
                            colorSpacePresent: Reflect.has(result, 'colorSpace'),
                            pixelFormat: Reflect.get(result, 'pixelFormat'),
                            pixelFormatType: typeof Reflect.get(result, 'pixelFormat'),
                            pixelFormatPresent: Reflect.has(result, 'pixelFormat'),
                        },
                        pixels: Array.from(result.data),
                        effects,
                    });
                } catch (error) {
                    const native = error as Error;
                    observations.push({ error: { name: native.name, message: native.message }, effects });
                }
            }
            entries.push({
                storage,
                settings,
                attributes: two.getContextAttributes(),
                observations,
                sourceBefore,
                sourceAfter: source(),
            });
        }
    }
    return entries;
}

/**
 * Compares each actual native result with the built consumer and an independent bitmap oracle.
 *
 * @param context Owned built extension and browser transport.
 *
 * @returns Completion after every requested and actual mode is recorded.
 */
export const verifyReadoutModes = async (context: BuiltSuiteContext): Promise<void> => {
    await context.command({
        id: 'modes-native-disable',
        operation: 'consumer-configure',
        configuration: createBuiltConfiguration(context.browser, false, 'modes-native'),
    });
    await context.read('modes-native');
    const invoke = `const __name = value => value; return (${observeReadoutModes.toString()})();`;
    const script = context.browser === 'chromium' ? `(()=>{${invoke}})()` : invoke;
    const native = await context.evaluate<Awaited<ReturnType<typeof observeReadoutModes>>>(script);
    await context.command({
        id: 'modes-protected-enable',
        operation: 'consumer-configure',
        configuration: createBuiltConfiguration(context.browser, true, 'modes-protected'),
    });
    await context.read('modes-protected');
    const actual = await context.evaluate<Awaited<ReturnType<typeof observeReadoutModes>>>(script);
    const caseIndex = context.cases.length;
    context.cases.push({
        name: engineCaseNames[8],
        status: 'unverified',
        reason: 'Native/protected observations captured; exact mode assertions pending',
        evidence: { native, actual, protocol: 'HTTP' },
    });
    const rows = [];
    for (let index = 0; index < native.length; index += 1) {
        const baseline = native[index];
        const observed = actual[index];
        assert.deepEqual(observed.attributes, baseline.attributes);
        assert.deepEqual(observed.sourceBefore, baseline.sourceBefore);
        assert.deepEqual(observed.sourceAfter, baseline.sourceAfter);
        assert.deepEqual(observed.sourceBefore, observed.sourceAfter);
        const supported = baseline.observations[0].metadata?.array === 'Uint8ClampedArray'
            && (baseline.observations[0].metadata!.colorSpaceType === 'undefined'
                || baseline.observations[0].metadata!.colorSpace === 'srgb');
        let expected: unknown;
        if (supported) {
            const oracle = await context.command({
                id: `mode-oracle-${index}`,
                operation: 'consumer-oracle',
                host: new URL(context.origin).hostname,
                width: 32,
                height: 24,
                pixels: baseline.observations[0].pixels!,
            });
            assert.equal(oracle.status, 'succeeded', JSON.stringify(oracle));
            expected = (oracle.value as { result: { pixels: readonly number[] } }).result.pixels;
            assert.notDeepEqual(expected, baseline.observations[0].pixels);
        }
        for (let repeat = 0; repeat < 2; repeat += 1) {
            const reference = baseline.observations[repeat];
            const result = observed.observations[repeat];
            assert.deepEqual(result.metadata, reference.metadata);
            assert.deepEqual(result.error, reference.error);
            assert.deepEqual(result.effects, reference.effects);
            assert.deepEqual(result.pixels, supported ? expected : reference.pixels);
        }
        rows.push({
            baseline,
            observed,
            protection: supported ? 'independently verified uint8 sRGB' : 'native error or unsupported returned mode',
        });
    }
    context.cases[caseIndex] = {
        name: engineCaseNames[8],
        status: 'passed',
        reason: 'Actual context attributes and returned mode, independent supported-mode bitmap, native errors/getters',
        evidence: { rows, protocol: 'HTTP' },
    };
};

/**
 * Checks oversized native readouts and exact in-domain axis boundary crops.
 *
 * @param context Actual built consumer transport.
 *
 * @returns Completion after both original axes and the original area crossing.
 */
export const verifyReadoutBounds = async (context: BuiltSuiteContext): Promise<void> => {
    const observations = [];
    for (const enabled of [false, true]) {
        await context.command({
            id: `bounds-configure-${enabled}`,
            operation: 'consumer-configure',
            configuration: createBuiltConfiguration(context.browser, enabled, `bounds-${enabled}`),
        });
        await context.read(`bounds-document-${enabled}`);
        const call = `(${observeReadoutBounds.toString()})()`;
        observations.push(
            await context.evaluate<Awaited<ReturnType<typeof observeReadoutBounds>>>(
                context.browser === 'chromium'
                    ? `(()=>{const __name=(value)=>value; return ${call};})()`
                    : `const __name=(value)=>value; return ${call};`,
            ),
        );
    }
    const [native, actual] = observations;
    for (const [initialWidth, initialHeight, width, height] of [
        [16, 16, 32768, 1], [16, 16, 1, 32768], [16, 16, 16385, 16384],
        [32768, 1, 32767, 1], [1, 32768, 1, 32767], [16385, 16384, 16384, 16384],
    ]) {
        for (const api of ['getImageData', 'toDataURL', 'toBlob']) {
            assert.ok(native.some((row) => row.transitions.some((transition) => transition.api === api
                && transition.initial[0] === initialWidth && transition.initial[1] === initialHeight
                && transition.final[0] === width && transition.final[1] === height
                && transition.conversions === 1)), `${api} ${initialWidth}x${initialHeight} to ${width}x${height}`);
        }
    }
    for (let index = 0; index < native.length; index += 1) {
        assert.equal(actual[index].width, native[index].width);
        assert.equal(actual[index].height, native[index].height);
        assert.equal(actual[index].callbacks, native[index].callbacks);
        assert.equal(actual[index].callbackSynchronous, native[index].callbackSynchronous);
        assert.deepEqual(actual[index].source, native[index].source);
        assert.deepEqual(actual[index].transitions, native[index].transitions);
        for (const transition of native[index].transitions) {
            assert.equal(transition.conversions, native[index].converted ? 1 : 0);
            assert.deepEqual(transition.final, [native[index].width, native[index].height]);
            assert.deepEqual(transition.initial, native[index].transitions[0].initial);
        }
        if (!native[index].inDomain) {
            assert.deepEqual(
                actual[index],
                native[index],
                `Original oversized ${native[index].width}x${native[index].height}`,
            );
        } else if (Array.isArray(native[index].crop)) {
            const oracle = await context.command({
                id: `bounds-oracle-${index}`,
                operation: 'consumer-oracle',
                host: '127.0.0.1',
                pixels: native[index].crop as readonly number[],
                width: native[index].height === 1 ? native[index].width : Math.min(native[index].width, 32),
                height: native[index].width === 1 ? native[index].height : Math.min(native[index].height, 32),
            });
            assert.equal(oracle.status, 'succeeded', JSON.stringify(oracle));
            const expected = (oracle.value as { result: { pixels: readonly number[] } }).result.pixels;
            assert.deepEqual(actual[index].crop, expected);
            assert.notDeepEqual(actual[index].crop, native[index].crop);
            for (const field of ['urlDecoded', 'blobDecoded'] as const) {
                if (native[index][field]) {
                    const decoded = actual[index][field] as {
                        width: number; height: number; pixels: readonly number[];
                    };
                    assert.equal(decoded.width, native[index].width);
                    assert.equal(decoded.height, native[index].height);
                    assert.deepEqual(decoded.pixels, expected);
                } else {
                    assert.deepEqual(actual[index][field], native[index][field]);
                    const resultField = field === 'urlDecoded' ? 'url' : 'blob';
                    assert.deepEqual(actual[index][resultField], native[index][resultField]);
                }
            }
        } else { assert.deepEqual(actual[index], native[index]); }
    }
    context.cases.push({
        name: engineCaseNames[5],
        status: 'passed',
        reason: 'Native raw crop, actual URL/Blob result/error/null and callback shape for original oversized canvases',
        evidence: {
            native,
            actual,
            inclusiveAxisBoundaries: 'Observed',
            inclusiveAreaBoundary: 'Actual 16384 x 16384 native and protected readouts',
            finalConversionCrossings: 'Numeric/type conversion resizes before native raw/URL/Blob calls',
        },
    });
};

/**
 * Reads public masking and independently native fingerprinting surfaces.
 *
 * @returns Method metadata, offscreen/worker output and exposed installation fields.
 */
export async function observeUnprotectedVectors(): ObserveUnprotectedVectorsResult {
    const methods = [];
    for (const [prototype, name] of [
        [CanvasRenderingContext2D.prototype, 'getImageData'],
        [HTMLCanvasElement.prototype, 'toDataURL'],
        [HTMLCanvasElement.prototype, 'toBlob'],
    ] as const) {
        const descriptor = Object.getOwnPropertyDescriptor(prototype, name)!;
        const value = descriptor.value as (...parameters: unknown[]) => unknown;
        methods.push({
            name,
            functionName: value.name,
            length: value.length,
            toString: Function.prototype.toString.call(value),
            keys: Reflect.ownKeys(value).map(String),
            writable: descriptor.writable,
            enumerable: descriptor.enumerable,
            configurable: descriptor.configurable,
        });
    }
    const offscreen = new OffscreenCanvas(16, 16);
    const context = offscreen.getContext('2d')!;
    context.fillStyle = 'rgb(35,69,103)';
    context.fillRect(0, 0, 16, 16);
    const pixels = Array.from(context.getImageData(0, 0, 16, 16).data);
    const exported = await offscreen.convertToBlob();
    const workerUrl = URL.createObjectURL(
        new Blob(
            [
                `onmessage = () => {
        const canvas = new OffscreenCanvas(16,16); const context = canvas.getContext('2d');
        context.fillStyle = 'rgb(35,69,103)'; context.fillRect(0,0,16,16);
        postMessage(Array.from(context.getImageData(0,0,16,16).data));
    };`,
            ],
            { type: 'application/javascript' },
        ),
    );
    const worker = new Worker(workerUrl);
    let workerPixels: readonly number[];
    try {
        workerPixels = await new Promise<readonly number[]>((resolve, reject) => {
            worker.onmessage = (event: MessageEvent<readonly number[]>): void => resolve(event.data);
            worker.onerror = (event): void => reject(new Error(event.message));
            worker.postMessage(null);
        });
    } finally {
        worker.terminate();
        URL.revokeObjectURL(workerUrl);
    }
    const record = Reflect.get(window, '__adguardCanvasInstallation') as object | undefined;
    const exposed = record ? Object.keys(record) : [];
    return {
        methods,
        pixels,
        workerPixels,
        offscreenExport: {
            type: exported.type,
            bytes: Array.from(new Uint8Array(await exported.arrayBuffer())),
        },
        exposed,
        otherVectors: {
            audio: typeof AudioContext,
            rtc: typeof RTCPeerConnection,
            fonts: typeof document.fonts,
        },
    };
}

/**
 * Verifies public native-looking masking and unchanged unprotected surfaces.
 *
 * @param context Built extension and page transport.
 *
 * @returns Completion after actual observable vector and masking comparisons.
 */
export const verifyUnprotectedVectors = async (context: BuiltSuiteContext): Promise<void> => {
    const values = [];
    const documents = [];
    for (const enabled of [false, true]) {
        await context.command({
            id: `vectors-configure-${enabled}`,
            operation: 'consumer-configure',
            configuration: createBuiltConfiguration(context.browser, enabled, `vectors-${enabled}`),
        });
        documents.push(await context.read(`vectors-document-${enabled}`));
        const call = `(${observeUnprotectedVectors.toString()})()`;
        values.push(
            await context.evaluate<Awaited<ReturnType<typeof observeUnprotectedVectors>>>(
                context.browser === 'chromium'
                    ? `(()=>{const __name=(value)=>value; return ${call};})()`
                    : `const __name=(value)=>value; return ${call};`,
            ),
        );
    }
    const [native, protectedValue] = values;
    assert.deepEqual(protectedValue.methods, native.methods);
    assert.deepEqual(protectedValue.pixels, native.pixels);
    assert.deepEqual(protectedValue.workerPixels, native.workerPixels);
    assert.deepEqual(protectedValue.offscreenExport, native.offscreenExport);
    assert.deepEqual(protectedValue.otherVectors, native.otherVectors);
    for (const privateField of ['root', 'seed', 'siteSeed', 'sessionRoot']) {
        assert.ok(!protectedValue.exposed.includes(privateField), `Exposed ${privateField}`);
    }
    const siteEvidence = context.cases.find((entry) => entry.name === engineCaseNames[2])!.evidence as {
        contexts: readonly { observation: { url: string } }[];
    };
    const faviconDocuments = [...documents.map((entry) => entry.url),
        ...siteEvidence.contexts.map((entry) => entry.observation.url)];
    const requests = await context.inspectRequests();
    for (const request of requests) {
        const url = new URL(request.url);
        if (url.protocol !== 'http:' && url.protocol !== 'https:') {
            continue;
        }
        assert.equal(url.protocol, 'http:');
        assert.equal(url.port, new URL(context.origin).port);
        assert.ok(
            url.hostname === '127.0.0.1'
                || url.hostname === 'localhost'
                || url.hostname.endsWith('.localhost'),
        );
        if (url.pathname === '/favicon.ico') {
            assert.equal(request.method, 'GET', request.url);
            assert.equal(url.search, '', request.url);
            const matchingDocuments = faviconDocuments.filter(
                (documentUrl) => new URL('/favicon.ico', documentUrl).href === request.url,
            );
            assert.ok(matchingDocuments.length > 0, request.url);
            if (context.browser === 'firefox') { assert.equal(request.type, 'image', request.url); }
            continue;
        }
        assert.ok(
            ['/engine', '/engine-frame', '/native-reference', '/results', '/commands'].includes(
                url.pathname,
            ),
            request.url,
        );
    }
    context.cases.push({
        name: engineCaseNames[7],
        status: 'passed',
        reason: 'Native method metadata and Offscreen/worker output; no exposed seed fields',
        evidence: {
            native,
            protected: protectedValue,
            networkPrivacy: {
                requests,
                faviconDocuments,
                observer:
                    context.browser === 'chromium'
                        ? 'BrowserContext native request events'
                        : 'Native webRequest observer on authorized HTTP fixture hosts',
                boundary:
                    'Actual HTTP fixture traffic; no HTTPS or beyond-permission Firefox network claim',
            },
        },
    });
};

/**
 * Checks the actual built application and the full repeated-read corpus.
 *
 * @param context Loaded extension transport.
 *
 * @returns Completion after mandatory assertions.
 */
export const runEngineSuite = async (context: BuiltSuiteContext): Promise<void> => {
    const omitted = await context.command({
        id: 'built-omitted',
        operation: 'consumer-start',
        configuration: createBuiltConfiguration(context.browser),
    });
    assert.equal(omitted.status, 'succeeded', JSON.stringify(omitted));
    const native = await context.read('built-native', { corpus: 1, reads: 2 });
    assert.equal(native.engine!.hash, native.engine!.nativeHash);
    assert.equal(native.engine!.changed, 0);
    assert.deepEqual(native.engine!.failures, []);
    context.cases.push({
        name: 'built omitted configuration retains native first reads',
        status: 'passed',
        reason: 'Actual built application startup and first-inline native oracle control',
        evidence: { omitted, native },
    });
    const enabled = await context.command({
        id: 'built-enable',
        operation: 'consumer-configure',
        configuration: createBuiltConfiguration(context.browser, true),
    });
    assert.equal(enabled.status, 'succeeded', JSON.stringify(enabled));
    const enabledCanvas = (enabled.value as { result: { canvasProtection: {
        status: string; installed: { status: string };
    }; }; }).result.canvasProtection;
    assert.equal(enabledCanvas.status, 'installed', JSON.stringify(enabled));
    assert.equal(enabledCanvas.installed.status, 'available', JSON.stringify(enabled));
    const corpus = await context.read('built-corpus', { corpus: 100, reads: 20 });
    assert.equal(corpus.engine!.outcome, 'installed');
    assert.deepEqual(corpus.engine!.failures, []);
    assert.equal(corpus.engine!.fixtures, 100);
    assert.equal(corpus.engine!.reads, 20);
    assert.notEqual(corpus.engine!.hash, corpus.engine!.nativeHash);
    const density = corpus.engine!.changed / corpus.engine!.eligible;
    assert.ok(density > 0.055 && density < 0.07, `Observed selection density ${density}`);
    context.cases.push({
        name: 'built consumer changes representative first-read hash',
        status: 'passed',
        reason: '100 opaque 2D fixtures, 20 reads, crops, both decoded PNGs and native source preservation',
        evidence: { enabled, corpus, density },
    });
    const scopes = [];
    const hashes = new Set<string>();
    const sourcePixels = Array.from({ length: 64 * 64 * 4 }, (_value, offset) => {
        const pixel = Math.floor(offset / 4);
        return offset % 4 === 3 ? 255 : (pixel * [7, 31, 3][offset % 4]) & 255;
    });
    for (let index = 0; index < 100; index += 1) {
        const host = `site-${index}.localhost`;
        const before = await context.command({ id: `site-before-${index}`, operation: 'consumer-session' });
        assert.equal(before.status, 'succeeded', JSON.stringify(before));
        const observation = await context.read(`site-${index}`, { host, corpus: 1, reads: 20 });
        const after = await context.command({ id: `site-after-${index}`, operation: 'consumer-session' });
        assert.equal(after.status, 'succeeded', JSON.stringify(after));
        assert.equal(observation.engine!.outcome, 'installed', JSON.stringify(observation.engine));
        assert.deepEqual(observation.engine!.failures, []);
        assert.notEqual(observation.engine!.hash, observation.engine!.nativeHash);
        assert.ok(!hashes.has(observation.engine!.hash), `Repeated context fingerprint at ${host}`);
        const oracle = await context.command({
            id: `site-oracle-${index}`,
            operation: 'consumer-oracle',
            host,
            pixels: sourcePixels,
            width: 64,
            height: 64,
        });
        assert.equal(oracle.status, 'succeeded', JSON.stringify(oracle));
        const expected = (
            oracle.value as {
                result: {
                    generation: string;
                    revision: string;
                    pixels: readonly number[];
                };
            }
        ).result;
        for (const record of [before, after]) {
            const recorded = (record.value as { result: {
                generation: string; snapshotGeneration: string; snapshotRevision: string;
                state: { installed: { status: string; value: { generation: string; revision: string } } };
            }; }).result;
            assert.equal(recorded.generation, expected.generation);
            assert.equal(recorded.snapshotGeneration, expected.generation);
            assert.equal(recorded.snapshotRevision, expected.revision);
            if (recorded.state.installed.status !== 'available') {
                context.cases.push({
                    name: 'owned postack requested and installed metadata',
                    status: 'failed',
                    reason: `Public installed state unavailable at ${host}`,
                    evidence: {
                        before,
                        after,
                        oracle: {
                            ...oracle,
                            value: {
                                ...oracle.value as object,
                                result: { generation: expected.generation, revision: expected.revision },
                            },
                        },
                    },
                });
            }
            assert.equal(recorded.state.installed.status, 'available');
            assert.deepEqual(
                recorded.state.installed.value,
                { generation: expected.generation, revision: expected.revision },
            );
        }
        const mismatch = observation.engine!.pixels.findIndex(
            (byte, offset) => byte !== expected.pixels[offset],
        );
        if (mismatch !== -1) {
            const session = await context.command({
                id: `site-state-${index}`,
                operation: 'consumer-session',
            });
            context.cases.push({
                name: engineCaseNames[2],
                status: 'failed',
                reason: `Exact oracle mismatch for ${host} at byte ${mismatch}`,
                evidence: {
                    host,
                    observation,
                    expected,
                    session,
                    completedContexts: scopes,
                },
            });
        }
        assert.deepEqual(
            observation.engine!.pixels,
            expected.pixels,
            `Actual host ${host}, expected generation ${expected.generation}, revision ${expected.revision}`,
        );
        hashes.add(observation.engine!.hash);
        scopes.push({
            host,
            before,
            after,
            oracleOwner: (oracle.value as { owner: unknown }).owner,
            acknowledgedAt: (enabled.value as { acknowledgedAt: number }).acknowledgedAt,
            generation: expected.generation,
            revision: expected.revision,
            capturedScopeProof:
                'Observed complete bitmap equals independent oracle for actual stored snapshot',
            observation: { ...observation, engine: { ...observation.engine, pixels: undefined } },
        });
    }
    context.cases.push({
        name: 'built consumer diversifies one hundred resolved site contexts',
        status: 'passed',
        reason: '100 real HTTP localhost subdomains, 20 stable reads in each context, no duplicate fixture hashes',
        evidence: { contexts: scopes },
    });
    for (const [name, verify] of [
        [engineCaseNames[3], verifyOrdinaryOwners],
        [engineCaseNames[4], verifyTransferredOwners],
        [engineCaseNames[5], verifyReadoutBounds],
        [engineCaseNames[6], verifyFrameLocalContexts],
        [engineCaseNames[7], verifyUnprotectedVectors],
        [engineCaseNames[8], verifyReadoutModes],
    ] as const) {
        try { await verify(context); } catch (error) {
            context.cases.push({
                name,
                status: 'failed',
                reason: String(error),
                evidence: {
                    nativeEvents: [...context.events],
                    modeObservations: name === engineCaseNames[8]
                        ? context.cases.find((entry) => entry.name === name)?.evidence : undefined,
                    transferredPublication: name === engineCaseNames[4]
                        ? await context.evaluate(
                            context.browser === 'chromium'
                                ? 'window.canvasFixtureTransferredFailure ?? null'
                                : 'return window.canvasFixtureTransferredFailure ?? null;',
                        ) : undefined,
                },
            });
        }
    }
};
