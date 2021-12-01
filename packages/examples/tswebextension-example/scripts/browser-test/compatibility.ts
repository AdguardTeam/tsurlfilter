import { Product } from './product';

export interface Compatibility {
    full?: boolean,
    partial?: {
        exceptions: {
            product: Product,
            cases: number[],
        }[],
    },
    none?: {
        products: Product[]
    },
    special?: {
        compatible: Product[],
        incompatible: Product[],
    }
}

export const isCompatible = (compatiblity: Compatibility, product: Product) => {
    const {
        full,
        partial,
        none,
        special,
    } = compatiblity;

    if (full) {
        return true;
    }

    if (special) {
        return special.compatible.includes(product);
    }

    if (none) {
        return (!none.products.includes(product));
    }

    if (partial) {
        return partial.exceptions.map(ex => ex.product).includes(product);
    }
}
