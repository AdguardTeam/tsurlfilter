/**
 * @file Cross-package parity test: verifies that dnr-converter's Rule
 * stays behaviourally compatible with @adguard/tsurlfilter's NetworkRule
 * across modifier sets, priority, URL pattern, $badfilter detection/negation,
 * and text roundtrip.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
    Engine,
    NetworkRule,
    NetworkRuleOption,
    Request,
    RequestType,
} from '@adguard/tsurlfilter';

import { ResourceType } from '../../src/declarative-rule/rule-condition';
import { OPTION_NAMES } from '../../src/rule/option-names';
import { Rule } from '../../src/rule/rule';

/**
 * Maps dnr-converter ResourceType values to canonical content-type modifier names.
 */
const RESOURCE_TYPE_TO_NAME: Record<string, string> = {
    [ResourceType.MainFrame]: 'document',
    [ResourceType.SubFrame]: 'subdocument',
    [ResourceType.Script]: 'script',
    [ResourceType.Stylesheet]: 'stylesheet',
    [ResourceType.Image]: 'image',
    [ResourceType.Object]: 'object',
    [ResourceType.Media]: 'media',
    [ResourceType.Font]: 'font',
    [ResourceType.WebSocket]: 'websocket',
    [ResourceType.Ping]: 'ping',
    [ResourceType.Other]: 'other',
    [ResourceType.XmlHttpRequest]: 'xmlhttprequest',
};

/**
 * Canonical content-type modifier name mapped to the tsurlfilter RequestType
 * flag. Content types are NOT NetworkRuleOption bitmask members in tsurlfilter.
 */
const CONTENT_TYPE_REQUEST_TYPE: Record<string, number> = {
    document: RequestType.Document,
    font: RequestType.Font,
    image: RequestType.Image,
    media: RequestType.Media,
    object: RequestType.Object,
    other: RequestType.Other,
    ping: RequestType.Ping,
    script: RequestType.Script,
    stylesheet: RequestType.Stylesheet,
    subdocument: RequestType.SubDocument,
    websocket: RequestType.WebSocket,
    xmlhttprequest: RequestType.XmlHttpRequest,
};

/**
 * Canonical modifier name mapped to the tsurlfilter NetworkRuleOption bitmask
 * member. Scoped to modifiers that are bitmask options in tsurlfilter AND are
 * tracked by dnr-converter's enabledModifiers/disabledModifiers.
 */
const BITMASK_MODIFIERS: Record<string, NetworkRuleOption> = {
    badfilter: NetworkRuleOption.Badfilter,
    content: NetworkRuleOption.Content,
    cookie: NetworkRuleOption.Cookie,
    csp: NetworkRuleOption.Csp,
    elemhide: NetworkRuleOption.Elemhide,
    generichide: NetworkRuleOption.Generichide,
    genericblock: NetworkRuleOption.Genericblock,
    header: NetworkRuleOption.Header,
    important: NetworkRuleOption.Important,
    jsinject: NetworkRuleOption.Jsinject,
    'match-case': NetworkRuleOption.MatchCase,
    method: NetworkRuleOption.Method,
    permissions: NetworkRuleOption.Permissions,
    popup: NetworkRuleOption.Popup,
    redirect: NetworkRuleOption.Redirect,
    removeheader: NetworkRuleOption.RemoveHeader,
    removeparam: NetworkRuleOption.RemoveParam,
    specifichide: NetworkRuleOption.Specifichide,
    stealth: NetworkRuleOption.Stealth,
    'third-party': NetworkRuleOption.ThirdParty,
    urlblock: NetworkRuleOption.Urlblock,
};

/**
 * The universe of comparable canonical modifier names.
 */
const MODIFIER_UNIVERSE: readonly string[] = [
    ...Object.keys(BITMASK_MODIFIERS),
    ...Object.keys(CONTENT_TYPE_REQUEST_TYPE),
];

/**
 * Reads the corpus file and returns non-empty, non-comment lines.
 *
 * @param filename Fixture file name.
 *
 * @returns Array of rule text strings.
 */
function loadCorpus(filename: string): string[] {
    const filePath = resolve(__dirname, '..', 'fixtures', filename);
    const content = readFileSync(filePath, 'utf-8');
    return content
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line.length > 0 && !line.startsWith('!'));
}

/**
 * Canonical enabled modifier names derived from a dnr-converter Rule.
 *
 * Content-type modifiers are checked via both {@link Rule.enabledModifiers}
 * and {@link Rule.permittedResourceTypes} because dnr-converter tracks
 * implicit content types (e.g. document/subdocument defaults on allowlist
 * rules) in permittedResourceTypes rather than enabledModifiers.
 *
 * @param rule The dnr-converter Rule.
 *
 * @returns Sorted set of enabled canonical modifier names.
 */
function dnrEnabledNames(rule: Rule): string[] {
    const names = new Set<string>();
    for (const name of MODIFIER_UNIVERSE) {
        if (rule.isModifierEnabled(name)) {
            names.add(name);
        }
    }
    // Also gather content types from permittedResourceTypes (they may not appear
    // in enabledModifiers when they are implicit, e.g. on allowlist negator rules).
    for (const rt of rule.permittedResourceTypes) {
        const name = RESOURCE_TYPE_TO_NAME[rt];
        if (name) {
            names.add(name);
        }
    }
    return [...names].sort();
}

/**
 * Canonical disabled modifier names derived from a dnr-converter Rule.
 *
 * Content-type modifiers are checked via both {@link Rule.disabledModifiers}
 * and {@link Rule.restrictedResourceTypes} because dnr-converter tracks
 * implicit restricted content types in restrictedResourceTypes rather than
 * disabledModifiers.
 *
 * @param rule The dnr-converter Rule.
 *
 * @returns Sorted set of disabled canonical modifier names.
 */
function dnrDisabledNames(rule: Rule): string[] {
    const names = new Set<string>();
    for (const name of MODIFIER_UNIVERSE) {
        if (rule.isModifierDisabled(name)) {
            names.add(name);
        }
    }
    for (const rt of rule.restrictedResourceTypes) {
        const name = RESOURCE_TYPE_TO_NAME[rt];
        if (name) {
            names.add(name);
        }
    }
    return [...names].sort();
}

/**
 * Canonical enabled modifier names derived from a tsurlfilter NetworkRule.
 *
 * @param rule The tsurlfilter NetworkRule.
 *
 * @returns Sorted set of enabled canonical modifier names.
 */
function tsEnabledNames(rule: NetworkRule): string[] {
    const names = new Set<string>();
    for (const [name, option] of Object.entries(BITMASK_MODIFIERS)) {
        if (rule.isOptionEnabled(option)) {
            names.add(name);
        }
    }
    const permitted = rule.getPermittedRequestTypes();
    for (const [name, requestType] of Object.entries(CONTENT_TYPE_REQUEST_TYPE)) {
        if ((permitted & requestType) !== 0) {
            names.add(name);
        }
    }
    return [...names].sort();
}

/**
 * Canonical disabled modifier names derived from a tsurlfilter NetworkRule.
 *
 * @param rule The tsurlfilter NetworkRule.
 *
 * @returns Sorted set of disabled canonical modifier names.
 */
function tsDisabledNames(rule: NetworkRule): string[] {
    const names = new Set<string>();
    for (const [name, option] of Object.entries(BITMASK_MODIFIERS)) {
        if (rule.isOptionDisabled(option)) {
            names.add(name);
        }
    }
    const restricted = rule.getRestrictedRequestTypes();
    for (const [name, requestType] of Object.entries(CONTENT_TYPE_REQUEST_TYPE)) {
        if ((restricted & requestType) !== 0) {
            names.add(name);
        }
    }
    return [...names].sort();
}

const corpusRules = loadCorpus('network-rule-corpus.txt');

// ---------------------------------------------------------------------------
// Task 1 smoke test: basic cross-package harness
// ---------------------------------------------------------------------------
describe('Rule ↔ NetworkRule cross-package harness', () => {
    it('parses a basic rule under both implementations', () => {
        const [dnrRule] = Rule.createFromText(1, 0, '||example.com^');
        const tsRule = new NetworkRule('||example.com^', 1);

        expect(dnrRule).toBeDefined();
        expect(tsRule).toBeInstanceOf(NetworkRule);
        expect(dnrRule.pattern).toBe(tsRule.getPattern());
    });
});

// ---------------------------------------------------------------------------
// Task 2: modifier-set parity (enabled + disabled)
// ---------------------------------------------------------------------------
describe('modifier-set parity', () => {
    it.each(corpusRules)('enabled modifiers match for: %s', (ruleText) => {
        const [dnrRule] = Rule.createFromText(1, 0, ruleText);
        const tsRule = new NetworkRule(ruleText, 1);
        expect(dnrEnabledNames(dnrRule)).toEqual(tsEnabledNames(tsRule));
    });

    it.each(corpusRules)('disabled modifiers match for: %s', (ruleText) => {
        const [dnrRule] = Rule.createFromText(1, 0, ruleText);
        const tsRule = new NetworkRule(ruleText, 1);
        expect(dnrDisabledNames(dnrRule)).toEqual(tsDisabledNames(tsRule));
    });

    it('$first-party is normalised to ~$third-party on both sides', () => {
        const [dnrRule] = Rule.createFromText(1, 0, '||example.com^$first-party');
        const tsRule = new NetworkRule('||example.com^$first-party', 1);
        expect(dnrRule.isModifierDisabled('third-party')).toBe(true);
        expect(tsRule.isOptionDisabled(NetworkRuleOption.ThirdParty)).toBe(true);
    });
});

// ---------------------------------------------------------------------------
// Task 3: pattern / allowlist / priority / advanced-value parity
// ---------------------------------------------------------------------------
describe('pattern / allowlist / priority / advanced-value parity', () => {
    it.each(corpusRules)('pattern matches for: %s', (ruleText) => {
        const [dnrRule] = Rule.createFromText(1, 0, ruleText);
        const tsRule = new NetworkRule(ruleText, 1);
        expect(dnrRule.pattern).toBe(tsRule.getPattern());
    });

    it.each(corpusRules)('allowlist flag matches for: %s', (ruleText) => {
        const [dnrRule] = Rule.createFromText(1, 0, ruleText);
        const tsRule = new NetworkRule(ruleText, 1);
        expect(dnrRule.allowlist).toBe(tsRule.isAllowlist());
    });

    it.each(corpusRules)('priority matches for: %s', (ruleText) => {
        const [dnrRule] = Rule.createFromText(1, 0, ruleText);
        const tsRule = new NetworkRule(ruleText, 1);
        expect(dnrRule.priority).toBe(tsRule.getPriorityWeight());
    });

    it.each(corpusRules)('advanced modifier value matches for: %s', (ruleText) => {
        const [dnrRule] = Rule.createFromText(1, 0, ruleText);
        const tsRule = new NetworkRule(ruleText, 1);

        if (dnrRule.isModifierEnabled(OPTION_NAMES.REMOVEPARAM)) {
            // For `$removeparam` an empty value is meaningful ("remove all
            // query parameters"), so both sides must agree exactly — `''`
            // must not be collapsed to `null`.
            expect(dnrRule.advancedModifierValue).toBe(tsRule.getAdvancedModifierValue());
            return;
        }

        // Normalise other value-less modifiers: dnr-converter returns `null`
        // while tsurlfilter returns `''`. Both mean "no value" — neither should
        // affect downstream behaviour. Apply the same normalisation on both sides.
        const dnrValue = dnrRule.advancedModifierValue || null;
        const tsValue = tsRule.getAdvancedModifierValue() || null;
        expect(dnrValue).toBe(tsValue);
    });
});

// ---------------------------------------------------------------------------
// Task 4: $badfilter detection and negation parity
// ---------------------------------------------------------------------------
describe('$badfilter detection and negation parity', () => {
    const badfilterCorpus = corpusRules.filter((ruleText) => ruleText.includes('badfilter'));

    it.each(badfilterCorpus)('badfilter detection matches for: %s', (ruleText) => {
        const [dnrRule] = Rule.createFromText(1, 0, ruleText);
        const tsRule = new NetworkRule(ruleText, 1);
        expect(dnrRule.isModifierEnabled('badfilter'))
            .toBe(tsRule.isOptionEnabled(NetworkRuleOption.Badfilter));
    });

    it('a $badfilter rule negates its identical target on both sides', () => {
        const [dnrBf] = Rule.createFromText(1, 0, '||example.com^$badfilter');
        const [dnrTarget] = Rule.createFromText(1, 0, '||example.com^');
        const tsBf = new NetworkRule('||example.com^$badfilter', 1);
        const tsTarget = new NetworkRule('||example.com^', 1);

        expect(dnrBf.negatesBadfilter(dnrTarget)).toBe(true);
        expect(tsBf.negatesBadfilter(tsTarget)).toBe(true);
    });

    it('a $badfilter rule does not negate a different-pattern target on either side', () => {
        const [dnrBf] = Rule.createFromText(1, 0, '||example.com^$badfilter');
        const [dnrOther] = Rule.createFromText(1, 0, '||other.example^');
        const tsBf = new NetworkRule('||example.com^$badfilter', 1);
        const tsOther = new NetworkRule('||other.example^', 1);

        expect(dnrBf.negatesBadfilter(dnrOther)).toBe(false);
        expect(tsBf.negatesBadfilter(tsOther)).toBe(false);
    });

    it.each([
        // Advanced modifier values.
        ['||example.com^$removeparam=foo', '||example.com^$removeparam=foo,badfilter', true],
        ['||example.com^$removeparam=bar', '||example.com^$removeparam=foo,badfilter', false],
        ['||example.com^$removeparam', '||example.com^$removeparam,badfilter', true],
        ['||example.com^$removeparam', '||example.com^$removeparam=foo,badfilter', false],
        ["||example.com^$csp=script-src 'self'", "||example.com^$csp=script-src 'self',badfilter", true],
        ["||example.com^$csp=script-src 'none'", "||example.com^$csp=script-src 'self',badfilter", false],
        // Repeated modifiers are kept as separate entries, in the written order.
        [
            "||example.com^$csp=script-src 'self'",
            "||example.com^$csp=script-src 'self',csp=img-src 'none',badfilter",
            false,
        ],
        [
            "||example.com^$csp=script-src 'self',csp=img-src 'none'",
            "||example.com^$csp=script-src 'self',csp=img-src 'none',badfilter",
            true,
        ],
        [
            "||example.com^$csp=img-src 'none',csp=script-src 'self'",
            "||example.com^$csp=script-src 'self',csp=img-src 'none',badfilter",
            false,
        ],
        ['||example.com^$redirect=nooptext', '||example.com^$redirect=noopjs,badfilter', false],
        // $redirect and $redirect-rule share one option flag but are different modifiers.
        ['||example.com^$redirect=nooptext', '||example.com^$redirect-rule=nooptext,badfilter', false],
        ['||example.com^$redirect-rule=nooptext', '||example.com^$redirect-rule=nooptext,badfilter', true],
        // $header, $method and $to values.
        ['||example.com^$header=set-cookie:/a/', '||example.com^$header=set-cookie:/a/,badfilter', true],
        ['||example.com^$header=set-cookie:/a/', '||example.com^$header=set-cookie:/b/,badfilter', false],
        ['||example.com^$header=set-cookie', '||example.com^$header=referer,badfilter', false],
        ['||example.com^$method=GET', '||example.com^$method=GET,badfilter', true],
        ['||example.com^$method=GET', '||example.com^$method=POST,badfilter', false],
        ['||example.com^$to=a.com', '||example.com^$to=a.com,badfilter', true],
        ['||example.com^$to=a.com', '||example.com^$to=b.com,badfilter', false],
        // Values are compared as written: spellings that are equivalent after
        // parsing must not negate each other in either engine.
        ['||example.com^$removeheader=Set-Cookie', '||example.com^$removeheader=set-cookie,badfilter', false],
        ['||example.com^$to=Example.com', '||example.com^$to=example.com,badfilter', false],
        ['||example.com^$method=GET', '||example.com^$method=get,badfilter', false],
        ['||example.com^$method=GET|POST', '||example.com^$method=POST|GET,badfilter', false],
        ['||example.com^$to=a.com|b.com', '||example.com^$to=b.com|a.com,badfilter', false],
        [
            '||example.com^$permissions=fullscreen=()\\,document-domain=()',
            '||example.com^$permissions=fullscreen=()|document-domain=(),badfilter',
            false,
        ],
        // $app values are compared in MV2 and MV3 alike.
        ['||example.com^$app=a|b', '||example.com^$app=b|a,badfilter', false],
        ['||example.com^$app=a|b', '||example.com^$app=a|b,badfilter', true],
        // $permissions values (AG-36226 / AdguardBrowserExtension#2961).
        ['||example.com^$permissions=fullscreen=()', '||example.com^$permissions=fullscreen=(),badfilter', true],
        [
            '||example.com^$permissions=document-domain=()',
            '||example.com^$permissions=fullscreen=(),badfilter',
            false,
        ],
        // $header regexp and restricted $method/$to values.
        ['||example.com^$header=x:/foo/', '||example.com^$header=x:/foo/,badfilter', true],
        ['||example.com^$header=x:/foo/', '||example.com^$header=x:foo,badfilter', false],
        ['||example.com^$method=~HEAD', '||example.com^$method=~GET,badfilter', false],
        ['||example.com^$to=~a.com', '||example.com^$to=~b.com,badfilter', false],
        // Values are taken from the rule text, before conversion to AG syntax,
        // so resource aliases and priority suffixes are compared as written.
        ['||example.com^$redirect=noop.js', '||example.com^$redirect=noopjs,badfilter', false],
        ['||example.com^$redirect=noop.js:99', '||example.com^$redirect=noop.js,badfilter', false],
        ['||example.com^$empty', '||example.com^$redirect=nooptext,badfilter', false],
        ['||example.com^$redirect=noopjs', '||example.com^$redirect=noopjs,badfilter', true],
    ])('MV2 and MV3 agree on negation for target %s vs badfilter %s', (targetText, badfilterText, expected) => {
        const [dnrBadfilter] = Rule.createFromText(1, 0, badfilterText);
        const [dnrTarget] = Rule.createFromText(1, 0, targetText);
        const tsBadfilter = new NetworkRule(badfilterText, 1);
        const tsTarget = new NetworkRule(targetText, 1);

        expect(dnrBadfilter.negatesBadfilter(dnrTarget)).toBe(expected);
        expect(tsBadfilter.negatesBadfilter(tsTarget)).toBe(expected);
    });
});

// ---------------------------------------------------------------------------
// $badfilter through the MV2 engine
// ---------------------------------------------------------------------------

/**
 * Matches a request against rules through the MV2 engine.
 *
 * @param rules Rule texts.
 *
 * @returns `true` when any rule was applied to the request.
 */
const matchesThroughEngine = (rules: string[]): boolean => {
    const engine = Engine.createSync({
        filters: [{ id: 1, content: rules.join('\n') }],
    });
    const result = engine.matchRequest(
        new Request('https://example.com/', null, RequestType.Document),
    );

    const ruleLists = [
        result.cspRules,
        result.cookieRules,
        result.replaceRules,
        result.urlTransformRules,
        result.redirectRules,
        result.removeParamRules,
        result.removeHeaderRules,
        result.permissionsRules,
        result.headerRules,
        result.stealthRules,
    ];

    return result.basicRule !== null
        || result.documentRule !== null
        || ruleLists.some((list) => list !== null && list.length > 0);
};

/**
 * Engine-level `$badfilter` cases: target rule text, badfilter rule text, and
 * whether the badfilter rule is expected to negate the target.
 */
const ENGINE_BADFILTER_CASES: [target: string, badfilter: string, negated: boolean][] = [
    // Source-syntax aliases are compared by the name as written.
    ['||example.com^$queryprune=foo', '||example.com^$queryprune=foo,badfilter', true],
    ['||example.com^$queryprune=bar', '||example.com^$queryprune=foo,badfilter', false],
    ['||example.com^$queryprune=foo', '||example.com^$removeparam=foo,badfilter', false],
    [
        '||example.com^$rewrite=abp-resource:blank-js',
        '||example.com^$rewrite=abp-resource:blank-js,badfilter',
        true,
    ],
    ['||example.com^$rewrite=abp-resource:blank-js', '||example.com^$redirect=noopjs,badfilter', false],
    // Values that conversion rewrites must not negate a differently written rule.
    ['||example.com^$redirect=noop.js', '||example.com^$redirect=noopjs,badfilter', false],
    ['||example.com^$empty', '||example.com^$redirect=nooptext,badfilter', false],
    // Repeated modifiers are not collapsed and are order-sensitive.
    [
        "||example.com^$csp=script-src 'self'",
        "||example.com^$csp=script-src 'self',csp=img-src 'none',badfilter",
        false,
    ],
    [
        "||example.com^$csp=script-src 'self',csp=img-src 'none'",
        "||example.com^$csp=script-src 'self',csp=img-src 'none',badfilter",
        true,
    ],
    [
        "||example.com^$csp=img-src 'none',csp=script-src 'self'",
        "||example.com^$csp=script-src 'self',csp=img-src 'none',badfilter",
        false,
    ],
    // Unconverted rules keep negating as before.
    ['||example.com^$removeparam=foo', '||example.com^$removeparam=foo,badfilter', true],
    ['||example.com^$removeparam=bar', '||example.com^$removeparam=foo,badfilter', false],
    ['||example.com^$redirect=noopjs', '||example.com^$redirect=noopjs,badfilter', true],
];

describe('badfilter negation through the MV2 engine', () => {
    // `new NetworkRule(text)` used above bypasses the `FilterList` conversion,
    // so that table exercises a path the product never takes: in the engine the
    // rule text has already been converted to AG syntax. These cases go through
    // the engine, and a `$badfilter` rule must negate exactly the same rules.
    it.each(ENGINE_BADFILTER_CASES)(
        'negates=%s for target %s vs badfilter %s',
        (targetText, badfilterText, negated) => {
            // The target rule must apply on its own, otherwise the check below
            // would pass for the wrong reason.
            expect(matchesThroughEngine([targetText])).toBe(true);
            expect(matchesThroughEngine([targetText, badfilterText])).toBe(!negated);
        },
    );
});

// ---------------------------------------------------------------------------
// Task 5: text roundtrip parity
// ---------------------------------------------------------------------------
describe('text roundtrip parity', () => {
    it.each(corpusRules)('dnr-converter text re-parses equivalently under tsurlfilter: %s', (ruleText) => {
        const [dnrRule] = Rule.createFromText(1, 0, ruleText);
        const dnrText = dnrRule.getText();

        // tsurlfilter must accept dnr-converter's canonical text.
        const reParsed = new NetworkRule(dnrText, 1);

        // ...and it must describe the same rule (pattern + allowlist).
        expect(reParsed.getPattern()).toBe(dnrRule.pattern);
        expect(reParsed.isAllowlist()).toBe(dnrRule.allowlist);
    });

    // Pre-filter the corpus to the subset whose text is expected to render
    // unchanged (basic + single-flag-modifier rules). Each generated case then
    // asserts unconditionally, so the parity guarantee cannot silently
    // disappear if the corpus drifts to contain no matching rule.
    const stableCorpus = corpusRules.filter(
        (ruleText) => /^(?:@@)?\|\|[^$]+\^\$?(?:third-party|important|script|image)$/.test(ruleText),
    );

    it('corpus contains at least one stable (unchanged-text) rule', () => {
        // Guard against the corpus drifting so no rule matches the stable-text
        // filter, which would make the parametrised cases below disappear
        // silently with all-green-but-vacuous output.
        expect(stableCorpus.length).toBeGreaterThan(0);
    });

    it.each(stableCorpus)('dnr-converter text equals source for unconverted rules: %s', (ruleText) => {
        const [dnrRule] = Rule.createFromText(1, 0, ruleText);
        // Rules whose modifiers need no AG-syntax conversion render unchanged.
        expect(dnrRule.getText()).toBe(ruleText);
    });
});
