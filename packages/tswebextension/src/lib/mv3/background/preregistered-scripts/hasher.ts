import { type CosmeticRule } from '@adguard/tsurlfilter';

import { normalizeDomain } from '../../../common/utils/hostname';

/**
 * Coordination key: the `window` property name shared by the shared bundle,
 * per-rule files and the cleanup file.
 *
 * Fixed forever: the cleanup file deletes the property before any page
 * script runs, so rotation buys no stealth. A stable key keeps the
 * generated filenames stable across build generations.
 */
export const COORDINATION_KEY = '__ag_7d8a978ba755ed70';

/**
 * Filename of the shared scriptlets bundle.
 */
export const SHARED_BUNDLE_FILENAME = 'scriptlets-bundle.js';

/**
 * Filename of the cleanup script — the last file loaded for a domain.
 */
export const CLEANUP_FILENAME = 'cleanup.js';

/**
 * Returns the per-rule filename for a hash.
 *
 * @param hash Rule hash.
 *
 * @returns Per-rule filename.
 */
export const getRuleFilename = (hash: string): string => {
    return `${hash}.js`;
};

/**
 * Filename of the JSON manifest listing the per-rule hashes with matching
 * generated files.
 */
export const MANIFEST_FILENAME = 'manifest.json';

/**
 * Manifest schema version written by the build and required by the runtime.
 * A manifest reporting any other version is rejected: its fields may have
 * changed meaning.
 */
export const MANIFEST_SCHEMA_VERSION = 1;

/**
 * Shape of the `manifest.json` shipped next to the generated artifacts.
 * Shared contract between the build-time writer (browser-extension tools)
 * and the runtime reader ({@link PreregisteredScriptsService}).
 */
export interface PreregisteredScriptsManifest {
    /**
     * Schema version of the manifest.
     */
    schemaVersion: number;

    /**
     * Hashes of the current generation's per-rule files.
     */
    hashes: string[];

    /**
     * Scriptlet name → per-function filename (`s-{hash}.js`). A rule whose
     * scriptlet has no entry here stays on the dynamic injection path.
     */
    scriptletFiles: Record<string, string>;

    /**
     * Expanded preregistered hostnames embedded in the shared bundle's embed
     * gate. The runtime publishes this set for the top-level-site check, so
     * the page and background predicates always use the same set. Required:
     * a manifest without it cannot describe what its bundle gates, and the
     * feature has no released generation to stay compatible with.
     */
    hostnames: string[];
}

/**
 * Subdirectory within the filters folder where preregistered-script bundles
 * live. Consumed by the browser-extension build tool and runtime
 * configuration, not by this service itself.
 */
export const PREREGISTERED_SCRIPTS_DIR = 'preregistered-scripts';

/**
 * Number of hex characters to keep from the full SHA-256 digest.
 * 16 hex chars (64 bits) keeps per-hash filenames short while collision risk
 * stays negligible for the realistic number of distinct rules.
 */
const HASH_LENGTH = 16;

/**
 * Matches per-rule file paths (`…/{hash}.js`), the inverse of
 * {@link getRuleFilename}. Derived from {@link HASH_LENGTH} so the two can
 * never drift apart.
 */
const RULE_FILE_PATH_REGEX = new RegExp(`(?:^|/)([0-9a-f]{${HASH_LENGTH}})\\.js$`);

/**
 * Prefix of per-scriptlet-function filenames (`s-{hash}.js`), keeping them
 * apart from per-rule `{hash}.js` files. Part of the shared build/runtime
 * contract: the prefix keeps function files from matching the per-rule file
 * pattern when coverage is derived from registration file lists, and the
 * build tool names function files with it.
 */
export const SCRIPTLET_FUNCTION_FILENAME_PREFIX = 's-';

/**
 * Matches per-scriptlet-function filenames (`s-*.js`) that stay inside the
 * artifacts directory. Derived from
 * {@link SCRIPTLET_FUNCTION_FILENAME_PREFIX} so the build and runtime sides
 * cannot drift apart. Used to validate manifest entries before they reach
 * the registration `js` list: a value with a path separator or an unexpected
 * name must not be turned into a URL.
 */
export const SCRIPTLET_FUNCTION_FILENAME_REGEX = new RegExp(
    `^${SCRIPTLET_FUNCTION_FILENAME_PREFIX}[A-Za-z0-9_-]+\\.js$`,
);

/**
 * Computes a truncated SHA-256 hash of a string, used as a short, stable
 * filename (`{hash}.js`) for both build-time file generation and runtime
 * content-script registration.
 *
 * @param text Text to hash.
 *
 * @returns Lowercase hex string, {@link HASH_LENGTH} characters long.
 */
export const hashString = async (text: string): Promise<string> => {
    const encoder = new TextEncoder();
    const data = encoder.encode(text);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, HASH_LENGTH);
};

/**
 * Type-discriminator kinds so a scriptlet invocation and a JS rule body
 * can never hash to the same value even if their raw text happens to
 * coincide (e.g. a JS rule body that's textually identical to
 * `name + JSON.stringify(args)` for some scriptlet).
 */
const SCRIPTLET_HASH_KIND = 's';
const JS_RULE_HASH_KIND = 'j';

/**
 * Computes the stable hash for a scriptlet invocation.
 *
 * The input is a JSON-encoded tuple, never concatenation: concatenation let
 * a rule body containing `|path:` collide with a different rule carrying a
 * `$path` pattern.
 *
 * @param name Scriptlet name.
 * @param args Scriptlet arguments array.
 * @param pathPattern Optional raw `$path` modifier pattern of the rule.
 *
 * @returns SHA-256 hex hash string.
 */
const computeScriptletHash = async (
    name: string,
    args: string[],
    pathPattern?: string,
): Promise<string> => {
    return hashString(JSON.stringify([SCRIPTLET_HASH_KIND, name, args, pathPattern ?? null]));
};

/**
 * Computes the stable hash for a JS injection rule. See
 * {@link computeScriptletHash} for the input format; `null` (no `$path`)
 * differs from an empty root-only pattern.
 *
 * @param body Generated JS rule body.
 * @param pathPattern Optional raw `$path` modifier pattern of the rule.
 *
 * @returns SHA-256 hex hash string.
 */
const computeJsRuleHash = async (body: string, pathPattern?: string): Promise<string> => {
    return hashString(JSON.stringify([JS_RULE_HASH_KIND, body, pathPattern ?? null]));
};

/**
 * Computes the stable hash for a cosmetic rule (scriptlet or JS injection),
 * dispatching on the rule's own {@link CosmeticRule.isScriptlet} flag.
 *
 * This is the single hashing entry point shared by build-time collection
 * (`collectScriptlets` in the browser-extension build tool) and runtime
 * matching (`PreregisteredScriptsService`), so both sides are guaranteed to
 * hash any given rule identically — there is no separate extraction logic
 * to keep in sync.
 *
 * @param rule A constructed `CosmeticRule` instance.
 *
 * @returns SHA-256 hex hash string.
 *
 * @throws If the rule is a scriptlet rule but its scriptlet data can't be read.
 */
export const computeRuleHash = async (rule: CosmeticRule): Promise<string> => {
    const pathPattern = rule.pathModifier?.pattern;

    if (!rule.isScriptlet) {
        return computeJsRuleHash(rule.getContent(), pathPattern);
    }

    const data = rule.getScriptletData();
    if (!data) {
        throw new Error('getScriptletData() returned null for a scriptlet rule');
    }

    return computeScriptletHash(data.params.name, data.params.args, pathPattern);
};

/**
 * Cache for {@link computeRuleHashCached}: engine rule objects are reused
 * across lookups, so identity-keyed memoization is safe.
 */
const ruleHashCache = new WeakMap<CosmeticRule, Promise<string>>();

/**
 * {@link computeRuleHash} memoized per rule object — hashing runs on the
 * per-frame injection path, where the same rules are hashed repeatedly.
 * Rejections are cached too: a failing rule (e.g. a scriptlet with no
 * parseable data) fails deterministically, so a retry would only re-hash
 * and re-log it on every frame.
 *
 * @param rule A constructed `CosmeticRule` instance.
 *
 * @returns SHA-256 hex hash string.
 */
export const computeRuleHashCached = (rule: CosmeticRule): Promise<string> => {
    let cached = ruleHashCache.get(rule);

    if (!cached) {
        cached = computeRuleHash(rule);
        ruleHashCache.set(rule, cached);
    }

    return cached;
};

/**
 * Expands configured domains into lookup hostnames: the domain plus its
 * `www.` alias when not already prefixed. Content-script match patterns
 * are exact-host, so the apex and the alias need separate registrations;
 * hostnames without matching rules are skipped later. Other subdomains
 * are not covered. Shared by the build-time collector and the runtime
 * service so both sides look up the same hostname set.
 *
 * @param domains Configured preregistered domains.
 *
 * @returns Unique normalized hostnames to look up.
 */
export const expandHostnames = (domains: string[]): string[] => {
    const hostnames = new Set<string>();

    for (const domain of domains) {
        const normalized = normalizeDomain(domain);
        hostnames.add(normalized);
        if (!normalized.startsWith('www.')) {
            hostnames.add(`www.${normalized}`);
        }
    }

    return [...hostnames];
};

/**
 * Extracts the rule hash from a per-rule file path (`…/{hash}.js`), the
 * inverse of {@link getRuleFilename}. Used to recover covered rule hashes
 * from persisted content-script registrations.
 *
 * @param filePath Script file path from a registration descriptor.
 *
 * @returns The rule hash, or `null` for non-rule files (shared bundle,
 * per-function `s-*.js`, cleanup).
 */
export const getRuleHashFromFilePath = (filePath: string): string | null => {
    const match = RULE_FILE_PATH_REGEX.exec(filePath);
    return match ? match[1] : null;
};
