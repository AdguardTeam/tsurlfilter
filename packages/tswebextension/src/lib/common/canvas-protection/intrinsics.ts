/**
 * JavaScript operations captured privately when the standalone realm engine loads.
 * Later page replacements never receive hash state, seeds or private pixel buffers.
 */
const typedArrayPrototype = Object.getPrototypeOf(Uint8Array.prototype);
export const canvasIntrinsics = Object.freeze({
    Uint8Array,
    Uint32Array,
    DataView,
    TextEncoder,
    Proxy,
    WeakMap,
    apply: Reflect.apply,
    floor: Math.floor,
    min: Math.min,
    max: Math.max,
    parseInt: Number.parseInt,
    slice: String.prototype.slice,
    encode: TextEncoder.prototype.encode,
    typedLength: Object.getOwnPropertyDescriptor(typedArrayPrototype, 'length')!.get!,
    typedBuffer: Object.getOwnPropertyDescriptor(typedArrayPrototype, 'buffer')!.get!,
    typedTag: Object.getOwnPropertyDescriptor(typedArrayPrototype, Symbol.toStringTag)!.get!,
    typedSet: typedArrayPrototype.set as Uint8Array['set'],
    setUint32: DataView.prototype.setUint32,
    weakGet: WeakMap.prototype.get,
    weakSet: WeakMap.prototype.set,
    setPrototypeOf: Object.setPrototypeOf,
    objectPrototype: Object.prototype,
});

/**
 * Removes inherited callbacks from private state, Proxy handlers and WebIDL dictionaries.
 *
 * @param value Newly created private handler or options dictionary.
 *
 * @returns The same object with no inherited page-owned callbacks.
 */
export function withoutPrototype<T extends object>(value: T): T {
    return canvasIntrinsics.setPrototypeOf(value, null);
}
