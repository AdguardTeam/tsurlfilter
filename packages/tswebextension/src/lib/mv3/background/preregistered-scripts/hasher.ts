import { type CosmeticRule } from '@adguard/tsurlfilter';

/**
 * Filename of the shared scriptlets bundle loaded before every per-hash file.
 */
export const SHARED_BUNDLE_FILENAME = 'scriptlets-bundle.js';

/**
 * Filename of the cleanup script loaded after the shared bundle and every
 * per-hash file. Deletes the coordination property the shared bundle creates
 * on `window`, so it never survives into the page's own script execution.
 */
export const CLEANUP_BUNDLE_FILENAME = 'cleanup.js';

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
 * Computes the stable hash for a scriptlet invocation.
 *
 * @param name Scriptlet name.
 * @param args Scriptlet arguments array.
 *
 * @returns SHA-256 hex hash string.
 */
export const computeScriptletHash = async (name: string, args: string[]): Promise<string> => {
    return hashString(name + JSON.stringify(args));
};

/**
 * Computes the stable hash for a JS injection rule.
 *
 * @param body Generated JS rule body.
 *
 * @returns SHA-256 hex hash string.
 */
export const computeJsRuleHash = async (body: string): Promise<string> => {
    return hashString(body);
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
    const pathSuffix = rule.pathModifier ? `|path:${rule.pathModifier.pattern}` : '';

    if (!rule.isScriptlet) {
        return hashString(rule.getContent() + pathSuffix);
    }

    const data = rule.getScriptletData();
    if (!data) {
        throw new Error('getScriptletData() returned null for a scriptlet rule');
    }

    return hashString(data.params.name + JSON.stringify(data.params.args) + pathSuffix);
};

/**
 * Normalizes a domain string for comparison: trims whitespace, lower-cases it,
 * strips leading/trailing dots, and drops a leading `www.` prefix.
 *
 * Shared by build-time collection (browser-extension) and runtime matching
 * (`CosmeticApi`, `PreregisteredScriptsService`) so both sides agree on
 * whether two domain strings refer to the same domain.
 *
 * @param domain Raw domain string.
 *
 * @returns Normalized domain string.
 */
export const normalizeDomain = (domain: string): string => {
    return domain.trim().toLowerCase().replace(/^\.+|\.+$/g, '').replace(/^www\./, '');
};
