import { type CosmeticRule } from '@adguard/tsurlfilter';

/**
 * Coordination key: the `window` property name shared by the shared bundle,
 * per-rule files and the cleanup file.
 *
 * Fixed forever: the cleanup file deletes the property before any page
 * script runs, so rotation buys no stealth. A stable key keeps filenames
 * stable, so persisted content-script registrations from a previous
 * extension version keep loading the same paths.
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
 * Highest manifest schema version the runtime understands. Manifests
 * without `schemaVersion` are version 0. A manifest reporting a higher
 * version is rejected by the runtime: its fields may have changed meaning.
 */
export const MANIFEST_SCHEMA_VERSION = 1;

/**
 * Shape of the `manifest.json` shipped next to the generated artifacts.
 * Shared contract between the build-time writer (browser-extension tools)
 * and the runtime reader ({@link PreregisteredScriptsService}). The writer
 * may persist extra bookkeeping fields; the runtime ignores them.
 */
export interface PreregisteredScriptsManifest {
    /**
     * Schema version of the manifest. Absent in manifests written before
     * the field was introduced; treated as 0.
     */
    schemaVersion?: number;

    /**
     * Hashes of the current generation's per-rule files.
     */
    hashes: string[];

    /**
     * Scriptlet name → per-function filename (`s-{hash}.js`). A rule whose
     * scriptlet has no entry here stays on the dynamic injection path.
     * May be absent in raw manifests written before this field was
     * introduced — the runtime reader normalizes it to `{}`.
     */
    scriptletFiles: Record<string, string>;
}

/**
 * Subdirectory within the filters folder where preregistered-script bundles live.
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
 * Type-discriminator prefixes so a scriptlet invocation and a JS rule body
 * can never hash to the same value even if their raw text happens to
 * coincide (e.g. a JS rule body that's textually identical to
 * `name + JSON.stringify(args)` for some scriptlet).
 */
const SCRIPTLET_HASH_PREFIX = 's:';
const JS_RULE_HASH_PREFIX = 'j:';

/**
 * Suffix appended to the hash input when a rule carries a `$path` modifier,
 * so the same rule body with different `$path` values hashes differently.
 *
 * @param pathPattern Raw `$path` modifier pattern.
 *
 * @returns Suffix string or an empty string.
 */
const pathHashSuffix = (pathPattern?: string): string => {
    return pathPattern ? `|path:${pathPattern}` : '';
};

/**
 * Computes the stable hash for a scriptlet invocation.
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
    return hashString(SCRIPTLET_HASH_PREFIX + name + JSON.stringify(args) + pathHashSuffix(pathPattern));
};

/**
 * Computes the stable hash for a JS injection rule.
 *
 * @param body Generated JS rule body.
 * @param pathPattern Optional raw `$path` modifier pattern of the rule.
 *
 * @returns SHA-256 hex hash string.
 */
const computeJsRuleHash = async (body: string, pathPattern?: string): Promise<string> => {
    return hashString(JS_RULE_HASH_PREFIX + body + pathHashSuffix(pathPattern));
};

/**
 * Computes the stable hash for a cosmetic rule (scriptlet or JS injection),
 * dispatching on the rule's own {@link CosmeticRule.isScriptlet} flag.
 *
 * This is the single hashing entry point shared by build-time collection
 * (`ScriptletCollector`) and runtime matching
 * (`PreregisteredScriptsService`), so both sides are guaranteed to hash any
 * given rule identically — there is no separate extraction logic to keep in sync.
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

        cached.catch(() => ruleHashCache.delete(rule));
    }

    return cached;
};

/**
 * Normalizes a domain string for comparison: trims whitespace, lower-cases
 * it, and strips leading/trailing dots. The `www.` prefix is NOT stripped:
 * content-script match patterns are exact-host, so apex and `www.` are
 * distinct registrations — collapsing them would silently widen coverage.
 *
 * @param domain Raw domain string.
 *
 * @returns Normalized domain string.
 */
export const normalizeDomain = (domain: string): string => {
    return domain.trim().toLowerCase().replace(/^\.+|\.+$/g, '');
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
