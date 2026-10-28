# DNR Converter Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

### Changed

- `Rule.writtenKeys` is gone: `$badfilter` compares the rule text as written
  (`Rule.originalText`), so a rule no longer keeps a comparison key.

### Deprecated

### Removed

### Fixed

- `$domain` did not match the target hostname of a document request. Chrome
  matches `initiatorDomains` against the request initiator only, and a document
  request started by the browser (new tab page, address bar, bookmark, reload)
  has no initiator. A rule such as
  `*$document,csp=script-src-attr 'none',domain=example.com` now
  also produces a `main_frame` rule with `requestDomains`, so it works on the
  first page load, as it does in MV2. The additional rule is not created when
  the rule does not target `main_frame`, when the rule has `$third-party` or
  `$~third-party`, when a permitted `$to` and a permitted `$domain` are both
  present, or when a `$domain`, `$to`, or `$denyallow` value cannot be
  represented in DNR. A `$domain` with permitted domains still needs a
  non-domain-specific, non-regexp pattern, as in the MV2 matcher.
  `$urltransform` rules do not get the additional rule: a `$domain` with
  permitted domains does not match browser-started navigations, while an
  excluded-only `$domain` still matches them through the base rule.
  Affected rules now consume two declarative rules, and two regex-rule slots
  when a `$removeparam` rule generates a regexp, so they count against the
  rule and regex budgets.
- `$badfilter` incorrectly negated rules with different values of value-bearing
  modifiers, e.g. `||example.com^$removeparam=foo,badfilter` cancelled
  `||example.com^$removeparam=bar`. A `$badfilter` now disables a rule only when
  the whole modifier list is written the same way — names, values, their order
  and repeats, `$permissions` included — so `$redirect-rule` is no longer treated
  as `$redirect`, and spellings that are equivalent after parsing (e.g.
  `Set-Cookie` and `set-cookie`) do not negate each other.
- `$badfilter` with `$domain` still disables the rule it refers to for the
  domains present in both lists, but regular expression domains now keep their
  case, so `$domain=/A/` no longer cancels `$domain=/a/`. This exception applies
  only while neither rule has a negated `~domain`; otherwise the whole text is
  compared. As before, the whole declarative rule is disabled rather than only
  the domains named in both lists.
- `$badfilter` rules that also carried a convertible modifier (e.g.
  `||example.com^$csp=script-src 'none',badfilter`) were converted into
  declarative rules instead of disabling the rule they refer to.
- Fixed named `$removeparam` rules with an anchored literal URL pattern ending
  in `^` failing to remove the first query parameter before MV3 requests.
  Rules whose generated regexp fails validation retain their previous matching
  [AdguardBrowserExtension#3615].

[AdguardBrowserExtension#3615]: https://github.com/AdguardTeam/AdguardBrowserExtension/issues/3615

### Security

## [2.0.0] - 2026-09-29

### Added

- `parseCompactRuleset()` reads a parsed ruleset file: metadata, ordinary
  rules and the number of metadata rules.
- `RulesetWithSourceMap.fromCompact()` and
  `RulesetWithSourceMap.fromDeserialized()` build a rule set from
  `parseCompactRuleset()` or `deserialize()` output.
- `IRulesetWithSourceMap.getMetadataRulesCount()` returns the number of
  metadata rules in the ruleset file, for static rule quota accounting.
- `InvalidMetadataChunksError` for missing or malformed metadata rules.

### Changed

- **BREAKING:** Ruleset metadata is split into `metadata.chunk` fragments of
  at most 64 KiB in leading metadata rules, so that Edge Add-ons accepts MV3
  packages [MicrosoftEdge-Extensions#603]. Applies to filter rulesets and
  `ruleset_0`. 1.x and 2.x ruleset files are incompatible; rebuild rulesets
  with this version.

[2.0.0]: https://github.com/AdguardTeam/tsurlfilter/releases/tag/dnr-converter-v2.0.0

## [1.1.2] - 2026-08-25

### Changed

- Updated [@adguard/scriptlets] to `v2.5.1`.

## [1.1.1] - 2026-08-24

### Fixed

- Unknown and unsupported modifiers were silently discarded during MV3
  conversion, which could turn the remaining rule into a broader blocking or
  allow DNR rule [AdguardFilters#238305].
- Value-less `$removeparam` rules (e.g. `||example.org^$removeparam`) converted
  into blocking DNR rules instead of a redirect that removes the whole query
  string, so matching sites were blocked [AdguardBrowserExtension#3602].
- Unanchored `$urltransform` substitution patterns did not match query strings
  in MV3 [AdguardBrowserExtension#3600].

[AdguardFilters#238305]: https://github.com/AdguardTeam/AdguardFilters/issues/238305
[AdguardBrowserExtension#3602]: https://github.com/AdguardTeam/AdguardBrowserExtension/issues/3602
[AdguardBrowserExtension#3600]: https://github.com/AdguardTeam/AdguardBrowserExtension/issues/3600


## [1.1.0] - 2026-07-28

### Changed

- `RegularRuleConverter` now uses a template method (`groupConverted()`) instead
  of having each subclass duplicate `convert()`. `CspConverter` and
  `RemoveHeaderConverter` override `groupConverted()` instead.
- Renamed `DEFAULT_DEST_RULE_SETS_DIR` to `DEFAULT_DEST_RULESETS_DIR` in the CLI.
- Updated `.eslintrc.cjs` to align with other packages: separated
  `builtin`/`external` import groups, added `@adguard/**` pathGroups,
  added `curly` rule.
- Renamed `test/src/rulesets/` to `test/src/ruleset/` to match source directory
  naming.

### Fixed

- Fixed stale `@typedef` import paths in `TooManyError` subclasses (pointed to
  non-existent `../../source-map` instead of `../../ruleset/source-map`).
- Fixed README: repo URL, added `$urltransform` and `$cookie` to supported
  modifiers, corrected `NetworkRule[]` → `Rule[]` in ConverterOptions docs.
- Removed redundant `FilterConverterOptions` duplicate export.

### Removed

- Deleted dead `bamboo-specs/scripts/dnr-converter-tests.sh` (never referenced
  by CI).

[1.1.0]: https://github.com/AdguardTeam/tsurlfilter/releases/tag/dnr-converter-v1.1.0


## [1.0.0] - 2026-07-10

### Added

- Initial release: DNR conversion stack (rule converters, rulesets, source maps,
  CLI) extracted from `@adguard/tsurlfilter`.

[1.1.2]: https://github.com/AdguardTeam/tsurlfilter/releases/tag/dnr-converter-v1.1.2
[1.1.1]: https://github.com/AdguardTeam/tsurlfilter/releases/tag/dnr-converter-v1.1.1
[1.0.0]: https://github.com/AdguardTeam/tsurlfilter/releases/tag/dnr-converter-v1.0.0

[@adguard/scriptlets]: https://github.com/AdguardTeam/Scriptlets/blob/master/CHANGELOG.md
[MicrosoftEdge-Extensions#603]: https://github.com/microsoft/MicrosoftEdge-Extensions/issues/603
