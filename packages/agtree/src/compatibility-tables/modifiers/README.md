# Modifiers compatibility tables

Each file represents a specific modifier. The file name is the name of the modifier. For example, `third-party` is
represented by the file `third-party.yml`.

## File structure

Each file contains an object, where the key is either:

- The special `common` key for properties shared across all platforms
- An [actual adblocker ID](../README.md#supported-adblockers-and-platforms)

### The `common` key

The `common` key allows you to define properties that are shared across all platforms. These properties are
automatically merged into each platform-specific entry. This reduces duplication and improves maintainability.

**Example:**

```yaml
common:
  name: important
  description: |-
    The `$important` modifier applied to a rule increases its priority
    over any other rule without `$important` modifier.
  negatable: false

adg_any:
  docs: https://adguard.app/kb/general/ad-filtering/create-own-filters/#important-modifier

ubo_any:
  docs: https://github.com/gorhill/uBlock/wiki/Static-filter-syntax#important
```

In this example, `name`, `description`, and `negatable` are common across all platforms, while `docs` links are
platform-specific.

> [!NOTE]
> If a field is defined in both `common` and a platform-specific entry, the platform-specific value will override
> the common value.

### Platform-specific entries

Each platform-specific entry is an object with the following fields:

<!-- markdownlint-disable MD013 -->

| Field                 | Description                                                                                                                                                                                                                                                                              | Type             | Default value [**]    |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------- | --------------------- |
| `name` [*]            | Name of the actual modifier.                                                                                                                                                                                                                                                             | `string`         |                       |
| `aliases`             | List of aliases for the modifier (if any).                                                                                                                                                                                                                                               | `string[]\|null` | `null` (no aliases)   |
| `description`         | Short description of the actual modifier. If not specified or it's value is `null`, then the description is not available.                                                                                                                                                               | `string\|null`   | `null`                |
| `docs`                | Link to the documentation. If not specified or it's value is `null`, then the documentation is not available.                                                                                                                                                                            | `string\|null`   | `null`                |
| `version_added`       | The version of the adblocker when the modifier was added.                                                                                                                                                                                                                                | `string\|null`   | `null`                |
| `version_removed`     | The version of the adblocker when the modifier was removed.                                                                                                                                                                                                                              | `string\|null`   | `null`                |
| `deprecated`          | Describes whether the modifier is deprecated; for *soon-to-be removed* features.                                                                                                                                                                                                         | `boolean`        | `false`               |
| `deprecation_message` | Message that describes why the modifier is deprecated. If not specified or it's value is `null`, then the message is not available. It's value is omitted if the modifier is not marked as deprecated.                                                                                   | `string\|null`   | `null`                |
| `removed`             | Describes whether the modifier is removed; for *already removed* features.                                                                                                                                                                                                               | `boolean`        | `false`               |
| `removal_message`     | Message that describes why the modifier is removed. If not specified or it's value is `null`, then the message is not available. It's value is omitted if the modifier is not marked as deprecated.                                                                                      | `string\|null`   | `null`                |
| `conflicts`           | List of modifiers that are incompatible with the actual one.                                                                                                                                                                                                                             | `string[]\|null` | `null` (no conflicts) |
| `inverse_conflicts`   | The actual modifier is incompatible with all other modifiers, except the ones listed in `conflicts`.                                                                                                                                                                                     | `boolean`        | `false`               |
| `assignable`          | Describes whether the actual modifier supports value assignment. For example, `$domain` is assignable, so it can be used like this: `$domain=domain.com\|~subdomain.domain.com`, where `=` is the assignment operator and `domain.com\|~subdomain.domain.com` is the value.              | `boolean`        | `false`               |
| `negatable`           | Describes whether the actual modifier can be negated. For example, `$third-party` is negatable, so it can be used like this: `$~third-party`.                                                                                                                                            | `boolean`        | `true`                |
| `block_only`          | The actual modifier can only be used in blocking rules, it cannot be used in exceptions. If it's value is `true`, then the modifier can be used only in blocking rules. `exception_only` and `block_only` cannot be used together (they are mutually exclusive).                         | `boolean`        | `false`               |
| `exception_only`      | The actual modifier can only be used in exceptions, it cannot be used in blocking rules. If it's value is `true`, then the modifier can be used only in exceptions. `exception_only` and `block_only` cannot be used together (they are mutually exclusive).                             | `boolean`        | `false`               |
| `value_optional`      | Describes whether the *assignable* modifier value is required. For example, `$cookie` is assignable but it can be used without a value in exception rules: `@@\|\|example.com^$cookie`. If `false`, the `value_format` is required, e.g. the value of `$app` should always be specified. | `boolean`        | `false`               |
| `value_format`        | Describes the format of the value. See [Value format](#value-format) for more details.                                                                                                                                                                                                   | `string\|null`   | `null`                |
| `value_format_flags`  | [RegExp flags][regexp-flags] for the `value_format` field. It can be used only if the `value_format` is provided and it's a regular expression. Thanks to XRegExp syntax, you can also use flags in the beginning of the regular expression, e.g. `(?i)pattern`.                         | `string\|null`   | `null`                |

<!-- markdownlint-enable MD013 -->

[regexp-flags]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/RegExp/RegExp#flags

### Value format

The value format describes the format of the modifier value. It can be one of the following:

- Null value:
    - In this case, the value format isn't validated.
      The value is valid if it's not empty, because if you specify "assignable" as `true`,
      then the value is required, just the format is not validated.
    - Example: `value_format: null`
- Regular expression pattern:
    - Validating the value is done by matching it against the regular expression you provide.
      The value is valid if it matches the regular expression.
    - The regular expression should start with `/` and end with `/`. For example, `/^[a-z0-9]+$/`.
    - Example:
        - If you want to validate that the value is a number, you can use `value_format: /^[0-9]+$/`.
          It matches for `$modifier=1` (valid), but not for `$modifier=abc` (invalid).
- Pre-defined validator name:
    - Validating the value is done by using the pre-defined validator. The value is valid if it matches the validator.
    - Currently available validators:
        - list of domains separated by the vertical bar `|`:
            - `pipe_separated_apps` validates value for `$app` modifier
                - **Does not support**: wildcards (`*`), wildcard TLD (e.g., `example.*`), or regex patterns
            - `pipe_separated_domains` validates value for `$domain` modifier
                - **Supports**: wildcard TLD (e.g., `example.*`), wildcard subdomain (e.g., `*.example.com`)
                - **Does not support**: regex patterns
            - `pipe_separated_denyallow_domains` validates value for `$denyallow` modifier
                - **Does not support**: negation (`~`), wildcards (`*`), wildcard TLD (e.g., `example.*`),
                  or regex patterns
            <!-- TODO: implement later -->
            <!-- - `pipe_separated_extensions` validates value for `$extension` modifier -->
            - `pipe_separated_methods` validates value for `$method` modifier
            - `pipe_separated_stealth_options` validates value for `$stealth` modifier
            - `csp_value` validates value for `$csp` modifier
            - `permissions_value` validates value for `$permissions` modifier
            - `referrerpolicy_value` validates value for `$referrerpolicy` modifier
        - `url` validates that the value is a valid URL.
        - `regexp` validates that the value is a valid regular expression.
            > :warning: **This is not the same as when you assign a regular expression to value_format!**
            >
            > - If you specify `value_format: /^[0-9]+$/`,
            >   then the value is valid if it matches the regular expression
            >   (it is numeric, for example: `$modifier=1`, but not `$modifier=a`).
            > - If you specify `value_format: regexp`, then the value is valid if it's a valid regular expression,
            >   for example: `$modifier=/^valid_regex_value$/`.
            >
        - Example:
        - For validating `domain` modifier, you can use `value_format: pipe_separated_domains`.

> [!NOTE]
> In YAML files, you can use XRegExp syntax for regular expressions.
> For example, you can use free-spacing mode `(?x)` to make the regular expression more readable,
> or you can use comments `(?#...)` to add comments to the regular expression,
> or named captures `(?<name>...)`.
> During build, YAML files are processed and we extract native regular expressions from XRegExp instances.

* * *

### <a name="footnote-asterisk-1"></a>

> `*`: The field is required.

[*]: #footnote-asterisk-1 "The field is required"

### <a name="footnote-asterisk-2"></a>

> `**`: Default value may not be specified in .yml files.

[**]: #footnote-asterisk-2 "Default value may not be specified in .yml files."
