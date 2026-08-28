# Scriptlets compatibility tables

Each file represents a specific scriptlet. The file name is the name of the scriptlet. For example,
`abort-on-property-read` is represented by the file `abort-on-property-read.yml`.

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
  parameters:
    - name: property
      required: true

adg_os_any|adg_ext_any:
  name: abort-on-property-read
  version_added: 1.0.4
  aliases:
    - abort-on-property-read.js
    - ubo-abort-on-property-read.js

ubo_any:
  name: abort-on-property-read.js
```

In this example, `parameters` is common across all platforms, while `name`, `aliases`, and `version_added` are
platform-specific.

> [!NOTE]
> If a field is defined in both `common` and a platform-specific entry, the platform-specific value will override
> the common value.

### Platform-specific entries

Each platform-specific entry is an object with the following fields:

<!-- markdownlint-disable MD013 -->

| Field                      | Description                                                                                                                                                                                              | Type             | Default value        |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------- | -------------------- |
| `name`\*                   | Name of the actual scriptlet.                                                                                                                                                                            | `string`         |                      |
| `aliases`                  | List of aliases for the scriptlet (if any).                                                                                                                                                              | `string[]\|null` | `null` (no aliases)  |
| `description`              | Short description of the actual scriptlet. If not specified or it's value is `null`, then the description is not available.                                                                              | `string\|null`   | `null`               |
| `docs`                     | Link to the documentation. If not specified or it's value is `null`, then the documentation is not available.                                                                                            | `string\|null`   | `null`               |
| `version_added`            | The version of the adblocker in which the scriptlet was added. For AdGuard resources, the version of the library is specified.                                                                           | `string\|null`   | `null`               |
| `version_removed`          | The version of the adblocker when the scriptlet was removed.                                                                                                                                             | `string\|null`   | `null`               |
| `is_trusted`               | Describes whether the scriptlet is a trusted scriptlet. Trusted scriptlets have elevated privileges and can only be used in trusted filter lists.                                                        | `boolean`        | `false`              |
| `debug`                    | Describes whether the scriptlet is used only for debugging purposes.                                                                                                                                     | `boolean`        | `false`              |
| `deprecated`               | Describes whether the scriptlet is deprecated.                                                                                                                                                           | `boolean`        | `false`              |
| `deprecation_message`      | Message that describes why the scriptlet is deprecated. If not specified or it's value is `null`, then the message is not available. It's value is omitted if the scriptlet is not marked as deprecated. | `string\|null`   | `null`               |
| `removed`                  | Describes whether the scriptlet is removed; for *already removed* features.                                                                                                                              | `boolean`        | `false`              |
| `removal_message`          | Message that describes why the scriptlet is removed. If not specified or it's value is `null`, then the message is not available. It's value is omitted if the scriptlet is not marked as deprecated.    | `string\|null`   | `null`               |
| `parameters`               | List of parameters that the scriptlet accepts. **Every** parameter should be listed here, because we check that the scriptlet is used correctly (e.g. that the number of parameters is correct).         | `Parameter[]`    | `[]` (no parameters) |
| `parameters[].name`\*      | Name of the actual parameter.                                                                                                                                                                            | `string`         |                      |
| `parameters[].required`\*  | Describes whether the parameter is required. Empty parameters are not allowed.                                                                                                                           | `boolean`        |                      |
| `parameters[].description` | Short description of the parameter. If not specified or it's value is `null`, then the description is not available.                                                                                     | `string\|null`   | `null`               |
| `parameters[].pattern`     | Regular expression that matches the value of the parameter. If it's value is `null`, then the parameter value is not checked.                                                                            | `string\|null`   | `null`               |
| `parameters[].default`     | Default value of the parameter (if any)                                                                                                                                                                  | `string\|null`   | `null`               |
| `parameters[].debug`       | Describes whether the parameter is used only for debugging purposes.                                                                                                                                     | `boolean`        | `false`              |
| `variadic_parameters`      | Configuration for accepting an unlimited number of arguments after the fixed parameters. See [Variadic parameters](#variadic-parameters) section below for details.                                      | `object\|null`   | `null` (not variadic)|
| `variadic_parameters.min_count` | Minimum number of variadic arguments required.                                                                                                                                               | `number`         | `0`                  |
| `variadic_parameters.max_count` | Maximum number of variadic arguments allowed. Use `null` for unlimited.                                                                                                                     | `number\|null`   | `null` (unlimited)   |
| `variadic_parameters.all_parameters` | Validation rules applied to **all** variadic arguments. If not specified, arguments are accepted without validation.                                                                   | `object\|null`   | `null`               |
| `variadic_parameters.all_parameters.name` | Name describing what these variadic arguments represent.                                                                                                                          | `string`         |                      |
| `variadic_parameters.all_parameters.description` | Description of what these variadic arguments are for.                                                                                                                        | `string\|null`   | `null`               |
| `variadic_parameters.all_parameters.pattern` | Regular expression pattern that **each** variadic argument must match.                                                                                                           | `string\|null`   | `null`               |
| `variadic_parameters.all_parameters.default` | Default value for variadic arguments (if any).                                                                                                                                   | `string\|null`   | `null`               |
| `variadic_parameters.all_parameters.debug` | Whether these variadic arguments are for debugging purposes only.                                                                                                                  | `boolean`        | `false`              |
| `variadic_parameters.parameters` | Validation rules for **specific positions** (0-indexed). Use numeric string keys like `"0"`, `"1"`, `"2"`. Overrides `all_parameters` for that position.                            | `object\|null`   | `null`               |
| `variadic_parameters.parameters["N"]` | Validation for the Nth variadic argument (same fields as `all_parameters`). Example: `"0"` for first variadic arg, `"2"` for third.                                                  | `object`         |                      |
| `ubo_tokens`               | List of uBlock Origin token parameters the scriptlet accepts. Tokens are optional key-value pairs that come after the positional parameters and are parsed by `getExtraArgs()`.                          | `UboToken[]`     | `[]` (no tokens)     |
| `ubo_tokens[].name`\*      | Name of the token (the key in the key-value pair).                                                                                                                                                       | `string`         |                      |
| `ubo_tokens[].description` | Short description of what this token controls or configures. If not specified or its value is `null`, then the description is not available.                                                             | `string\|null`   | `null`               |
| `ubo_tokens[].value_format` | Regular expression pattern that matches valid values for this token. Defines the syntax/format of acceptable values. If `null`, format validation is not available.                                     | `string\|null`   | `null`               |
| `ubo_tokens[].value_type`  | Semantic type indicating how the token value is used in code: `string` (used as-is), `integer` (auto-converted to number), or `boolean` (checked for truthiness). If `null`, type is unknown.          | `'string'\|'integer'\|'boolean'\|null` | `null` |
| `ubo_tokens[].default`     | Default/fallback value used in scriptlet code when the token is absent or falsy. Represents documented fallback patterns in the implementation (e.g. `extraArgs.quitAfter \|\| 0`). If `null`, no default is documented. | `string\|null` | `null` |

<!-- markdownlint-enable MD013 -->

\*: The field is required.

### uBO tokens

Tokens are a uBlock Origin-specific concept. They are optional key-value pairs appended after the positional
parameters in a scriptlet call and parsed by the `getExtraArgs()` function in uBO's scriptlet runtime.

**Example:**

```adblock
example.com##+js(aeld, click, popMagic, runAt, idle)
!                ↑     ↑      ↑         ↑      ↑
!                │     │      │         │      │
!                │     │      │         │      └── Token value (they always have values)
!                │     │      │         └── Tokens came after optional parameters
!                │     │      └── Second optional parameter value
!                │     └── First optional parameter value
!                └── Scriptlet name
```

Results in

```js
{ runAt: 'idle' }
```

being passed to the scriptlet as extra args.

The `value_type` and `value_format` fields are complementary:

- `value_format` describes **what is valid** (syntax) — a regex pattern for the raw string value
- `value_type` describes **how it is interpreted** (semantics) — whether the value is used as a string,
  converted to an integer, or treated as a boolean flag

### Variadic parameters

Variadic parameters allow a scriptlet to accept an arbitrary number of arguments after all the fixed positional
parameters. This is similar to JavaScript's rest parameters (`...args`).

#### When to use variadic parameters

Use variadic parameters when a scriptlet can accept any number of arguments at the end of its parameter list.
Common use cases include:

- **Logging scriptlets** that accept any number of message parts (e.g., `log`)
- **Scriptlets with flexible filtering** where users can provide multiple filter criteria
- **Any case where the number of arguments is not known in advance**

#### How it works

When a scriptlet has `variadic_parameters` defined:

1. All fixed parameters (defined in `parameters`) are processed first
2. Any remaining arguments are treated as variadic parameters
3. Variadic parameters are validated according to the rules in `variadic_parameters`
4. The count of variadic arguments must be within the specified `min_count` and `max_count` range

#### Configuration options

The `variadic_parameters` object supports the following configuration:

**Count control:**

- `min_count`: Minimum number of variadic arguments required (default: `0`)
- `max_count`: Maximum number of variadic arguments allowed. Use `null` for unlimited (default: `null`)

**Validation:**

- `all_parameters`: Validation rules applied to **all** variadic arguments (optional)
- `parameters`: Validation rules for **specific positions** (0-indexed, optional)

The validation priority is: position-specific rules override `all_parameters` rules, which override no validation.

#### Examples

##### Example 1: Accept any number of arguments without validation

The simplest case — accept unlimited arguments with no validation (like the AdGuard `log` scriptlet):

```yaml
adg_os_any|adg_ext_any:
  name: log
  variadic_parameters:
    min_count: 0      # no arguments required (optional)
    max_count: null   # unlimited args allowed
    # No validation - accept any values
```

**Usage (AdGuard scriptlet syntax):**

```adblock
example.org#%#//scriptlet('log')                           ! 0 args - valid
example.org#%#//scriptlet('log', 'Hello')                  ! 1 arg - valid
example.org#%#//scriptlet('log', 'Hello', 'world!')        ! 2 args - valid
example.org#%#//scriptlet('log', 'a', 'b', 'c', 'd', 'e')  ! 5 args - valid
```

##### Example 2: Validate all variadic arguments with the same pattern

Apply the same validation rule to every variadic argument:

```yaml
variadic_parameters:
  min_count: 1       # at least 1 arg required
  max_count: null    # unlimited
  all_parameters:
    name: filter_pattern
    description: Filter patterns to match
    pattern: ^[a-zA-Z0-9_-]+$   # alphanumeric, underscore, hyphen only
```

**Usage:**

```adblock
example.org#%#//scriptlet('scriptlet', 'valid-filter')           ! Valid - matches pattern
example.org#%#//scriptlet('scriptlet', 'filter1', 'filter2')     ! Valid - both match pattern
example.org#%#//scriptlet('scriptlet', 'invalid filter!')        ! Invalid - space is not allowed
example.org#%#//scriptlet('scriptlet')                           ! Invalid - min_count is 1
```

##### Example 3: Validate specific argument positions

Validate only certain positions, leave others unrestricted:

```yaml
variadic_parameters:
  min_count: 2       # need at least 2 args
  max_count: null
  parameters:
    "0":             # First variadic arg (0-indexed)
      name: log_level
      description: Logging level
      pattern: ^(info|warn|error)$
    "1":             # Second variadic arg
      name: timeout_ms
      description: Timeout in milliseconds
      pattern: ^\d+$
    # Args at position 2, 3, 4... have no validation
```

**Usage:**

```adblock
example.org#%#//scriptlet('scriptlet', 'info', '1000')                    ! Valid
example.org#%#//scriptlet('scriptlet', 'error', '500', 'extra', 'data')  ! Valid - positions 2,3 unrestricted
example.org#%#//scriptlet('scriptlet', 'debug', '1000')                  ! Invalid - "debug" not in pattern
example.org#%#//scriptlet('scriptlet', 'info')                           ! Invalid - min_count is 2
```

##### Example 4: Default validation with position-specific overrides

Combine `all_parameters` (default) with position-specific overrides:

```yaml
variadic_parameters:
  min_count: 1
  max_count: 5       # limit to 5 args
  all_parameters:
    name: arg
    pattern: ^[a-z]+$           # default: lowercase letters only
  parameters:
    "0":                        # Override for first arg
      name: command
      pattern: ^(start|stop)$   # must be "start" or "stop"
    # Positions 1, 2, 3, 4 use all_parameters validation
```

**Usage:**

```adblock
example.org#%#//scriptlet('scriptlet', 'start', 'abc', 'def')         ! Valid
example.org#%#//scriptlet('scriptlet', 'stop', 'xyz')                 ! Valid
example.org#%#//scriptlet('scriptlet', 'pause', 'abc')                ! Invalid - "pause" not allowed at position 0
example.org#%#//scriptlet('scriptlet', 'start', 'ABC')                ! Invalid - uppercase not allowed (all_parameters)
example.org#%#//scriptlet('scriptlet', 'start', 'a', 'b', 'c', 'd', 'e')  ! Invalid - exceeds max_count (5)
```

##### Example 5: Required minimum with no validation

Require at least N arguments, but don't validate their content:

```yaml
variadic_parameters:
  min_count: 3       # must provide at least 3 args
  max_count: 10      # but no more than 10
  # No all_parameters or parameters = no validation
```

#### Relationship with fixed parameters and uBO tokens

The order of arguments in a scriptlet call is:

1. **Fixed positional parameters** (defined in `parameters`)
2. **Variadic parameters** (defined in `variadic_parameters`)
3. **uBO tokens** (defined in `ubo_tokens`, uBO-specific only)

**Example scriptlet configuration:**

```yaml
parameters:
  - name: selector
    required: true
  - name: needle
    required: false

variadic_parameters:
  min_count: 0
  max_count: null

ubo_tokens:
  - name: runAt
```

**Example usage:**

```adblock
! Fixed: selector="div", needle="" (empty), Variadic: none
example.org#%#//scriptlet('scriptlet', 'div')

! Fixed: selector="div", needle="text", Variadic: none
example.org#%#//scriptlet('scriptlet', 'div', 'text')

! Fixed: selector="div", needle="text", Variadic: ["extra", "args"]
example.org#%#//scriptlet('scriptlet', 'div', 'text', 'extra', 'args')

! Note: AdGuard scriptlets and ABP snippets don't support tokens like uBO does
! For uBO scriptlets with tokens, use: example.com##+js(scriptlet, div, text, extra, runAt, idle)
```

#### Best practices

1. **Be explicit about counts**: Always set `min_count` and `max_count` to clearly document expectations
2. **Use validation when possible**: If variadic args have a known format, use `pattern` to validate
3. **Document clearly**: Use `description` fields to explain what variadic arguments represent
4. **Prefer position-specific validation**: If only certain positions need validation, use `parameters` instead
   of `all_parameters`
5. **Consider limits**: Set reasonable `max_count` values to prevent abuse or mistakes
