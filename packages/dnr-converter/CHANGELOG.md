# DNR Converter Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

### Changed

### Deprecated

### Removed

### Fixed

### Security

## [2.1.0] - 2026-11-12

### Added

- Partial `$csp` exception support for exact conditions, exceptions which are
  wider than the blocker, and clean domain exclusions, including a standalone
  CSP conversion API, `FilterConverter.convertCspRules()`, which resolves
  exceptions across all filters at once. It parses only candidate lines instead
  of the whole filter list; the regular `convert()` still rejects an allowlist
  `$csp` rule and owns `$badfilter` lines.
- `TooManyError`, `UnexpectedConversionError` and `RuleScanError` are now
  exported, so an error can be checked with `instanceof`;
  `isCspDeclarativeRule`, `isRuleScanError` and `isUnavailableFilterSourceError`
  are exported too. `IRulesetWithSourceMap` gained a required
  `getSourceRuleIndexes()`, which returns `SourceRuleIdxAndFilterId[]` and maps a
  declarative rule id to source rule indexes without reading the rule text, and
  `ComputedWithSourceMapOptions` describes the source-map-only options.
- `excludeCspRules` conversion option leaves CSP rules to the standalone CSP
  conversion. It is available only in source-map mode (`withSourceMap: true`),
  and `convertCspRules()` has to run afterwards, otherwise the CSP rules are not
  converted at all.
- `Rule.cspDirective` keeps the `$csp` directive in a dedicated field.
- `Rule.originalText` keeps the rule text as written, and `$badfilter` compares
  it, so a rule no longer needs a separate comparison key.
- A `$csp` exception is applied only when it really covers the blocking rule:
  the URL identity is compared field by field, and an exception which would
  lose a part of its condition is rejected and reported instead of matching
  more than written. An exception whose condition cannot be built at all, e.g. a
  domain label punycode cannot encode, is reported the same way instead of
  failing the whole conversion. An exception whose `$domain`, `$to` or
  `$denyallow` value contains a port is rejected, since a DNR domain list
  cannot hold one.
- An exception with a permitted `$domain` against a blocker with the additional
  `main_frame` rule is rejected only when the excluded domain overlaps the
  target domains: `*$csp=x,domain=a.com` + `@@||cdn.example.net^$csp,domain=a.com`
  is resolvable, while an exception for `sub.a.com` stays rejected.
- A `$csp` exception applies only when it outranks the blocking rule, so
  `$important` keeps its policy: `@@||example.com^$csp` does not cancel
  `||example.com^$csp=...,important`, and neither does a valued exception. In
  MV2 only a value-less exception cancels the blocking rule; a valued one goes
  through the same priority check.
- A filter whose content cannot be read does not fail the standalone CSP pass:
  the pass skips it and reports an `UnavailableFilterSourceError`.
- A `$csp` exception is recognized when its pattern ends right after the domain
  (`@@||example.com$csp`), and a url filter is compared case-insensitively when
  the exception is not marked with `$match-case`, like DNR matches it. A pattern
  which ends right after the domain is a host prefix, so it is never called
  disjoint from another domain: `||example.com$csp=script-src 'none'` with
  `@@||example.company^$csp` excludes `example.company` instead of dropping the
  exception.

### Changed

- A blocking `$csp` rule without a directive is a parse error instead of a
  plain block rule, and so are a `$csp` directive which contains `report-`
  (as in tsurlfilter), a value-less `$permissions` or `$removeheader`, and `$csp`
  combined with `$cookie`: such rules used to degrade into a plain blocking
  rule, to send violation reports to a third-party host, or to produce no rule
  at all, because one declarative rule carries one action.
- `$csp` rules with the same condition in one filter are no longer combined
  into one policy: CSP applies only the first copy of a repeated directive, so a merge
  either dropped the second policy or changed what is blocked through the
  `default-src` fallback. Only identical policies are deduplicated now,
  everything else stays in its own header, where a browser enforces both.

### Fixed

- Non-ASCII values no longer break the conversion: a hostname in a URL filter is
  converted to punycode, also after a `*` or `*.` wildcard and in unanchored or
  scheme-prefixed patterns, the rest of the pattern is percent-encoded, and
  `$domain`, `$to` and `$denyallow` values are lowercased before the punycode
  conversion, so `ПРИМЕР.рф` and `пример.рф` give the same domain. A `*` inside
  an anchored hostname is converted label by label, so `||пример.рф*/x` keeps
  the wildcard a separator instead of folding it into a label, and the hostname
  of the pattern is lowercased, so `||ПРИМЕР.рф^` matches the host
  `xn--e1afmkfd.xn--p1ai`.
- The `$csp` directive is no longer replaced by a following value-bearing
  advanced modifier: `$csp=script-src 'none',urltransform=/a/b/` used to emit a
  CSP header with `/a/b/`, and `$redirect=noopjs,csp=x` redirected to the wrong
  resource.
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
  domains present in both lists, and plain domains are now compared
  case-insensitively, so `$domain=foo.com,badfilter` also disables
  `$domain=FOO.com`, which 2.0.0 left alone. Regular expression domains keep
  their case, as before. This exception applies only while neither rule has a
  negated `~domain`; otherwise the whole text is compared. As before, the whole
  declarative rule is disabled rather than only the domains named in both lists.
- `$badfilter` rules that also carried a convertible modifier (e.g.
  `||example.com^$csp=script-src 'none',badfilter`) were converted into
  declarative rules instead of disabling the rule they refer to.
- Fixed named `$removeparam` rules with an anchored literal URL pattern ending
  in `^` failing to remove the first query parameter before MV3 requests.
  Rules whose generated regexp fails validation retain their previous matching
  [AdguardBrowserExtension#3615].

[AdguardBrowserExtension#3615]: https://github.com/AdguardTeam/AdguardBrowserExtension/issues/3615
[2.1.0]: https://github.com/AdguardTeam/tsurlfilter/releases/tag/dnr-converter-v2.1.0

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
