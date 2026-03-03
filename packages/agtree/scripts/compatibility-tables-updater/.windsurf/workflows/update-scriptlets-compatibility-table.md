# Step 4: Update Scriptlets Compatibility Tables

**This is Step 4 of 4.** Steps 1 (ABP), 2 (uBO), and 3 (AdGuard) research MUST be completed first.

## STOP - Verify Research Files Exist

Before doing anything else, check that all three research files are present:

- `.current/abp-scriptlets.md`
- `.current/ubo-scriptlets.md`
- `.current/adg-scriptlets.md`

**If any file is missing, STOP immediately.** Do not proceed. Tell the user to run the
missing research step first:

- Missing ABP data → run `/research-abp-scriptlets` (Step 1)
- Missing uBO data → run `/research-ubo-scriptlets` (Step 2)
- Missing AdGuard data → run `/research-adg-scriptlets` (Step 3)

---

## Prerequisites - READ THESE FIRST

**You MUST read these files completely before starting:**

1. **Research files from previous steps:**
   - `.current/abp-scriptlets.md` - Pre-researched ABP scriptlet data (from Step 1)
   - `.current/ubo-scriptlets.md` - Pre-researched uBO scriptlet data (from Step 2)
   - `.current/adg-scriptlets.md` - Pre-researched AdGuard scriptlet data (from Step 3)

2. **Schema and structure documentation:**
   - `src/compatibility-tables/scriptlets/README.md` - Complete field reference, examples, and patterns
   - `src/compatibility-tables/schemas/scriptlet.ts` - Schema definitions and validation rules

3. **Existing YAML examples:**
   - `src/compatibility-tables/scriptlets/abort-on-property-read.yml` - Simple scriptlet
   - `src/compatibility-tables/scriptlets/prevent-addEventListener.yml` - Complex with uBO tokens
   - `src/compatibility-tables/scriptlets/set-constant.yml` - Another token example
   - `src/compatibility-tables/scriptlets/log.yml` - Variadic parameters example

**CRITICAL:** You may ONLY use fields documented in the README.md. Any undocumented field is forbidden.

---

## Goal

Update YAML files in `src/compatibility-tables/scriptlets/` based on:

- Pre-researched ABP data in `.current/abp-scriptlets.md`
- Pre-researched uBO data in `.current/ubo-scriptlets.md`
- Pre-researched AdGuard data in `.current/adg-scriptlets.md`
    (AdGuard is the naming reference and backbone for cross-referencing)

**WORK IN TWO PHASES:**

### Phase 1: Update Existing YAML Files

- Review each existing YAML file in `src/compatibility-tables/scriptlets/`
- Verify all information is current and accurate
- Add missing platforms or parameters
- Update descriptions and documentation links
- Mark deprecated/removed scriptlets
- **NEVER remove `version_added` or other version fields** - these may be manually researched

### Phase 2: Create New YAML Files

- After Phase 1 is complete, identify all scriptlets not yet covered by a YAML file
- Create new YAML files for uncovered scriptlets

---

## Platform Identifiers - ALWAYS USE THESE EXACT VALUES

- **AdGuard:** Always use `adg_os_any|adg_ext_any|adg_safari_any` (never just `adg_any` or other variations)
- **uBlock Origin:** Always use `ubo_any`
- **Adblock Plus:** Always use `abp_any`

---

## Data Sources

### ABP Data (`.current/abp-scriptlets.md`)

Use this file as the sole source for ABP scriptlet details. It contains:

- Scriptlet names (hyphenated, no `.js`, no aliases)
- Parameters (exact names, required/optional, types, descriptions, defaults, patterns)
- `version_added` (from `@since` tags)
- Docs URLs

**Do NOT re-read** `.current/abp-scriptlets/` source files directly — use the research dump.

### uBO Data (`.current/ubo-scriptlets.md`)

Use this file as the sole source for uBO scriptlet details. It contains:

- Canonical name (WITH `.js` suffix) and all aliases
- Positional parameters (names, descriptions, defaults, patterns)
- Tokens from `getExtraArgs()` (name, value_type, value_format, description, default)
- `is_trusted` flag

**Do NOT re-read** `.current/ubo/` source files directly — use the research dump.

**Key uBO rules to remember when writing YAML:**

- Canonical `name` field uses `.js` suffix (e.g., `set-constant.js`)
- Aliases include BOTH `.js` and non-`.js` forms for every alias
- Tokens go in `ubo_tokens` array, NOT in `parameters`
- Each token needs: `name`, `description`, `value_format`, `value_type`

### AdGuard Data (`.current/adg-scriptlets.md`)

Use this file as the sole source for AdGuard scriptlet details. It contains:

- Canonical scriptlet names (AdGuard naming is used as YAML filenames)
- Parameters (exact names, required/optional, descriptions, defaults, patterns)
- `version_added` and `is_trusted` flags
- `related_ubo` and `related_abp` cross-references for mapping equivalents
- Docs URLs

**Do NOT re-read** `.current/adg-scriptlets/` source files directly — use the research dump.

---

## Finding Equivalent Scriptlets Across Platforms

**This is critical** - many existing YAML files already have correct mappings. Your goal is to verify
and update them, not recreate from scratch.

### Step 1: Check Existing YAML Files First

Before researching, check if a YAML file already exists in `src/compatibility-tables/scriptlets/`:

- Filenames typically use the AdGuard scriptlet name (hyphenated, no `.js`)
- Example: `abort-on-property-read.yml`, `set-constant.yml`, `prevent-addEventListener.yml`
- If it exists, you're UPDATING, not creating from scratch

### Step 2: Use AdGuard Cross-References from `.current/adg-scriptlets.md`

Each entry in `.current/adg-scriptlets.md` includes:

- `related_ubo` — the equivalent uBO scriptlet name
- `related_abp` — the equivalent ABP scriptlet name
- These are usually reliable mappings; use them as the primary cross-reference

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

- Check the `variadic` flag in the relevant `.current/` research file
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

### 1. Verify and Read Research Files

Confirm all three files exist and read them completely:

- `.current/abp-scriptlets.md`
- `.current/ubo-scriptlets.md`
- `.current/adg-scriptlets.md`

If any is missing, **STOP** (see top of this document).

### 2. Build Scriptlet Inventory

Create `.current/scriptlets-inventory.md` to track progress. Populate it from your sources:

```markdown
# Scriptlets Inventory

## AdGuard Scriptlets (from .current/adg-scriptlets.md)
- [ ] scriptlet-name-1
- [ ] scriptlet-name-2
...

## uBO Scriptlets (from .current/ubo-scriptlets.md)
- [ ] scriptlet-name-1.js
- [ ] scriptlet-name-2.js
...

## ABP Scriptlets (from .current/abp-scriptlets.md)
- [ ] scriptlet-name-1
- [ ] scriptlet-name-2
...

## Existing YAML Files
- [ ] yaml-file-1.yml
- [ ] yaml-file-2.yml
...
```

To populate:

1. Copy scriptlet names from `.current/adg-scriptlets.md` → AdGuard list
2. Copy scriptlet names from `.current/ubo-scriptlets.md` → uBO list
3. Copy scriptlet names from `.current/abp-scriptlets.md` → ABP list
4. List every `.yml` file in `src/compatibility-tables/scriptlets/` → Existing YAML list

Check off items as you process them.

### 3. PHASE 1: Update Existing YAML Files

**Work through each existing YAML file one by one:**

For each YAML file:

1. **Check scriptlet still exists** in one of the three `.current/` research files
2. **CRITICAL - Version Fields:**
    - **NEVER REMOVE `version_added`, `version_removed`, or version-related fields**
    - These are often manually researched and cannot be extracted from source
    - Only ADD version info if you find it in docs/source
    - If unsure, KEEP the existing value
3. Verify all platform sections are accurate
4. Add missing platforms if found in the data sources
5. Add new parameters discovered in the research files
    - **CRITICAL:** Use EXACT parameter names as recorded in `.current/` files
    - Do NOT invent or imagine parameter names
    - The `.current/` files already have exact names extracted from source
6. **ONLY add `pattern` field** if a non-`(none)` pattern is recorded in `.current/` files
7. **ONLY add `default` field** if a non-`(none)` default is recorded in `.current/` files
8. Add new aliases found in `.current/ubo-scriptlets.md`
    - **CRITICAL:** Use EXACT alias names as recorded
9. Update descriptions if research files have better/clearer description
10. Add `deprecated: true` or `removed: true` if scriptlet is deprecated/removed
11. **Do NOT delete platform sections** - mark as removed instead
12. Check off in inventory file when done

**If scriptlet removed from a platform:**

- Set `removed: true` in that platform's section
- Add `version_removed: "X.X.X"` if version known
- Add `removal_message: "explanation"` if reason documented
- **Keep the platform section** - don't delete it

### 4. PHASE 2: Create New YAML Files

**Only after Phase 1 is complete:**

1. Review inventory to find scriptlets not covered by existing YAML files
2. For each new scriptlet:
    - Look up its data in `.current/adg-scriptlets.md`, `.current/abp-scriptlets.md`,
        and `.current/ubo-scriptlets.md`
    - Find equivalent scriptlets using `related_ubo` / `related_abp` fields in `.current/adg-scriptlets.md`
    - Create new YAML file
3. **Naming convention:**
    - Use AdGuard name as filename (or most common name if no AdGuard version)
    - Use `.yml` extension
4. **Structure:**
    - Start with `common` section for fields shared across all platforms
    - Add platform-specific sections for each blocker that supports it
    - Include all aliases from all platforms
5. **Field guidelines:**
    - Omit `pattern` if `(none)` in research files
    - Omit `default` if `(none)` in research files
    - Only include version fields if found in research files or AdGuard wiki

### 5. Cross-Reference and Map Equivalents

Use this priority order:

1. Check AdGuard wiki's "Related UBO/ABP" links first
2. Match by functionality and description
3. Compare parameter purposes (names may differ across platforms)
4. Verify by checking existing YAML files for similar scriptlets
5. When in doubt, create separate YAML files rather than incorrectly merging unrelated scriptlets

### 6. Handle Special Cases

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
`.current/abp-scriptlets/source/behavioral/abort-on-iframe-property-read.js`
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

The `pattern` field should contain a regex that validates parameter values. The `.current/` research
files already extracted these. Use values recorded there; only look at source directly if unsure.

**Common patterns for reference:**

- CSS selectors: Usually no pattern needed (too complex)
- Numbers: `^\d+$` or `^-?\d+(\.\d+)?$`
- Booleans: `^(true|false|1|0)$`
- Enums: `^(option1|option2|option3)$`

**IMPORTANT:** If the research file records `(none)`, **omit the `pattern` field entirely**.
Do NOT add `pattern: null`.

### Extracting Default Values

The `.current/` research files already recorded defaults. Use values recorded there.

Always use string representation in YAML: `"1000"`, `"true"`, `"block"`.

**IMPORTANT:** If the research file records `(none)`, **omit the `default` field entirely**.
Do NOT add `default: null`.

---

## Common Pitfalls to Avoid

1. **NEVER invent or imagine field names**

    - **CRITICAL:** Always use parameter names EXACTLY as recorded in `.current/` files
    - Do NOT create parameter names based on what you think they should be called
    - Do NOT rename parameters to make them "clearer" or "more consistent"
    - If `.current/abp-scriptlets.md` says `typeSearch`, use `typeSearch`
    - This applies to ALL fields: parameters, aliases, token names, etc.

2. **Don't confuse uBO tokens with parameters**
   - Tokens from `getExtraArgs()` → use `ubo_tokens` field (listed under `tokens` in `.current/ubo-scriptlets.md`)
   - Positional arguments → use `parameters` field (listed under `parameters` in `.current/ubo-scriptlets.md`)

3. **Don't forget dual naming for uBO**
   - Always include both `.js` and non-`.js` versions in aliases
   - Canonical `name` field uses `.js` suffix

4. **Don't duplicate common parameters**
   - If parameter is in `common` section, don't repeat in platform sections
   - Only repeat if you need to override the common value

5. **Don't use camelCase**
   - YAML field names are `snake_case`: `version_added`, `is_trusted`
   - NOT `versionAdded`, `isTrusted`

6. **Don't skip build validation**
   - Always run `pnpm build` to verify changes
   - Fix all errors before considering the update complete

7. **Don't create fields not in README.md**
   - Only use documented fields from the README
   - No custom or undocumented fields allowed

8. **Don't use wrong platform identifiers**
   - AdGuard: `adg_os_any|adg_ext_any|adg_safari_any` (all three together)
   - uBO: `ubo_any`
   - ABP: `abp_any`

9. **NEVER remove version fields**

    - `version_added`, `version_removed`, and related version fields are often manually researched
    - **NEVER REMOVE THESE** even if you cannot find them in source/docs
    - You may ADD version info if you find it in docs
    - When in doubt, PRESERVE the existing value
    - This is CRITICAL - do not ignore this rule

10. **Don't add null values unnecessarily**

    - **DO NOT** add `pattern: null` - omit the field if no validation exists
    - **DO NOT** add `default: null` - omit the field if no default exists
    - Null is the default value for these optional fields
    - Only add these fields when they have actual non-null values

11. **Don't skip scriptlets - use inventory file**

    - Use the inventory file to track progress
    - Ensure every scriptlet is either in an existing YAML or needs a new YAML

---

## Summary Checklist

Before completing the update:

- [ ] `.current/abp-scriptlets.md` exists and was read
- [ ] `.current/ubo-scriptlets.md` exists and was read
- [ ] `.current/adg-scriptlets.md` exists and was read
- [ ] Read README.md and schema.ts completely
- [ ] Reviewed existing YAML files for patterns
- [ ] Created `.current/scriptlets-inventory.md` with all scriptlets from all sources
- [ ] Listed all existing YAML files in inventory
- [ ] PHASE 1: Updated all existing YAML files
- [ ] **VERIFIED: No `version_added` or `version_removed` fields were removed**
- [ ] **VERIFIED: No `pattern: null` or `default: null` added unnecessarily**
- [ ] PHASE 2: Created new YAML files for new scriptlets
- [ ] Handled uBO tokens properly (in `ubo_tokens`, not `parameters`)
- [ ] Included dual naming for uBO scriptlets
- [ ] Used only fields documented in README.md
- [ ] ONLY added `pattern` field when a non-`(none)` value was in research files
- [ ] ONLY added `default` field when a non-`(none)` value was in research files
- [ ] **VERIFIED: All parameter names taken EXACTLY from `.current/` files (not invented)**
- [ ] **VERIFIED: All alias names taken EXACTLY from `.current/` files (not invented)**
- [ ] Checked inventory file - all scriptlets processed
- [ ] Build passes: `pnpm build` succeeds
- [ ] No schema validation errors
- [ ] Documentation URLs are valid
- [ ] Compared with existing examples for consistency
