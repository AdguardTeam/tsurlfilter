# Redirects compatibility tables

Each file represents a specific redirect. The file name is the name of the redirect. For example, `1x1-transparent.gif`
is represented by the file `1x1-transparent.gif.yml`.

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
  description: Redirects to an empty JavaScript file.

adg_os_any|adg_ext_any:
  name: noopjs
  aliases:
    - noop.js
    - blank-js

ubo_any:
  name: noop.js
  resource_types:
    - script
```

In this example, `description` is common across all platforms, while `name`, `aliases`, and `resource_types` are
platform-specific.

> [!NOTE]
> If a field is defined in both `common` and a platform-specific entry, the platform-specific value will override
> the common value.

### Platform-specific entries

Each platform-specific entry is an object with the following fields:

<!-- markdownlint-disable MD013 -->

| Field                 | Description                                                                                                                                                                                                                                                                                                                                                          | Type             | Default value       |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------- | ------------------- |
| `name`\*              | Name of the actual redirect.                                                                                                                                                                                                                                                                                                                                         | `string`         |                     |
| `aliases`             | List of aliases for the redirect (if any).                                                                                                                                                                                                                                                                                                                           | `string[]\|null` | `null` (no aliases) |
| `description`         | Short description of the actual redirect. If not specified or it's value is `null`, then the description is not available.                                                                                                                                                                                                                                           | `string\|null`   | `null`              |
| `docs`                | Link to the documentation. If not specified or it's value is `null`, then the documentation is not available.                                                                                                                                                                                                                                                        | `string\|null`   | `null`              |
| `version_added`       | The version of the adblocker in which the redirect was added. For AdGuard resources, the version of the library is specified.                                                                                                                                                                                                                                        | `string\|null`   | `null`              |
| `version_removed`     | The version of the adblocker when the redirect was removed.                                                                                                                                                                                                                                                                                                          | `string\|null`   | `null`              |
| `deprecated`          | Describes whether the redirect is deprecated.                                                                                                                                                                                                                                                                                                                        | `boolean`        | `false`             |
| `deprecation_message` | Message that describes why the redirect is deprecated. If not specified or it's value is `null`, then the message is not available. It's value is omitted if the redirect is not marked as deprecated.                                                                                                                                                               | `string\|null`   | `null`              |
| `removed`             | Describes whether the redirect is removed; for *already removed* features.                                                                                                                                                                                                                                                                                           | `boolean`        | `false`             |
| `removal_message`     | Message that describes why the redirect is removed. If not specified or it's value is `null`, then the message is not available. It's value is omitted if the redirect is not marked as deprecated.                                                                                                                                                                  | `string\|null`   | `null`              |
| `is_blocking`         | Whether the redirect requires user interaction to proceed (e.g., click to load). Blocking redirects show an interactive placeholder instead of silently replacing content. Non-blocking redirects (like `noopjs`) replace resources transparently. Example: `click2load.html` is blocking because it displays a UI that users must click to load the actual content. | `boolean`        | `false`             |
| `resource_types`      | List of [resource types][resource-types] that the redirect can be applied to. Only the values ​​listed in the documentation can be used!                                                                                                                                                                                                                               | `string[]`       | `[]`                |

<!-- markdownlint-enable MD013 -->

[resource-types]: https://developer.chrome.com/docs/extensions/reference/declarativeNetRequest/#type-ResourceType
\*: The field is required.
