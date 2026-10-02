import { describe, expect, test } from 'vitest';
import { server } from 'vitest/browser';

import { createCanvasProtectionCode } from '../../../src/lib/common/canvas-protection/code';
import { type CanvasBootstrapSnapshot } from '../../../src/lib/common/canvas-protection/contracts';
import { deriveSiteSeed } from '../../../src/lib/common/canvas-protection/noise';

import { referenceSourceNoise } from './noise-reference';

type Realm = Window & typeof globalThis;

/**
 * Creates trusted current delivery state.
 *
 * @returns A fully enabled candidate policy.
 */
const snapshot = (): CanvasBootstrapSnapshot => ({
    session: { root: '0123456789abcdef0123456789abcdef', generation: 'abcdef0123456789abcdef0123456789' },
    gates: { filteringEnabled: true, stealthModeEnabled: true, protectCanvas: true },
    policy: {
        schemaVersion: 1,
        revision: 'current',
        browser: server.browser === 'firefox' ? 'firefox-mv2' : 'chromium-mv3',
        selectors: { matches: ['<all_urls>'], excludeMatches: [] },
        ownFrameExclusions: [],
        documentExclusions: [],
        unavailableConditions: [],
    },
});

/**
 * Runs a fresh generated bundle in an HTTP document with no extension APIs.
 *
 * @param body Assertions against a genuinely separate realm.
 * @param url Actual native URL of the fresh document.
 */
const withRealm = async (
    body: (realm: Realm) => Promise<void> | void,
    url = new URL('./empty.html', import.meta.url).href,
): Promise<void> => {
    const frame = document.createElement('iframe');
    frame.width = '64';
    frame.height = '64';
    frame.src = url;
    let watchdog: ReturnType<typeof setTimeout>;
    const loaded = new Promise<void>((resolve, reject) => {
        watchdog = setTimeout(() => {
            reject(new Error(`Iframe load missing: ${frame.contentWindow?.location.href} `
                + `readyState=${frame.contentDocument?.readyState}`));
        }, 3000);
        frame.onload = (): void => { clearTimeout(watchdog); resolve(); };
    });
    document.body.appendChild(frame);
    try {
        await loaded;
        await body(frame.contentWindow as Realm);
    } finally {
        clearTimeout(watchdog!);
        frame.remove();
    }
};

/**
 * Draws an ordinary opaque bitmap and captures its original readout.
 *
 * @param realm Canvas owner realm.
 *
 * @returns Native original image and context.
 */
const draw = (realm: Realm): { context: CanvasRenderingContext2D; original: ImageData } => {
    const canvas = realm.document.createElement('canvas');
    canvas.width = 32;
    canvas.height = 16;
    const context = canvas.getContext('2d')!;
    context.fillStyle = 'rgb(71,123,189)';
    context.fillRect(0, 0, 32, 16);
    return { context, original: context.getImageData(0, 0, 32, 16) };
};

/**
 * Computes an independent expected bitmap for the actual complete host.
 *
 * @param realm Delivered document.
 * @param original Original browser pixels.
 * @param state Trusted delivery snapshot.
 *
 * @returns Independently noised RGBA bytes.
 */
const expected = (realm: Realm, original: ImageData, state: CanvasBootstrapSnapshot): number[] => (
    Array.from(referenceSourceNoise(original, deriveSiteSeed(state.session, realm.location.hostname)))
);

describe('generated canvas bootstrap and native masking', () => {
    test.each(['disabled', 'excluded', 'unsupported'] as const)(
        'keeps %s decisions after enabled duplicate snapshots',
        async (outcome) => {
            await withRealm((realm) => {
                const state = snapshot();
                const before = realm.HTMLCanvasElement.prototype.toDataURL;
                const { toString } = realm.Function.prototype;
                if (outcome === 'disabled') {
                    realm.eval(createCanvasProtectionCode({
                        ...state, gates: { ...state.gates, protectCanvas: false },
                    }));
                } else if (outcome === 'excluded') {
                    realm.eval(createCanvasProtectionCode({
                        ...state,
                        policy: {
                            ...state.policy,
                            ownFrameExclusions: [{
                                requestTypes: ['document', 'subdocument'],
                                condition: {
                                    type: 'url-regexp', input: 'frame-url', pattern: 'empty\\.html', flags: '',
                                },
                            }],
                        },
                    }));
                } else {
                    realm.eval(createCanvasProtectionCode(state));
                }
                realm.eval(createCanvasProtectionCode(state));
                const record = Reflect.get(realm, Symbol.for('adguard.canvas.installation'));
                expect(record.outcome).toBe(outcome);
                expect(realm.HTMLCanvasElement.prototype.toDataURL).toBe(before);
                expect(realm.Function.prototype.toString).toBe(toString);
            }, outcome === 'unsupported' ? 'about:blank' : undefined);
        },
    );

    test('preserves callable surface and both native stringification paths', async () => {
        await withRealm((realm) => {
            const state = snapshot();
            const originals = [realm.HTMLCanvasElement.prototype.toDataURL,
                realm.HTMLCanvasElement.prototype.toBlob, realm.CanvasRenderingContext2D.prototype.getImageData];
            const descriptors = ['toDataURL', 'toBlob'].map((name) => (
                Object.getOwnPropertyDescriptor(realm.HTMLCanvasElement.prototype, name)!
            ));
            const originalToString = realm.Function.prototype.toString;
            const representations = originals.map((method) => Reflect.apply(originalToString, method, []));
            const fixture = draw(realm);
            realm.eval(createCanvasProtectionCode(state));
            const wrappers = [realm.HTMLCanvasElement.prototype.toDataURL,
                realm.HTMLCanvasElement.prototype.toBlob, realm.CanvasRenderingContext2D.prototype.getImageData];
            wrappers.forEach((method, index) => {
                expect(method).not.toBe(originals[index]);
                expect(method.name).toBe(originals[index].name);
                expect(method.length).toBe(originals[index].length);
                expect(Reflect.ownKeys(method)).toEqual(Reflect.ownKeys(originals[index]));
                expect(method.toString()).toBe(representations[index]);
                expect(Reflect.apply(realm.Function.prototype.toString, method, [])).toBe(representations[index]);
                expect(() => realm.Reflect.construct(method, [])).toThrow(realm.TypeError);
            });
            ['toDataURL', 'toBlob'].forEach((name, index) => {
                const descriptor = Object.getOwnPropertyDescriptor(realm.HTMLCanvasElement.prototype, name)!;
                expect({ ...descriptor, value: undefined }).toEqual({ ...descriptors[index], value: undefined });
            });
            const unrelated = realm.eval('(function ordinary(){return 3})');
            expect(unrelated.toString()).toBe(Reflect.apply(originalToString, unrelated, []));
            expect(() => Reflect.apply(realm.Function.prototype.toString, {}, [])).toThrow(realm.TypeError);
            expect(Array.from(fixture.context.getImageData(0, 0, 32, 16).data)).toEqual(
                expected(realm, fixture.original, state),
            );
            expect(Reflect.ownKeys(Reflect.get(realm, Symbol.for('adguard.canvas.installation')))).toEqual(
                ['outcome', 'methods'],
            );
        });
    });

    test('keeps installed protection after excluded duplicate snapshots', async () => {
        await withRealm((realm) => {
            const state = snapshot();
            const fixture = draw(realm);
            realm.eval(createCanvasProtectionCode(state));
            const wrapper = realm.CanvasRenderingContext2D.prototype.getImageData;
            const bytes = Array.from(fixture.context.getImageData(0, 0, 32, 16).data);
            realm.eval(createCanvasProtectionCode({
                ...state,
                gates: { ...state.gates, protectCanvas: false },
                session: { root: 'ffffffffffffffffffffffffffffffff', generation: 'changed' },
            }));
            expect(realm.CanvasRenderingContext2D.prototype.getImageData).toBe(wrapper);
            expect(Array.from(fixture.context.getImageData(0, 0, 32, 16).data)).toEqual(bytes);
        });
    });

    test('keeps private seed and pixels away from replaced intrinsics', async () => {
        await withRealm(async (realm) => {
            const state = snapshot();
            const fixture = draw(realm);
            const transferred = realm.document.createElement('canvas');
            transferred.width = 32;
            transferred.height = 16;
            realm.document.body.appendChild(transferred);
            const offscreen = transferred.transferControlToOffscreen();
            const offscreenContext = offscreen.getContext('2d')!;
            offscreenContext.fillStyle = 'rgb(71,123,189)';
            offscreenContext.fillRect(0, 0, 32, 8);
            offscreenContext.fillStyle = 'rgba(71,123,189,0.5)';
            offscreenContext.fillRect(0, 8, 32, 8);
            expect(realm.document.visibilityState).toBe('visible');
            const readiness = realm.document.createElement('canvas');
            readiness.width = 32;
            readiness.height = 16;
            const readinessContext = readiness.getContext('2d')!;
            let previous: number[] | undefined;
            let ready = false;
            for (let attempt = 0; attempt < 8; attempt += 1) {
                // eslint-disable-next-line no-await-in-loop -- Verify successive committed native bitmap snapshots.
                await new Promise<void>((resolve) => realm.requestAnimationFrame(() => (
                    realm.requestAnimationFrame(() => resolve())
                )));
                readinessContext.clearRect(0, 0, 32, 16);
                readinessContext.drawImage(transferred, 0, 0);
                const pixels = Array.from(readinessContext.getImageData(0, 0, 32, 16).data);
                const prior = previous;
                const committed = pixels.every((value, offset) => (
                    offset % 4 !== 3 || value === (offset < 32 * 8 * 4 ? 255 : 128)
                ));
                if (committed && prior && pixels.every((value, offset) => value === prior[offset])) {
                    ready = true;
                    break;
                }
                previous = pixels;
            }
            expect(ready).toBe(true);
            const sourceBefore = Array.from(offscreenContext.getImageData(0, 0, 32, 16).data);
            const nativeTransferred = transferred.toDataURL();
            const originalOffscreenRead = realm.OffscreenCanvasRenderingContext2D.prototype.getImageData;
            const originalRead = realm.CanvasRenderingContext2D.prototype.getImageData;
            const originalExport = realm.HTMLCanvasElement.prototype.toDataURL;
            const wanted = expected(realm, fixture.original, state);
            realm.eval(createCanvasProtectionCode(state));
            const leaks: string[] = [];
            const NativeProxy = realm.Proxy;
            const replace = (owner: object, key: PropertyKey, label: string): void => {
                const native = Reflect.get(owner, key) as Function;
                Reflect.set(owner, key, new NativeProxy(native, {
                    construct: (target, args, newTarget): object => {
                        leaks.push(label);
                        return Reflect.construct(target, args, newTarget);
                    },
                    apply: (target, receiver, args): unknown => {
                        leaks.push(label);
                        return Reflect.apply(target, receiver, args);
                    },
                }));
            };
            [realm.Uint8Array, realm.Uint32Array, realm.DataView, realm.TextEncoder,
                realm.Proxy, realm.WeakMap, realm.VideoFrame].forEach((constructor) => (
                replace(realm, constructor.name, constructor.name)
            ));
            const typed = Object.getPrototypeOf(realm.Uint8Array.prototype);
            ['set'].forEach((key) => replace(typed, key, `typed-${key}`));
            const replaceGetter = (owner: object, key: PropertyKey, label: string): void => {
                const descriptor = Object.getOwnPropertyDescriptor(owner, key)!;
                Object.defineProperty(owner, key, {
                    ...descriptor,
                    get: function get(): unknown {
                        leaks.push(label);
                        return Reflect.apply(descriptor.get!, this, []);
                    },
                });
            };
            ['length', 'buffer'].forEach((key) => replaceGetter(typed, key, `typed-${key}`));
            replaceGetter(typed, Symbol.toStringTag, 'typed-tag');
            ['width', 'height'].forEach((key) => (
                replaceGetter(realm.ImageData.prototype, key, `ImageData-${key}`)
            ));
            if (Object.getOwnPropertyDescriptor(realm.ImageData.prototype, 'colorSpace')) {
                replaceGetter(realm.ImageData.prototype, 'colorSpace', 'ImageData-colorSpace');
            } else {
                Object.defineProperty(realm.ImageData.prototype, 'colorSpace', {
                    configurable: true, get: (): string => { leaks.push('ImageData-colorSpace'); return 'srgb'; },
                });
            }
            ['format', 'colorSpace', 'displayWidth', 'displayHeight'].forEach((key) => (
                replaceGetter(realm.VideoFrame.prototype, key, `frame-${key}`)
            ));
            replace(realm.VideoFrame.prototype, 'close', 'frame-close');
            replaceGetter(realm.VideoColorSpace.prototype, 'primaries', 'frame-primaries');
            replace(realm.DataView.prototype, 'setUint32', 'DataView-write');
            const arrayDescriptors = [Symbol.iterator, 'map', 'find', 'push'].map((key) => ({
                key, descriptor: Object.getOwnPropertyDescriptor(realm.Array.prototype, key)!,
            }));
            replace(realm.Array.prototype, Symbol.iterator, 'array-iterator');
            ['map', 'find', 'push'].forEach((key) => replace(realm.Array.prototype, key, `array-${key}`));
            ['floor', 'min', 'max', 'trunc'].forEach((key) => replace(realm.Math, key, `Math-${key}`));
            ['get', 'set'].forEach((key) => replace(realm.WeakMap.prototype, key, `WeakMap-${key}`));
            replace(realm.Reflect, 'apply', 'Reflect-apply');
            replace(realm.CanvasRenderingContext2D.prototype, 'putImageData', 'pixels-write');
            ['drawImage', 'getImageData', 'putImageData'].forEach((key) => (
                replace(realm.OffscreenCanvasRenderingContext2D.prototype, key, `offscreen-${key}`)
            ));
            replace(realm.OffscreenCanvas.prototype, 'getContext', 'offscreen-context');
            replace(realm.HTMLCanvasElement.prototype, 'transferControlToOffscreen', 'private-transfer');
            replace(realm.HTMLCanvasElement.prototype, 'getContext', 'owner-query');
            const imageData = Object.getOwnPropertyDescriptor(realm.ImageData.prototype, 'data')!;
            Object.defineProperty(realm.ImageData.prototype, 'data', {
                ...imageData,
                get: function get(): Uint8ClampedArray {
                    leaks.push('ImageData-data');
                    return Reflect.apply(imageData.get!, this, []);
                },
            });
            Object.defineProperty(realm.Uint8ClampedArray, Symbol.hasInstance, {
                configurable: true, value: (): boolean => { leaks.push('array-brand'); return true; },
            });
            Object.defineProperty(realm.Object.prototype, 'getPrototypeOf', {
                configurable: true,
                value: (): never => { leaks.push('inherited-proxy-trap'); throw new Error('trap'); },
            });
            const image = fixture.context.getImageData(0, 0, 32, 16);
            const actual = Array.from(Reflect.apply(imageData.get!, image, []) as Uint8ClampedArray);
            expect(actual).toEqual(wanted);
            fixture.context.canvas.toDataURL();
            const protectedTransferred = transferred.toDataURL();
            const blobPromise = new Promise<Blob>((resolve) => transferred.toBlob((blob) => resolve(blob!)));
            fixture.context.getImageData.toString();
            realm.Function.prototype.toString.call(fixture.context.canvas.toDataURL);
            realm.eval(createCanvasProtectionCode({
                ...state, gates: { ...state.gates, protectCanvas: false },
            }));
            const nativeImage = Reflect.apply(originalRead, fixture.context, [0, 0, 32, 16]);
            expect(Array.from(Reflect.apply(imageData.get!, nativeImage, []) as Uint8ClampedArray)).toEqual(
                Array.from(Reflect.apply(imageData.get!, fixture.original, []) as Uint8ClampedArray),
            );
            expect(Reflect.apply(originalExport, fixture.context.canvas, [])).toBeTypeOf('string');
            expect(leaks).toEqual([]);
            // The native Blob callback is asynchronous; the library's private work has finished before yielding.
            arrayDescriptors.forEach(({ key, descriptor }) => (
                Object.defineProperty(realm.Array.prototype, key, descriptor)
            ));
            const protectedBlob = await blobPromise;
            expect(leaks).toEqual([]);
            const decode = async (input: string | Blob): Promise<ImageData> => {
                const blob = typeof input === 'string' ? await (await fetch(input)).blob() : input;
                const bitmap = await createImageBitmap(blob);
                const canvas = document.createElement('canvas');
                canvas.width = bitmap.width;
                canvas.height = bitmap.height;
                const context = canvas.getContext('2d')!;
                context.drawImage(bitmap, 0, 0);
                bitmap.close();
                return context.getImageData(0, 0, canvas.width, canvas.height);
            };
            const baseline = await decode(nativeTransferred);
            const transferredExpected = expected(realm, baseline, state);
            expect(Array.from((await decode(protectedTransferred)).data)).toEqual(transferredExpected);
            expect(Array.from((await decode(protectedBlob)).data)).toEqual(transferredExpected);
            expect(Array.from(Reflect.apply(originalOffscreenRead, offscreenContext, [0, 0, 32, 16]).data)).toEqual(
                sourceBefore,
            );
        });
    });

    test.each(['webgl', 'webgl2', 'bitmaprenderer'] as const)(
        'keeps ordinary %s exports native after generated installation',
        async (kind) => {
            await withRealm(async (realm) => {
                const canvas = realm.document.createElement('canvas');
                canvas.width = 32;
                canvas.height = 16;
                if (kind === 'bitmaprenderer') {
                    const image = await createImageBitmap(draw(realm).context.canvas);
                    canvas.getContext('bitmaprenderer')!.transferFromImageBitmap(image);
                } else {
                    const gl = canvas.getContext(kind, { preserveDrawingBuffer: true }) as
                        WebGLRenderingContext | WebGL2RenderingContext;
                    gl.clearColor(0.25, 0.5, 0.75, 1);
                    gl.clear(gl.COLOR_BUFFER_BIT);
                }
                const original = canvas.toDataURL();
                let creationErrors = 0;
                canvas.addEventListener('webglcontextcreationerror', () => { creationErrors += 1; });
                realm.eval(createCanvasProtectionCode(snapshot()));
                expect(canvas.toDataURL()).toBe(original);
                const blob = await new Promise<Blob>((resolve) => canvas.toBlob((value) => resolve(value!)));
                expect(await blob.arrayBuffer()).toEqual(await (await (await fetch(original)).blob()).arrayBuffer());
                expect(creationErrors).toBe(0);
            });
        },
    );

    test('retains original conversion receivers and private reentrant snapshots', async () => {
        await withRealm(async (realm) => {
            const state = snapshot();
            const fixture = draw(realm);
            const originalToBlob = realm.HTMLCanvasElement.prototype.toBlob;
            const NativeProxy = realm.Proxy;
            let nativeCalls = 0;
            const callbacks: unknown[] = [];
            realm.HTMLCanvasElement.prototype.toBlob = new NativeProxy(originalToBlob, {
                apply: (target, receiver, args): void => {
                    nativeCalls += 1;
                    callbacks.push(args[0]);
                    Reflect.apply(target, receiver, args);
                },
            });
            realm.eval(createCanvasProtectionCode(state));
            let conversions = 0;
            let privateCalls = 0;
            const originalUint32 = realm.Uint32Array;
            let nested: number[] = [];
            const type = {
                [Symbol.toPrimitive](hint: string): string {
                    expect(this).toBe(type);
                    expect(hint).toBe('string');
                    conversions += 1;
                    realm.Uint32Array = new NativeProxy(originalUint32, {
                        construct: (target, args, newTarget): Uint32Array => {
                            privateCalls += 1;
                            return Reflect.construct(target, args, newTarget);
                        },
                    });
                    nested = Array.from(fixture.context.getImageData(0, 0, 32, 16).data);
                    return 'image/png';
                },
            };
            let qualityCalls = 0;
            const quality = { valueOf: (): number => { qualityCalls += 1; return 0.5; } };
            let deliveries = 0;
            const order: string[] = [];
            let delivered!: Blob;
            const complete = new Promise<void>((resolve) => {
                const callback = (blob: Blob | null): void => {
                    deliveries += 1;
                    order.push('callback');
                    delivered = blob!;
                    resolve();
                };
                fixture.context.canvas.toBlob(callback, type as unknown as string, quality as unknown as number);
                expect(callbacks).toEqual([callback]);
            });
            order.push('return');
            await Promise.resolve();
            order.push('microtask');
            fixture.context.fillStyle = 'red';
            fixture.context.fillRect(0, 0, 32, 16);
            await complete;
            expect(conversions).toBe(1);
            expect(privateCalls).toBe(0);
            expect(qualityCalls).toBe(0);
            expect(deliveries).toBe(1);
            expect(nativeCalls).toBe(1);
            expect(order).toEqual(['return', 'microtask', 'callback']);
            expect(nested).toEqual(expected(realm, fixture.original, state));
            const bitmap = await createImageBitmap(delivered);
            const copy = document.createElement('canvas');
            copy.width = 32;
            copy.height = 16;
            const context = copy.getContext('2d')!;
            context.drawImage(bitmap, 0, 0);
            bitmap.close();
            expect(Array.from(context.getImageData(0, 0, 32, 16).data)).toEqual(nested);
        });
    });

    test.each(['disabled', 'excluded', 'unsupported', 'installed'] as const)(
        'retains sealed %s installation after registry and global replacements',
        async (outcome) => {
            await withRealm((realm) => {
                const state = snapshot();
                const fixture = draw(realm);
                let initial = state;
                if (outcome === 'disabled') {
                    initial = { ...state, gates: { ...state.gates, protectCanvas: false } };
                } else if (outcome === 'excluded') {
                    initial = {
                        ...state,
                        policy: {
                            ...state.policy,
                            ownFrameExclusions: [{
                                requestTypes: ['document', 'subdocument'] as ('document' | 'subdocument')[],
                                condition: {
                                    type: 'url-regexp' as const,
                                    input: 'frame-url' as const,
                                    pattern: 'empty\\.html',
                                    flags: '',
                                },
                            }],
                        },
                    };
                }
                realm.eval(createCanvasProtectionCode(initial));
                const key = realm.Symbol.for('adguard.canvas.installation');
                const record = Reflect.get(realm, key);
                const before = [realm.HTMLCanvasElement.prototype.toDataURL,
                    realm.HTMLCanvasElement.prototype.toBlob, realm.CanvasRenderingContext2D.prototype.getImageData,
                    realm.Function.prototype.toString];
                const expectedPixels = outcome === 'installed'
                    ? expected(realm, fixture.original, state) : Array.from(fixture.original.data);
                const NativeProxy = realm.Proxy;
                const originalSymbol = realm.Symbol;
                let callbacks = 0;
                realm.Symbol.for = (name: string): symbol => { callbacks += 1; return originalSymbol(name); };
                const constructors = [
                    'Object', 'TextEncoder', 'Uint8Array', 'Uint32Array', 'WeakMap', 'Proxy',
                ] as const;
                constructors.forEach((name) => {
                    const original = realm[name];
                    Reflect.set(realm, name, new NativeProxy(original, {
                        get: (target, property, receiver): unknown => {
                            callbacks += 1;
                            return Reflect.get(target, property, receiver);
                        },
                        construct: (target, args, newTarget): object => {
                            callbacks += 1;
                            return Reflect.construct(target, args, newTarget);
                        },
                    }));
                });
                const parse = realm.Number.parseInt;
                realm.Number.parseInt = (...args: Parameters<typeof Number.parseInt>): number => {
                    callbacks += 1;
                    return Reflect.apply(parse, undefined, args);
                };
                Reflect.set(realm, 'globalThis', new NativeProxy({}, {
                    get: (): undefined => { callbacks += 1; return undefined; },
                }));
                const next = {
                    ...state,
                    session: {
                        root: 'fedcba9876543210fedcba9876543210', generation: 'different-generation',
                    },
                };
                realm.eval(createCanvasProtectionCode(next));
                expect(callbacks).toBe(0);
                expect([realm.HTMLCanvasElement.prototype.toDataURL,
                    realm.HTMLCanvasElement.prototype.toBlob, realm.CanvasRenderingContext2D.prototype.getImageData,
                    realm.Function.prototype.toString]).toEqual(before);
                expect(Reflect.get(realm, key)).toBe(record);
                expect(record.outcome).toBe(outcome);
                expect(Array.from(fixture.context.getImageData(0, 0, 32, 16).data)).toEqual(expectedPixels);
                const alias = Object.getOwnPropertyDescriptor(realm, '__adguardCanvasInstallation')!;
                expect(alias).toEqual({
                    value: record, enumerable: false, writable: false, configurable: false,
                });
                expect(Object.getOwnPropertyDescriptor(realm, key)).toEqual(alias);
                expect(Reflect.ownKeys(record)).toEqual(['outcome', 'methods']);
                expect(Object.isFrozen(record)).toBe(true);
                expect(Object.isFrozen(record.methods)).toBe(true);
            }, outcome === 'unsupported' ? 'about:blank' : undefined);
        },
    );

    test('captures child policy independently of forged and replayed parent records', async () => {
        let replay: unknown;
        await withRealm((realm) => {
            const state = snapshot();
            realm.eval(createCanvasProtectionCode({ ...state, gates: { ...state.gates, protectCanvas: false } }));
            replay = Reflect.get(realm, realm.Symbol.for('adguard.canvas.installation'));
        });
        let callbacks = 0;
        Object.defineProperty(window, '__adguardCanvasInstallation', { configurable: true, value: replay });
        Object.defineProperty(window, 'adguardCanvasContext', {
            configurable: true,
            get: (): never => { callbacks += 1; throw new Error('parent marker must remain unread'); },
        });
        try {
            await withRealm((realm) => {
                const state = snapshot();
                const fixture = draw(realm);
                realm.eval(createCanvasProtectionCode(state));
                const own = Reflect.get(realm, realm.Symbol.for('adguard.canvas.installation'));
                expect(own).not.toBe(replay);
                expect(own.outcome).toBe('installed');
                expect(Array.from(fixture.context.getImageData(0, 0, 32, 16).data)).toEqual(
                    expected(realm, fixture.original, state),
                );
                expect(callbacks).toBe(0);
                expect(Reflect.set(realm, '__adguardCanvasInstallation', replay)).toBe(false);
                expect(Reflect.get(realm, '__adguardCanvasInstallation')).toBe(own);
            });
        } finally {
            Reflect.deleteProperty(window, '__adguardCanvasInstallation');
            Reflect.deleteProperty(window, 'adguardCanvasContext');
        }
    });

    test('keeps optional private state away from inherited accessors', async () => {
        await withRealm((realm) => {
            const state = snapshot();
            const fixture = draw(realm);
            realm.eval(createCanvasProtectionCode(state));
            const stored = new WeakMap<object, Map<string, unknown>>();
            const calls: string[] = [];
            ['readout', 'originX', 'originY', 'canvasWidth', 'canvasHeight', 'exportContext',
                'getThrows', 'getThrown', 'methodThrows', 'methodThrown', 'value', 'returned',
                'primitive', 'thrown'].forEach((name) => {
                Object.defineProperty(realm.Object.prototype, name, {
                    configurable: true,
                    get: function get(): unknown {
                        calls.push(`get-${name}`);
                        return stored.get(this)?.get(name);
                    },
                    set: function set(value: unknown): void {
                        calls.push(`set-${name}`);
                        let record = stored.get(this);
                        if (!record) {
                            record = new Map();
                            stored.set(this, record);
                        }
                        record.set(name, value);
                    },
                });
            });
            const result = fixture.context.getImageData(0, 0, 32, 16);
            expect(Array.from(result.data)).toEqual(expected(realm, fixture.original, state));
            const type = { toString: (): string => 'image/png' };
            fixture.context.canvas.toDataURL(type as unknown as string);
            const failure = new realm.Error('original conversion failure');
            const throwingGetter = {
                get toString(): never { throw failure; },
            };
            const throwingMethod = {
                toString: (): never => { throw failure; },
            };
            expect(() => fixture.context.canvas.toDataURL(throwingGetter as unknown as string)).toThrow(failure);
            expect(() => fixture.context.canvas.toDataURL(throwingMethod as unknown as string)).toThrow(failure);
            expect(calls).toEqual([]);
        });
    });
    test('keeps sparse private arrays and omitted arguments away from inherited numeric accessors', async () => {
        await withRealm(async (realm) => {
            const state = snapshot();
            const fixture = draw(realm);
            const pixels = expected(realm, fixture.original, state);
            const nativeURL = realm.HTMLCanvasElement.prototype.toDataURL;
            const nativeBlob = realm.HTMLCanvasElement.prototype.toBlob;
            const nativeRead = realm.CanvasRenderingContext2D.prototype.getImageData;
            realm.eval(createCanvasProtectionCode(state));
            const calls: string[] = [];
            let inheritedDeliveries = 0;
            let inheritedConversions = 0;
            const inheritedCallback = (): void => { inheritedDeliveries += 1; };
            inheritedCallback.toString = (): string => { inheritedConversions += 1; return 'image/jpeg'; };
            const inheritedType = {
                toString: (): string => { inheritedConversions += 1; return 'image/jpeg'; },
            };
            let delivered: Promise<Blob>;
            try {
                for (let index = 0; index < 5; index += 1) {
                    const name = `${index}`;
                    Object.defineProperty(realm.Array.prototype, name, {
                        configurable: true,
                        get: function get(): unknown {
                            calls.push(`get-${name}`);
                            if (index === 0) { return inheritedCallback; }
                            return index === 1 ? inheritedType : undefined;
                        },
                        set: function set(value: unknown): void {
                            calls.push(`set-${name}`);
                            Object.defineProperty(this, name, {
                                value, configurable: true, writable: true, enumerable: true,
                            });
                        },
                    });
                }
                const errorOf = (method: Function, receiver: object, args: unknown[]): unknown => {
                    try {
                        Reflect.apply(method, receiver, args);
                        return undefined;
                    } catch (error) {
                        const { name, message } = error as Error;
                        return { name, message };
                    }
                };
                const { canvas } = fixture.context;
                const originalMissingCallback = errorOf(nativeBlob, canvas, []);
                const originalMissingCoordinates = errorOf(nativeRead, fixture.context, [0, 0, 32]);
                Reflect.apply(nativeURL, canvas, []);
                expect(calls).toEqual([]);
                expect(errorOf(canvas.toBlob, canvas, [])).toEqual(originalMissingCallback);
                expect(errorOf(fixture.context.getImageData, fixture.context, [0, 0, 32]))
                    .toEqual(originalMissingCoordinates);
                expect(Array.from(fixture.context.getImageData(0, 0, 32, 16).data)).toEqual(pixels);
                const encoded = canvas.toDataURL();
                expect(encoded).toBe(canvas.toDataURL(undefined));
                let conversions = 0;
                const type = {
                    toString: (): string => { conversions += 1; return 'image/png'; },
                };
                expect(encoded).toBe(canvas.toDataURL(type as unknown as string));
                expect(conversions).toBe(1);
                delivered = new Promise<Blob>((resolve) => {
                    canvas.toBlob((value) => resolve(value!));
                });
                expect(calls).toEqual([]);
                expect(inheritedConversions).toBe(0);
                expect(inheritedDeliveries).toBe(0);
            } finally {
                // Only the synchronous protected invocation owns private snapshot preparation.
                for (let index = 0; index < 5; index += 1) {
                    Reflect.deleteProperty(realm.Array.prototype, `${index}`);
                }
            }
            const blob = await delivered!;
            const bitmap = await createImageBitmap(blob);
            const copy = document.createElement('canvas');
            copy.width = 32;
            copy.height = 16;
            const context = copy.getContext('2d')!;
            context.drawImage(bitmap, 0, 0);
            bitmap.close();
            expect(Array.from(context.getImageData(0, 0, 32, 16).data)).toEqual(pixels);
            expect(inheritedDeliveries).toBe(0);
        });
    });
});
