import { describe, expect, it } from 'vitest';

import { NETWORK_RULE_OPTIONS } from '@adguard/tsurlfilter';

import { OPTION_NAMES } from '../../src/rule/option-names';

describe('cross-package modifier coverage', () => {
    // The converter must know every modifier name the MV2 engine supports:
    // otherwise a modifier added to MV2 becomes an unknown modifier here, and
    // the rule is dropped on one engine only.
    it('knows every modifier name of the MV2 engine', () => {
        const known = new Set<string>(Object.values(OPTION_NAMES));
        const missing = Object.values(NETWORK_RULE_OPTIONS)
            .filter((name) => !known.has(name));

        expect(missing).toEqual([]);
    });
});
