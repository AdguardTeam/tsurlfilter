# Adblock rule validator

This directory contains adblock rule validator that can be used to validate rules from various adblocker formats.
The validation is based on data stored in [the compatibility tables][compatibility-tables-url].
It is used by [AGLint] to validate filtering rules.

> [!WARNING]
> The validator is still in development, currently it only supports [basic rules][kb-basic-rules] validation.

- [Modifier validator API](#modifier-validator-api)
    - [`exists()`](#modifier-validator-api--exists)
    - [`validate()`](#modifier-validator-api--validate)

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
 * Checks whether the given `modifier` is valid for specified `platforms`.
 * It checks whether the modifier is supported by the product, deprecated, assignable, negatable, etc.
 *
 * @param platforms Platforms to check the modifier for. Can be a specific platform
 * (e.g., [Platform.AdgExtChrome]) or a generic platform (e.g., [Platform.AdgAny]),
 * or combination of multiple products (e.g., [Platform.AdgAny, Platform.UboAny]).
 * @param modifier Modifier AST node.
 * @param isException Whether the modifier is used in exception rule, default to false.
 * Needed to check whether the modifier is allowed only in blocking or exception rules.
 *
 * @note For single product: validates using first platform's compatibility data.
 * If multiple products are specified (e.g., [Platform.AdgAny, Platform.UboAny]),
 * validation is skipped and returns valid.
 *
 * @returns Result of modifier validation.
 */
validate(platforms: Platform[], modifier: Modifier, isException = false): ValidationResult;
```

where

- `platforms` is an array of `Platform` objects - can be:
    - A single specific platform (e.g., `[Platform.AdgExtChrome]`)
    - A single generic platform for one product (e.g., `[Platform.AdgAny]`, `[Platform.UboAny]`)
    - Multiple platforms from different products (e.g., `[Platform.AdgAny, Platform.UboAny]`) -
      in this case validation is skipped and returns `{ valid: true }`

- `Modifier` is a [common parser type][parser-modifier-type]

- `ValidationResult` is a type with the following structure:

    ```ts
    /**
     * Result of modifier validation:
     * - `{ valid: true }` for valid and _fully supported_ modifier;
     * - `{ valid: true, warn: <deprecation notice> }` for valid
     *   and _still supported but deprecated_ modifier;
     * - otherwise `{ valid: false, error: <invalidity reason> }`
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
import { Platform, ModifierParser, modifierValidator } from '@adguard/agtree';
// ModifierParser.parse() converts a string modifier into the AGTree `Modifier` type
```

- `$webrtc` is not supported by AdGuard:

    ```ts
    modifierValidator.validate(
        [Platform.AdgOsWindows],
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
        [Platform.UboExtFirefox],
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
        [Platform.AdgOsWindows],
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
        [Platform.AdgOsWindows],
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

[compatibility-tables-url]: https://github.com/AdguardTeam/tsurlfilter/tree/master/packages/agtree/src/compatibility-tables
[parser-modifier-type]: https://github.com/AdguardTeam/tsurlfilter/blob/865ff8a6100f804a6392f68b61b76e6d7a2c611d/packages/agtree/src/parser/common.ts#L754
[AGLint]: https://github.com/AdguardTeam/AGLint
[kb-basic-rules]: https://adguard.com/kb/general/ad-filtering/create-own-filters/#basic-rules
