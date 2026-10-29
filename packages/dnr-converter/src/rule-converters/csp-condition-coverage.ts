import {
    DomainType,
    RequestMethod,
    ResourceType,
    type RuleCondition,
} from '../declarative-rule/rule-condition';

/**
 * Compares one DNR condition field of a CSP exception and a blocking rule.
 *
 * A comparator answers whether the exception is not narrower than the blocking
 * rule in this field and must fail closed: an unsupported value must never be
 * reported as covered.
 */
type ConditionFieldCovers = (
    exceptionCondition: RuleCondition,
    blockingCondition: RuleCondition,
) => boolean;

/**
 * Condition fields which describe the URL identity of a rule.
 */
const URL_CONDITION_FIELDS: readonly (keyof RuleCondition)[] = [
    'urlFilter',
    'regexFilter',
];

/**
 * Values of all domain types.
 */
const ALL_DOMAIN_TYPES: readonly DomainType[] = Object.values(DomainType);

/**
 * Values of all request methods.
 */
const ALL_REQUEST_METHODS: readonly RequestMethod[] = Object.values(RequestMethod);

/**
 * Values of all resource types.
 */
const ALL_RESOURCE_TYPES: readonly ResourceType[] = Object.values(ResourceType);

/**
 * Canonicalizes a value for order-independent comparison.
 *
 * @param value Value to canonicalize.
 *
 * @returns Canonicalized value.
 */
const canonicalize = (value: unknown): unknown => {
    if (Array.isArray(value)) {
        return value
            .map((item) => canonicalize(item))
            .sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right)));
    }

    if (value !== null && typeof value === 'object') {
        return Object.fromEntries(
            Object.entries(value)
                .sort(([left], [right]) => left.localeCompare(right))
                .map(([key, item]) => [key, canonicalize(item)]),
        );
    }

    return value;
};

/**
 * Creates a comparator which requires the given condition fields to be equal.
 *
 * @param fields Condition fields to compare.
 *
 * @returns Comparator of the given fields.
 */
const createEqualityComparator = (
    fields: readonly (keyof RuleCondition)[],
): ConditionFieldCovers => (exceptionCondition, blockingCondition) => {
    const exceptionValues = fields.map((field) => exceptionCondition[field]);
    const blockingValues = fields.map((field) => blockingCondition[field]);

    return JSON.stringify(canonicalize(exceptionValues))
        === JSON.stringify(canonicalize(blockingValues));
};

/**
 * Checks whether one list of values contains all values of another one.
 *
 * @param superset List which may contain all values.
 * @param subset List which must be contained.
 *
 * @returns `true` if the first list is a superset of the second one.
 */
const isSuperset = <T>(superset: readonly T[], subset: readonly T[]): boolean => (
    subset.every((value) => superset.includes(value))
);

/**
 * Builds the set of values allowed by an inclusion/exclusion condition pair.
 *
 * @param included Values allowed explicitly, `undefined` if all values are allowed.
 * @param excluded Values excluded explicitly, `undefined` if nothing is excluded.
 * @param all All values of the field.
 *
 * @returns Values allowed by the pair.
 */
const getAllowedValues = <T>(
    included: readonly T[] | undefined,
    excluded: readonly T[] | undefined,
    all: readonly T[],
): T[] => (included ?? all).filter((value) => !(excluded ?? []).includes(value));

/**
 * Checks whether an exception's party restriction covers a blocking rule's one.
 *
 * An absent `domainType` does not restrict the rule by the party, so it covers
 * any restricted value.
 *
 * @param exceptionCondition Condition of the exception.
 * @param blockingCondition Condition of the blocking rule.
 *
 * @returns `true` if the exception's restriction is not narrower.
 */
const coversDomainType = (
    exceptionCondition: RuleCondition,
    blockingCondition: RuleCondition,
): boolean => isSuperset(
    exceptionCondition.domainType ? [exceptionCondition.domainType] : ALL_DOMAIN_TYPES,
    blockingCondition.domainType ? [blockingCondition.domainType] : ALL_DOMAIN_TYPES,
);

/**
 * Checks whether an exception's resource types cover a blocking rule's ones.
 *
 * @param exceptionCondition Condition of the exception.
 * @param blockingCondition Condition of the blocking rule.
 *
 * @returns `true` if the exception allows every resource type of the blocker.
 */
const coversResourceTypes = (
    exceptionCondition: RuleCondition,
    blockingCondition: RuleCondition,
): boolean => isSuperset(
    getAllowedValues(
        exceptionCondition.resourceTypes,
        exceptionCondition.excludedResourceTypes,
        ALL_RESOURCE_TYPES,
    ),
    getAllowedValues(
        blockingCondition.resourceTypes,
        blockingCondition.excludedResourceTypes,
        ALL_RESOURCE_TYPES,
    ),
);

/**
 * Checks whether an exception's request methods cover a blocking rule's ones.
 *
 * @param exceptionCondition Condition of the exception.
 * @param blockingCondition Condition of the blocking rule.
 *
 * @returns `true` if the exception allows every method of the blocker.
 */
const coversRequestMethods = (
    exceptionCondition: RuleCondition,
    blockingCondition: RuleCondition,
): boolean => isSuperset(
    getAllowedValues(
        exceptionCondition.requestMethods,
        exceptionCondition.excludedRequestMethods,
        ALL_REQUEST_METHODS,
    ),
    getAllowedValues(
        blockingCondition.requestMethods,
        blockingCondition.excludedRequestMethods,
        ALL_REQUEST_METHODS,
    ),
);

/**
 * Checks whether an exception is not case-sensitive when a blocking rule is.
 *
 * A case-insensitive exception matches a superset of the blocker's URLs.
 *
 * @param exceptionCondition Condition of the exception.
 * @param blockingCondition Condition of the blocking rule.
 *
 * @returns `true` if the exception is not narrower by the case sensitivity.
 */
const coversCaseSensitivity = (
    exceptionCondition: RuleCondition,
    blockingCondition: RuleCondition,
): boolean => !exceptionCondition.isUrlFilterCaseSensitive
    || blockingCondition.isUrlFilterCaseSensitive === true;

/**
 * Checks whether a domain belongs to a parent domain.
 *
 * @param domain Domain to check.
 * @param parentDomain Potential parent domain.
 *
 * @returns `true` if the parent domain covers the domain.
 */
export const isDomainCovered = (domain: string, parentDomain: string): boolean => (
    domain === parentDomain || domain.endsWith(`.${parentDomain}`)
);

/**
 * Checks whether each domain in one list is covered by another list.
 *
 * @param subset Domains that must be covered.
 * @param superset Domains that may cover them.
 *
 * @returns `true` if the first domain list is a subset of the second.
 */
const isDomainListSubset = (subset: unknown, superset: unknown): boolean => (
    Array.isArray(subset)
    && Array.isArray(superset)
    && subset.every((domain) => (
        typeof domain === 'string'
        && superset.some((parentDomain) => (
            typeof parentDomain === 'string'
            && isDomainCovered(domain, parentDomain)
        ))
    ))
);

/**
 * Checks whether one DNR header condition covers another.
 *
 * @param header Header condition to check.
 * @param coveringHeader Potential covering header condition.
 *
 * @returns `true` if the second header condition covers the first.
 */
const isHeaderInfoCovered = (header: unknown, coveringHeader: unknown): boolean => {
    if (
        header === null
        || coveringHeader === null
        || typeof header !== 'object'
        || typeof coveringHeader !== 'object'
    ) {
        return false;
    }

    const headerInfo = header as Record<string, unknown>;
    const coveringHeaderInfo = coveringHeader as Record<string, unknown>;
    if (
        typeof headerInfo.header !== 'string'
        || typeof coveringHeaderInfo.header !== 'string'
        || headerInfo.header.toLowerCase() !== coveringHeaderInfo.header.toLowerCase()
    ) {
        return false;
    }

    const coveringHeaderHasValueRestrictions = coveringHeaderInfo.values !== undefined
        || coveringHeaderInfo.excludedValues !== undefined;

    return !coveringHeaderHasValueRestrictions
        || JSON.stringify(canonicalize(headerInfo))
            === JSON.stringify(canonicalize(coveringHeaderInfo));
};

/**
 * Checks whether each header condition is covered by another list.
 *
 * @param subset Header conditions that must be covered.
 * @param superset Header conditions that may cover them.
 *
 * @returns `true` if the first header list is a subset of the second.
 */
const isHeaderListSubset = (subset: unknown, superset: unknown): boolean => (
    Array.isArray(subset)
    && Array.isArray(superset)
    && subset.every((header) => (
        superset.some((coveringHeader) => isHeaderInfoCovered(header, coveringHeader))
    ))
);

/**
 * Checks whether an exception's domain list covers a blocking rule's one.
 *
 * An absent exception list means the exception is not restricted by the
 * condition at all, so it covers any list of the blocking rule. The same rule
 * applies to `initiatorDomains` and `requestDomains`, which DNR treats as
 * "all domains" when omitted.
 *
 * @param exceptionList Domains of the exception.
 * @param blockingList Domains of the blocking rule.
 *
 * @returns `true` if the exception's list covers the blocking rule's list.
 */
const coversDomainList = (exceptionList: unknown, blockingList: unknown): boolean => (
    exceptionList === undefined || isDomainListSubset(blockingList, exceptionList)
);

/**
 * Checks whether an exception excludes no more domains than a blocking rule.
 *
 * An absent exception list means the exception excludes nothing, so it covers
 * any list of the blocking rule.
 *
 * @param exceptionList Domains excluded by the exception.
 * @param blockingList Domains excluded by the blocking rule.
 *
 * @returns `true` if the exception excludes a subset of the blocking rule's list.
 */
const coversExcludedDomains = (exceptionList: unknown, blockingList: unknown): boolean => (
    exceptionList === undefined || isDomainListSubset(exceptionList, blockingList)
);

/**
 * Checks whether an exception's response headers cover a blocking rule's ones.
 *
 * A rule matches when any header of its list matches, so the exception covers
 * the blocking rule only when every blocking header is implied by some header
 * of the exception: a response that matches the blocking rule must match the
 * exception as well. An absent exception list means the exception is not
 * restricted by headers, so it covers any list of the blocking rule.
 *
 * @param exceptionHeaders Headers of the exception.
 * @param blockingHeaders Headers of the blocking rule.
 *
 * @returns `true` if the exception's list covers the blocking rule's list.
 */
const coversResponseHeaders = (exceptionHeaders: unknown, blockingHeaders: unknown): boolean => (
    exceptionHeaders === undefined || isHeaderListSubset(blockingHeaders, exceptionHeaders)
);

/**
 * Comparators for every DNR condition field.
 *
 * The mapped type keeps the table exhaustive: a field added to
 * {@link RuleCondition} without a comparator breaks the build, so a new
 * condition field cannot be silently ignored by the resolver.
 *
 * Fields of one pair (`resourceTypes`/`excludedResourceTypes` and so on) share
 * a comparator which reads both of them.
 */
const CONDITION_COVERAGE: {
    readonly [K in keyof RuleCondition]-?: ConditionFieldCovers;
} = {
    urlFilter: createEqualityComparator(['urlFilter', 'regexFilter']),
    regexFilter: createEqualityComparator(['urlFilter', 'regexFilter']),
    domainType: coversDomainType,
    initiatorDomains: (exceptionCondition, blockingCondition) => coversDomainList(
        exceptionCondition.initiatorDomains,
        blockingCondition.initiatorDomains,
    ),
    excludedInitiatorDomains: (exceptionCondition, blockingCondition) => coversExcludedDomains(
        exceptionCondition.excludedInitiatorDomains,
        blockingCondition.excludedInitiatorDomains,
    ),
    requestDomains: (exceptionCondition, blockingCondition) => coversDomainList(
        exceptionCondition.requestDomains,
        blockingCondition.requestDomains,
    ),
    excludedRequestDomains: (exceptionCondition, blockingCondition) => coversExcludedDomains(
        exceptionCondition.excludedRequestDomains,
        blockingCondition.excludedRequestDomains,
    ),
    responseHeaders: (exceptionCondition, blockingCondition) => coversResponseHeaders(
        exceptionCondition.responseHeaders,
        blockingCondition.responseHeaders,
    ),
    excludedResponseHeaders: createEqualityComparator(['excludedResponseHeaders']),
    tabIds: createEqualityComparator(['tabIds']),
    excludedTabIds: createEqualityComparator(['excludedTabIds']),
    requestMethods: coversRequestMethods,
    excludedRequestMethods: coversRequestMethods,
    resourceTypes: coversResourceTypes,
    excludedResourceTypes: coversResourceTypes,
    isUrlFilterCaseSensitive: coversCaseSensitivity,
};

/**
 * All condition fields compared by the resolver.
 */
const CONDITION_FIELDS = Object.keys(CONDITION_COVERAGE) as (keyof RuleCondition)[];

/**
 * Condition fields compared by the non-URL coverage check.
 */
const NON_URL_CONDITION_FIELDS = CONDITION_FIELDS
    .filter((field) => !URL_CONDITION_FIELDS.includes(field));

/**
 * Checks whether an exception covers the given condition fields of a blocking rule.
 *
 * @param exceptionCondition Condition of the exception.
 * @param blockingCondition Condition of the blocking rule.
 * @param fields Condition fields to compare.
 *
 * @returns `true` if the exception is not narrower in any of the fields.
 */
const coversFields = (
    exceptionCondition: RuleCondition,
    blockingCondition: RuleCondition,
    fields: readonly (keyof RuleCondition)[],
): boolean => fields.every((field) => (
    CONDITION_COVERAGE[field](exceptionCondition, blockingCondition)
));

/**
 * Checks whether an exception has the same URL identity and is not narrower
 * than a blocking rule in any other condition.
 *
 * @param exceptionCondition Condition of the exception.
 * @param blockingCondition Condition of the blocking rule.
 *
 * @returns `true` if the exception covers the blocking rule's condition.
 */
export const coversCondition = (
    exceptionCondition: RuleCondition,
    blockingCondition: RuleCondition,
): boolean => coversFields(exceptionCondition, blockingCondition, CONDITION_FIELDS);

/**
 * Checks whether an exception covers a blocking rule's non-URL conditions.
 *
 * @param exceptionCondition Condition of the exception.
 * @param blockingCondition Condition of the blocking rule.
 *
 * @returns `true` if the exception is not narrower in any non-URL field.
 */
export const coversNonUrlConditions = (
    exceptionCondition: RuleCondition,
    blockingCondition: RuleCondition,
): boolean => coversFields(exceptionCondition, blockingCondition, NON_URL_CONDITION_FIELDS);
