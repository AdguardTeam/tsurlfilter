import { describe, expect, test } from 'vitest';
import { server } from 'vitest/browser';

import { createCanvasProtectionCode } from '../../../src/lib/common/canvas-protection/code';
import { type CanvasBootstrapSnapshot } from '../../../src/lib/common/canvas-protection/contracts';
import { deriveSiteSeed } from '../../../src/lib/common/canvas-protection/noise';

import { type Realm, snapshot, withRealm } from './generated-realm';
import { referenceSourceNoise } from './noise-reference';

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
 * Repeats the fixture fill once the engine is loaded: rendering made earlier is not tracked.
 *
 * @param fixture Canvas drawn before installation.
 * @param fixture.context Its 2D context, still holding the fixture fill style.
 */
const repaint = ({ context }: { context: CanvasRenderingContext2D }): void => {
    context.fillRect(0, 0, 32, 16);
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

/**
 * Lists the own keys of a global object. Firefox orders them by first use, so they are sorted.
 *
 * @param realm Document's global object.
 *
 * @returns Sorted own string and symbol keys.
 */
const globalKeys = (realm: Realm): string[] => Reflect.ownKeys(realm).map(String).sort();

describe('generated canvas bootstrap and native masking', () => {
    test.each(['disabled', 'excluded', 'unsupported'] as const)('leaves a %s document untouched', async (outcome) => {
        await withRealm((realm) => {
            const state = snapshot();
            const globals = globalKeys(realm);
            const methods = (): Function[] => [
                realm.HTMLCanvasElement.prototype.toDataURL,
                realm.HTMLCanvasElement.prototype.toBlob,
                realm.CanvasRenderingContext2D.prototype.getImageData,
                realm.CanvasRenderingContext2D.prototype.fillText,
                Object.getOwnPropertyDescriptor(realm.HTMLIFrameElement.prototype, 'contentWindow')!.get!,
                realm.Function.prototype.toString,
            ];
            const before = methods();
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
            methods().forEach((method, index) => expect(method).toBe(before[index]));
            expect(globalKeys(realm)).toEqual(globals);
        }, outcome === 'unsupported' ? 'about:blank' : undefined);
    });

    test('preserves callable surface and both native stringification paths', async () => {
        await withRealm((realm) => {
            const state = snapshot();
            const globals = globalKeys(realm);
            const originals = [realm.HTMLCanvasElement.prototype.toDataURL,
                realm.HTMLCanvasElement.prototype.toBlob, realm.CanvasRenderingContext2D.prototype.getImageData];
            const descriptors = ['toDataURL', 'toBlob'].map((name) => (
                Object.getOwnPropertyDescriptor(realm.HTMLCanvasElement.prototype, name)!
            ));
            const originalToString = realm.Function.prototype.toString;
            const representations = originals.map((method) => Reflect.apply(originalToString, method, []));
            const fixture = draw(realm);
            realm.eval(createCanvasProtectionCode(state));
            repaint(fixture);
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
            expect(globalKeys(realm)).toEqual(globals);
        });
    });

    test('serves a repeated delivery with the existing wrappers', async () => {
        await withRealm((realm) => {
            const state = snapshot();
            const fixture = draw(realm);
            realm.eval(createCanvasProtectionCode(state));
            repaint(fixture);
            const methods = (): Function[] => [
                realm.CanvasRenderingContext2D.prototype.getImageData,
                realm.CanvasRenderingContext2D.prototype.fillText,
                realm.HTMLCanvasElement.prototype.toDataURL,
                realm.Function.prototype.toString,
            ];
            const wrappers = methods();
            const bytes = Array.from(fixture.context.getImageData(0, 0, 32, 16).data);
            expect(bytes).toEqual(expected(realm, fixture.original, state));
            realm.eval(createCanvasProtectionCode(state));
            realm.eval(createCanvasProtectionCode({ ...state, gates: { ...state.gates, protectCanvas: false } }));
            methods().forEach((method, index) => expect(method).toBe(wrappers[index]));
            expect(Array.from(fixture.context.getImageData(0, 0, 32, 16).data)).toEqual(bytes);
        });
    });

    test('keeps private seed and pixels away from replaced intrinsics', async () => {
        await withRealm(async (realm) => {
            const state = snapshot();
            const fixture = draw(realm);
            const originalRead = realm.CanvasRenderingContext2D.prototype.getImageData;
            const originalExport = realm.HTMLCanvasElement.prototype.toDataURL;
            const wanted = expected(realm, fixture.original, state);
            realm.eval(createCanvasProtectionCode(state));
            repaint(fixture);
            const untracked = realm.document.createElement('canvas').getContext('2d')!;
            const video = realm.document.createElement('video');
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
                realm.Proxy, realm.WeakMap, realm.WeakSet].forEach((constructor) => (
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
            replace(realm.DataView.prototype, 'setUint32', 'DataView-write');
            const arrayDescriptors = [Symbol.iterator, 'map', 'find', 'push'].map((key) => ({
                key, descriptor: Object.getOwnPropertyDescriptor(realm.Array.prototype, key)!,
            }));
            replace(realm.Array.prototype, Symbol.iterator, 'array-iterator');
            ['map', 'find', 'push'].forEach((key) => replace(realm.Array.prototype, key, `array-${key}`));
            ['floor', 'min', 'max', 'trunc'].forEach((key) => replace(realm.Math, key, `Math-${key}`));
            ['get', 'set'].forEach((key) => replace(realm.WeakMap.prototype, key, `WeakMap-${key}`));
            ['has', 'add'].forEach((key) => replace(realm.WeakSet.prototype, key, `WeakSet-${key}`));
            replace(realm.Reflect, 'apply', 'Reflect-apply');
            replace(realm.CanvasRenderingContext2D.prototype, 'putImageData', 'pixels-write');
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
            untracked.drawImage(video, 0, 0);
            untracked.fillRect(0, 0, 1, 1);
            const image = fixture.context.getImageData(0, 0, 32, 16);
            const actual = Array.from(Reflect.apply(imageData.get!, image, []) as Uint8ClampedArray);
            expect(actual).toEqual(wanted);
            const protectedURL = fixture.context.canvas.toDataURL();
            const blobPromise = new Promise<Blob>((resolve) => (
                fixture.context.canvas.toBlob((blob) => resolve(blob!))
            ));
            fixture.context.getImageData.toString();
            realm.Function.prototype.toString.call(fixture.context.canvas.toDataURL);
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
            expect(Array.from((await decode(protectedURL)).data)).toEqual(wanted);
            expect(Array.from((await decode(protectedBlob)).data)).toEqual(wanted);
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
            repaint(fixture);
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

    test('ignores installation markers defined by a page', async () => {
        await withRealm((realm) => {
            const state = snapshot();
            const fixture = draw(realm);
            const forged = Object.freeze({ outcome: 'installed', methods: Object.freeze({}) });
            Object.defineProperty(realm, '__adguardCanvasInstallation', { value: forged });
            Object.defineProperty(realm, realm.Symbol.for('adguard.canvas.installation'), { value: forged });
            realm.eval(createCanvasProtectionCode(state));
            repaint(fixture);
            expect(Array.from(fixture.context.getImageData(0, 0, 32, 16).data)).toEqual(
                expected(realm, fixture.original, state),
            );
        });
    });

    test('keeps optional private state away from inherited accessors', async () => {
        await withRealm((realm) => {
            const state = snapshot();
            const fixture = draw(realm);
            realm.eval(createCanvasProtectionCode(state));
            repaint(fixture);
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
            repaint(fixture);
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

    test('converts object coordinates once and in order, and noises the converted rectangle', async () => {
        await withRealm((realm) => {
            const state = snapshot();
            const fixture = draw(realm);
            realm.eval(createCanvasProtectionCode(state));
            repaint(fixture);
            const log: string[] = [];
            const coordinate = (name: string, value: number): object => ({
                valueOf: (): number => { log.push(name); return value; },
            });
            const crop = fixture.context.getImageData(
                coordinate('sx', 8.9) as unknown as number,
                coordinate('sy', 4) as unknown as number,
                coordinate('sw', 16) as unknown as number,
                coordinate('sh', 8) as unknown as number,
            );
            expect(log).toEqual(['sx', 'sy', 'sw', 'sh']);
            const full = expected(realm, fixture.original, state);
            const wanted: number[] = [];
            for (let y = 4; y < 12; y += 1) {
                wanted.push(...full.slice((y * 32 + 8) * 4, (y * 32 + 24) * 4));
            }
            expect(Array.from(crop.data)).toEqual(wanted);
        });
    });

    test('leaves primitive argument errors to the browser and stops at a rejected coordinate', async () => {
        await withRealm((realm) => {
            const natives = {
                getImageData: realm.CanvasRenderingContext2D.prototype.getImageData,
                toDataURL: realm.HTMLCanvasElement.prototype.toDataURL,
                toBlob: realm.HTMLCanvasElement.prototype.toBlob,
            };
            const fixture = draw(realm);
            realm.eval(createCanvasProtectionCode(snapshot()));
            repaint(fixture);
            const { context } = fixture;
            const failure = (method: Function, receiver: object, args: unknown[]): Error => {
                try {
                    Reflect.apply(method, receiver, args);
                } catch (error) {
                    expect(error).toBeInstanceOf(realm.TypeError);
                    return error as Error;
                }
                throw new Error('Expected a rejected argument');
            };
            let later = 0;
            const counted = { valueOf: (): number => { later += 1; return 1; } };
            [[Symbol('x'), 0, 1, 1], [0, 1n, 1, 1], [NaN, counted, 1, 1], [0, 2 ** 31, counted, 1]].forEach((args) => {
                expect(failure(context.getImageData, context, args).message).toBe(
                    failure(natives.getImageData, context, args).message,
                );
            });
            expect(later).toBe(0);
            expect(failure(context.canvas.toDataURL, context.canvas, [Symbol('type')]).message).toBe(
                failure(natives.toDataURL, context.canvas, [Symbol('type')]).message,
            );
            const callback = (): void => { throw new Error('Unexpected callback'); };
            expect(failure(context.canvas.toBlob, context.canvas, [callback, Symbol('type')]).message).toBe(
                failure(natives.toBlob, context.canvas, [callback, Symbol('type')]).message,
            );
        });
    });

    test('throws a realm TypeError when an object argument converts to no number or string', async () => {
        await withRealm(async (realm) => {
            const fixture = draw(realm);
            realm.eval(createCanvasProtectionCode(snapshot()));
            repaint(fixture);
            const { context } = fixture;
            let conversions = 0;
            let callbacks = 0;
            const toSymbol = { [Symbol.toPrimitive]: (): symbol => { conversions += 1; return Symbol('x'); } };
            const toObject = { toString: (): object => { conversions += 1; return {}; }, valueOf: undefined };
            expect(() => context.getImageData(toSymbol as unknown as number, 0, 1, 1)).toThrow(realm.TypeError);
            expect(() => context.canvas.toDataURL(toSymbol as unknown as string)).toThrow(realm.TypeError);
            expect(() => context.canvas.toBlob(() => { callbacks += 1; }, toObject as unknown as string))
                .toThrow(realm.TypeError);
            expect(conversions).toBe(3);
            await new Promise((resolve) => { setTimeout(resolve, 20); });
            expect(callbacks).toBe(0);
        });
    });

    /**
     * Lists functions the engine replaces, as they currently are in the realm.
     *
     * @param realm Document's global object.
     *
     * @returns Readouts, a rendering method, a frame accessor and the serializer.
     */
    const replaced = (realm: Realm): Function[] => [
        realm.HTMLCanvasElement.prototype.toDataURL,
        realm.CanvasRenderingContext2D.prototype.getImageData,
        realm.CanvasRenderingContext2D.prototype.fillText,
        realm.OffscreenCanvas.prototype.convertToBlob,
        Object.getOwnPropertyDescriptor(realm.HTMLIFrameElement.prototype, 'contentWindow')!.get!,
        realm.Function.prototype.toString,
    ];

    const outcome = (realm: Realm, run: () => unknown): string => {
        try {
            return `returned ${String(run())}`;
        } catch (error) {
            const { name, message } = error as Error;
            return `threw ${name}: ${message} (${error instanceof realm.TypeError ? 'realm' : 'foreign'} TypeError)`;
        }
    };

    test('rejects a prototype chain that leads back to a wrapper as a native function does', async () => {
        await withRealm((realm) => {
            const cycles = (method: Function): Record<string, string> => {
                const original = Object.getPrototypeOf(method);
                try {
                    const { create } = realm.Object;
                    return {
                        // The page's own builtins make the calls, as they do in a real document.
                        direct: outcome(realm, () => realm.Object.setPrototypeOf(method, create(method)) === method),
                        nested: outcome(realm, () => (
                            realm.Object.setPrototypeOf(method, create(create(method))) === method
                        )),
                        // eslint-disable-next-line no-proto -- The legacy setter is one of the native entry points.
                        legacy: outcome(realm, () => { (method as any).__proto__ = create(method); return 1; }),
                        // Firefox stacks do not name the native caller, so the wrapper cannot tell this call apart.
                        reflect: server.browser === 'firefox' ? 'not compared'
                            : outcome(realm, () => realm.Reflect.setPrototypeOf(method, create(method))),
                        unchanged: String(Object.getPrototypeOf(method) === original),
                        readable: outcome(realm, () => typeof method.toString),
                        detached: outcome(realm, () => {
                            Object.setPrototypeOf(method, null);
                            return Object.getPrototypeOf(method);
                        }),
                    };
                } finally {
                    Object.setPrototypeOf(method, original);
                }
            };
            const natives = replaced(realm);
            const references = natives.map(cycles);
            expect(references[0].direct).toContain('threw TypeError');
            realm.eval(createCanvasProtectionCode(snapshot()));
            replaced(realm).forEach((wrapper, index) => {
                expect(wrapper).not.toBe(natives[index]);
                expect(cycles(wrapper)).toEqual(references[index]);
            });
        });
    });

    test('reads arguments and caller of a wrapper as of a native function', async () => {
        await withRealm((realm) => {
            const restricted = (method: Function): string[] => [
                outcome(realm, () => (method as any).arguments),
                outcome(realm, () => (method as any).caller),
                outcome(realm, () => (method.toString as any).arguments),
                outcome(realm, () => (method.toString as any).caller),
            ];
            const natives = replaced(realm);
            const references = natives.map(restricted);
            realm.eval(createCanvasProtectionCode(snapshot()));
            const wrappers = replaced(realm);
            wrappers.forEach((wrapper, index) => expect(restricted(wrapper)).toEqual(references[index]));
            // An accessor defined by a page receives the wrapper, never the native function behind it.
            Object.defineProperty(realm.Function.prototype, 'arguments', {
                configurable: true, get(): unknown { return this; },
            });
            Object.defineProperty(wrappers[1], 'caller', { configurable: true, value: 5 });
            wrappers.forEach((wrapper) => expect((wrapper as any).arguments).toBe(wrapper));
            expect((wrappers[1] as any).caller).toBe(5);
        });
    });

    test.runIf(server.browser === 'chromium')('leaves no engine frames in errors raised under a wrapper', async () => {
        await withRealm((realm) => {
            const frames = (run: () => unknown): string[] => {
                try {
                    run();
                } catch (error) {
                    // Everything below the first frames belongs to this test and differs by call site.
                    return (error as Error).stack!.split('\n').slice(0, 2).map((line) => line.replace(/\(.*\)$/, ''));
                }
                throw new Error('Expected an error');
            };
            const probes = (method: Function): string[][] => [
                frames(() => Reflect.apply(method, {}, [])),
                frames(() => Object.create(method).toString()),
                frames(() => Object.create(Object.create(method)).toString()),
                frames(() => Object.create(new realm.Proxy(method, {})).toString()),
                frames(() => Object.setPrototypeOf(method, Object.create(method))),
            ];
            const engineFrame = /<anonymous>:\d+:\d+/;
            const complete = (method: Function): string => {
                try {
                    Reflect.apply(method, {}, []);
                } catch (error) {
                    return (error as Error).stack!;
                }
                throw new Error('Expected an error');
            };
            const natives = replaced(realm).slice(0, 3);
            const references = natives.map(probes);
            realm.eval(createCanvasProtectionCode(snapshot()));
            replaced(realm).slice(0, 3).forEach((wrapper, index) => {
                expect(probes(wrapper)).toEqual(references[index]);
                expect(complete(wrapper)).not.toMatch(engineFrame);
                expect(complete(wrapper).split('\n')).toHaveLength(complete(natives[index]).split('\n').length);
            });
        });
    });
});
