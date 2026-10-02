import { server } from 'vitest/browser';

import {
    type CanvasNatives,
    captureCanvasNatives,
    createGetImageDataWrapper,
    createToBlobWrapper,
    createToDataURLWrapper,
} from '../../../src/lib/common/canvas-protection/readout';

/**
 * Same-browser, isolated native and protected documents with captured intrinsics.
 */
export interface CanvasRealmPair {
    readonly native: Window & typeof globalThis;
    readonly protected: Window & typeof globalThis;
    readonly nativeIntrinsics: CanvasNatives;
    readonly protectedIntrinsics: CanvasNatives;
    readonly seed: Uint8Array;
    readonly nativeCalls: { native: number; protected: number };
    readonly nativeBlobCallbacks: { native: unknown[]; protected: unknown[] };
    readonly nativeExports: {
        native: { toDataURL: number; toBlob: number };
        protected: { toDataURL: number; toBlob: number };
    };
}

/**
 * Runs a differential assertion in fresh realms, removing both documents on failure.
 * Direct fixture installation tests canvas semantics independently of extension delivery.
 *
 * @param test Differential assertion using the isolated pair.
 */
export async function withCanvasRealmPair(test: (pair: CanvasRealmPair) => Promise<void>): Promise<void> {
    const frames = [document.createElement('iframe'), document.createElement('iframe')];
    frames.forEach((frame) => {
        frame.hidden = true;
        document.body.appendChild(frame);
    });
    try {
        const native = frames[0].contentWindow as Window & typeof globalThis;
        const protectedRealm = frames[1].contentWindow as Window & typeof globalThis;
        const nativeCalls = { native: 0, protected: 0 };
        const exportPlatform = server.browser === 'firefox' ? 'firefox' as const : 'chromium' as const;
        const nativeIntrinsics = { ...captureCanvasNatives(native), exportPlatform };
        const protectedIntrinsics = { ...captureCanvasNatives(protectedRealm), exportPlatform };
        const nativeBlobCallbacks: CanvasRealmPair['nativeBlobCallbacks'] = { native: [], protected: [] };
        const nativeExports = {
            native: { toDataURL: 0, toBlob: 0 },
            protected: { toDataURL: 0, toBlob: 0 },
        };
        const originalNative = nativeIntrinsics.getImageData;
        const originalProtected = protectedIntrinsics.getImageData;
        const countedNative = new native.Proxy(originalNative, {
            apply: (target, receiver, args): ImageData => {
                nativeCalls.native += 1;
                return native.Reflect.apply(target, receiver, args);
            },
        });
        const countedProtected = new protectedRealm.Proxy(originalProtected, {
            apply: (target, receiver, args): ImageData => {
                nativeCalls.protected += 1;
                return protectedRealm.Reflect.apply(target, receiver, args);
            },
        });
        Object.defineProperty(native.CanvasRenderingContext2D.prototype, 'getImageData', {
            ...Object.getOwnPropertyDescriptor(native.CanvasRenderingContext2D.prototype, 'getImageData'),
            value: countedNative,
        });
        const seed = new Uint8Array(Array.from({ length: 16 }, (_, index) => index));
        const descriptor = Object.getOwnPropertyDescriptor(
            protectedRealm.CanvasRenderingContext2D.prototype,
            'getImageData',
        )!;
        Object.defineProperty(protectedRealm.CanvasRenderingContext2D.prototype, 'getImageData', {
            ...descriptor,
            value: createGetImageDataWrapper({ ...protectedIntrinsics, getImageData: countedProtected }, seed),
        });
        [native, protectedRealm].forEach((realm, index) => {
            const intrinsics = index === 0 ? nativeIntrinsics : protectedIntrinsics;
            const counts = index === 0 ? nativeExports.native : nativeExports.protected;
            const toDataURL = new realm.Proxy(intrinsics.toDataURL, {
                apply: (target, receiver, args): string => {
                    counts.toDataURL += 1;
                    return realm.Reflect.apply(target, receiver, args);
                },
            });
            const toBlob = new realm.Proxy(intrinsics.toBlob, {
                apply: (target, receiver, args): void => {
                    counts.toBlob += 1;
                    nativeBlobCallbacks[index === 0 ? 'native' : 'protected'].push(args[0]);
                    return realm.Reflect.apply(target, receiver, args);
                },
            });
            Object.defineProperty(realm.HTMLCanvasElement.prototype, 'toDataURL', {
                ...Object.getOwnPropertyDescriptor(realm.HTMLCanvasElement.prototype, 'toDataURL'),
                value: index === 0 ? toDataURL : createToDataURLWrapper({ ...intrinsics, toDataURL }, seed),
            });
            Object.defineProperty(realm.HTMLCanvasElement.prototype, 'toBlob', {
                ...Object.getOwnPropertyDescriptor(realm.HTMLCanvasElement.prototype, 'toBlob'),
                value: index === 0 ? toBlob : createToBlobWrapper({ ...intrinsics, toBlob }, seed),
            });
        });
        await test({
            native,
            protected: protectedRealm,
            nativeIntrinsics,
            protectedIntrinsics,
            seed,
            nativeCalls,
            nativeExports,
            nativeBlobCallbacks,
        });
    } finally {
        frames.forEach((frame) => frame.remove());
    }
}
