/**
 * Filename of the shared scriptlets bundle loaded before every per-hash file.
 */
export const SHARED_BUNDLE_FILENAME = 'scriptlets-bundle.js';

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
 * Normalizes a domain string for comparison: trims whitespace, lower-cases it,
 * and strips leading/trailing dots.
 *
 * Deliberately does NOT strip a leading `www.` label (or any other
 * subdomain label): `PreregisteredScriptsService.buildDomainScripts` already
 * treats `www.example.com` as a subdomain of `example.com` via wildcard
 * `matches` patterns and hash-set-equality collapsing, and `CosmeticApi`'s
 * `isPreregisteredDomain` matches subdomains via `endsWith`. Special-casing
 * `www` here would only make distinct domain strings collide too early —
 * that used to cause a "Duplicate script ID" crash when both `www.example.com`
 * and `example.com` were preregistered.
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
    return domain.trim().toLowerCase().replace(/^\.+|\.+$/g, '');
};
