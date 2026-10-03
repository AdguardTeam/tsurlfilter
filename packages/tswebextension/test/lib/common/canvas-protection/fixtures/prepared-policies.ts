import {
    type DocumentPolicyInput,
    type PreparedCondition,
    type PreparedPolicyRule,
    type ProtectionPolicyArtifact,
} from '../../../../../src/lib/common/canvas-protection/contracts';

/**
 * Creates a prepared policy with no exclusions for supported URL delivery.
 *
 * @param browser Browser registration adapter.
 * @param revision Captured policy revision.
 *
 * @returns A seed-free prepared policy.
 */
export const createProtectAllPolicy = (
    browser: ProtectionPolicyArtifact['browser'],
    revision: string,
): ProtectionPolicyArtifact => ({
    schemaVersion: 1,
    revision,
    browser,
    selectors: { matches: ['<all_urls>'], excludeMatches: [] },
    ownFrameExclusions: [],
    documentExclusions: [],
    unavailableConditions: [],
});

/**
 * A prepared predicate and its independently specified expected decision.
 */
export interface PreparedPolicyFixture {
    readonly name: string;
    readonly rule: PreparedPolicyRule;
    readonly url: string;
    readonly requestType?: DocumentPolicyInput['requestType'];
    readonly sourceUrl?: string;
    readonly excluded: boolean;
}

const protocolCondition: PreparedCondition = {
    type: 'url-regexp', input: 'frame-url', pattern: '^https://', flags: '',
};

const targetCondition: PreparedCondition = {
    type: 'url-regexp', input: 'frame-url', pattern: '^https://(?:a|b)\\.example\\.com/', flags: '',
};

const denyCondition: PreparedCondition = {
    type: 'url-regexp', input: 'frame-url', pattern: '^https://b\\.example\\.com/', flags: '',
};

const sourceCondition: PreparedCondition = {
    type: 'url-regexp', input: 'source-url', pattern: '^https://publisher\\.example/', flags: '',
};

/**
 * Exact prepared predicates, without filter-text parsing or transformation.
 */
export const preparedPolicyFixtures: readonly PreparedPolicyFixture[] = [
    {
        name: 'host positive',
        rule: { requestTypes: ['document'], condition: targetCondition },
        url: 'https://a.example.com/',
        excluded: true,
    },
    {
        name: 'host negative',
        rule: { requestTypes: ['document'], condition: targetCondition },
        url: 'https://c.example.com/',
        excluded: false,
    },
    {
        name: 'source positive',
        rule: { requestTypes: ['subdocument'], condition: sourceCondition },
        url: 'https://frame.example/',
        requestType: 'subdocument',
        sourceUrl: 'https://publisher.example/article',
        excluded: true,
    },
    {
        name: 'source negative',
        rule: { requestTypes: ['subdocument'], condition: sourceCondition },
        url: 'https://frame.example/',
        requestType: 'subdocument',
        sourceUrl: 'https://other.example/article',
        excluded: false,
    },
    {
        name: 'source unknown',
        rule: { requestTypes: ['subdocument'], condition: sourceCondition },
        url: 'https://frame.example/',
        requestType: 'subdocument',
        excluded: false,
    },
    {
        name: 'target to set positive',
        rule: {
            requestTypes: ['document'],
            condition: {
                type: 'and', operands: [targetCondition, { type: 'not', operand: denyCondition }],
            },
        },
        url: 'https://a.example.com/',
        excluded: true,
    },
    {
        name: 'target denyallow set negative',
        rule: {
            requestTypes: ['document'],
            condition: {
                type: 'and', operands: [targetCondition, { type: 'not', operand: denyCondition }],
            },
        },
        url: 'https://b.example.com/',
        excluded: false,
    },
    {
        name: 'target outside to set negative',
        rule: {
            requestTypes: ['document'],
            condition: {
                type: 'and', operands: [targetCondition, { type: 'not', operand: denyCondition }],
            },
        },
        url: 'https://c.example.com/',
        excluded: false,
    },
    {
        name: 'case sensitive negative',
        rule: {
            requestTypes: ['document'],
            condition: {
                type: 'url-regexp', input: 'frame-url', pattern: '/Native$', flags: '',
            },
        },
        url: 'https://example.com/native',
        excluded: false,
    },
    {
        name: 'case insensitive positive',
        rule: {
            requestTypes: ['document'],
            condition: {
                type: 'url-regexp', input: 'frame-url', pattern: '/Native$', flags: 'i',
            },
        },
        url: 'https://example.com/native',
        excluded: true,
    },
    {
        name: 'document mask positive',
        rule: { requestTypes: ['document'], condition: protocolCondition },
        url: 'https://example.com/',
        requestType: 'document',
        excluded: true,
    },
    {
        name: 'document mask child negative',
        rule: { requestTypes: ['document'], condition: protocolCondition },
        url: 'https://example.com/',
        requestType: 'subdocument',
        excluded: false,
    },
    {
        name: 'subdocument mask positive',
        rule: { requestTypes: ['subdocument'], condition: protocolCondition },
        url: 'https://example.com/',
        requestType: 'subdocument',
        excluded: true,
    },
    {
        name: 'subdocument mask top negative',
        rule: { requestTypes: ['subdocument'], condition: protocolCondition },
        url: 'https://example.com/',
        requestType: 'document',
        excluded: false,
    },
];
