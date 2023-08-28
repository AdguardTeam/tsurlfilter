/**
 * @file Compatibility tables types.
 */

/**
 * List of properties names for modifier data.
 *
 * @see {@link https://github.com/AdguardTeam/tsurlfilter/blob/master/packages/agtree/src/compatibility-tables/modifiers/README.md#file-structure}
 */
export const enum SpecificKey {
    Name = 'name',
    Aliases = 'aliases',
    Description = 'description',
    Docs = 'docs',
    Deprecated = 'deprecated',
    DeprecationMessage = 'deprecation_message',
    Removed = 'removed',
    RemovalMessage = 'removal_message',
    Conflicts = 'conflicts',
    InverseConflicts = 'inverse_conflicts',
    Assignable = 'assignable',
    Negatable = 'negatable',
    BlockOnly = 'block_only',
    ExceptionOnly = 'exception_only',
    ValueOptional = 'value_optional',
    ValueFormat = 'value_format',
    // TODO: following fields should be handled later
    // VersionAdded = 'version_added',
    // VersionRemoved = 'version_removed',
}

/**
 * Specific platform modifier data type
 * where all properties are required.
 */
export type SpecificPlatformModifierData = {
    [SpecificKey.Name]: string;
    [SpecificKey.Aliases]: string[] | null;
    [SpecificKey.Description]: string | null;
    [SpecificKey.Docs]: string | null;
    [SpecificKey.Deprecated]: boolean;
    [SpecificKey.DeprecationMessage]: string | null;
    [SpecificKey.Removed]: boolean;
    [SpecificKey.RemovalMessage]: string | null;
    [SpecificKey.Conflicts]: string[] | null;
    [SpecificKey.InverseConflicts]: boolean;
    [SpecificKey.Assignable]: boolean;
    [SpecificKey.Negatable]: boolean;
    [SpecificKey.BlockOnly]: boolean;
    [SpecificKey.ExceptionOnly]: boolean;
    [SpecificKey.ValueOptional]: boolean;
    [SpecificKey.ValueFormat]: string | null;
    // TODO: following fields should be handled later
    // [SpecificKey.VersionAdded]?: string | null;
    // [SpecificKey.VersionRemoved]?: string | null;
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

/**
 * Modifier data map prepared from raw modifiers data.
 */
export type ModifierDataMap = Map<string, ModifierData>;
