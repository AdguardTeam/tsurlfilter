# Validators

This directory contains validators for modifier value formats. Validators are used to
validate modifier values in filter rules and provide detailed error messages when
validation fails.

## API

### `validate(validatorName, value, ctx)`

Validates a value using the specified validator. Issues are written into the
provided `ValidationContext`.

**Parameters:**

- `validatorName` - Name of the validator to use (see available validators below)
- `value` - String value to validate
- `ctx` - `ValidationContext` instance to collect issues into

**Throws:** Error if the validator name is not recognized.

**Example:**

```typescript
import { validate } from './compatibility-tables/validators';
import { ValidationContext } from './compatibility-tables/validators/validation-context';

const ctx = new ValidationContext();
validate('pipe_separated_domains', 'example.com|example.org', ctx);
if (!ctx.valid) {
  console.error(ctx.issues);
}
```

### `isKnownValidator(validatorName: string): boolean`

Type guard to check if a validator name is known.

**Parameters:**

- `validatorName` - Name to check

**Returns:** `true` if the validator exists, `false` otherwise

**Example:**

```typescript
import { isKnownValidator } from './compatibility-tables/validators';

if (isKnownValidator('pipe_separated_domains')) {
  // validator exists
}
```

### `KNOWN_VALIDATORS: ReadonlySet<string>`

Set of all available validator names. Useful for iterating over all validators
or checking if a name exists.

**Example:**

```typescript
import { KNOWN_VALIDATORS } from './compatibility-tables/validators';

console.log(Array.from(KNOWN_VALIDATORS));
// ['pipe_separated_apps', 'pipe_separated_domains', ...]
```

## Available Validators

### Pipe-Separated List Validators

These validators validate lists of items separated by the vertical bar `|`.

#### `pipe_separated_apps`

Validates app names for the `$app` modifier.

**Supports:**

- Alphanumeric characters (a-z, A-Z, 0-9)
- Underscore (`_`)
- Dot (`.`) as separator between chunks

**Does not support:**

- Wildcards (`*`)
- Wildcard TLD (e.g., `example.*`)
- Regex patterns

**Valid examples:**

- `Example.exe`
- `com.example.app`
- `Example.exe|com.example.app`

**Invalid examples:**

- `Example.*` (wildcard not allowed)
- `com.example..app` (empty chunk between dots)

---

#### `pipe_separated_domains`

Validates domain names for the `$domain` modifier.

**Supports:**

- Valid domain names and hostnames
- Wildcard TLD (e.g., `example.*`)
- Wildcard subdomain (e.g., `*.example.com`)
- Regex patterns (e.g., `/^example\.(com|org)$/`)
- Negation with `~` prefix (e.g., `~example.com`)

**Valid examples:**

- `example.com`
- `example.com|example.org`
- `~example.com` (negated domain)
- `example.*` (wildcard TLD)
- `*.example.com` (wildcard subdomain)
- `/^example\.(com|org)$/` (regex pattern)

**Invalid examples:**

- `example..com` (empty label)
- `exam[le.com` (invalid characters)

---

#### `pipe_separated_denyallow_domains`

Validates domain names for the `$denyallow` modifier.

**Supports:**

- Valid domain names and hostnames only

**Does not support:**

- Negation (`~`)
- Wildcards (`*`)
- Wildcard TLD (e.g., `example.*`)
- Regex patterns

**Valid examples:**

- `example.com`
- `example.com|example.org`

**Invalid examples:**

- `~example.com` (negation not allowed)
- `example.*` (wildcards not allowed)

---

#### `pipe_separated_methods`

Validates HTTP methods for the `$method` modifier.

**Supports:**

- Standard HTTP methods (lowercase only)
- See `pipe-separated-methods.ts` for the complete list of allowed methods
- Negation with `~` prefix
- Consistent negation (all methods must be either negated or not negated)

**Valid examples:**

- `get`
- `get|post|put`
- `~get|~post` (all negated)

**Invalid examples:**

- `GET` (must be lowercase)
- `get|~post` (mixed negation not allowed)
- `disconnect` (not an allowed method)

---

#### `pipe_separated_stealth_options`

Validates stealth options for the `$stealth` modifier.

**Supports:**

- Predefined stealth option names (lowercase only)
- See `pipe-separated-stealth-options.ts` for the complete list

**Does not support:**

- Negation (`~`)

**Valid examples:**

- `donottrack`
- `webrtc|push|location`

**Invalid examples:**

- `~donottrack` (negation not allowed)
- `PUSH` (must be lowercase)
- `mp3` (not a valid stealth option)

---

### Special Value Validators

#### `csp_value`

Validates Content Security Policy directives for the `$csp` modifier.

**Format:** `directive value; directive value; ...`

**Requirements:**

- Each directive must be from the allowed CSP directives list
- Each directive must have a non-empty value
- Directives should not be quoted
- See `csp-value.ts` for the complete list of allowed CSP directives

**Valid examples:**

- `script-src 'self'`
- `child-src 'none'; frame-src 'self'`

**Invalid examples:**

- `script-src` (missing value)
- `'script-src' 'self'` (directive should not be quoted)
- `unknown-directive 'self'` (invalid directive)

---

#### `permissions_value`

Validates Permissions Policy directives for the `$permissions` modifier.

**Format:** `directive=allowlist\, directive=allowlist\, ...`

**Requirements:**

- Directives must be from the allowed Permissions Policy directives list
- See `permissions-value.ts` for the complete list of allowed directives

**Allowlist format:**

- `*` (all origins)
- `()` (empty allowlist)
- `(origin1 origin2 ...)` (list of origins)

**Origins must:**

- Be quoted with double quotes: `"https://example.com"`
- Or be the special token `self` (case-insensitive)

**Valid examples:**

- `autoplay=*`
- `geolocation=()`
- `camera=(self)`
- `autoplay=("https://example.com" "https://example.org")`

**Invalid examples:**

- `wi-fi=()` (invalid directive)
- `autoplay=('*')` (use `*` without quotes or parentheses)
- `autoplay=(*)` (use `*` without parentheses)
- `geolocation=(https://example.com)` (origins must be quoted)
- `geolocation=('https://example.com')` (use double quotes, not single)

---

#### `referrerpolicy_value`

Validates Referrer-Policy directives for the `$referrerpolicy` modifier.

**Requirements:**

- Value must be one of the standard Referrer-Policy directive names
- See `referrerpolicy-value.ts` for the complete list of allowed directives

**Valid examples:**

- `no-referrer`
- `strict-origin-when-cross-origin`

**Invalid examples:**

- `no-origin` (invalid directive)
- `autoplay=self` (wrong directive from another modifier)

---

### Generic Validators

#### `url`

Validates that the value is a valid URL.

**Valid examples:**

- `https://example.com`
- `http://example.org/path`

**Invalid examples:**

- `not-a-url`
- `example.com` (missing scheme)

---

#### `regexp`

Validates that the value is a valid regular expression.

> **Note:** This validates that the value itself is a regex pattern,
> not that it matches a regex pattern.

**Valid examples:**

- `/^[a-z0-9]+$/`
- `/example\.(com|org)/i`

**Invalid examples:**

- `[invalid(regex` (syntax error)
- `example.com` (not a regex pattern)

---

## Error Messages

Validators write structured issues into the `ValidationContext`. Each issue has
a `messageId` and optional `data`:

- **Parser errors**: e.g. `DOMAIN_LIST_PARSE_ERROR` with `{ message }`
- **Invalid list values**: e.g. `INVALID_DOMAIN_LIST_VALUES` with `{ values }`
- **Negated values**: e.g. `NEGATED_DOMAIN_VALUES` with `{ values }`
- **Mixed negations**: e.g. `MIXED_METHOD_NEGATIONS` with `{ values }`
- **CSP errors**: `INVALID_CSP_DIRECTIVES`, `CSP_DIRECTIVE_QUOTED`, etc.
- **Permissions errors**: `INVALID_PERMISSIONS_VALUE` with `{ message }`
- **Referrer-Policy errors**: `INVALID_REFERRER_POLICY_DIRECTIVE` with `{ value }`

## Implementation Details

Each validator is implemented as a `Validator` object with:

- `name`: The validator name (string)
- `validate`: A `ValidatorFn` — `(value: string, ctx: ValidationContext) => void`

Validators are exported individually and collected in a map for the
`validate()` function to use.

## Adding a New Validator

1. Create a new file in this directory (e.g., `my-validator.ts`)
2. Implement a `ValidatorFn` that writes issues into the `ValidationContext`
3. Export a `Validator` object with a unique name
4. Import and add it to the `VALIDATORS` array in `index.ts`
5. Update this README with the validator documentation

Example:

```typescript
// my-validator.ts
import { type ValidationContext, type Validator } from './types';

const validateMyFormat = (value: string, ctx: ValidationContext): void => {
  if (!value) {
    ctx.addError('EMPTY_MY_FORMAT');
    return;
  }

  // Your validation logic
  if (!isValid(value)) {
    ctx.addError('INVALID_MY_FORMAT', { value });
  }
};

export const MyFormatValidator: Validator = {
  name: 'my_format',
  validate: validateMyFormat,
};
```
