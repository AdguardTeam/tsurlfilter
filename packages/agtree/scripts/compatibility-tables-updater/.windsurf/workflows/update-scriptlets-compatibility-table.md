# Update Scriptlets Compatibility Tables

## Prerequisites - READ THESE FIRST

**You MUST read these files completely before starting:**

1. **Schema and structure documentation:**
   - `src/compatibility-tables/scriptlets/README.md` - Complete field reference, examples, and patterns
   - `src/compatibility-tables/schemas/scriptlet.ts` - Schema definitions and validation rules

2. **Existing YAML examples:**
   - `src/compatibility-tables/scriptlets/abort-on-property-read.yml` - Simple scriptlet
   - `src/compatibility-tables/scriptlets/prevent-addEventListener.yml` - Complex with uBO tokens
   - `src/compatibility-tables/scriptlets/set-constant.yml` - Another token example
   - `src/compatibility-tables/scriptlets/log.yml` - Variadic parameters example

**CRITICAL:** You may ONLY use fields documented in the README.md. Any undocumented field is forbidden.

---

## Goal

Update YAML files in `src/compatibility-tables/scriptlets/` based on the latest scriptlet implementations
from the downloaded repositories.

**WORK IN TWO PHASES:**

### Phase 1: Update Existing YAML Files

- Review each existing YAML file in `src/compatibility-tables/scriptlets/`
- Verify all information is current and accurate
- Add missing platforms or parameters
- Update descriptions and documentation links
- Mark deprecated/removed scriptlets
- **NEVER remove `version_added` or other version fields** - these may be manually researched

### Phase 2: Create New YAML Files

- After Phase 1 is complete, scan all repositories for new scriptlets
- Create a comprehensive inventory of all scriptlets found in repos
- Compare against existing YAML files
- Create new YAML files only for scriptlets not yet covered

---

## Platform Identifiers - ALWAYS USE THESE EXACT VALUES

- **AdGuard:** Always use `adg_os_any|adg_ext_any|adg_safari_any` (never just `adg_any` or other variations)
- **uBlock Origin:** Always use `ubo_any`
- **Adblock Plus:** Always use `abp_any`

---

## Repository Locations and Structure

The downloaded repositories are in `downloads/` directory. **Note:** Repository structures may change
over time, so verify paths if files are not found where expected.

### uBlock Origin (`downloads/ubo/`)

**Primary source:** `downloads/ubo/src/js/resources/scriptlets.js`

- This is the entry point that imports individual scriptlet files
- Some special scriptlets are in a separate file (e.g., `prevent-addeventlistener.js`, `json-edit.js`),
    but most of them could be found in the `scriptlets.js` file
- Follow the imports to find the actual scriptlet implementation

**Important patterns:**

- **Dual naming:** Every uBO scriptlet has TWO valid names:
    - Canonical name WITH `.js` suffix (e.g., `set-constant.js`) - use this as the `name` field
    - Alias WITHOUT `.js` suffix (e.g., `set-constant`) - include in `aliases` array
    - This applies to ALL aliases: if there's an alias `aeld`, also include `aeld.js`

- **Ignore `.fn` files:** Files ending in `.fn` (e.g., `abort-current-script.fn`) are helper functions,
  NOT scriptlets. Skip them entirely.

- **JSDoc availability:** Most uBO scriptlets have minimal or no JSDoc. When JSDoc is absent:
    - Analyze the function signature for parameter names and defaults
    - Examine how parameters are used in the code
    - Check the uBO wiki at
      <https://github.com/gorhill/uBlock/wiki/Resources-Library#available-general-purpose-scriptlets>
        - **Warning:** The wiki is sometimes outdated, always verify against source code
    - Look for comments above the function explaining parameters
    - Infer descriptions from variable names and validation logic

- **getExtraArgs() and uBO Tokens:**

  uBO scriptlets can accept optional **token** parameters AFTER the positional parameters.
  These are key-value pairs parsed by the `getExtraArgs()` function.

  **How getExtraArgs() works** (from `downloads/ubo/src/js/resources/safe-self.js`):

  ```javascript
  getExtraArgs(args, offset = 0) {
      const entries = args.slice(offset).reduce((out, v, i, a) => {
          if ( (i & 1) === 0 ) {           // Even indices (0,2,4...) are KEYS
              const rawValue = a[i+1];     // Odd indices (1,3,5...) are VALUES
              const value = /^\d+$/.test(rawValue)
                  ? parseInt(rawValue, 10)  // Convert all-digit strings to integers
                  : rawValue;               // Keep non-digit strings as-is
              out.push([ a[i], value ]);
          }
          return out;
      }, []);
      return this.Object_fromEntries(entries);  // Returns object like {runAt: 'idle', protect: 1}
  }
  ```

  **Example usage in scriptlet:**

  ```javascript
  function preventAddEventListener(type = '', pattern = '') {
      const safe = safeSelf();
      const extraArgs = safe.getExtraArgs(Array.from(arguments), 2);  // Skip first 2 args
      // ...
      const targetSelector = extraArgs.elements || undefined;  // Access 'elements' token
      if ( extraArgs.protect ) { /* ... */ }                   // Access 'protect' token
      runAt(() => { /* ... */ }, extraArgs.runAt);             // Access 'runAt' token
  }
  ```

  **Example filter rule:**

  ```text
  example.com##+js(aeld, click, popMagic, runAt, idle, protect, 1)
  !                     ^      ^         ^      ^     ^        ^
  !                     |      |         |      |     |        |
  !                     |      |         |      |     |        └─ Token value (converted to integer)
  !                     |      |         |      |     └─ Token name
  !                     |      |         |      └─ Token value
  !                     |      |         └─ Token name (tokens start after positional params)
  !                     |      └─ Second positional parameter
  !                     └─ First positional parameter
  ```

  Result: `extraArgs = {runAt: 'idle', protect: 1}`

  **In YAML files:**

    - Tokens go in the `ubo_tokens` array, NOT in `parameters`
    - Each token needs:
        - `name`: Token key (e.g., "runAt", "elements", "protect")
        - `description`: What the token controls/configures
        - `value_format`: Regex pattern for valid values (use `null` if any value accepted)
        - `value_type`: How it's used in code: `'string'`, `'integer'`, or `'boolean'`
        - `default`: Fallback value in code (e.g., if code has `extraArgs.quitAfter || 0`,
            default is `"0"`)

  **Finding tokens in source code:**

  1. Look for `getExtraArgs()` call - the offset parameter tells you how many positional params exist
  2. Search for `extraArgs.` in the code to find all token accesses
  3. Check how each token is used to determine `value_type`:
      - Used in conditions like `if (extraArgs.stay)` → `'boolean'`
      - Passed to `setTimeout()` or arithmetic → `'integer'`
      - Used for string matching/operations → `'string'`

### Adblock Plus (`downloads/abp-scriptlets/`)

**Primary source:** `downloads/abp-scriptlets/source/`

**Folder structure:**

- `behavioral/` - Behavior-modifying scriptlets (abort, prevent, override, etc.)
- `conditional-hiding/` - Element hiding scriptlets
- `introspection/` - Debugging/logging scriptlets
- `utils/` - Helper utilities (**IGNORE** - these are not scriptlets)

**JSDoc quality:** ABP has excellent JSDoc documentation. Use these for:

- Parameter names and descriptions
- Parameter types
- Version information
- Usage examples

**Naming:** ABP uses hyphenated names without `.js` suffix
(e.g., `abort-on-property-read`, `prevent-listener`) and they don't have aliases.

**Documentation:** https://help.adblockplus.org/hc/en-us/articles/1500002338501-Snippet-filters-tutorial#snippets-ref

### AdGuard (`downloads/adg-scriptlets/`)

**Primary source:** `downloads/adg-scriptlets/wiki/about-scriptlets.md`

- Most comprehensive documentation for each scriptlet
- Includes syntax, parameters, examples, version info
- Contains cross-references to equivalent uBO and ABP scriptlets

**Fallback source:** `downloads/adg-scriptlets/src/scriptlets/` for implementation details when
wiki lacks information

**Wiki structure for each scriptlet:**

- Version added (e.g., "Added in v1.0.4")
- Syntax section with parameter descriptions
- Example usage
- "Related UBO scriptlet:" links
- "Related ABP source:" links

**JSDoc quality:** AdGuard has comprehensive JSDoc similar to ABP

---

## Finding Equivalent Scriptlets Across Platforms

**This is critical** - many existing YAML files already have correct mappings. Your goal is to verify
and update them, not recreate from scratch.

### Step 1: Check Existing YAML Files First

Before researching, check if a YAML file already exists in `src/compatibility-tables/scriptlets/`:

- Filenames typically use the AdGuard scriptlet name (hyphenated, no `.js`)
- Example: `abort-on-property-read.yml`, `set-constant.yml`, `prevent-addEventListener.yml`
- If it exists, you're UPDATING, not creating from scratch

### Step 2: Use AdGuard Wiki Cross-References

In `downloads/adg-scriptlets/wiki/about-scriptlets.md`, each scriptlet section includes:

- "Related UBO scriptlet:" with link to uBO documentation
- "Related ABP source:" with link to ABP source file
- These are usually reliable mappings

### Step 3: Match by Functionality, Not Just Name

**Common name variations:**

- `set-constant` (AdGuard) = `set-constant.js` (uBO) = `override-property-read` (ABP)
- `prevent-addEventListener` (AdGuard) = `addEventListener-defuser.js` (uBO) = `prevent-listener` (ABP)
- `abort-on-property-read` (AdGuard) = `abort-on-property-read.js` (uBO) = `abort-on-property-read` (ABP)

Look at the **purpose** and **behavior** described in documentation, not just the name.

### Step 4: Parameter Mapping

Parameters often have different names across platforms but serve the same purpose:

**Example from prevent-addEventListener:**

- AdGuard: `typeSearch`, `listenerSearch`, `additionalArgName`, `additionalArgValue`
- uBO: `type`, `pattern` (positional) + `runAt`, `elements`, `protect` (tokens)
- ABP: `type`, `handler`, `selector`

**Handle these cases:**

- **Different parameter names:** Document each platform's specific names in its section
- **Different parameter counts:** Some platforms have extra optional parameters
- **uBO tokens vs parameters:** What's a positional parameter in AdGuard/ABP might be a token in uBO
    - Example: AdGuard might have `additionalArgName`/`additionalArgValue` parameters
    - uBO might use `elements` token instead
    - Map uBO tokens to `ubo_tokens`, not `parameters`
- **ABP-specific parameters:** ABP often has `setConfigurable` parameter that others lack

### Step 5: Variadic Parameters

Some scriptlets accept unlimited arguments (e.g., `log` scriptlet):

- Check if the scriptlet function uses rest parameters (`...args`) or processes all remaining arguments
- In YAML, use `variadic_parameters` field (see `log.yml` example)
- Define `min_count`, `max_count`, and validation rules

### Step 6: When No Equivalent Exists

Some scriptlets are platform-specific:

- Trusted scriptlets often only exist in AdGuard and uBlock
- Create YAML with only the platforms that support it. If there is an Adguard version of the scriptlet,
  YAML file should be named after Adguard version. If there is no Adguard version, YAML file should be
  named after uBlock version. If there is no uBlock version, YAML file should be named after
  Adblock Plus version.
- If Adguard version is introduced meantime, YAML file should be renamed to Adguard version, etc.
- Don't add placeholder entries for unsupported platforms

---

## YAML File Structure Reference

### Required vs Optional Fields

**Platform-specific required fields:**

- `name` - REQUIRED for each platform section

**Common optional fields with defaults:**

- `aliases`: defaults to `null` (no aliases)
- `description`: defaults to `null`
- `docs`: defaults to `null`
- `version_added`: defaults to `null`
- `version_removed`: defaults to `null`
- `is_trusted`: defaults to `false`
- `debug`: defaults to `false`
- `deprecated`: defaults to `false`
- `removed`: defaults to `false`
- `parameters`: defaults to `[]` (empty array)
- `ubo_tokens`: defaults to `[]` (only valid for `ubo_any`)
- `variadic_parameters`: defaults to `null`

Description maybe different for Adguard, uBlock Origin and Adblock Plus, but if the funcionality
is the same, use the same description for all platforms, so place it under `common` section.

### Common Pattern: Shared Parameters

When parameters are identical across all platforms, use `common` section:

```yaml
common:
  description: Short description of what the scriptlet does
  parameters:
    - name: property
      required: true
      description: Path to property (joined with `.` if needed)
      # ONLY add 'pattern' if validation regex exists in source (omit if null)
      # ONLY add 'default' if default value exists in source (omit if null)

adg_os_any|adg_ext_any|adg_safari_any:
  name: scriptlet-name
  version_added: 1.0.4
  aliases:
    - scriptlet-name.js
  docs: https://github.com/AdguardTeam/Scriptlets/blob/master/wiki/about-scriptlets.md#scriptlet-name

ubo_any:
  name: scriptlet-name.js
  aliases:
    - scriptlet-name
  docs: https://github.com/gorhill/uBlock/wiki/Resources-Library#scriptlet-name

abp_any:
  name: scriptlet-name
  version_added: "3.4.1"
  docs: https://developers.eyeo.com/snippets/<category>-snippets/<name>
```

### Complex Pattern: Platform-Specific Parameters and uBO Tokens

When parameters differ or uBO uses tokens:

```yaml
common:
  description: Prevents adding event listeners for specified events

adg_os_any|adg_ext_any|adg_safari_any:
  name: prevent-addEventListener
  version_added: 1.0.4
  aliases: [...]
  docs: https://...
  parameters:
    - name: typeSearch
      required: false
      description: String or regex matching the type
      # Omit pattern/default if null (null is the default)
    - name: listenerSearch
      required: false
      description: String or regex matching the listener

ubo_any:
  name: addEventListener-defuser.js
  aliases:
    - addEventListener-defuser
    - aeld
    - aeld.js
  docs: https://...
  parameters:
    - name: type
      required: false
      description: String/regex, event name to defuse
      default: ''  # Empty string default from function signature
    - name: pattern
      required: false
      description: String/regex matching handler function
      default: ''
  ubo_tokens:
    - name: runAt
      description: Defers to specific document ready state
      value_format: ^(loading|interactive|complete)$
      value_type: string
    - name: elements
      description: CSS selector for target elements
      value_format: null
      value_type: string
    - name: protect
      description: Protects addEventListener from being overwritten
      value_format: ^1$
      value_type: boolean

abp_any:
  name: prevent-listener
  version_added: "3.11.2"
  docs: https://...
  parameters:
    - name: type
      required: true
      description: Pattern matching event type(s)
    - name: handler
      required: false
      description: Pattern matching handler declaration
```

---

## Workflow Steps

### 1. Create Scriptlet Inventory File

**CRITICAL:** To ensure no scriptlets are missed, create a temporary inventory file:

```bash
# Create inventory file
touch scriptlets-inventory.md
```

Structure:

```markdown
# Scriptlets Inventory

## uBlock Origin Scriptlets
- [ ] scriptlet-name-1.js
- [ ] scriptlet-name-2.js
...

## Adblock Plus Scriptlets
- [ ] scriptlet-name-1
- [ ] scriptlet-name-2
...

## AdGuard Scriptlets
- [ ] scriptlet-name-1
- [ ] scriptlet-name-2
...

## Existing YAML Files
- [ ] yaml-file-1.yml
- [ ] yaml-file-2.yml
...
```

Check off items as you process them to track progress.

### 2. Review Downloaded Repositories

Verify that `downloads/` contains:

- `downloads/ubo/` - uBlock Origin repository
- `downloads/abp-scriptlets/` - Adblock Plus snippets repository
- `downloads/adg-scriptlets/` - AdGuard Scriptlets repository

### 3. PHASE 1: Scan All Scriptlets and Build Inventory

**Before updating any files, scan ALL repositories and build a complete inventory.**

#### Scan uBlock Origin

1. Start at `downloads/ubo/src/js/resources/scriptlets.js`
2. List ALL scriptlet files (follow imports)
3. Skip any `.fn` files (helpers, not scriptlets)
4. **Add every scriptlet to inventory file** under "uBlock Origin Scriptlets"
5. For each scriptlet, record:
    - Primary name (with `.js` suffix)
    - All aliases (from `registerScriptlet()` call)
    - Number of parameters
    - Whether it uses tokens (`getExtraArgs()`)

#### Scan Adblock Plus

1. Navigate to `downloads/abp-scriptlets/source/`
2. **Scan ALL folders:** `behavioral/`, `conditional-hiding/`, `introspection/`
3. Ignore `utils/` folder
4. **List EVERY `.js` file** - these are the scriptlets
5. **Add every scriptlet to inventory file** under "Adblock Plus Scriptlets"
6. For each scriptlet, record:
    - Name (from filename without `.js`)
    - Number of parameters (from JSDoc or function signature)
    - Whether it's new (not in existing YAML files)

#### Scan AdGuard

1. Open `downloads/adg-scriptlets/wiki/about-scriptlets.md`
2. **List EVERY scriptlet section** (they start with `###` headings)
3. **Add every scriptlet to inventory file** under "AdGuard Scriptlets"
4. For each scriptlet, record:
    - Name (from heading)
    - Syntax
    - Related uBO/ABP scriptlets (for cross-referencing)
5. Also scan `downloads/adg-scriptlets/src/scriptlets/` to ensure no scriptlets are in source but not in wiki

### 4. List All Existing YAML Files

**Add to inventory:** List every `.yml` file in `src/compatibility-tables/scriptlets/` under "Existing YAML Files".

### 5. PHASE 2: Update Existing YAML Files

**Work through each existing YAML file one by one:**

For each YAML file:

1. **Check scriptlet still exists** in repositories
2. **CRITICAL - Version Fields:**
    - **NEVER REMOVE `version_added`, `version_removed`, or version-related fields**
    - These are often manually researched and cannot be extracted from source
    - Only ADD version info if you find it in docs/source
    - If unsure, KEEP the existing value
3. Verify all platform sections are accurate
4. Add missing platforms if found in new repos
5. Add new parameters discovered in source code
    - **CRITICAL:** Use EXACT parameter names from source code/docs
    - Do NOT invent or imagine parameter names
    - Copy names character-by-character from function signatures or JSDoc
6. **ONLY add `pattern` field** if validation regex found in source (omit if null)
7. **ONLY add `default` field** if default value found in source (omit if null)
8. Add new aliases found in repos
    - **CRITICAL:** Use EXACT alias names from source
    - Copy from `registerScriptlet()` calls or documentation
9. Update descriptions if source has better/clearer description
10. Add `deprecated: true` or `removed: true` if scriptlet is deprecated/removed
11. **Do NOT delete platform sections** - mark as removed instead
12. Check off in inventory file when done

**If scriptlet removed from a platform:**

- Set `removed: true` in that platform's section
- Add `version_removed: "X.X.X"` if version known
- Add `removal_message: "explanation"` if reason documented
- **Keep the platform section** - don't delete it

### 6. PHASE 3: Create New YAML Files

**Only after Phase 2 is complete:**

1. Review inventory file to find scriptlets not covered by existing YAML files
2. For each new scriptlet:
    - Analyze source code thoroughly
    - Extract parameters, defaults, validation patterns
    - Find equivalent scriptlets across platforms
    - Create new YAML file
3. **Naming convention:**
    - Use AdGuard name as filename (or most common name if no AdGuard version)
    - Use `.yml` extension
4. **Structure:**
    - Start with `common` section for fields shared across all platforms
    - Add platform-specific sections for each blocker that supports it
    - Include all aliases from all platforms
5. **Field guidelines:**
    - Omit `pattern` if null (no validation)
    - Omit `default` if null (no default)
    - Only include version fields if found in docs/source

### 7. Cross-Reference and Map Equivalents

Use this priority order:

1. Check AdGuard wiki's "Related UBO/ABP" links first
2. Match by functionality and description
3. Compare parameter purposes (names may differ)
4. Verify by checking existing YAML files for similar scriptlets
5. When in doubt, create separate YAML files rather than incorrectly merging unrelated scriptlets

### 8. Handle Special Cases

**uBO dual naming:**

```yaml
ubo_any:
  name: set-constant.js        # Canonical name WITH .js
  aliases:
    - set-constant              # Alias WITHOUT .js
    - set                       # Other alias
    - set.js                    # Other alias WITH .js
```

**Variadic parameters (e.g., log scriptlet):**

```yaml
common:
  name: log
  description: Logs all arguments to console
  variadic_parameters:
    min_count: 0
    max_count: null
    all_parameters:
      name: args
      description: Arguments to log
```

Some scriptlets, like
`packages/agtree/scripts/compatibility-tables-updater/downloads/abp-scriptlets/source/behavioral/abort-on-iframe-property-read.js`
accepts variadic parameters, and technically accepts zero parameters (and in this case they function like
a no-op), but it does not make any sense, so in that cases, we should require at least one parameter.

**Trusted scriptlets:**

```yaml
adg_os_any|adg_ext_any|adg_safari_any:
  name: trusted-set-cookie
  is_trusted: true        # Mark as trusted
  # ... rest of fields
```

---

## Validation Steps

After creating or updating YAML files, you MUST validate:

### 1. Build Validation (REQUIRED)

Run the build command to ensure YAML files are valid:

```bash
pnpm build
```

The build MUST pass without errors. If it fails:

- Check error messages for schema validation failures
- Verify all field names match the README documentation exactly (use snake_case)
- Ensure required fields are present
- Fix issues and rebuild

### 2. Schema Compliance

- All field names use `snake_case` (e.g., `version_added`, not `versionAdded`)
- Required fields present: `name` in each platform section
- No fields used that aren't documented in README.md
- Boolean fields use correct defaults: `is_trusted: false`, `debug: false`, etc.
- `ubo_tokens` only appears in `ubo_any` sections
- `parameters` array: each parameter has `name` and `required` fields

### 3. Logical Consistency

- If `common.parameters` exists, platform sections shouldn't duplicate it unless overriding
- Platform-specific parameter overrides make sense
- Aliases don't conflict across platforms
- For uBO: `name` includes `.js`, aliases include both `.js` and non-`.js` forms
- Platform identifiers are exactly: `adg_os_any|adg_ext_any|adg_safari_any`, `ubo_any`, `abp_any`

### 4. Documentation Links

Verify all `docs` URLs follow these patterns:

- AdGuard: `https://github.com/AdguardTeam/Scriptlets/blob/master/wiki/about-scriptlets.md#scriptlet-name`
- uBO: `https://github.com/gorhill/uBlock/wiki/Resources-Library#scriptlet-name`
- ABP: `https://developers.eyeo.com/snippets/<category>-snippets/<name>` e.g.
  <https://developers.eyeo.com/snippets/conditional-hiding-snippets/hide-if-canvas-contains> or
  <https://developers.eyeo.com/snippets/behavioral-snippets/abort-current-inline-script>

### 5. Compare with Existing Examples

For similar scriptlets, match the style and completeness:

- `abort-on-property-read.yml` - simple scriptlet with common parameters
- `prevent-addEventListener.yml` - complex with tokens and different parameters per platform
- `set-constant.yml` - another token example
- `log.yml` - variadic parameters

---

## Parameter Validation and Defaults

### Analyzing Parameters for `pattern` Field

The `pattern` field should contain a regex that validates parameter values. Analyze source code to find:

1. **Explicit regex validation** in the code:

   ```javascript
   if (!/^\d+$/.test(delay)) { return; }  // pattern: '^\\d+$' for integers
   ```

2. **Enum-like checks**:

   ```javascript
   if (!['immediate', 'interactive', 'complete'].includes(when)) { return; }
   // pattern: '^(immediate|interactive|complete)$'
   ```

3. **Type or format constraints**:

   ```javascript
   const isBoolean = value === 'true' || value === 'false';
   // pattern: '^(true|false)$'
   ```

4. **Common patterns**:
   - CSS selectors: Usually no pattern needed (too complex)
   - Numbers: `^\d+$` or `^-?\d+(\.\d+)?$`
   - Booleans: `^(true|false|1|0)$`
   - Enums: `^(option1|option2|option3)$`

**IMPORTANT:** If no validation is found, **omit the `pattern` field entirely**. Do NOT add `pattern: null`.

### Extracting Default Values

The `default` field should contain the default value from the source code:

1. **Function signature defaults**:

   ```javascript
   function scriptlet(selector = '', attr = '', value = '') {
   // defaults: '', '', ''
   ```

2. **Fallback operators**:

   ```javascript
   const delay = args[0] || 1000;  // default: "1000"
   const enabled = args[1] || 'true';  // default: "true"
   ```

3. **Conditional defaults**:

   ```javascript
   const mode = args[0] ? args[0] : 'block';  // default: "block"
   ```

Always use string representation in YAML: `"1000"`, `"true"`, `"block"`.

**IMPORTANT:** If no default is found, **omit the `default` field entirely**. Do NOT add `default: null`.

---

## Common Pitfalls to Avoid

1. **NEVER invent or imagine field names**

    - **CRITICAL:** Always copy parameter names EXACTLY from source code or documentation
    - Do NOT create parameter names based on what you think they should be called
    - Do NOT rename parameters to make them "clearer" or "more consistent"
    - If the source says `typeSearch`, use `typeSearch` (not `type`, not `searchType`)
    - If the source says `selector`, use `selector` (not `cssSelector`, not `element`)
    - Copy character-by-character from:
        - Function signatures: `function scriptlet(param1, param2)`
        - JSDoc: `@param {string} actualParamName`
        - Documentation: parameter names as written in docs
    - This applies to ALL fields: parameters, aliases, token names, etc.

2. **Don't confuse uBO tokens with parameters**
   - Tokens parsed by `getExtraArgs()` → use `ubo_tokens` field
   - Positional arguments → use `parameters` field

3. **Don't ignore `.fn` helpers in uBO**
   - Files ending in `.fn` are utilities, not scriptlets
   - Skip them entirely

4. **Don't forget dual naming for uBO**
   - Always include both `.js` and non-`.js` versions in aliases
   - Canonical `name` field uses `.js` suffix

5. **Don't duplicate common parameters**
   - If parameter is in `common` section, don't repeat in platform sections
   - Only repeat if you need to override the common value

6. **Don't use camelCase**
   - YAML field names are `snake_case`: `version_added`, `is_trusted`
   - NOT `versionAdded`, `isTrusted`

7. **Don't skip build validation**
   - Always run `pnpm build` to verify changes
   - Fix all errors before considering the update complete

8. **Don't create fields not in README.md**
   - Only use documented fields from the README
   - No custom or undocumented fields allowed

9. **Don't use wrong platform identifiers**
   - AdGuard: `adg_os_any|adg_ext_any|adg_safari_any` (all three together)
   - uBO: `ubo_any`
   - ABP: `abp_any`

10. **NEVER remove version fields**

    - `version_added`, `version_removed`, and related version fields are often manually researched
    - **NEVER REMOVE THESE** even if you cannot find them in source/docs
    - You may ADD version info if you find it in docs
    - When in doubt, PRESERVE the existing value
    - This is CRITICAL - do not ignore this rule

11. **Don't add null values unnecessarily**

    - **DO NOT** add `pattern: null` - omit the field if no validation exists
    - **DO NOT** add `default: null` - omit the field if no default exists
    - Null is the default value for these optional fields
    - Only add these fields when they have actual non-null values

12. **Don't skip scriptlets - use inventory file**

    - Scan ALL scriptlets in ALL repositories
    - Use the inventory file to track progress
    - Ensure every scriptlet is either in an existing YAML or needs a new YAML
    - Check all folders in ABP (`behavioral/`, `conditional-hiding/`, `introspection/`)

---

## Summary Checklist

Before completing the update:

- [ ] Read README.md and schema.ts completely
- [ ] Reviewed existing YAML files for patterns
- [ ] Checked all three repositories (uBO, ABP, AdGuard)
- [ ] Found equivalent scriptlets using cross-references
- [ ] Used correct platform identifiers
- [ ] Created scriptlets-inventory.md file and populated it with all scriptlets from all repos
- [ ] Listed all existing YAML files in inventory
- [ ] PHASE 2: Updated all existing YAML files
- [ ] **VERIFIED: No `version_added` or `version_removed` fields were removed**
- [ ] **VERIFIED: No `pattern: null` or `default: null` added unnecessarily**
- [ ] PHASE 3: Created new YAML files for new scriptlets
- [ ] Handled uBO tokens properly (in `ubo_tokens`, not `parameters`)
- [ ] Included dual naming for uBO scriptlets
- [ ] Used only fields documented in README.md
- [ ] ONLY added `pattern` field when validation regex found (omitted if null)
- [ ] ONLY added `default` field when default value found (omitted if null)
- [ ] **VERIFIED: All parameter names copied EXACTLY from source (not invented)**
- [ ] **VERIFIED: All alias names copied EXACTLY from source (not invented)**
- [ ] Scanned ALL scriptlet folders (including ABP's `behavioral/`, `conditional-hiding/`, `introspection/`)
- [ ] Checked inventory file - all scriptlets processed
- [ ] Build passes: `pnpm build` succeeds
- [ ] No schema validation errors
- [ ] Documentation URLs are valid
- [ ] Compared with existing examples for consistency
