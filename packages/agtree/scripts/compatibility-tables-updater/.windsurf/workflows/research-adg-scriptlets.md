---
description: Step 3 - Research AdGuard scriptlets and dump findings to .current/adg-scriptlets.md
---

# Step 3: Research AdGuard Scriptlets

**This is Step 3 of 4.** Run this after Step 1 (ABP) and Step 2 (uBO), and before Step 4 (update tables).

## Prerequisites - READ THESE FIRST

**You MUST read these files completely before starting:**

1. `src/compatibility-tables/scriptlets/README.md` - Complete field reference, especially parameter fields
2. `src/compatibility-tables/schemas/scriptlet.ts` - Schema definitions and validation rules

Also skim a few existing YAML files to understand what data points matter:

- `src/compatibility-tables/scriptlets/abort-on-property-read.yml` - Simple scriptlet
- `src/compatibility-tables/scriptlets/set-constant.yml` - Parameter example

---

## Goal

Scan the AdGuard scriptlets repository and extract all information needed to update or create
YAML compatibility table entries. Dump structured results to `.current/adg-scriptlets.md`.

AdGuard is the **naming backbone** of the compatibility tables:

- YAML filenames are based on AdGuard names (e.g., `prevent-addEventListener.yml`)
- AdGuard wiki contains cross-references to equivalent uBO and ABP scriptlets
- AdGuard has the most comprehensive documentation

**This session does NOT touch any YAML files.** Output only goes to `.current/adg-scriptlets.md`.

**Do NOT write scripts** (Python, JavaScript, bash, etc.) to extract or process data. Read and
analyze source files directly using your file reading tools. Scripts introduce their own bugs and
are harder to verify than direct analysis.

---

## Setup

Create the `.current` directory and clone the AdGuard repository if not already present:

```bash
mkdir -p .current
```

If `.current/adg-scriptlets/` does not already exist, clone it (shallow clone for speed):

```bash
git clone --depth 1 --branch master https://github.com/AdguardTeam/Scriptlets.git .current/adg-scriptlets
```

If the directory already exists from a previous run, skip the clone — the existing copy is fine.

---

## Source Locations

### Primary source: `.current/adg-scriptlets/wiki/about-scriptlets.md`

This is the main documentation file. Each scriptlet has a `###` section containing:

- Scriptlet name (from the heading)
- Description
- Syntax block with parameter names and descriptions
- "Added in v..." line → `version_added`
- "Related UBO scriptlet:" link → uBO equivalent name
- "Related ABP source:" link → ABP equivalent name
- Example usage

### Fallback source: `.current/adg-scriptlets/src/scriptlets/`

Use this when the wiki is missing information:

- Function signatures → parameter names and defaults
- JSDoc `@param` → parameter descriptions and types
- `isValidScriptletName` or similar → trusted flag
- Files prefixed with `trusted-` → `is_trusted: true`

**Check for completeness:** Also list `.js` files in `src/scriptlets/` to ensure no scriptlet
exists in source but is absent from the wiki.

---

## Extraction Steps

### 1. List all scriptlets from the wiki

Scan `.current/adg-scriptlets/wiki/about-scriptlets.md` and collect every `###` heading.
Each heading is a scriptlet name. Record this full list before proceeding.

### 2. Also list source files

List all `.js` files in `.current/adg-scriptlets/src/scriptlets/`. Note any that are NOT
covered by a `###` section in the wiki — add them to the full list too.

### 3. Check for existing progress (resume support)

Before writing anything:

1. Check if `.current/adg-scriptlets.md` already exists
2. If it does, scan it for `###` headings to collect the list of already-written scriptlet names
3. Skip those scriptlets in step 4 — do NOT rewrite entries that are already present
4. If the file does not exist yet, initialize it now with just the header:

```markdown
# AdGuard Scriptlets Research

<!-- Total found: N (trusted: X, wiki-only: Y, source-only: Z) -->

```

(Fill in N, X, Y, Z with the counts from steps 1–2. You can update this line at the end.)

### 4. Process and write each scriptlet one at a time

**CRITICAL: Write each entry to `.current/adg-scriptlets.md` immediately after processing it.**
Do NOT accumulate entries in memory and write them all at once — you will run out of output budget.

For each scriptlet NOT already in the file:

1. Read its wiki section (and source file if wiki info is incomplete)
2. Extract all fields (see field list below)
3. **Immediately append** the formatted entry to `.current/adg-scriptlets.md`
4. Move on to the next scriptlet

Processing ~10 scriptlets between file writes is acceptable, but never queue more than that.

### 5. For each scriptlet, extract the following

Read the wiki section (and source file if needed) and extract:

- **name** — exact scriptlet name from the `###` heading
- **description** — from the wiki description text (one or two sentences)
- **version_added** — from "Added in v..." text (e.g., `"1.0.4"`); write `(none)` if absent
- **is_trusted** — `true` if name starts with `trusted-` or if marked trusted in docs;
    `false` otherwise
- **aliases** — from AdGuard source/docs if any alternate names exist; write `(none)` if absent
- **related_ubo** — the uBO scriptlet name from "Related UBO scriptlet:" link;
    write `(none)` if absent
- **related_abp** — the ABP scriptlet name from "Related ABP source:" link;
    write `(none)` if absent
- **docs** — `https://github.com/AdguardTeam/Scriptlets/blob/master/wiki/about-scriptlets.md#<anchor>`
    (derive anchor from scriptlet name: lowercase, replace spaces/special chars with `-`)
- **variadic** — `true` if the scriptlet accepts rest parameters or processes all remaining args;
    `false` otherwise
- **parameters** — for each parameter in order:
    - `name` — EXACT name from wiki syntax block or JSDoc. **Do NOT invent or rename.**
    - `required` — `true` if not marked optional; `false` if in `[brackets]` in syntax or has a default
    - `description` — from wiki syntax description or JSDoc `@param`
    - `default` — from function signature (e.g., `param = ''`) or wiki; write `(none)` if absent
    - `pattern` — ONLY if explicit validation regex found in source; write `(none)` if absent

**Critical rules:**

- Copy parameter names **character-by-character** from wiki or source. Never invent or guess.
- If a scriptlet has no parameters, write `parameters: (none)`.
- If a field has no value, write `(none)` — do not leave it blank.

---

## Output Format

`.current/adg-scriptlets.md` must follow this structure:

```markdown
# AdGuard Scriptlets Research

<!-- Total found: N (trusted: X, wiki-only: Y, source-only: Z) -->

---

### abort-on-property-read

- **description:** Aborts execution of inline scripts attempting to read the specified property
- **version_added:** 1.0.4
- **is_trusted:** false
- **aliases:** (none)
- **related_ubo:** abort-on-property-read.js
- **related_abp:** abort-on-property-read
- **docs:** https://github.com/AdguardTeam/Scriptlets/blob/master/wiki/about-scriptlets.md#abort-on-property-read
- **variadic:** false
- **parameters:**
  - `property` | required: true | description: A dot-separated path to a property | default: (none) | pattern: (none)

---

### trusted-set-cookie

- **description:** Sets a cookie with a name, value, path, domain, and same-site attributes
- **version_added:** 1.7.3
- **is_trusted:** true
- **aliases:** (none)
- **related_ubo:** trusted-set-cookie.js
- **related_abp:** (none)
- **docs:** https://github.com/AdguardTeam/Scriptlets/blob/master/wiki/about-scriptlets.md#trusted-set-cookie
- **variadic:** false
- **parameters:**
  - `name` | required: true | description: Name of the cookie to set | default: (none) | pattern: (none)
  - `value` | required: true | description: Value of the cookie | default: (none) | pattern: (none)
  - `offsetExpires` | required: false | description: Expiry offset in seconds from now | default: '' | pattern: (none)
  - `path` | required: false | description: Cookie path | default: / | pattern: (none)
```

**Formatting rules:**

- Each scriptlet is a `###` heading using its exact AdGuard name.
- Use `---` separators between scriptlets.
- List every parameter on its own line using the pipe-separated format shown above.
- Always include all 5 parameter fields (`name`, `required`, `description`, `default`, `pattern`),
    writing `(none)` when a value is absent.
- Keep the comment at the top with total count and breakdown.

---

## Completion Check

Before finishing, verify:

- [ ] All `###` headings from `about-scriptlets.md` have an entry in `.current/adg-scriptlets.md`
- [ ] Source files in `src/scriptlets/` were also checked for any unlisted scriptlets
- [ ] `is_trusted: true` set for all scriptlets prefixed with `trusted-`
- [ ] `related_ubo` and `related_abp` cross-references extracted for every scriptlet where present
- [ ] Parameter names copied exactly from wiki/source (not invented)
- [ ] `version_added` extracted where present in wiki
- [ ] `variadic: true` set for scriptlets that accept unlimited arguments
- [ ] Total count comment at top matches actual count
