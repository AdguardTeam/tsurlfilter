/**
 * @file Determines modifier value kind from modifier name at parse time.
 *
 * Uses zero-allocation region comparison — no strings are allocated.
 */

import { regionEquals } from '../context';
import {
    MOD_KIND_CSP,
    MOD_KIND_DOMAIN_LIST,
    MOD_KIND_RESOURCE,
    MOD_KIND_UNKNOWN,
} from '../network/constants';

/**
 * Determines the value kind for a modifier based on its name.
 * Returns the kind constant (MOD_KIND_*) to be packed into flags.
 *
 * @param source Source string.
 * @param nameStart Start index of modifier name (inclusive).
 * @param nameEnd End index of modifier name (exclusive).
 *
 * @returns Kind constant value (0 = unknown).
 */
export function getModifierValueKind(
    source: string,
    nameStart: number,
    nameEnd: number,
): number {
    const len = nameEnd - nameStart;

    switch (len) {
        case 2:
            // "to"
            if (regionEquals(source, nameStart, nameEnd, 'to')) {
                return MOD_KIND_DOMAIN_LIST;
            }
            break;

        case 3:
            // "csp"
            if (regionEquals(source, nameStart, nameEnd, 'csp')) {
                return MOD_KIND_CSP;
            }
            break;

        case 4:
            // "from"
            if (regionEquals(source, nameStart, nameEnd, 'from')) {
                return MOD_KIND_DOMAIN_LIST;
            }
            break;

        case 6:
            // "domain"
            if (regionEquals(source, nameStart, nameEnd, 'domain')) {
                return MOD_KIND_DOMAIN_LIST;
            }
            break;

        case 7:
            // "rewrite"
            if (regionEquals(source, nameStart, nameEnd, 'rewrite')) {
                return MOD_KIND_RESOURCE;
            }
            break;

        case 8:
            // "redirect"
            if (regionEquals(source, nameStart, nameEnd, 'redirect')) {
                return MOD_KIND_RESOURCE;
            }
            break;

        case 9:
            // "denyallow"
            if (regionEquals(source, nameStart, nameEnd, 'denyallow')) {
                return MOD_KIND_DOMAIN_LIST;
            }
            break;

        case 11:
            // "permissions"
            // Intentionally mapped to MOD_KIND_CSP: both `csp` and `permissions`
            // produce HTTP-directive strings with similar grammar (space-separated
            // directives). A downstream consumer that needs to distinguish the two
            // can inspect the modifier name; the `kind` field signals only that
            // sub-parsing as a directive list is possible.
            if (regionEquals(source, nameStart, nameEnd, 'permissions')) {
                return MOD_KIND_CSP;
            }
            break;

        case 13:
            // "redirect-rule"
            if (regionEquals(source, nameStart, nameEnd, 'redirect-rule')) {
                return MOD_KIND_RESOURCE;
            }
            break;

        default:
            break;
    }

    return MOD_KIND_UNKNOWN;
}
