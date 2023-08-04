export enum CosmeticRuleModifiers {
    Path = 'path',
    Domain = 'domain',
    Url = 'url',
}

export const CosmeticRuleModifiersSyntax = {
    OpenBracket: '[',
    CloseBracket: ']',
    SpecialSymbol: '$',
    Delimiter: ',',
    Assigner: '=',
    EscapeCharacter: '\\',
} as const;
