# Adblock rule validator

This directory contains adblock rule validator that can be used to validate rules from various adblocker formats.
The validation is based on data stored in [the compatibility tables][compatibility-tables-url].
It is used by [AGLint] to validate filtering rules.

> [!WARNING]
> The validator is still in development, currently it only supports [basic rules][kb-basic-rules] validation.

- [Modifier validator API](#modifier-validator-api)
    - [`exists()`](#modifier-validator-api--exists)
    - [`validate()`](#modifier-validator-api--validate)
    - [`getAdgDocumentationLink()`,
      `getUboDocumentationLink()`,
      `getAbpDocumentationLink()`](#modifier-validator-api--getdocumentationlink)

## <a name="modifier-validator-api"></a> Modifier validator API

The modifier validator API is available in the `@adguard/agtree` package:

```ts
import { modifierValidator } from '@adguard/agtree';
```

### <a name="modifier-validator-api--exists"></a> `exists()`

```ts
/**
 * Simply checks whether the modifier exists in any adblocker.
 *
 * **Deprecated** and **removed** modifiers are considered as **existent**.
 *
 * @param modifier Already parsed modifier AST node.
 *
 * @returns True if modifier exists, false otherwise.
 */
exists(modifier: Modifier): boolean;
```

where `Modifier` is a [common parser type][parser-modifier-type].

<a name="modifier-validator-api--exists--examples"></a>

[**Examples of `exists()` usage:**](#modifier-validator-api--exists--examples)

```ts
import { ModifierParser, modifierValidator } from '@adguard/agtree';

// ModifierParser.parse() converts a string modifier into the AGTree `Modifier` type

// true is returned because $domain is a known modifier
modifierValidator.exists(ModifierParser.parse('domain=example.com|example.org'));

// false is returned because $non-existent-modifier is not a known modifier
modifierValidator.exists(ModifierParser.parse('non-existent-modifier=value'));
```

### <a name="modifier-validator-api--validate"></a> `validate()`

```ts
/**
 * Checks whether the given `modifier` is valid for specified `syntax`.
 *
 * For `Common` syntax it simply checks whether the modifier exists.
 * For specific syntax the validation is more complex —
 * deprecated, assignable, negatable and other requirements are checked.
 *
 * @param syntax Adblock syntax to check the modifier for.
 * @param rawModifier Modifier AST node.
 * @param isException Whether the modifier is used in exception rule, default to false.
 * Needed to check whether the modifier is allowed only in blocking or exception rules.
 *
 * @returns Result of modifier validation.
 */
validate(syntax: AdblockSyntax, rawModifier: Modifier, isException = false): ValidationResult;
```

where

- `AdblockSyntax` is a string enum with the following values:

    ```ts
    enum AdblockSyntax {
        Common = 'Common',
        Abp = 'AdblockPlus',
        Ubo = 'uBlockOrigin',
        Adg = 'AdGuard',
    }
    ```

- `Modifier` is a [common parser type][parser-modifier-type]

- `ValidationResult` is a type with the following structure:

    ```ts
    /**
     * Result of modifier validation:
     * - `{ valid: true }` for valid and _fully supported_ modifier;
     * - `{ valid: true, warn: <deprecation notice> }` for valid
     *   and _still supported but deprecated_ modifier;
     * - otherwise `{ valid: true, error: <invalidity reason> }`
     */
    type ValidationResult = {
        valid: boolean,
        error?: string,
        warn?: string,
    };
    ```

<a name="modifier-validator-api--validate--examples"></a>

[**Examples of `validate()` usage:**](#modifier-validator-api--validate--examples)

```ts
import { type AdblockSyntax, ModifierParser, modifierValidator } from '@adguard/agtree';
// ModifierParser.parse() converts a string modifier into the AGTree `Modifier` type
```

- `$webrtc` is not supported by AdGuard:

    ```ts
    modifierValidator.validate(
        AdblockSyntax.Adg,
        ModifierParser.parse('webrtc'),
    );
    ```

    ↓↓↓

    ```ts
    {
        valid: false,
        error: "Removed and no longer supported modifier: 'webrtc'"
    }
    ```

- but `$webrtc` is supported by uBlock Origin:

    ```ts
    modifierValidator.validate(
        AdblockSyntax.Ubo,
        ModifierParser.parse('webrtc'),
    );
    ```

    ↓↓↓

    ```ts
    {
        valid: true,
    }
    ```

- `$stealth` is not supported for blocking rules, only for exceptions:

    ```ts
    modifierValidator.validate(
        AdblockSyntax.Adg,
        ModifierParser.parse('stealth=dpi'),
        false,
    );
    ```

    ↓↓↓

    ```ts
    {
        valid: false,
        error: "Only exception rules may contain the modifier: 'stealth'"
    }
    ```

- `$mp4` is deprecated but still supported:

    ```ts
    modifierValidator.validate(
        AdblockSyntax.Adg,
        ModifierParser.parse('mp4'),
    );
    ```

    ↓↓↓

    <!-- markdownlint-disable line-length -->

    ```ts
    {
        valid: true,
        warn: "Rules with `$mp4` are still supported and being converted into `$redirect=noopmp4-1s` now but the support shall be removed in the future."
    }
    ```

### <a name="modifier-validator-api--getdocumentationlink"></a> `getAdgDocumentationLink()`, `getUboDocumentationLink()`, `getAbpDocumentationLink()`

<!-- markdownlint-enable line-length -->

Returns specified adblocker syntax documentation URL for given modifier, or `null` if there is no such URL.

```ts
getAdgDocumentationLink = (modifier: Modifier): string | null;
```

```ts
getUboDocumentationLink = (modifier: Modifier): string | null;
```

```ts
getAbpDocumentationLink = (modifier: Modifier): string | null;
```

where `Modifier` is a [common parser type][parser-modifier-type].

<a name="modifier-validator-api--getdocumentationlink--examples"></a>

<!-- markdownlint-disable-next-line line-length -->
[**Examples of `getAdgDocumentationLink()`, `getUboDocumentationLink()`, and `getAbpDocumentationLink()` usage:**](#modifier-validator-api--getdocumentationlink--examples)

```ts
import { ModifierParser, modifierValidator } from '@adguard/agtree';

// ModifierParser.parse() converts a string modifier into the AGTree `Modifier` type

// `https://adguard.app/kb/general/ad-filtering/create-own-filters/#denyallow-modifier` is returned
modifierValidator.getAdgDocumentationLink(ModifierParser.parse('denyallow=example.com'));

// `null` is returned because $permissions modifier is not supported by Ublock Origin
modifierValidator.getUboDocumentationLink(ModifierParser.parse('permissions=autoplay=()'));

// `https://help.adblockplus.org/hc/en-us/articles/360062733293-How-to-write-filters#type-options` is returned
modifierValidator.getAbpDocumentationLink(ModifierParser.parse('popup'));
```

[compatibility-tables-url]: https://github.com/AdguardTeam/tsurlfilter/tree/master/packages/agtree/src/compatibility-tables
[parser-modifier-type]: https://github.com/AdguardTeam/tsurlfilter/blob/865ff8a6100f804a6392f68b61b76e6d7a2c611d/packages/agtree/src/parser/common.ts#L754
[AGLint]: https://github.com/AdguardTeam/AGLint
[kb-basic-rules]: https://adguard.com/kb/general/ad-filtering/create-own-filters/#basic-rules
