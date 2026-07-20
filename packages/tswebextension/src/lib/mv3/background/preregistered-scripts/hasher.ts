/**
 * Copyright (c) 2015-2026 Adguard Software Ltd.
 *
 * @file
 * Hashing utilities for preregistered scripts.
 *
 * These functions are shared between build-time tools (in browser-extension)
 * and runtime (in tswebextension) to ensure consistent hash computation.
 *
 * This file has **no browser-extension dependencies** and can be imported
 * from Node.js (e.g. by build-time tools) via the `@adguard/tswebextension/mv3/preregistered-scripts`
 * entry point.
 */

/**
 * Filename of the shared scriptlets bundle loaded before every per-hash file.
 */
export const SHARED_BUNDLE_FILENAME = 'scriptlets-bundle.js';

/**
 * Subdirectory within the filters folder where preregistered-script bundles live.
 */
export const PREREGISTERED_SCRIPTS_DIR = 'preregistered-scripts';

/**
 * Computes the SHA-256 hash of a string.
 *
 * @param text Text to hash.
 *
 * @returns SHA-256 hex string.
 */
export const hashString = async (text: string): Promise<string> => {
    const encoder = new TextEncoder();
    const data = encoder.encode(text);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
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
