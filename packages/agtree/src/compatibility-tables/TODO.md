# Compatibility tables TODO list

- [ ] Fill compatibility tables with data.
    - [ ] Import scriptlets/redirects from AdGuard Scriptlets library? GitHub Action for importing?
    - [ ] GitHub Action workflow that checks YML files for errors.
- [ ] Finalize table structure, if needed. It depends on edge cases and how we'll use the tables in the API.
- [ ] Table optimization, if needed. We need a maintainable, convenient data structure for the tables, so maybe we'll
      need to optimize it before using it in the API.
- [ ] Create API endpoints for the tables.
- [ ] Wiki generation (`.md` files from the tables / gh-pages).

## Linter rules

Here is the list of rules that we need to implement to take all the advantages of the compatibility tables:

- **Modifiers:**
    - [ ] `no-unknown-modifier`: report unknown modifiers.
      For example, `script` is a known modifier, but `scriptlet` is not.
    - [ ] `no-incorrect-modifier-parameter`: report modifiers with incorrect parameters.
        - Report if the modifier shouldn't have parameters, but it used with parameters, for example `script=param`.
        - Report if the modifier should have parameters, but it used without parameters, for example `domain`.
        - Validate parameters with regular expressions.
            - Use predefined validation patterns that are faster than regular expressions?
    - [ ] `no-bad-modifier-negation`: report modifiers that cannot be negated.
      For example, `important` cannot be negated, so it shouldn't used as `~important`.
    - [ ] `no-bad-modifier-exceptions`: report modifiers that cannot be used in exceptions.
      For example, `empty` cannot be used in exceptions, like `@@||example.org^$empty`.
    - [ ] `no-incompatible-modifier`: if `! PLATFORM` or adblock agent is specified before,
      report incompatible modifiers. If the adblocker version is specified in the agent,
      report incompatible modifiers for the specified version.
    - [ ] `no-deprecated-modifier`: report deprecated modifiers.
    - [ ] `no-conflicting-modifier`: report conflicting modifiers (modifiers that cannot be used together).
