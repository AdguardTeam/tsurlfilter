import {
    CanvasConditionFlags,
    CanvasConditionInput,
    CanvasConditionType,
    CanvasPolicyRequestType,
} from '../../../../../src/lib/common/canvas-protection/constants';
import {
    type DocumentPolicyInput,
    type PreparedCondition,
    type PreparedPolicyRule,
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
    ownFrameExclusions: [],
    documentExclusions: [],
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
    type: CanvasConditionType.UrlRegexp, input: CanvasConditionInput.FrameUrl, pattern: '^https://', flags: CanvasConditionFlags.None,
};

const targetCondition: PreparedCondition = {
    type: CanvasConditionType.UrlRegexp,
    input: CanvasConditionInput.FrameUrl,
    pattern: '^https://(?:a|b)\\.example\\.com/',
    flags: CanvasConditionFlags.None,
};

const denyCondition: PreparedCondition = {
    type: CanvasConditionType.UrlRegexp,
    input: CanvasConditionInput.FrameUrl,
    pattern: '^https://b\\.example\\.com/',
    flags: CanvasConditionFlags.None,
};

const sourceCondition: PreparedCondition = {
    type: CanvasConditionType.UrlRegexp,
    input: CanvasConditionInput.SourceUrl,
    pattern: '^https://publisher\\.example/',
    flags: CanvasConditionFlags.None,
};

/**
 * Exact prepared predicates, without filter-text parsing or transformation.
 */
export const preparedPolicyFixtures: readonly PreparedPolicyFixture[] = [
    {
        name: 'host positive',
        rule: { requestTypes: [CanvasPolicyRequestType.Document], condition: targetCondition },
        url: 'https://a.example.com/',
        excluded: true,
    },
    {
        name: 'host negative',
        rule: { requestTypes: [CanvasPolicyRequestType.Document], condition: targetCondition },
        url: 'https://c.example.com/',
        excluded: false,
    },
    {
        name: 'source positive',
        rule: { requestTypes: [CanvasPolicyRequestType.Subdocument], condition: sourceCondition },
        url: 'https://frame.example/',
        requestType: CanvasPolicyRequestType.Subdocument,
        sourceUrl: 'https://publisher.example/article',
        excluded: true,
    },
    {
        name: 'source negative',
        rule: { requestTypes: [CanvasPolicyRequestType.Subdocument], condition: sourceCondition },
        url: 'https://frame.example/',
        requestType: CanvasPolicyRequestType.Subdocument,
        sourceUrl: 'https://other.example/article',
        excluded: false,
    },
    {
        name: 'source unknown',
        rule: { requestTypes: [CanvasPolicyRequestType.Subdocument], condition: sourceCondition },
        url: 'https://frame.example/',
        requestType: CanvasPolicyRequestType.Subdocument,
        excluded: false,
    },
    {
        name: 'target to set positive',
        rule: {
            requestTypes: [CanvasPolicyRequestType.Document],
            condition: {
                type: CanvasConditionType.And,
                operands: [targetCondition, { type: CanvasConditionType.Not, operand: denyCondition }],
            },
        },
        url: 'https://a.example.com/',
        excluded: true,
    },
    {
        name: 'target denyallow set negative',
        rule: {
            requestTypes: [CanvasPolicyRequestType.Document],
            condition: {
                type: CanvasConditionType.And,
                operands: [targetCondition, { type: CanvasConditionType.Not, operand: denyCondition }],
            },
        },
        url: 'https://b.example.com/',
        excluded: false,
    },
    {
        name: 'target outside to set negative',
        rule: {
            requestTypes: [CanvasPolicyRequestType.Document],
            condition: {
                type: CanvasConditionType.And,
                operands: [targetCondition, { type: CanvasConditionType.Not, operand: denyCondition }],
            },
        },
        url: 'https://c.example.com/',
        excluded: false,
    },
    {
        name: 'case sensitive negative',
        rule: {
            requestTypes: [CanvasPolicyRequestType.Document],
            condition: {
                type: CanvasConditionType.UrlRegexp,
                input: CanvasConditionInput.FrameUrl,
                pattern: '/Native$',
                flags: CanvasConditionFlags.None,
            },
        },
        url: 'https://example.com/native',
        excluded: false,
    },
    {
        name: 'case insensitive positive',
        rule: {
            requestTypes: [CanvasPolicyRequestType.Document],
            condition: {
                type: CanvasConditionType.UrlRegexp,
                input: CanvasConditionInput.FrameUrl,
                pattern: '/Native$',
                flags: CanvasConditionFlags.IgnoreCase,
            },
        },
        url: 'https://example.com/native',
        excluded: true,
    },
    {
        name: 'document mask positive',
        rule: { requestTypes: [CanvasPolicyRequestType.Document], condition: protocolCondition },
        url: 'https://example.com/',
        requestType: CanvasPolicyRequestType.Document,
        excluded: true,
    },
    {
        name: 'document mask child negative',
        rule: { requestTypes: [CanvasPolicyRequestType.Document], condition: protocolCondition },
        url: 'https://example.com/',
        requestType: CanvasPolicyRequestType.Subdocument,
        excluded: false,
    },
    {
        name: 'subdocument mask positive',
        rule: { requestTypes: [CanvasPolicyRequestType.Subdocument], condition: protocolCondition },
        url: 'https://example.com/',
        requestType: CanvasPolicyRequestType.Subdocument,
        excluded: true,
    },
    {
        name: 'subdocument mask top negative',
        rule: { requestTypes: [CanvasPolicyRequestType.Subdocument], condition: protocolCondition },
        url: 'https://example.com/',
        requestType: CanvasPolicyRequestType.Document,
        excluded: false,
    },
];
