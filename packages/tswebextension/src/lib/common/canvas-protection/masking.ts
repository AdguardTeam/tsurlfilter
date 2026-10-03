import { canvasIntrinsics as intrinsics, withoutPrototype } from './intrinsics';

type ApplyHandler<T extends Function> = NonNullable<ProxyHandler<T>['apply']>;

/**
 * Preserves native callable metadata, native representations and native failures of wrappers.
 */
export interface NativeMasking {
    wrap<T extends Function>(native: T, apply: ApplyHandler<T>): T;
    serializer(nativeToString: typeof Function.prototype.toString): typeof Function.prototype.toString;
    learnErrors(Constructor: ErrorConstructor): void;
}

/**
 * Location and line of the engine's own frames in stack traces, read once while the
 * engine loads and before any page code runs. The delivered engine is a single line.
 */
const OWN_FRAME = ((): string | undefined => {
    const { stack } = new Error();
    const match = typeof stack === 'string' ? /([^\s()@]+:\d+):\d+\)?$/m.exec(stack) : null;
    return match === null ? undefined : `${match[1]}:`;
})();
const FRAME_PREFIX = '    at ';
const PROTOTYPE_CHAIN_LIMIT = 1000;

/**
 * Splits a stack into lines without calling replaceable string or array methods.
 *
 * @param stack Stack text.
 *
 * @returns Its lines.
 */
const splitLines = (stack: string): string[] => {
    const lines: string[] = withoutPrototype([]);
    let position = 0;
    while (position <= stack.length) {
        let end = intrinsics.apply(intrinsics.indexOf, stack, ['\n', position]) as number;
        if (end === -1) {
            end = stack.length;
        }
        lines[lines.length] = intrinsics.apply(intrinsics.slice, stack, [position, end]);
        position = end + 1;
    }
    return lines;
};

const startsWith = (text: string, prefix: string): boolean => (
    intrinsics.apply(intrinsics.slice, text, [0, prefix.length]) === prefix
);

const isFrame = (line: string): boolean => startsWith(line, FRAME_PREFIX);

const isOwnFrame = (line: string): boolean => (
    OWN_FRAME !== undefined && intrinsics.apply(intrinsics.indexOf, line, [OWN_FRAME]) !== -1
);

/**
 * Creates the private wrapper-to-native mapping of one engine instance.
 * Every realm the instance protects shares it, so a serializer borrowed from
 * another protected realm still reports the native representation.
 *
 * @returns A callable wrapper factory and a factory of realm serializers.
 */
export function createNativeMasking(): NativeMasking {
    const methods = new intrinsics.WeakMap<Function, Function>();
    const stackSetters = new intrinsics.WeakMap<Function, Function>();

    /**
     * Reads the stack text of an error created by the browser in a protected realm.
     * V8 gives every error an own `stack` accessor backed by the realm's native pair.
     * Other errors, and other browsers' errors, are left as they are.
     *
     * @param error Thrown value.
     *
     * @returns The stack text and a writer that keeps the property's native shape.
     */
    const openStack = (error: unknown): { text: string; write(text: string): void } | undefined => {
        if (OWN_FRAME === undefined || error === null || (typeof error !== 'object' && typeof error !== 'function')) {
            return undefined;
        }
        const found = intrinsics.getOwnPropertyDescriptor(error, 'stack');
        if (found === undefined) {
            return undefined;
        }
        // Detached from Object.prototype, so a missing member cannot resolve to a page-defined one.
        const descriptor = withoutPrototype(found);
        if (typeof descriptor.value === 'string') {
            return {
                text: descriptor.value,
                write: (text): void => {
                    intrinsics.defineProperty(error, 'stack', withoutPrototype({ ...descriptor, value: text }));
                },
            };
        }
        if (descriptor.get === undefined) {
            return undefined;
        }
        const setter = intrinsics.apply(intrinsics.weakGet, stackSetters, [descriptor.get]);
        if (setter === undefined) {
            return undefined;
        }
        const text = intrinsics.apply(descriptor.get, error, []);
        return typeof text !== 'string' ? undefined : {
            text,
            write: (replacement): void => {
                intrinsics.apply(setter, error, [replacement]);
            },
        };
    };

    /**
     * Rewrites the stack of an error raised under a wrapper so that it reads as if the
     * native method had been called directly: the native frames it raised, then the
     * caller's frames captured again from below the wrapper. Capturing them again also
     * restores the frames that the engine's own had pushed past the stack limit.
     *
     * @param error Thrown value, returned for rethrowing.
     * @param boundary The engine's outermost function on the stack.
     * @param ownCall The error comes from a native call the engine made for itself, so its frames are dropped.
     * @param nativeFunctionReceiver Restores the frame label V8 gives when `toString` is called on
     * an object inheriting from a native function rather than from a proxy.
     *
     * @returns The same thrown value.
     */
    const repairStack = (
        error: unknown,
        boundary: Function,
        ownCall: boolean,
        nativeFunctionReceiver: boolean,
    ): unknown => {
        const opened = intrinsics.captureStackTrace === undefined ? undefined : openStack(error);
        if (opened === undefined) {
            return error;
        }
        const lines = splitLines(opened.text);
        let firstFrame = 0;
        while (firstFrame < lines.length && !isFrame(lines[firstFrame])) {
            firstFrame += 1;
        }
        let firstOwn = firstFrame;
        while (firstOwn < lines.length && !isOwnFrame(lines[firstOwn])) {
            firstOwn += 1;
        }
        if (firstOwn === lines.length) {
            return error;
        }
        const holder: { stack?: unknown } = withoutPrototype({});
        intrinsics.captureStackTrace!(holder, boundary);
        if (typeof holder.stack !== 'string') {
            return error;
        }
        const callers = splitLines(holder.stack);
        let stack = '';
        for (let index = 0; index < firstFrame; index += 1) {
            stack += index === 0 ? lines[index] : `\n${lines[index]}`;
        }
        let frames = lines.length - firstFrame;
        for (let index = firstFrame; index < firstOwn && !ownCall; index += 1) {
            let line = lines[index];
            if (index === firstFrame && nativeFunctionReceiver
                && startsWith(line, `${FRAME_PREFIX}Object.toString (`)) {
                line = `${FRAME_PREFIX}Function.toString (${intrinsics.apply(intrinsics.slice, line, [24])}`;
            }
            stack += `\n${line}`;
            frames -= 1;
        }
        for (let index = 0; index < callers.length && frames > 0; index += 1) {
            if (isFrame(callers[index])) {
                stack += `\n${callers[index]}`;
                frames -= 1;
            }
        }
        opened.write(stack);
        return error;
    };

    const isWrapper = (value: unknown): boolean => intrinsics.apply(intrinsics.weakGet, methods, [value]) !== undefined;
    const inheritsFromWrapper = (value: unknown): boolean => {
        if (value === null || typeof value !== 'object') {
            return false;
        }
        let link = intrinsics.getPrototypeOf(value);
        for (let depth = 0; link !== null && depth < PROTOTYPE_CHAIN_LIMIT; depth += 1) {
            if (isWrapper(link)) {
                return true;
            }
            link = intrinsics.getPrototypeOf(link);
        }
        return false;
    };
    const accessor = (owner: object | null, name: string): Function | undefined => {
        const found = owner === null ? undefined : intrinsics.getOwnPropertyDescriptor(owner, name);
        return found === undefined ? undefined : withoutPrototype(found).get;
    };

    const wrap = <T extends Function>(
        native: T,
        apply: ApplyHandler<T>,
        nativeFunctionReceiver?: (receiver: unknown) => boolean,
    ): T => {
        // `arguments` and `caller` of a native function resolve to native accessors of its
        // Function.prototype. Firefox reports an incompatible receiver when they run on a proxy.
        const home = intrinsics.getPrototypeOf(native);
        const restricted = withoutPrototype({
            arguments: accessor(home, 'arguments'), caller: accessor(home, 'caller'),
        });
        const applyTrap = (target: T, receiver: unknown, args: unknown[]): unknown => {
            try {
                return apply(target, receiver, args);
            } catch (error) {
                throw repairStack(error, applyTrap, false, nativeFunctionReceiver?.(receiver) ?? false);
            }
        };
        const getTrap = (target: T, property: string | symbol, receiver: unknown): unknown => {
            // eslint-disable-next-line @typescript-eslint/no-use-before-define -- The proxy refers to its handler.
            if (receiver === wrapper && (property === 'arguments' || property === 'caller')) {
                const getter = restricted[property];
                // Only the untouched native accessor runs on the target: it never returns its receiver.
                if (getter !== undefined
                    && intrinsics.getOwnPropertyDescriptor(target, property) === undefined
                    && intrinsics.getPrototypeOf(target) === home
                    && accessor(home, property) === getter) {
                    try {
                        return intrinsics.apply(getter, target, []);
                    } catch (error) {
                        throw repairStack(error, getTrap, false, false);
                    }
                }
            }
            return intrinsics.get(target, property, receiver);
        };
        // A native function rejects a prototype whose chain leads back to it. A proxy would
        // accept it and recurse forever on the next property read. The rejection is produced
        // by the native target, so the error is the browser's own.
        const setPrototypeOfTrap = (target: T, prototype: object | null): boolean => {
            let link = prototype;
            let cyclic = false;
            for (let depth = 0; link !== null && !cyclic && depth < PROTOTYPE_CHAIN_LIMIT; depth += 1) {
                // eslint-disable-next-line @typescript-eslint/no-use-before-define -- The proxy refers to its handler.
                cyclic = link === wrapper;
                link = cyclic ? link : intrinsics.getPrototypeOf(link);
            }
            if (!cyclic) {
                return intrinsics.reflectSetPrototypeOf(target, prototype);
            }
            try {
                intrinsics.setPrototypeOf(target, intrinsics.create(target));
            } catch (error) {
                const opened = openStack(error);
                const lines = opened === undefined ? withoutPrototype<string[]>([]) : splitLines(opened.text);
                for (let index = 1; index < lines.length - 1; index += 1) {
                    // `Reflect.setPrototypeOf` reports the rejection by returning false.
                    if (isOwnFrame(lines[index]) && !isOwnFrame(lines[index + 1])) {
                        if (startsWith(lines[index + 1], `${FRAME_PREFIX}Reflect.setPrototypeOf (`)) {
                            return false;
                        }
                        break;
                    }
                }
                throw repairStack(error, setPrototypeOfTrap, true, false);
            }
            return false;
        };
        const wrapper: T = new intrinsics.Proxy(native, withoutPrototype({
            apply: applyTrap, get: getTrap, setPrototypeOf: setPrototypeOfTrap,
        }));
        intrinsics.apply(intrinsics.weakSet, methods, [wrapper, native]);
        return wrapper;
    };

    return {
        wrap,
        learnErrors: (Constructor): void => {
            const found = intrinsics.getOwnPropertyDescriptor(new Constructor(), 'stack');
            const descriptor = found === undefined ? undefined : withoutPrototype(found);
            if (descriptor?.get !== undefined && descriptor.set !== undefined) {
                intrinsics.apply(intrinsics.weakSet, stackSetters, [descriptor.get, descriptor.set]);
            }
        },
        serializer: (nativeToString) => wrap(
            nativeToString,
            (target, receiver, args): string => intrinsics.apply(
                target,
                intrinsics.apply(intrinsics.weakGet, methods, [receiver]) ?? receiver,
                args,
            ),
            inheritsFromWrapper,
        ),
    };
}
