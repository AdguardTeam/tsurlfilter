/**
 * @file Curated build-time contract of the preregistered-scripts
 * artifacts: the symbols the browser-extension build tool imports.
 * Runtime-only helpers (hashing cache, coverage recovery, hostname
 * normalization) are intentionally not re-exported — this entry point is
 * public API and must stay minimal.
 */

export {
    CLEANUP_FILENAME,
    COORDINATION_KEY,
    computeRuleHash,
    CONDITIONS_FILENAME_PREFIX,
    expandHostnames,
    getConditionsFilename,
    getRuleFilename,
    hashString,
    MANIFEST_FILENAME,
    MANIFEST_SCHEMA_VERSION,
    PREREGISTERED_SCRIPTS_DIR,
    SCRIPTLET_FUNCTION_FILENAME_PREFIX,
    SHARED_BUNDLE_FILENAME,
} from './hasher';
export type { PreregisteredScriptsManifest } from './hasher';
export { computePageExceptionsFingerprint } from './exception-fingerprint';
export type { PreregisteredFilterList } from './exception-fingerprint';
