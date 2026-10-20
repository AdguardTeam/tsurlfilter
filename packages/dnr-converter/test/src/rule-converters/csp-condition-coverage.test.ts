import { describe, expect, it } from 'vitest';

import {
    DomainType,
    RequestMethod,
    ResourceType,
    type RuleCondition,
} from '../../../src/declarative-rule/rule-condition';
import { coversNonUrlConditions, isDomainCovered } from '../../../src/rule-converters/csp-condition-coverage';

/**
 * A request which a condition can match or not.
 */
type SampleRequest = {
    party: DomainType;
    resourceType: ResourceType;
    method: RequestMethod;
    initiator: string;
    headers: Record<string, string>;
};

/**
 * Header conditions used in the sample conditions.
 */
const HEADER_CONDITIONS: RuleCondition['responseHeaders'] = [
    { header: 'set-cookie' },
    { header: 'set-cookie', values: ['a'] },
    { header: 'x-frame-options' },
];

/**
 * Headers of the sample requests.
 */
const SAMPLE_HEADERS: Record<string, string>[] = [
    {},
    { 'set-cookie': 'a' },
    { 'x-frame-options': 'deny' },
];

/**
 * Non-URL condition fragments used to build the sample conditions.
 *
 * The list mixes single restrictions with their combinations, so the coverage
 * check is compared against the independent matcher below for every pair.
 */
const CONDITION_FRAGMENTS: RuleCondition[] = [
    {},
    { domainType: DomainType.FirstParty },
    { domainType: DomainType.ThirdParty },
    { resourceTypes: [ResourceType.Script] },
    { resourceTypes: [ResourceType.Script, ResourceType.Image] },
    { excludedResourceTypes: [ResourceType.Script] },
    { excludedResourceTypes: [ResourceType.Script, ResourceType.Image] },
    { requestMethods: [RequestMethod.Post] },
    { requestMethods: [RequestMethod.Post, RequestMethod.Put] },
    { excludedRequestMethods: [RequestMethod.Post] },
    { initiatorDomains: ['example.com'] },
    { initiatorDomains: ['sub.example.com'] },
    { excludedInitiatorDomains: ['example.com'] },
    { responseHeaders: HEADER_CONDITIONS },
    { isUrlFilterCaseSensitive: true },
    { domainType: DomainType.ThirdParty, resourceTypes: [ResourceType.Script] },
    { domainType: DomainType.ThirdParty, excludedResourceTypes: [ResourceType.Script] },
    { resourceTypes: [ResourceType.Script], excludedInitiatorDomains: ['example.com'] },
    { requestMethods: [RequestMethod.Post], initiatorDomains: ['example.com'] },
    { excludedResourceTypes: [ResourceType.Image], responseHeaders: HEADER_CONDITIONS },
];

/**
 * Builds the sample requests checked by the property test.
 *
 * @returns All combinations of the sample request dimensions.
 */
function buildSamples(): SampleRequest[] {
    const samples: SampleRequest[] = [];

    [DomainType.FirstParty, DomainType.ThirdParty].forEach((party) => {
        [ResourceType.Script, ResourceType.Image, ResourceType.SubFrame].forEach((resourceType) => {
            [RequestMethod.Get, RequestMethod.Post].forEach((method) => {
                ['example.com', 'sub.example.com', 'other.com'].forEach((initiator) => {
                    SAMPLE_HEADERS.forEach((headers) => {
                        samples.push({
                            party,
                            resourceType,
                            method,
                            initiator,
                            headers,
                        });
                    });
                });
            });
        });
    });

    return samples;
}

/**
 * Checks whether a header condition matches the sample headers.
 *
 * @param header Header condition to check.
 * @param headers Headers of the sample request.
 *
 * @returns `true` if the condition matches the headers.
 */
function headerMatches(header: unknown, headers: Record<string, string>): boolean {
    if (header === null || typeof header !== 'object') {
        return false;
    }

    const headerInfo = header as { header?: string; values?: string[]; excludedValues?: string[] };
    if (typeof headerInfo.header !== 'string') {
        return false;
    }

    const value = headers[headerInfo.header.toLowerCase()];
    if (value === undefined) {
        return false;
    }

    if (headerInfo.values !== undefined) {
        return headerInfo.values.includes(value);
    }

    if (headerInfo.excludedValues !== undefined) {
        return !headerInfo.excludedValues.includes(value);
    }

    return true;
}

/**
 * Independent implementation of the DNR condition matching for a sample request.
 *
 * It is written from the DNR documentation and is not shared with the resolver,
 * so it can be used as an oracle for the coverage check.
 *
 * @param condition Condition to match.
 * @param sample Sample request.
 *
 * @returns `true` if the condition matches the sample request.
 */
function matchesCondition(condition: RuleCondition, sample: SampleRequest): boolean {
    if (condition.domainType !== undefined && condition.domainType !== sample.party) {
        return false;
    }

    if (condition.resourceTypes !== undefined && !condition.resourceTypes.includes(sample.resourceType)) {
        return false;
    }

    if (condition.excludedResourceTypes !== undefined
        && condition.excludedResourceTypes.includes(sample.resourceType)) {
        return false;
    }

    if (condition.requestMethods !== undefined && !condition.requestMethods.includes(sample.method)) {
        return false;
    }

    if (condition.excludedRequestMethods !== undefined
        && condition.excludedRequestMethods.includes(sample.method)) {
        return false;
    }

    if (condition.initiatorDomains !== undefined
        && !condition.initiatorDomains.some((domain) => isDomainCovered(sample.initiator, domain))) {
        return false;
    }

    if (condition.excludedInitiatorDomains !== undefined
        && condition.excludedInitiatorDomains.some((domain) => isDomainCovered(sample.initiator, domain))) {
        return false;
    }

    if (condition.responseHeaders !== undefined
        && !condition.responseHeaders.every((header) => headerMatches(header, sample.headers))) {
        return false;
    }

    return true;
}

describe('coversNonUrlConditions', () => {
    const samples = buildSamples();

    it('never reports a narrower condition as covered', () => {
        const violations: string[] = [];

        CONDITION_FRAGMENTS.forEach((exceptionCondition) => {
            CONDITION_FRAGMENTS.forEach((blockingCondition) => {
                if (!coversNonUrlConditions(exceptionCondition, blockingCondition)) {
                    return;
                }

                samples.forEach((sample) => {
                    if (matchesCondition(blockingCondition, sample)
                        && !matchesCondition(exceptionCondition, sample)) {
                        violations.push(
                            `exception ${JSON.stringify(exceptionCondition)} does not cover `
                            + `blocker ${JSON.stringify(blockingCondition)} for ${JSON.stringify(sample)}`,
                        );
                    }
                });
            });
        });

        expect(violations).toEqual([]);
    });

    it('reports an unrestricted condition as covering every restricted one', () => {
        CONDITION_FRAGMENTS.forEach((blockingCondition) => {
            expect(coversNonUrlConditions({}, blockingCondition)).toBe(true);
        });
    });

    it('reports a restricted condition as not covering an unrestricted one', () => {
        CONDITION_FRAGMENTS
            .filter((condition) => Object.keys(condition).length > 0)
            .forEach((exceptionCondition) => {
                expect(coversNonUrlConditions(exceptionCondition, {})).toBe(false);
            });
    });
});
