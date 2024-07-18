# Compatibility tables TODO list

- [x] Fill compatibility tables with data.
    - [x] Import scriptlets/redirects from AdGuard Scriptlets library? GitHub Action for importing?
    - [x] GitHub Action workflow that checks YML files for errors.
- [x] Finalize table structure, if needed. It depends on edge cases and how we'll use the tables in the API.
- [x] Table optimization, if needed. We need a maintainable, convenient data structure for the tables, so maybe we'll
      need to optimize it before using it in the API.
- [x] Create API endpoints for the tables.
- [x] Wiki generation (`.md` files from the tables / gh-pages).
- [ ] Review redirects' aliases in compatibility table:
    - [ ] check if `ubo-` and `abp-` prefixes should be deprecated,
    <!-- markdownlint-disable MD013 -->
    - [x] make compatibility table does not miss any [ubo aliases](https://raw.githubusercontent.com/gorhill/uBlock/master/src/js/redirect-resources.js).
    <!-- markdownlint-enable MD013 -->
- [ ] Re-use data in YAML files via anchors. This will help to avoid duplication and make the data more maintainable.
- [ ] Make a site for compatibility tables in React and deploy it to GitHub Pages.
      Make entities searchable and viewable by URL.
- [ ] Handle negated aliases properly, like `first-party` and `~third-party`.
- [ ] Consider adding a field called `limited` and `limitationMessage` to the compatibility tables.
      This field will be used to indicate that the entity is limited in some way and provide a message with details.
- [ ] Add documentation link and description to all redirect resources.
- [ ] Add Extended CSS features to the compatibility tables.
- [ ] Add more tests for the compatibility tables API.

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
