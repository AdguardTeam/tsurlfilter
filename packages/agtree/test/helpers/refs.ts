/**
 * @file Helper functions for testing AST nodes cloning by comparing object references
 */

/**
 * Collect all object references from the input object. For our AST nodes, it's enough to collect objects and arrays.
 *
 * @param obj Object to collect references from
 * @returns Collected references
 */
function collectRefs(obj: object): object[] {
    const refs: object[] = [];

    // push the object itself
    refs.push(obj);

    // push "sub-objects"
    Object.values(obj).forEach((value) => {
        if (typeof value === 'object' && value !== null) {
            // push the object itself
            refs.push(value);

            // recursively collect references, if the value is an array
            // note: we don't have circular references
            if (Array.isArray(value)) {
                refs.push(...collectRefs(value));
            }
        }
    });

    return refs;
}

/**
 * Sort two arrays by length, the shortest array first and the longest array second.
 * This is just a helper function for reference comparison
 *
 * @param a First array
 * @param b Second array
 * @returns A tuple with the shortest array first and the longest array second
 */
function sortArraysByLength<T>(a: T[], b: T[]): [T[], T[]] {
    if (a.length <= b.length) {
        return [a, b];
    }

    return [b, a];
}

/**
 * A very simple helper function to check that all references from A are not in B. This is not a fully general purpose,
 * but it's enough for testing our AST nodes
 *
 * @param objects Objects to check
 * @returns `true` if all references from A are not in B, `false` otherwise
 */
export function everyRefsAreDifferent(...objects: object[]): boolean {
    // trivial case
    if (objects.length < 2) {
        return true;
    }

    // collect object references
    const refs = objects.map(collectRefs);

    // check that all references are different
    for (let i = 0; i < refs.length; i += 1) {
        for (let j = i + 1; j < refs.length; j += 1) {
            // if there is at least one reference in common, return false
            const [shorter, longer] = sortArraysByLength(refs[i], refs[j]);
            if (shorter.some((ref) => longer.includes(ref))) {
                return false;
            }
        }
    }

    // all references are different
    return true;
}
