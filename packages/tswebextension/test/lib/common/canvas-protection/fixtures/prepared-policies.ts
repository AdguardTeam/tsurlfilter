import { CanvasConditionFlags, CanvasConditionType } from '../../../../../src/lib/common/canvas-protection/constants';
import {
    type PreparedCondition,
    type ProtectionPolicyArtifact,
} from '../../../../../src/lib/common/canvas-protection/contracts';

/**
 * Creates a prepared policy with no exclusions for supported URL delivery.
 *
 * @param revision Captured policy revision.
 *
 * @returns A seed-free prepared policy.
 */
export const createProtectAllPolicy = (
    revision: string,
): ProtectionPolicyArtifact => ({
    revision,
    selectors: { matches: ['<all_urls>'], excludeMatches: [] },
    documentExclusions: [],
});

/**
 * A prepared predicate and its independently specified expected decision.
 */
export interface PreparedPolicyFixture {
    readonly name: string;
    readonly condition: PreparedCondition;
    readonly url: string;
    readonly excluded: boolean;
}

const targetCondition: PreparedCondition = {
    type: CanvasConditionType.UrlRegexp,
    pattern: '^https://(?:a|b)\\.example\\.com/',
    flags: CanvasConditionFlags.None,
};

/**
 * Exact prepared predicates, without filter-text parsing or transformation.
 */
export const preparedPolicyFixtures: readonly PreparedPolicyFixture[] = [
    {
        name: 'host positive',
        condition: targetCondition,
        url: 'https://a.example.com/',
        excluded: true,
    },
    {
        name: 'host negative',
        condition: targetCondition,
        url: 'https://c.example.com/',
        excluded: false,
    },
    {
        name: 'case sensitive negative',
        condition: {
            type: CanvasConditionType.UrlRegexp,
            pattern: '/Native$',
            flags: CanvasConditionFlags.None,
        },
        url: 'https://example.com/native',
        excluded: false,
    },
    {
        name: 'case insensitive positive',
        condition: {
            type: CanvasConditionType.UrlRegexp,
            pattern: '/Native$',
            flags: CanvasConditionFlags.IgnoreCase,
        },
        url: 'https://example.com/native',
        excluded: true,
    },
];
