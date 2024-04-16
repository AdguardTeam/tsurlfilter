# Redirects compatibility tables

Each file represents a specific redirect. The file name is the name of the redirect. For example, `1x1-transparent.gif` is represented by the file `1x1-transparent.gif.yml`.

## File structure

Each file contains an object, where the key is the [actual adblocker ID](../README.md#supported-adblockers-and-platforms) and the value is the object with the following fields:

| Field | Description | Type | Default value |
| --- | --- | --- | --- |
| `name`\* | Name of the actual redirect. | `string` | |
| `aliases` | List of aliases for the redirect (if any). | `string[]` | `[]` (no aliases) |
| `description` | Short description of the actual redirect. If not specified or it's value is `null`, then the description is not available. | `string\|null` | `null` |
| `docs` | Link to the documentation. If not specified or it's value is `null`, then the documentation is not available. | `string\|null` | `null` |
| `version_added` | The version of the adblocker when the redirect was added. | `string\|null` | `null` |
| `version_removed` | The version of the adblocker when the redirect was removed. | `string\|null` | `null` |
| `deprecated` | Describes whether the redirect is deprecated. | `boolean` | `false` |
| `deprecation_message` | Message that describes why the redirect is deprecated. If not specified or it's value is `null`, then the message is not available. It's value is omitted if the redirect is not marked as deprecated. | `string\|null` | `null` |

\*: The field is required.
