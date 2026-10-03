import { canvasIntrinsics as intrinsics, withoutPrototype } from './intrinsics';

/**
 * Preserves native callable metadata and native representations of wrappers.
 */
export interface NativeMasking {
    wrap<T extends Function>(native: T, apply: ProxyHandler<T>['apply']): T;
    serializer(nativeToString: typeof Function.prototype.toString): typeof Function.prototype.toString;
}

/**
 * Creates the private wrapper-to-native mapping of one engine instance.
 * Every realm the instance protects shares it, so a serializer borrowed from
 * another protected realm still reports the native representation.
 *
 * @returns A callable wrapper factory and a factory of realm serializers.
 */
export function createNativeMasking(): NativeMasking {
    const methods = new intrinsics.WeakMap<Function, Function>();
    const wrap = <T extends Function>(native: T, apply: ProxyHandler<T>['apply']): T => {
        const wrapper = new intrinsics.Proxy(native, withoutPrototype({ apply }));
        intrinsics.apply(intrinsics.weakSet, methods, [wrapper, native]);
        return wrapper;
    };
    return {
        wrap,
        serializer: (nativeToString) => wrap(nativeToString, (target, receiver, args): string => {
            const original = intrinsics.apply(intrinsics.weakGet, methods, [receiver]) ?? receiver;
            return intrinsics.apply(target, original, args);
        }),
    };
}
