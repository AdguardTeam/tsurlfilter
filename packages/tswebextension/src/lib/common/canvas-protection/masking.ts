import { canvasIntrinsics as intrinsics, withoutPrototype } from './intrinsics';

/**
 * Preserves native callable metadata and native representations in one realm.
 */
export interface NativeMasking {
    readonly toString: typeof Function.prototype.toString;
    wrap<T extends Function>(native: T, apply: ProxyHandler<T>['apply']): T;
}

/**
 * Creates private mappings used by the realm's native stringification hook.
 *
 * @param nativeToString Captured native function serializer.
 *
 * @returns A callable wrapper factory and the realm-wide serializer.
 */
export function createNativeMasking(nativeToString: typeof Function.prototype.toString): NativeMasking {
    const methods = new intrinsics.WeakMap<Function, Function>();
    const toString = new intrinsics.Proxy(nativeToString, withoutPrototype({
        apply: (target, receiver, args): string => {
            const original = intrinsics.apply(intrinsics.weakGet, methods, [receiver]) ?? receiver;
            return intrinsics.apply(target, original, args);
        },
    }));
    intrinsics.apply(intrinsics.weakSet, methods, [toString, nativeToString]);
    return {
        toString,
        wrap: <T extends Function>(native: T, apply: ProxyHandler<T>['apply']): T => {
            const wrapper = new intrinsics.Proxy(native, withoutPrototype({ apply }));
            intrinsics.apply(intrinsics.weakSet, methods, [wrapper, native]);
            return wrapper;
        },
    };
}
