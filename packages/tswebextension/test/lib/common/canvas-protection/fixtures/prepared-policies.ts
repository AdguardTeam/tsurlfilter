import { CanvasConditionType } from '../../../../../src/lib/common/canvas-protection/constants';
import {
    type HostCondition,
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

/**
 * Creates a host predicate.
 *
 * @param lookups Lookups replacing the empty ones.
 *
 * @returns Prepared condition.
 */
export const hostCondition = (lookups: Partial<Omit<HostCondition, 'type'>>): HostCondition => ({
    type: CanvasConditionType.Host,
    hosts: [],
    domains: [],
    parents: [],
    ...lookups,
});

const hosts = hostCondition({ hosts: ['a.example.com', 'b.example.com'] });
const domains = hostCondition({ domains: ['example.com'] });
const parents = hostCondition({ parents: ['example.com'] });

const cases: [string, PreparedCondition, string, boolean][] = [
    ['host', hosts, 'https://a.example.com/', true],
    ['host with www', hosts, 'https://www.b.example.com/', true],
    ['host with a trailing dot and port', hosts, 'https://a.example.com.:8443/x', true],
    ['host credentials', hosts, 'https://user@a.example.com/', true],
    ['other host', hosts, 'https://c.example.com/', false],
    ['host subdomain', hosts, 'https://sub.a.example.com/', false],
    ['host prefix', hosts, 'https://a.example.community/', false],
    ['domain', domains, 'https://example.com/', true],
    ['domain subdomains', domains, 'https://a.b.example.com/', true],
    ['domain suffix', domains, 'https://notexample.com/', false],
    ['parent one level below', parents, 'https://a.example.com/', true],
    ['parent one level below www', parents, 'https://www.a.example.com/', true],
    ['parent itself', parents, 'https://example.com/', false],
    ['parent with www', parents, 'https://www.example.com/', false],
    ['parent two levels below', parents, 'https://a.b.example.com/', false],
    ['pattern', hostCondition({ pattern: String.raw`^example\..*$` }), 'https://example.org/', true],
    ['pattern case', hostCondition({ pattern: String.raw`^EXAMPLE\.org$` }), 'https://example.org/', false],
];

/**
 * Exact prepared predicates, without filter-text parsing or transformation.
 */
export const preparedPolicyFixtures: readonly PreparedPolicyFixture[] = cases.map(
    ([name, condition, url, excluded]) => ({
        name, condition, url, excluded,
    }),
);
