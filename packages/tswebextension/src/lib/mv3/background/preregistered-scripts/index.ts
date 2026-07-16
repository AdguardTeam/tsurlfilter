/**
 * Copyright (c) 2015-2026 Adguard Software Ltd.
 *
 * @file
 * Re-exports for preregistered scripts.
 */

export {
    hashString,
    computeScriptletHash,
    computeJsRuleHash,
    SHARED_BUNDLE_FILENAME,
    PREREGISTERED_SCRIPTS_DIR,
} from './hasher';
export { PreregisteredScriptsService } from './preregistered-scripts-service';
