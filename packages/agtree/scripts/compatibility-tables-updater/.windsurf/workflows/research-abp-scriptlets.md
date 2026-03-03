---
description: Step 1 - Research Adblock Plus scriptlets and dump findings to .current/abp-scriptlets.md
---

# Step 1: Research Adblock Plus Scriptlets

**This is Step 1 of 4.** Run this before Step 2 (uBO), Step 3 (AdGuard), and Step 4 (update tables).

## Prerequisites - READ THESE FIRST

**You MUST read these files completely before starting:**

1. `src/compatibility-tables/scriptlets/README.md` - Complete field reference, especially parameter fields
2. `src/compatibility-tables/schemas/scriptlet.ts` - Schema definitions and validation rules

Also skim a few existing YAML files to understand the output format expected in Step 4:

- `src/compatibility-tables/scriptlets/abort-on-property-read.yml` - Simple scriptlet
- `src/compatibility-tables/scriptlets/prevent-addEventListener.yml` - Complex with platform-specific params

---

## Goal

Scan the Adblock Plus scriptlets repository and extract all information needed to update or create
YAML compatibility table entries. Dump structured results to `.current/abp-scriptlets.md`.

**This session does NOT touch any YAML files.** Output only goes to `.current/abp-scriptlets.md`.

**Do NOT write scripts** (Python, JavaScript, bash, etc.) to extract or process data. Read and
analyze source files directly using your file reading tools. Scripts introduce their own bugs and
are harder to verify than direct analysis.

---

## Setup

Create the `.current` directory and clone the ABP repository if not already present:

```bash
mkdir -p .current
```

If `.current/abp-scriptlets/` does not already exist, clone it (shallow clone for speed):

```bash
git clone --depth 1 --branch main https://gitlab.com/eyeo/anti-cv/snippets.git .current/abp-scriptlets
```

If the directory already exists from a previous run, skip the clone — the existing copy is fine.

---

## Source Location

**Primary source:** `.current/abp-scriptlets/source/`

**Folders to scan — scan ALL three:**

- `behavioral/` - Behavior-modifying scriptlets (abort, prevent, override, etc.)
- `conditional-hiding/` - Element hiding scriptlets
- `introspection/` - Debugging/logging scriptlets

**Ignore:** `utils/` folder — these are helper utilities, NOT scriptlets.

**Naming convention:** ABP uses hyphenated names without `.js` suffix (e.g., `abort-on-property-read`).
ABP scriptlets have **no aliases**.

**JSDoc quality:** ABP has excellent JSDoc. It is the primary source for:

- Parameter names and descriptions (use `@param` entries)
- Parameter types (`{string}`, `{number}`, etc.)
- Required vs optional (optional params are wrapped in `[brackets]` in JSDoc)
- `@since` tag → `version_added`
- Function description → `description`

**Docs URL pattern:**

- `behavioral/` → `https://developers.eyeo.com/snippets/behavioral-snippets/<name>`
- `conditional-hiding/` → `https://developers.eyeo.com/snippets/conditional-hiding-snippets/<name>`
- `introspection/` → `https://developers.eyeo.com/snippets/introspection-snippets/<name>`

---

## Extraction Steps

### 1. List all scriptlets

List every `.js` file in `behavioral/`, `conditional-hiding/`, and `introspection/`. This gives you
the complete set. Do NOT skip any file. Record this full list before proceeding.

### 2. Check for existing progress (resume support)

Before writing anything:

1. Check if `.current/abp-scriptlets.md` already exists
2. If it does, scan it for `###` headings to collect the list of already-written scriptlet names
3. Skip those scriptlets in step 3 — do NOT rewrite entries that are already present
4. If the file does not exist yet, initialize it now with just the header:

```markdown
# ABP Scriptlets Research

<!-- Total found: N -->

```

(Fill in N with the total count from step 1. You can update this line at the end.)

### 3. Process and write each scriptlet one at a time

**CRITICAL: Write each entry to `.current/abp-scriptlets.md` immediately after processing it.**
Do NOT accumulate entries in memory and write them all at once — you will run out of output budget.

For each scriptlet NOT already in the file:

1. Read its source file
2. Extract all fields (see field list below)
3. **Immediately append** the formatted entry to `.current/abp-scriptlets.md`
4. Move on to the next scriptlet

Processing ~10 scriptlets between file writes is acceptable, but never queue more than that.

### 4. For each scriptlet, extract the following

Read each file and extract:

- **name** — filename without `.js` extension
- **category** — folder name (`behavioral`, `conditional-hiding`, or `introspection`)
- **description** — from JSDoc function description (first sentence or full description)
- **version_added** — from JSDoc `@since` tag (e.g., `@since 3.4.1` → `"3.4.1"`); write `(none)` if absent
- **variadic** — `true` if the function uses rest parameters (`...args`) or explicitly processes
  `arguments` as a list; `false` otherwise
- **parameters** — for each parameter in order:
    - `name` — EXACT name from JSDoc `@param` or function signature. **Do NOT invent or rename.**
    - `required` — `true` if not optional; `false` if JSDoc shows `[param]` notation or has a default
    - `type` — from JSDoc type annotation (e.g., `string`, `number`, `RegExp`)
    - `description` — from JSDoc `@param` description
    - `default` — from function signature default (e.g., `param = ''`) or JSDoc; write `(none)` if absent
    - `pattern` — ONLY if an explicit validation regex is found in the source code; write `(none)` if absent

**Critical rules:**

- Copy parameter names **character-by-character** from source. Never invent or guess names.
- If a scriptlet has no parameters, write `parameters: (none)`.
- If a field has no value, write `(none)` — do not leave it blank.

---

## Output Format

`.current/abp-scriptlets.md` must follow this structure:

```markdown
# ABP Scriptlets Research

<!-- Total found: N (behavioral: X, conditional-hiding: Y, introspection: Z) -->

---

## behavioral

### abort-on-property-read

- **description:** Aborts the execution of inline scripts that try to read a specific property
- **version_added:** 3.4.1
- **docs:** https://developers.eyeo.com/snippets/behavioral-snippets/abort-on-property-read
- **variadic:** false
- **parameters:**
  - `property` | required: true | type: string | description: A dot-separated path to a property | default: (none) | pattern: (none)
  - `path` | required: false | type: string | description: Sub-path within the property object | default: (none) | pattern: (none)

### prevent-listener

- **description:** Prevents listeners for specific events from being added
- **version_added:** 3.11.2
- **docs:** https://developers.eyeo.com/snippets/behavioral-snippets/prevent-listener
- **variadic:** false
- **parameters:**
  - `type` | required: true | type: string | description: Pattern matching event type(s) | default: (none) | pattern: (none)
  - `handler` | required: false | type: string | description: Pattern matching handler declaration | default: (none) | pattern: (none)
  - `selector` | required: false | type: string | description: CSS selector for target elements | default: (none) | pattern: (none)

---

## conditional-hiding

### hide-if-contains

- **description:** Hides an element if it contains a specific string
- ...

---

## introspection

### trace

- **description:** Logs script call stack whenever a given property is accessed
- ...
```

**Formatting rules:**

- Group scriptlets under their folder as a `##` section heading.
- Each scriptlet is a `###` heading using its name (without `.js`).
- List every parameter on its own line using the pipe-separated format shown above.
- Always include all 6 parameter fields (`name`, `required`, `type`, `description`, `default`, `pattern`),
  writing `(none)` when a value is absent.
- Keep the comment at the top with the total count.

---

## Completion Check

Before finishing, verify:

- [ ] All three folders scanned (`behavioral/`, `conditional-hiding/`, `introspection/`)
- [ ] `utils/` folder was ignored
- [ ] Every `.js` file in the three folders has an entry in `.current/abp-scriptlets.md`
- [ ] Parameter names are copied exactly from source (not invented)
- [ ] `version_added` extracted from `@since` where present
- [ ] `variadic: true` set for scriptlets that process rest/arguments
- [ ] Total count comment at top of file matches actual count
