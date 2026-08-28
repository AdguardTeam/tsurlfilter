/**
 * @file {@link Rule} — parsed and normalized network filtering rule.
 *
 * Priority calculation is delegated to {@link RulePriority}.
 * Badfilter negation logic is delegated to {@link RuleBadfilter}.
 */

import {
    type AnyRule,
    type NetworkRule as NetworkRuleNode,
    NetworkRuleType,
    RuleCategory,
    RuleParserPipeline,
} from '@adguard/agtree';
import { RuleConverter } from '@adguard/agtree/converter';
import { RuleGenerator } from '@adguard/agtree/generator';

import { MASK_REGEX_RULE } from '../constants';
import { type RequestMethod, ResourceType } from '../declarative-rule/rule-condition';
import { getErrorMessage } from '../utils/error';
import { fastHash, fastHash31, hasSpaces } from '../utils/string';

import { OPTION_NAMES } from './option-names';
import { RuleBadfilter } from './rule-badfilter';
import { RulePriority } from './rule-priority';
import { type ConversionMeta, type HttpHeaderMatcher } from './rule-types';

export type { HttpHeaderMatcher } from './rule-types';

/**
 * Shared rule parser pipeline instance reused across all parse calls.
 */
const ruleParser = new RuleParserPipeline();

/**
 * Maps canonical content-type modifier names to their DNR `ResourceType`
 * equivalents. Only modifier names that correspond to adblock filter syntax
 * content-type options are included here (excluded `webtransport` and `webbundle`).
 */
const CONTENT_TYPE_RESOURCE_TYPE_MAP: Readonly<Partial<Record<string, ResourceType>>> = {
    [OPTION_NAMES.DOCUMENT]: ResourceType.MainFrame,
    [OPTION_NAMES.SUBDOCUMENT]: ResourceType.SubFrame,
    [OPTION_NAMES.SCRIPT]: ResourceType.Script,
    [OPTION_NAMES.STYLESHEET]: ResourceType.Stylesheet,
    [OPTION_NAMES.OBJECT]: ResourceType.Object,
    [OPTION_NAMES.IMAGE]: ResourceType.Image,
    [OPTION_NAMES.XMLHTTPREQUEST]: ResourceType.XmlHttpRequest,
    [OPTION_NAMES.MEDIA]: ResourceType.Media,
    [OPTION_NAMES.FONT]: ResourceType.Font,
    [OPTION_NAMES.WEBSOCKET]: ResourceType.WebSocket,
    [OPTION_NAMES.OTHER]: ResourceType.Other,
    [OPTION_NAMES.PING]: ResourceType.Ping,
};

/**
 * Modifier names that can be negated with `~`.
 *
 * Any modifier not in this set will cause a {@link SyntaxError} when negated.
 */
const NEGATABLE_MODIFIERS: ReadonlySet<string> = new Set([
    OPTION_NAMES.FIRST_PARTY,
    OPTION_NAMES.THIRD_PARTY,
    OPTION_NAMES.MATCH_CASE,
    OPTION_NAMES.DOCUMENT,
    OPTION_NAMES.DOC,
    OPTION_NAMES.SCRIPT,
    OPTION_NAMES.STYLESHEET,
    OPTION_NAMES.SUBDOCUMENT,
    OPTION_NAMES.OBJECT,
    OPTION_NAMES.IMAGE,
    OPTION_NAMES.XMLHTTPREQUEST,
    OPTION_NAMES.MEDIA,
    OPTION_NAMES.FONT,
    OPTION_NAMES.WEBSOCKET,
    OPTION_NAMES.OTHER,
    OPTION_NAMES.PING,
    OPTION_NAMES.EXTENSION,
]);

/**
 * Request prefix used in `$removeheader` modifier values.
 */
const REMOVE_HEADER_REQUEST_PREFIX = 'request:';

/**
 * Headers that may not be removed via the `$removeheader` modifier.
 *
 * @see {@link https://kb.adguard.com/en/general/how-to-create-your-own-ad-filters#removeheader-modifier}
 */
const FORBIDDEN_REMOVE_HEADERS = new Set<string>([
    'access-control-allow-origin',
    'access-control-allow-credentials',
    'access-control-allow-headers',
    'access-control-allow-methods',
    'access-control-expose-headers',
    'access-control-max-age',
    'access-control-request-headers',
    'access-control-request-method',
    'origin',
    'timing-allow-origin',
    'allow',
    'cross-origin-embedder-policy',
    'cross-origin-opener-policy',
    'cross-origin-resource-policy',
    'content-security-policy',
    'content-security-policy-report-only',
    'expect-ct',
    'feature-policy',
    'origin-isolation',
    'strict-transport-security',
    'upgrade-insecure-requests',
    'x-content-type-options',
    'x-download-options',
    'x-frame-options',
    'x-permitted-cross-domain-policies',
    'x-powered-by',
    'x-xss-protection',
    'public-key-pins',
    'public-key-pins-report-only',
    'sec-websocket-key',
    'sec-websocket-extensions',
    'sec-websocket-accept',
    'sec-websocket-protocol',
    'sec-websocket-version',
    'p3p',
    'sec-fetch-mode',
    'sec-fetch-dest',
    'sec-fetch-site',
    'sec-fetch-user',
    'referrer-policy',
    'content-type',
    'content-length',
    'accept',
    'accept-encoding',
    'host',
    'connection',
    'transfer-encoding',
    'upgrade',
]);

/**
 * Modifier names that are compatible with `$removeparam`.
 * Ported from tsurlfilter's `RemoveParamCompatibleOptions`.
 */
const REMOVEPARAM_COMPATIBLE_MODIFIERS: ReadonlySet<string> = new Set([
    OPTION_NAMES.REMOVEPARAM,
    OPTION_NAMES.THIRD_PARTY,
    OPTION_NAMES.IMPORTANT,
    OPTION_NAMES.MATCH_CASE,
    OPTION_NAMES.BADFILTER,
    OPTION_NAMES.SCRIPT,
    OPTION_NAMES.STYLESHEET,
    OPTION_NAMES.SUBDOCUMENT,
    OPTION_NAMES.OBJECT,
    OPTION_NAMES.IMAGE,
    OPTION_NAMES.XMLHTTPREQUEST,
    OPTION_NAMES.MEDIA,
    OPTION_NAMES.FONT,
    OPTION_NAMES.WEBSOCKET,
    OPTION_NAMES.OTHER,
    OPTION_NAMES.PING,
]);

/**
 * Modifier names that are compatible with `$permissions`.
 * Ported from tsurlfilter's `PermissionsCompatibleOptions`.
 *
 * `$permissions` is compatible with `$important`, `$badfilter`, `$domain`,
 * and all content-type modifiers (`$subdocument`, `$script`, `$stylesheet`,
 * etc.). This mirrors the runtime behavior of tsurlfilter's `NetworkRule`,
 * which tracks content-type and `$domain` modifiers separately from the
 * option bitmask used by `validatePermissionsRule`.
 */
const PERMISSIONS_COMPATIBLE_MODIFIERS: ReadonlySet<string> = new Set([
    OPTION_NAMES.PERMISSIONS,
    OPTION_NAMES.IMPORTANT,
    OPTION_NAMES.BADFILTER,
    OPTION_NAMES.DOMAIN,
    OPTION_NAMES.SUBDOCUMENT,
    OPTION_NAMES.SCRIPT,
    OPTION_NAMES.IMAGE,
    OPTION_NAMES.STYLESHEET,
    OPTION_NAMES.OBJECT,
    OPTION_NAMES.XMLHTTPREQUEST,
    OPTION_NAMES.MEDIA,
    OPTION_NAMES.FONT,
    OPTION_NAMES.WEBSOCKET,
    OPTION_NAMES.OTHER,
    OPTION_NAMES.PING,
]);

/**
 * Modifier names that are compatible with `$header`.
 * Ported from tsurlfilter's `HeaderCompatibleOptions`.
 */
const HEADER_COMPATIBLE_MODIFIERS: ReadonlySet<string> = new Set([
    OPTION_NAMES.HEADER,
    OPTION_NAMES.IMPORTANT,
    OPTION_NAMES.CSP,
    OPTION_NAMES.REMOVEHEADER,
    OPTION_NAMES.THIRD_PARTY,
    OPTION_NAMES.MATCH_CASE,
    OPTION_NAMES.BADFILTER,
    OPTION_NAMES.SCRIPT,
    OPTION_NAMES.STYLESHEET,
    OPTION_NAMES.SUBDOCUMENT,
    OPTION_NAMES.OBJECT,
    OPTION_NAMES.IMAGE,
    OPTION_NAMES.XMLHTTPREQUEST,
    OPTION_NAMES.MEDIA,
    OPTION_NAMES.FONT,
    OPTION_NAMES.WEBSOCKET,
    OPTION_NAMES.OTHER,
    OPTION_NAMES.PING,
]);

/**
 * Modifier names that are compatible with `$removeheader`.
 * Ported from tsurlfilter's `RemoveHeaderCompatibleOptions`.
 */
export const REMOVEHEADER_COMPATIBLE_MODIFIERS: ReadonlySet<string> = new Set([
    OPTION_NAMES.REMOVEHEADER,
    OPTION_NAMES.HEADER,
    OPTION_NAMES.THIRD_PARTY,
    OPTION_NAMES.IMPORTANT,
    OPTION_NAMES.MATCH_CASE,
    OPTION_NAMES.BADFILTER,
    OPTION_NAMES.SCRIPT,
    OPTION_NAMES.STYLESHEET,
    OPTION_NAMES.SUBDOCUMENT,
    OPTION_NAMES.OBJECT,
    OPTION_NAMES.IMAGE,
    OPTION_NAMES.XMLHTTPREQUEST,
    OPTION_NAMES.MEDIA,
    OPTION_NAMES.FONT,
    OPTION_NAMES.WEBSOCKET,
    OPTION_NAMES.OTHER,
    OPTION_NAMES.PING,
]);

/**
 * Parsed and normalized network filtering rule.
 *
 * Instances are created exclusively via the static factory methods
 * {@link Rule.createFromText} and {@link Rule.parseFromNode}.
 */
export class Rule {
    /**
     * Filter list ID from which the rule was extracted.
     */
    readonly filterListId: number;

    /**
     * Rule index within the filter list.
     */
    readonly index: number;

    /**
     * Original AST node. Kept for rule text generation and node-level
     * inspection.
     */
    readonly node: NetworkRuleNode;

    /**
     * URL pattern from the AST node (`node.pattern.value`).
     */
    readonly pattern: string;

    /**
     * Hash of the pattern, computed via `fastHash()`.
     * Used for quick badfilter comparison.
     */
    readonly hash: number;

    /**
     * Whether this is an allowlist (exception) rule.
     */
    readonly allowlist: boolean;

    /**
     * Set of canonical modifier names that are enabled on this rule.
     *
     * Content-type modifiers (script, image, etc.) are tracked here
     * **in addition to** being mapped to {@link permittedResourceTypes}.
     */
    readonly enabledModifiers: Set<string> = new Set();

    /**
     * Set of canonical modifier names that are disabled (negated) on
     * this rule. E.g. `~third-party` → `"third-party"` in this set.
     */
    readonly disabledModifiers: Set<string> = new Set();

    /**
     * Permitted (non-negated) domains from the `$domain` modifier.
     */
    readonly permittedDomains: string[] | null = null;

    /**
     * Restricted (negated) domains from the `$domain` modifier.
     */
    readonly restrictedDomains: string[] | null = null;

    /**
     * Permitted destination domains from the `$to` modifier.
     */
    readonly permittedToDomains: string[] | null = null;

    /**
     * Restricted destination domains from the `$to` modifier.
     */
    readonly restrictedToDomains: string[] | null = null;

    /**
     * Exception domains from the `$denyallow` modifier.
     */
    readonly denyAllowDomains: string[] | null = null;

    /**
     * Permitted resource types set by content-type modifiers,
     * already mapped to DNR {@link ResourceType} values.
     */
    readonly permittedResourceTypes: ResourceType[];

    /**
     * Restricted resource types set by negated content-type modifiers,
     * already mapped to DNR {@link ResourceType} values.
     */
    readonly restrictedResourceTypes: ResourceType[];

    /**
     * Permitted HTTP methods from the `$method` modifier.
     */
    readonly permittedMethods: RequestMethod[] | null = null;

    /**
     * Restricted HTTP methods from the `$method` modifier.
     */
    readonly restrictedMethods: RequestMethod[] | null = null;

    /**
     * Name of the advanced modifier (e.g. `"csp"`, `"redirect"`,
     * `"removeparam"`, `"removeheader"`, `"cookie"`, `"permissions"`).
     */
    readonly advancedModifierName: string | null = null;

    /**
     * Raw string value of the advanced modifier.
     */
    readonly advancedModifierValue: string | null = null;

    /**
     * Parsed data for the `$header` modifier.
     */
    readonly headerMatcher: HttpHeaderMatcher | null = null;

    /**
     * Effective header name to be removed by `$removeheader`.
     * `null` when no valid `$removeheader` modifier is present.
     */
    readonly removeHeaderName: string | null = null;

    /**
     * Whether the `$removeheader` modifier targets request headers
     * (true) or response headers (false).
     */
    readonly removeHeaderIsRequestType: boolean = false;

    /**
     * Whether the rule uses `$redirect-rule` (only redirects
     * already-blocked requests) vs plain `$redirect`.
     */
    readonly isRedirectRuleModifier: boolean = false;

    /**
     * Computed DNR priority (positive integer ≥ 1).
     */
    readonly priority: number;

    /**
     * Creates a new {@link Rule} from filter list metadata and an already-converted
     * network rule AST node.
     *
     * @param filterListId Filter list ID.
     * @param index Rule index within the filter list.
     * @param node Network rule AST node (must already be in AG syntax).
     *
     * @throws `SyntaxError` when the pattern contains spaces, the rule is too
     *   general, or any modifier is invalid.
     */
    private constructor(filterListId: number, index: number, node: NetworkRuleNode) {
        const pattern = node.pattern.value;
        if (pattern && hasSpaces(pattern)) {
            throw new SyntaxError('Rule has spaces, seems to be a host rule');
        }
        if (Rule.isTooGeneral(node)) {
            throw new SyntaxError(`Rule is too general: ${RuleGenerator.generate(node)}`);
        }

        const isAllowlist = node.exception;

        const permittedResourceTypesSet = new Set<ResourceType>();
        const restrictedResourceTypesSet = new Set<ResourceType>();
        const meta: ConversionMeta = {
            baseModifierCount: 0,
            permittedContentTypeCount: 0,
            permittedMethodCount: 0,
            hasHeader: false,
            permittedDomainCount: 0,
            hasRedirect: false,
            specificExclusionCount: 0,
            hasImportant: false,
        };

        let hasRestrictedContentType = false;

        for (const modifier of node.modifiers?.children ?? []) {
            const rawName = modifier.name.value;
            const exception = modifier.exception ?? false;
            const value = modifier.value?.value ?? '';

            const name = rawName;

            if (exception && !NEGATABLE_MODIFIERS.has(name)) {
                throw new SyntaxError(`Modifier $${name} cannot be negated`);
            }

            switch (name) {
                case OPTION_NAMES.FIRST_PARTY:
                    // $first-party is an alias for ~$third-party.
                    // Normalize it into the same internal representation so that
                    // RegularRuleConverter.getCondition() can derive DomainType.FirstParty
                    // from isModifierDisabled(THIRD_PARTY) uniformly.
                    if (exception) {
                        // ~$first-party ≡ $third-party
                        this.enabledModifiers.add(OPTION_NAMES.THIRD_PARTY);
                    } else {
                        // $first-party ≡ ~$third-party
                        this.disabledModifiers.add(OPTION_NAMES.THIRD_PARTY);
                    }
                    meta.baseModifierCount += 1;
                    break;

                case OPTION_NAMES.THIRD_PARTY:
                    if (exception) {
                        this.disabledModifiers.add(name);
                    } else {
                        this.enabledModifiers.add(name);
                    }
                    meta.baseModifierCount += 1;
                    break;

                case OPTION_NAMES.MATCH_CASE:
                    if (exception) {
                        this.disabledModifiers.add(name);
                    } else {
                        this.enabledModifiers.add(name);
                    }
                    meta.baseModifierCount += 1;
                    break;

                case OPTION_NAMES.IMPORTANT:
                    this.enabledModifiers.add(name);
                    meta.hasImportant = true;
                    break;

                case OPTION_NAMES.BADFILTER:
                case OPTION_NAMES.POPUP:
                    this.enabledModifiers.add(name);
                    break;

                case OPTION_NAMES.STEALTH:
                    if (!isAllowlist) {
                        throw new SyntaxError(
                            'Modifier $stealth is only allowed on allowlist rules',
                        );
                    }
                    this.enabledModifiers.add(name);
                    break;

                case OPTION_NAMES.DOCUMENT:
                    if (exception) {
                        this.disabledModifiers.add(name);
                        restrictedResourceTypesSet.add(ResourceType.MainFrame);
                        hasRestrictedContentType = true;
                    } else {
                        this.enabledModifiers.add(name);
                        permittedResourceTypesSet.add(ResourceType.MainFrame);
                        if (isAllowlist) {
                            this.enabledModifiers.add(OPTION_NAMES.ELEMHIDE);
                            this.enabledModifiers.add(OPTION_NAMES.JSINJECT);
                            this.enabledModifiers.add(OPTION_NAMES.URLBLOCK);
                            this.enabledModifiers.add(OPTION_NAMES.CONTENT);
                            meta.specificExclusionCount += 4;
                        }
                    }
                    break;

                case OPTION_NAMES.ELEMHIDE:
                case OPTION_NAMES.GENERICHIDE:
                case OPTION_NAMES.SPECIFICHIDE:
                case OPTION_NAMES.CONTENT:
                case OPTION_NAMES.URLBLOCK:
                case OPTION_NAMES.GENERICBLOCK:
                case OPTION_NAMES.JSINJECT:
                    if (exception) {
                        this.disabledModifiers.add(name);
                    } else {
                        if (!isAllowlist) {
                            throw new SyntaxError(
                                `Modifier $${name} is only allowed on allowlist rules`,
                            );
                        }
                        this.enabledModifiers.add(name);
                        permittedResourceTypesSet.add(ResourceType.MainFrame);
                        permittedResourceTypesSet.add(ResourceType.SubFrame);
                        meta.specificExclusionCount += 1;
                    }
                    break;

                case OPTION_NAMES.EXTENSION:
                    if (exception) {
                        this.disabledModifiers.add(name);
                    } else {
                        if (!isAllowlist) {
                            throw new SyntaxError(
                                `Modifier $${name} is only allowed on allowlist rules`,
                            );
                        }
                        this.enabledModifiers.add(name);
                        meta.specificExclusionCount += 1;
                    }
                    break;

                case OPTION_NAMES.SCRIPT:
                case OPTION_NAMES.STYLESHEET:
                case OPTION_NAMES.SUBDOCUMENT:
                case OPTION_NAMES.OBJECT:
                case OPTION_NAMES.IMAGE:
                case OPTION_NAMES.XMLHTTPREQUEST:
                case OPTION_NAMES.MEDIA:
                case OPTION_NAMES.FONT:
                case OPTION_NAMES.WEBSOCKET:
                case OPTION_NAMES.OTHER:
                case OPTION_NAMES.PING: {
                    const rt = CONTENT_TYPE_RESOURCE_TYPE_MAP[name];
                    if (exception) {
                        this.disabledModifiers.add(name);
                        if (rt !== undefined) {
                            restrictedResourceTypesSet.add(rt);
                            hasRestrictedContentType = true;
                        }
                    } else {
                        this.enabledModifiers.add(name);
                        if (rt !== undefined) {
                            permittedResourceTypesSet.add(rt);
                        }
                    }
                    break;
                }

                case OPTION_NAMES.DOMAIN: {
                    const parts = value.split('|').filter(Boolean);
                    const permitted: string[] = [];
                    const restricted: string[] = [];
                    for (const part of parts) {
                        if (part.startsWith('~')) {
                            restricted.push(part.slice(1));
                        } else {
                            permitted.push(part);
                        }
                    }
                    if (permitted.length > 0) {
                        this.permittedDomains = permitted;
                        meta.permittedDomainCount = permitted.length;
                    }
                    if (restricted.length > 0) {
                        this.restrictedDomains = restricted;
                        meta.baseModifierCount += 1;
                    }
                    break;
                }

                case OPTION_NAMES.DENYALLOW: {
                    const parts = value.split('|').filter(Boolean);
                    if (parts.some((p) => p.startsWith('~'))) {
                        throw new SyntaxError(
                            'Modifier $denyallow domains cannot be negated',
                        );
                    }
                    if (parts.length > 0) {
                        this.denyAllowDomains = parts;
                        meta.baseModifierCount += 1;
                    }
                    break;
                }

                case OPTION_NAMES.TO: {
                    const parts = value.split('|').filter(Boolean);
                    const toPermitted: string[] = [];
                    const toRestricted: string[] = [];
                    for (const part of parts) {
                        if (part.startsWith('~')) {
                            toRestricted.push(part.slice(1));
                        } else {
                            toPermitted.push(part);
                        }
                    }
                    if (toPermitted.length > 0) {
                        this.permittedToDomains = toPermitted;
                    }
                    if (toRestricted.length > 0) {
                        this.restrictedToDomains = toRestricted;
                    }
                    meta.baseModifierCount += 1;
                    break;
                }

                case OPTION_NAMES.METHOD: {
                    const parts = value.split('|').filter(Boolean);
                    const methodPermitted: RequestMethod[] = [];
                    const methodRestricted: RequestMethod[] = [];
                    for (const part of parts) {
                        const isNegated = part.startsWith('~');
                        const methodName = (
                            isNegated ? part.slice(1) : part
                        ).toLowerCase() as RequestMethod;
                        // Unknown methods (e.g. 'trace') are kept and rejected later by the validator.
                        if (isNegated) {
                            methodRestricted.push(methodName);
                        } else {
                            methodPermitted.push(methodName);
                        }
                    }
                    this.enabledModifiers.add(name);
                    if (methodPermitted.length > 0) {
                        this.permittedMethods = methodPermitted;
                        meta.permittedMethodCount = methodPermitted.length;
                    }
                    if (methodRestricted.length > 0) {
                        this.restrictedMethods = methodRestricted;
                        meta.baseModifierCount += 1;
                    }
                    break;
                }

                case OPTION_NAMES.HEADER:
                    this.enabledModifiers.add(name);
                    this.headerMatcher = Rule.parseHeaderModifier(value);
                    meta.hasHeader = true;
                    break;

                case OPTION_NAMES.CSP:
                case OPTION_NAMES.REMOVEPARAM:
                case OPTION_NAMES.COOKIE:
                case OPTION_NAMES.REPLACE:
                case OPTION_NAMES.JSONPRUNE:
                case OPTION_NAMES.HLS:
                case OPTION_NAMES.REFERRERPOLICY:
                case OPTION_NAMES.PERMISSIONS:
                    this.enabledModifiers.add(name);
                    this.advancedModifierName = rawName;
                    this.advancedModifierValue = value || null;
                    break;

                case OPTION_NAMES.REDIRECTRULE:
                case OPTION_NAMES.REDIRECT:
                    this.enabledModifiers.add(OPTION_NAMES.REDIRECT);
                    this.advancedModifierName = name;
                    this.advancedModifierValue = value || null;
                    this.isRedirectRuleModifier = name === OPTION_NAMES.REDIRECTRULE;
                    meta.hasRedirect = true;
                    break;

                case OPTION_NAMES.REMOVEHEADER: {
                    this.enabledModifiers.add(name);
                    this.advancedModifierName = rawName;
                    this.advancedModifierValue = value || null;
                    const info = Rule.computeRemoveHeaderInfo(value);
                    this.removeHeaderName = info.name;
                    this.removeHeaderIsRequestType = info.isRequest;
                    break;
                }

                case OPTION_NAMES.DNSREWRITE:
                    this.enabledModifiers.add(name);
                    this.advancedModifierName = rawName;
                    this.advancedModifierValue = value || null;
                    meta.baseModifierCount += 1;
                    break;

                // DNS/network-level modifiers — no DNR equivalent.
                // Still added to enabledModifiers so the validator can reject them.
                case OPTION_NAMES.DNSTYPE:
                case OPTION_NAMES.CTAG:
                case OPTION_NAMES.CLIENT:
                case OPTION_NAMES.APP:
                case OPTION_NAMES.NETWORK:
                    this.enabledModifiers.add(name);
                    break;

                case OPTION_NAMES.ALL:
                    if (isAllowlist) {
                        throw new SyntaxError(
                            'Modifier $all is not allowed on allowlist rules',
                        );
                    }
                    for (const rt of Object.values(ResourceType)) {
                        permittedResourceTypesSet.add(rt);
                    }
                    this.enabledModifiers.add(OPTION_NAMES.POPUP);
                    break;

                default:
                    // Unknown modifiers are silently ignored during parsing;
                    // they can be rejected downstream if necessary.
                    break;
            }
        }

        if (this.denyAllowDomains !== null && this.permittedToDomains !== null) {
            throw new SyntaxError(
                'Modifiers $denyallow and $to cannot be used together',
            );
        }

        // Validate modifier combinations (ported from tsurlfilter).
        if (this.enabledModifiers.has(OPTION_NAMES.REMOVEPARAM)) {
            for (const modifier of this.enabledModifiers) {
                if (!REMOVEPARAM_COMPATIBLE_MODIFIERS.has(modifier)) {
                    throw new SyntaxError(
                        `$removeparam is not compatible with $${modifier}`,
                    );
                }
            }
        }

        if (this.enabledModifiers.has(OPTION_NAMES.PERMISSIONS)) {
            for (const modifier of this.enabledModifiers) {
                if (!PERMISSIONS_COMPATIBLE_MODIFIERS.has(modifier)) {
                    throw new SyntaxError(
                        `$permissions is not compatible with $${modifier}`,
                    );
                }
            }
        }

        if (this.enabledModifiers.has(OPTION_NAMES.HEADER)) {
            for (const modifier of this.enabledModifiers) {
                if (!HEADER_COMPATIBLE_MODIFIERS.has(modifier)) {
                    throw new SyntaxError(
                        `$header is not compatible with $${modifier}`,
                    );
                }
            }
            if (this.removeHeaderIsRequestType) {
                throw new SyntaxError(
                    'Request-side $removeheader is not compatible with $header',
                );
            }
        }

        if (hasRestrictedContentType || restrictedResourceTypesSet.size > 0) {
            meta.baseModifierCount += 1;
        }
        meta.permittedContentTypeCount = permittedResourceTypesSet.size;

        this.filterListId = filterListId;
        this.index = index;
        this.node = node;
        this.pattern = pattern;
        this.hash = fastHash(pattern);
        this.allowlist = isAllowlist;
        this.priority = RulePriority.calculate(meta, isAllowlist);
        this.permittedResourceTypes = [...permittedResourceTypesSet];
        this.restrictedResourceTypes = [...restrictedResourceTypesSet];
    }

    /**
     * Checks if the specified modifier is enabled on the rule.
     *
     * @param modifier Canonical modifier name (e.g. `"redirect"`, `"script"`).
     *
     * @returns `true` if the modifier is enabled.
     */
    public isModifierEnabled(modifier: string): boolean {
        return this.enabledModifiers.has(modifier);
    }

    /**
     * Checks if the specified modifier is disabled (negated) on the rule.
     *
     * @param modifier Canonical modifier name.
     *
     * @returns `true` if the modifier is disabled.
     */
    public isModifierDisabled(modifier: string): boolean {
        return this.disabledModifiers.has(modifier);
    }

    /**
     * Returns `true` if one and only the specified modifier is enabled.
     *
     * @param modifier Canonical modifier name.
     *
     * @returns `true` if the modifier is the only enabled modifier.
     */
    public isSingleModifierEnabled(modifier: string): boolean {
        return this.enabledModifiers.size === 1
            && this.enabledModifiers.has(modifier);
    }

    /**
     * Checks if the rule completely disables filtering (elemhide + content +
     * urlblock + jsinject all enabled on an allowlist rule).
     *
     * @returns `true` if the rule disables all filtering.
     */
    public isFilteringDisabled(): boolean {
        if (!this.allowlist) {
            return false;
        }

        return this.enabledModifiers.has(OPTION_NAMES.ELEMHIDE)
            && this.enabledModifiers.has(OPTION_NAMES.CONTENT)
            && this.enabledModifiers.has(OPTION_NAMES.URLBLOCK)
            && this.enabledModifiers.has(OPTION_NAMES.JSINJECT);
    }

    /**
     * Checks if the rule pattern is a regular expression.
     *
     * @returns `true` if the rule pattern is a regex.
     */
    public isRegexRule(): boolean {
        return this.pattern.startsWith(MASK_REGEX_RULE)
            && this.pattern.endsWith(MASK_REGEX_RULE);
    }

    /**
     * Returns the rule text generated from the AST node.
     *
     * @returns Rule text string.
     */
    public getText(): string {
        return RuleGenerator.generate(this.node);
    }

    /**
     * Gets a hash for the full text of the rule. Needed to keep the ID of the
     * rule in the filter stable between runs (for CWS "skip review").
     *
     * @param salt Optional numeric salt for uniqueness.
     *
     * @returns Hash value in range [0, 2^31-1].
     */
    public getTextHash(salt?: number): number {
        const text = this.getText();
        const trialText = salt === undefined ? text : `${text}\0${salt}`;
        return fastHash31(trialText);
    }

    /**
     * Returns the applicable header name for `$removeheader`, or `null`
     * if the direction doesn't match or no valid header is set.
     *
     * @param isRequestHeaders `true` for request headers, `false` for response.
     *
     * @returns Header name or `null`.
     */
    public getApplicableHeaderName(isRequestHeaders: boolean): string | null {
        if (!this.removeHeaderName) {
            return null;
        }
        if (isRequestHeaders !== this.removeHeaderIsRequestType) {
            return null;
        }
        return this.removeHeaderName;
    }

    /**
     * Checks whether this rule (which must carry `$badfilter`) negates
     * `targetRule`. Delegates to {@link RuleBadfilter.negates}.
     *
     * @param targetRule The rule to test for negation.
     *
     * @returns `true` if this rule negates `targetRule`.
     */
    public negatesBadfilter(targetRule: Rule): boolean {
        return RuleBadfilter.negates(this, targetRule);
    }

    /**
     * Determines the effective header name and direction for a
     * `$removeheader` value.
     *
     * @param value Raw modifier value (may be empty for allowlist rules).
     *
     * @returns `name` — effective header name, or `null` when
     *   forbidden/unsupported; `isRequest` — `true` when targeting request
     *   headers.
     */
    private static computeRemoveHeaderInfo(
        value: string,
    ): { name: string | null; isRequest: boolean } {
        const lowerValue = value.toLowerCase();
        const isRequest = lowerValue.startsWith(REMOVE_HEADER_REQUEST_PREFIX);
        const rawHeaderName = isRequest
            ? lowerValue.slice(REMOVE_HEADER_REQUEST_PREFIX.length)
            : lowerValue;
        const headerName = rawHeaderName.trim();
        const isValid = headerName.length > 0
            && !FORBIDDEN_REMOVE_HEADERS.has(headerName)
            && !headerName.includes(':');

        return {
            name: isValid ? headerName : null,
            isRequest,
        };
    }

    /**
     * Parses the `$header` modifier value into an {@link HttpHeaderMatcher}.
     *
     * Expected format: `<header-name>` or `<header-name>:<value-or-/regex/>`.
     *
     * @param value Raw modifier value string.
     *
     * @returns Parsed header matcher.
     */
    private static parseHeaderModifier(value: string): HttpHeaderMatcher {
        const colonIdx = value.indexOf(':');
        if (colonIdx === -1) {
            return { header: value, value: null, isRegExp: false };
        }

        const header = value.slice(0, colonIdx);
        const rawValue = value.slice(colonIdx + 1);

        if (rawValue.startsWith('/') && rawValue.endsWith('/')) {
            return { header, value: rawValue.slice(1, -1), isRegExp: true };
        }

        return { header, value: rawValue, isRegExp: false };
    }

    /**
     * Checks if a network rule node is too general to be useful (no modifiers
     * and pattern shorter than 4 characters).
     *
     * @param node Network rule AST node.
     *
     * @returns `true` if the rule is too general.
     */
    public static isTooGeneral(node: NetworkRuleNode): boolean {
        return !(node.modifiers?.children?.length)
            && node.pattern.value.length < 4;
    }

    /**
     * Parses and converts rule text to AG syntax, then creates
     * {@link Rule} instances from all resulting network-rule nodes.
     *
     * @param filterId Filter list ID.
     * @param ruleIndex Rule index within the filter list.
     * @param text Raw rule text.
     *
     * @returns Array of {@link Rule} parsed from `text`.
     *
     * @throws `Error` when parsing or conversion fails.
     */
    public static createFromText(
        filterId: number,
        ruleIndex: number,
        text: string,
    ): Rule[] {
        let rulesConvertedToAGSyntax: AnyRule[];
        try {
            const node = ruleParser.parse(text);
            const conversionResult = RuleConverter.convertToAdg(node);
            if (conversionResult.isConverted) {
                rulesConvertedToAGSyntax = conversionResult.result;
            } else {
                rulesConvertedToAGSyntax = [node];
            }
        } catch (e) {
            throw new Error(
                // eslint-disable-next-line max-len
                `Unknown error during conversion rule to AG syntax: ${getErrorMessage(e)}`,
            );
        }

        const rules: Rule[] = [];
        for (let i = 0; i < rulesConvertedToAGSyntax.length; i += 1) {
            const ruleNode = rulesConvertedToAGSyntax[i];

            if (
                ruleNode.category !== RuleCategory.Network
                || ruleNode.type !== NetworkRuleType.NetworkRule
            ) {
                continue;
            }

            try {
                rules.push(new Rule(filterId, ruleIndex, ruleNode));
            } catch (e: unknown) {
                throw new Error(
                    // eslint-disable-next-line max-len
                    `Cannot create Rule from filter "${filterId}" and rule "${text}": ${getErrorMessage(e)}`,
                );
            }
        }

        return rules;
    }

    /**
     * Converts an already-parsed rule node to AG syntax and creates
     * {@link Rule} instances from all resulting network-rule nodes.
     *
     * @param filterListId Filter list ID.
     * @param index Rule index within the filter list.
     * @param node Rule AST node.
     *
     * @returns Array of {@link Rule} parsed from `node`.
     *
     * @throws `Error` when conversion to AG syntax fails.
     * @throws `SyntaxError` when the rule has spaces in pattern or is too
     *   general.
     */
    public static parseFromNode(
        filterListId: number,
        index: number,
        node: AnyRule,
    ): Rule[] {
        let rulesConvertedToAG: AnyRule[];
        try {
            const conversionResult = RuleConverter.convertToAdg(node);
            if (conversionResult.isConverted) {
                rulesConvertedToAG = conversionResult.result;
            } else {
                rulesConvertedToAG = [node];
            }
        } catch (e: unknown) {
            throw new Error(
                // eslint-disable-next-line max-len
                `Unknown error during conversion rule to AG syntax: ${getErrorMessage(e)}`,
            );
        }

        const rules: Rule[] = [];
        for (let i = 0; i < rulesConvertedToAG.length; i += 1) {
            const ruleNode = rulesConvertedToAG[i];

            if (
                ruleNode.category !== RuleCategory.Network
                || ruleNode.type !== NetworkRuleType.NetworkRule
            ) {
                continue;
            }

            try {
                rules.push(new Rule(filterListId, index, ruleNode));
            } catch (e: unknown) {
                let msg = `"${getErrorMessage(e)}" in the rule: `;

                try {
                    msg += `"${RuleGenerator.generate(node)}"`;
                } catch (generateError: unknown) {
                    msg += `"${JSON.stringify(node)}" `;
                    msg += `(generate error: ${getErrorMessage(generateError)})`;
                }

                throw new Error(msg);
            }
        }

        return rules;
    }
}

export {
    MASK_REGEX_RULE,
};
