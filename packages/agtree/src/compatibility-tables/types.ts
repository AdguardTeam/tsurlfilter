/**
 * @file Compatibility tables types.
 */

/**
 * Modifier data for specific platform in yaml files, e.g. adg_os_any, ubo_ext_any, etc.
 */
type SpecificPlatformModifierData = {
    name: string;
    aliases?: string[];
    description?: string | null;
    docs?: string | null;
    deprecated?: boolean;
    deprecation_message?: string | null;
    conflicts?: string[];
    inverse_conflicts?: boolean;
    assignable?: boolean;
    value_format?: string | null;
    negatable?: boolean;
    block_only?: boolean;
    exception_only?: boolean;
    // TODO: following fields should be handled later
    // version_added?: string | null;
    // version_removed?: string | null;
};

/**
 * Modifier data is an object where
 * - `key` — blocker id, e.g. 'adg_os_any', 'ubo_ext_any', etc.
 * - `value` — specific platform data, e.g. `{ name: 'domain', aliases: ['from'], ... }`
 */
export type ModifierData = {
    [key: string]: SpecificPlatformModifierData;
};

/**
 * Raw compatibility tables data object combined from yaml files.
 */
export type RawModifierData = {
    [key: string]: ModifierData;
};
