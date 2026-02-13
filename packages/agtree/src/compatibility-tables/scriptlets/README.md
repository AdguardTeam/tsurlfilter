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

<!-- markdownlint-enable MD013 -->

\*: The field is required.
