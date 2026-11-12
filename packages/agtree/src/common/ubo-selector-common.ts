/**
 * Known uBO-specific pseudo-class names.
 */
export const UboPseudoName = {
    MatchesMedia: 'matches-media',
    MatchesPath: 'matches-path',
    Remove: 'remove',
    RemoveAttr: 'remove-attr',
    RemoveClass: 'remove-class',
    Style: 'style',
} as const;

// intentionally naming the variable the same as the type
// eslint-disable-next-line @typescript-eslint/no-redeclare
export type UboPseudoName = typeof UboPseudoName[keyof typeof UboPseudoName];
