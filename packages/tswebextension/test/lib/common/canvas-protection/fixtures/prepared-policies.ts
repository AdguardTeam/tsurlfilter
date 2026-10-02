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
    readonly sourceUrl?: DocumentPolicyInput['sourceUrl'];
    readonly excluded: boolean;
    readonly unavailableReason?: string;
}

const pathCondition: PreparedCondition = {
    type: 'url-regexp', input: 'frame-url', pattern: '^https://example\\.com/native(?:\\?|$)', flags: '',
};

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

const encodedCondition: PreparedCondition = {
    type: 'url-regexp', input: 'frame-url', pattern: '^https://example\\.com/a%2Fb\\?q=%26$', flags: '',
};

/**
 * Exact prepared predicates, without filter-text parsing or transformation.
 */
export const preparedPolicyFixtures: readonly PreparedPolicyFixture[] = [
    {
        name: 'protocol positive',
        rule: { requestTypes: ['document'], condition: protocolCondition },
        url: 'https://example.com/',
        excluded: true,
    },
    {
        name: 'protocol negative',
        rule: { requestTypes: ['document'], condition: protocolCondition },
        url: 'http://example.com/',
        excluded: false,
    },
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
        name: 'path positive',
        rule: { requestTypes: ['document'], condition: pathCondition },
        url: 'https://example.com/native',
        excluded: true,
    },
    {
        name: 'path negative',
        rule: { requestTypes: ['document'], condition: pathCondition },
        url: 'https://example.com/protected',
        excluded: false,
    },
    {
        name: 'query positive',
        rule: {
            requestTypes: ['document'],
            condition: {
                type: 'url-regexp', input: 'frame-url', pattern: '\\?native=1(?:&|$)', flags: '',
            },
        },
        url: 'https://example.com/?native=1',
        excluded: true,
    },
    {
        name: 'query negative',
        rule: {
            requestTypes: ['document'],
            condition: {
                type: 'url-regexp', input: 'frame-url', pattern: '\\?native=1(?:&|$)', flags: '',
            },
        },
        url: 'https://example.com/?native=10',
        excluded: false,
    },
    {
        name: 'regex positive',
        rule: {
            requestTypes: ['document'],
            condition: {
                type: 'url-regexp', input: 'frame-url', pattern: '/item/[0-9]+(?:\\?|$)', flags: '',
            },
        },
        url: 'https://example.com/item/42',
        excluded: true,
    },
    {
        name: 'regex negative',
        rule: {
            requestTypes: ['document'],
            condition: {
                type: 'url-regexp', input: 'frame-url', pattern: '/item/[0-9]+(?:\\?|$)', flags: '',
            },
        },
        url: 'https://example.com/item/name',
        excluded: false,
    },
    {
        name: 'IPv4 positive',
        rule: {
            requestTypes: ['document'],
            condition: {
                type: 'url-regexp', input: 'frame-url', pattern: '^http://127\\.0\\.0\\.1/', flags: '',
            },
        },
        url: 'http://127.0.0.1/',
        excluded: true,
    },
    {
        name: 'IPv4 negative',
        rule: {
            requestTypes: ['document'],
            condition: {
                type: 'url-regexp', input: 'frame-url', pattern: '^http://127\\.0\\.0\\.1/', flags: '',
            },
        },
        url: 'http://127.0.0.2/',
        excluded: false,
    },
    {
        name: 'IPv6 positive',
        rule: {
            requestTypes: ['document'],
            condition: {
                type: 'url-regexp', input: 'frame-url', pattern: '^http://\\[2001:db8::1\\]/', flags: '',
            },
        },
        url: 'http://[2001:db8::1]/',
        excluded: true,
    },
    {
        name: 'IPv6 negative',
        rule: {
            requestTypes: ['document'],
            condition: {
                type: 'url-regexp', input: 'frame-url', pattern: '^http://\\[2001:db8::1\\]/', flags: '',
            },
        },
        url: 'http://[2001:db8::2]/',
        excluded: false,
    },
    {
        name: 'IDN positive',
        rule: {
            requestTypes: ['document'],
            condition: {
                type: 'url-regexp', input: 'frame-url', pattern: '^https://xn--bcher-kva\\.example/', flags: '',
            },
        },
        url: 'https://xn--bcher-kva.example/',
        excluded: true,
    },
    {
        name: 'IDN negative',
        rule: {
            requestTypes: ['document'],
            condition: {
                type: 'url-regexp', input: 'frame-url', pattern: '^https://xn--bcher-kva\\.example/', flags: '',
            },
        },
        url: 'https://books.example/',
        excluded: false,
    },
    {
        name: 'port positive',
        rule: {
            requestTypes: ['document'],
            condition: {
                type: 'url-regexp', input: 'frame-url', pattern: '^https://example\\.com:8443/', flags: '',
            },
        },
        url: 'https://example.com:8443/',
        excluded: true,
    },
    {
        name: 'port negative',
        rule: {
            requestTypes: ['document'],
            condition: {
                type: 'url-regexp', input: 'frame-url', pattern: '^https://example\\.com:8443/', flags: '',
            },
        },
        url: 'https://example.com:9443/',
        excluded: false,
    },
    {
        name: 'source positive',
        rule: { requestTypes: ['subdocument'], condition: sourceCondition },
        url: 'https://frame.example/',
        requestType: 'subdocument',
        sourceUrl: { status: 'available', value: 'https://publisher.example/article' },
        excluded: true,
    },
    {
        name: 'source negative',
        rule: { requestTypes: ['subdocument'], condition: sourceCondition },
        url: 'https://frame.example/',
        requestType: 'subdocument',
        sourceUrl: { status: 'available', value: 'https://other.example/article' },
        excluded: false,
    },
    {
        name: 'source unavailable',
        rule: { requestTypes: ['subdocument'], condition: sourceCondition },
        url: 'https://frame.example/',
        requestType: 'subdocument',
        sourceUrl: { status: 'unavailable', reason: 'special-frame-source-unavailable' },
        excluded: false,
        unavailableReason: 'special-frame-source-unavailable',
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
        name: 'anchor positive',
        rule: {
            requestTypes: ['document'],
            condition: {
                type: 'url-regexp', input: 'frame-url', pattern: '^https://example\\.com/native$', flags: '',
            },
        },
        url: 'https://example.com/native',
        excluded: true,
    },
    {
        name: 'anchor negative',
        rule: {
            requestTypes: ['document'],
            condition: {
                type: 'url-regexp', input: 'frame-url', pattern: '^https://example\\.com/native$', flags: '',
            },
        },
        url: 'https://example.com/native/more',
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
        name: 'percent encoding positive',
        rule: { requestTypes: ['document'], condition: encodedCondition },
        url: 'https://example.com/a%2Fb?q=%26',
        excluded: true,
    },
    {
        name: 'percent encoding negative',
        rule: { requestTypes: ['document'], condition: encodedCondition },
        url: 'https://example.com/a/b?q=&',
        excluded: false,
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
