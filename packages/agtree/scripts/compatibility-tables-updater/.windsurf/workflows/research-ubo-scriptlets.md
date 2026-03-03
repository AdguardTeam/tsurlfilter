---
description: Step 2 - Research uBlock Origin scriptlets and dump findings to .current/ubo-scriptlets.md
---

# Step 2: Research uBlock Origin Scriptlets

**This is Step 2 of 4.** Run this after Step 1 (ABP) and before Step 3 (AdGuard) and Step 4 (update tables).

## Prerequisites - READ THESE FIRST

**You MUST read these files completely before starting:**

1. `src/compatibility-tables/scriptlets/README.md` - Complete field reference, especially `ubo_tokens`
2. `src/compatibility-tables/schemas/scriptlet.ts` - Schema definitions and validation rules

Also read these existing YAML files to understand how uBO data maps to YAML:

- `src/compatibility-tables/scriptlets/prevent-addEventListener.yml` - uBO tokens example
- `src/compatibility-tables/scriptlets/set-constant.yml` - Another token example

---

## Goal

Scan the uBlock Origin scriptlets repository and extract all information needed to update or create
YAML compatibility table entries. Dump structured results to `.current/ubo-scriptlets.md`.

**This session does NOT touch any YAML files.** Output only goes to `.current/ubo-scriptlets.md`.

**Do NOT write scripts** (Python, JavaScript, bash, etc.) to extract or process data. Read and
analyze source files directly using your file reading tools. Scripts introduce their own bugs and
are harder to verify than direct analysis.

---

## Setup

Create the `.current` directory and clone the uBO repository if not already present:

```bash
mkdir -p .current
```

If `.current/ubo/` does not already exist, clone it (shallow clone for speed):

```bash
git clone --depth 1 --branch master https://github.com/gorhill/uBlock.git .current/ubo
```

If the directory already exists from a previous run, skip the clone — the existing copy is fine.

---

## Source Location

**Entry point:** `.current/ubo/src/js/resources/scriptlets.js`

- This file imports individual scriptlet files. Follow each import to find the implementation.
- Some special scriptlets are defined inline or in separate files (e.g., `prevent-addeventlistener.js`,
    `json-edit.js`).

**Critical rules:**

- **Skip `.fn` files** — files ending in `.fn` (e.g., `abort-current-script.fn`) are helper functions,
    NOT scriptlets. Ignore them entirely.
- **Dual naming** — every uBO scriptlet has TWO valid forms of each name:
    - Canonical name **WITH** `.js` suffix (e.g., `set-constant.js`) → this is the `name` field
    - Alias **WITHOUT** `.js` suffix (e.g., `set-constant`) → goes in `aliases`
    - This applies to ALL aliases: if there's an alias `aeld`, also include `aeld.js`
- **JSDoc availability** — most uBO scriptlets have minimal or no JSDoc. When JSDoc is absent:
    - Use the function signature for parameter names and defaults
    - Check how parameters are used in the code body
    - Check the uBO wiki at
        <https://github.com/gorhill/uBlock/wiki/Resources-Library#available-general-purpose-scriptlets>
        (warning: wiki may be outdated — always verify against source)

---

## Understanding uBO Tokens (getExtraArgs)

uBO scriptlets can accept optional **token** parameters AFTER the positional parameters.
These are key-value pairs parsed by the `getExtraArgs()` function
(defined in `.current/ubo/src/js/resources/safe-self.js`).

```javascript
getExtraArgs(args, offset = 0) {
    const entries = args.slice(offset).reduce((out, v, i, a) => {
        if ( (i & 1) === 0 ) {           // Even indices (0,2,4...) are KEYS
            const rawValue = a[i+1];     // Odd indices (1,3,5...) are VALUES
            const value = /^\d+$/.test(rawValue)
                ? parseInt(rawValue, 10)  // All-digit strings → integers
                : rawValue;              // Non-digit strings kept as-is
            out.push([ a[i], value ]);
        }
        return out;
    }, []);
    return this.Object_fromEntries(entries);
}
```

**How to find tokens in a scriptlet:**

1. Look for a `getExtraArgs(Array.from(arguments), N)` call — `N` is the number of positional params
2. Search for `extraArgs.` in the code to find all token accesses
3. Determine `value_type` from how the token is used:
    - `if (extraArgs.stay)` or `if (extraArgs.protect)` → `boolean`
    - Passed to `setTimeout()` or used in arithmetic → `integer`
    - Used for string matching/operations → `string`
4. For `value_format`: look for explicit validation like `if (!/^pattern$/.test(extraArgs.token))`,
    or enum checks like `if (!['a','b'].includes(extraArgs.token))`. Write `(none)` if no validation.
5. For `default`: look for `extraArgs.token || defaultValue` patterns. Write `(none)` if no default.

Tokens go in `ubo_tokens` in the YAML, NOT in `parameters`.

---

## Extraction Steps

### 1. Enumerate all scriptlets

Starting from `.current/ubo/src/js/resources/scriptlets.js`:

1. List all imports/requires to find individual scriptlet files
2. Read each referenced file
3. Skip any file ending in `.fn`
4. Collect the full list of scriptlet names — look for `registerScriptlet(...)` calls or exported
    function declarations
5. Write this full list somewhere (e.g., in your thinking) before proceeding — you need it to track progress

### 2. Check for existing progress (resume support)

Before writing anything:

1. Check if `.current/ubo-scriptlets.md` already exists
2. If it does, scan it for `###` headings to collect the list of already-written scriptlet names
3. Skip those scriptlets in step 3 — do NOT rewrite entries that are already present
4. If the file does not exist yet, initialize it now with just the header:

```markdown
# uBO Scriptlets Research

<!-- Total found: N (trusted: X) -->

```

(Fill in N and X with the counts from step 1. You can update this line at the end.)

### 3. Process and write each scriptlet one at a time

**CRITICAL: Write each entry to `.current/ubo-scriptlets.md` immediately after processing it.**
Do NOT accumulate entries in memory and write them all at once — you will run out of output budget.

For each scriptlet NOT already in the file:

1. Read its source file
2. Extract all fields (see field list below)
3. **Immediately append** the formatted entry to `.current/ubo-scriptlets.md`
4. Move on to the next scriptlet

Processing ~10 scriptlets between file writes is acceptable, but never queue more than that.

### 4. For each scriptlet, extract the following

- **name** — canonical name WITH `.js` suffix (e.g., `set-constant.js`)
- **aliases** — ALL other names from `registerScriptlet()` or similar registration:
    - Include both `.js` and non-`.js` forms for every alias
    - Example: if aliases include `set-constant`, also include `set-constant.js`
- **description** — from JSDoc if present; otherwise infer from code/wiki
- **parameters** — positional arguments only (NOT tokens):
    - `name` — EXACT name from function signature or JSDoc. **Do NOT invent.**
    - `description` — from JSDoc `@param` or inferred from usage in code body
    - `default` — from function signature (e.g., `param = ''`); write `(none)` if absent
    - `pattern` — ONLY if explicit validation regex found in source; write `(none)` if absent
- **tokens** — from `getExtraArgs()` usage (may be empty):
    - `name` — key name as used in `extraArgs.keyName`
    - `value_type` — `string`, `integer`, or `boolean`
    - `value_format` — validation regex if found; write `(none)` if absent
    - `description` — what the token controls/configures
    - `default` — from `extraArgs.token || defaultValue`; write `(none)` if absent
- **variadic** — `true` if the scriptlet processes all remaining arguments (rare in uBO)
- **is_trusted** — `true` if the scriptlet is prefixed with `trusted-` or explicitly marked trusted
- **docs** — `https://github.com/gorhill/uBlock/wiki/Resources-Library#<anchor>` if known;
    write `(none)` if not findable

**Critical rules:**

- Copy ALL names and aliases **character-by-character** from source. Never invent.
- Positional params → `parameters`. Token args → `tokens`. Never mix them.
- Always include both `.js` and non-`.js` forms in aliases.

---

## Output Format

`.current/ubo-scriptlets.md` must follow this structure:

```markdown
# uBO Scriptlets Research

<!-- Total found: N (trusted: X) -->

---

### set-constant.js

- **aliases:** set-constant, set, set.js
- **description:** Sets a constant value for a property
- **is_trusted:** false
- **variadic:** false
- **docs:** https://github.com/gorhill/uBlock/wiki/Resources-Library#set-constant-js
- **parameters:**
  - `property` | description: Property path to set | default: (none) | pattern: (none)
  - `value` | description: Value to assign | default: '' | pattern: (none)
  - `delay` | description: Delay in ms before setting | default: (none) | pattern: ^\d+$
- **tokens:**
  - `runAt` | value_type: string | value_format: ^(loading|interactive|complete)$ | description: Defers execution to document ready state | default: (none)

---

### addEventListener-defuser.js

- **aliases:** addEventListener-defuser, aeld, aeld.js
- **description:** Defuses event listeners matching the specified event type and handler
- **is_trusted:** false
- **variadic:** false
- **docs:** https://github.com/gorhill/uBlock/wiki/Resources-Library#addeventlistener-defuser-js
- **parameters:**
  - `type` | description: String or regex matching event type | default: '' | pattern: (none)
  - `pattern` | description: String or regex matching handler source | default: '' | pattern: (none)
- **tokens:**
  - `runAt` | value_type: string | value_format: ^(loading|interactive|complete)$ | description: Defers to a specific document ready state | default: (none)
  - `elements` | value_type: string | value_format: (none) | description: CSS selector to limit targets | default: (none)
  - `protect` | value_type: boolean | value_format: ^1$ | description: Prevents addEventListener from being overwritten | default: (none)

---

### trusted-set-cookie.js

- **aliases:** trusted-set-cookie
- **description:** Sets a cookie with a value that can include current timestamp
- **is_trusted:** true
- ...
```

**Formatting rules:**

- Each scriptlet is a `###` heading using its canonical name (WITH `.js`).
- Use `---` separators between scriptlets.
- List every alias in the `aliases` line, comma-separated (both `.js` and non-`.js` forms).
- Tokens section may be omitted if the scriptlet has no tokens — write `- **tokens:** (none)`.
- Parameters section may be omitted if no positional params — write `- **parameters:** (none)`.
- Always include all 4 token fields (`value_type`, `value_format`, `description`, `default`),
    writing `(none)` when a value is absent.
- Keep the comment at the top with the total count.

---

## Completion Check

Before finishing, verify:

- [ ] Entry point `.current/ubo/src/js/resources/scriptlets.js` was read
- [ ] All imports were followed to find individual scriptlet files
- [ ] All `.fn` files were skipped
- [ ] Every scriptlet has both `.js` and non-`.js` forms in aliases
- [ ] Tokens are in `tokens` section, NOT in `parameters`
- [ ] Parameter names copied exactly from source (not invented)
- [ ] `is_trusted: true` set for trusted scriptlets
- [ ] Total count comment at top matches actual count
