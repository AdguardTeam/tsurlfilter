# DNR Converter Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## Unreleased

### Removed

- **Breaking:** Removed the deprecated `domains` and `excludedDomains` fields
  from `RuleCondition` and `RuleConditionValidator` (deprecated since Chrome
  101). Use `initiatorDomains`/`excludedInitiatorDomains` instead. The package
  converters already emit the non-deprecated fields; `RuleConditionValidator`
  now rejects conditions carrying the removed keys as unknown keys. No
  migration is required (lockstep serialization, no external consumers).
- Removed the deprecated `serialize()` method from `RulesetWithSourceMap` and
  `IRulesetWithSourceMap`. Use `serializeCompact()` as the single serialization
  path.

### Changed

- **Breaking:** `SourceMap.serialize()` now emits a base64 VLQ string
  instead of a JSON array of triples, and
  `SourceMap.deserializeSources()` now decodes VLQ. No migration is required
  (lockstep serialization, no external consumers). The stale
  `@todo Can use protocol VLQ` is resolved; the size comparison is recorded
  in `benchmarks/vlq-results.md` (reproducible via `pnpm bench:vlq`). On a
  representative 100k+ line ruleset (EasyList + EasyPrivacy, 109,517
  triples), VLQ reduced source-map size by 38.51% (2,426,515 B → 1,492,126
  B, saving 912 KB); across the full chromium-mv3 set (50 rulesets, 316,742
  triples), the reduction was 39.25% (7,171,443 B → 4,356,603 B, saving
  2.68 MB).
- `SourceMap.deserializeSources()` now validates its input with a valibot
  schema and throws a descriptive error on malformed JSON or structurally
  invalid data (wrong types, missing fields, negative ids, or extra tuple
  elements), instead of performing an unguarded `JSON.parse` that could return
  silently wrong `Source[]` data or fail with a cryptic error. Valid input is
  unchanged.

- **Breaking:** `unsafeRules` is now a required parameter of
  `RulesetWithSourceMap.serializeCompact()` and a required constructor argument of
  `RulesetWithSourceMap`. The `unsafeRules` field of `SerializedRulesetData` (and its
  valibot validator) is no longer optional. Serialized metadata now always carries the
  `unsafeRules` key. No migration is required (lockstep serialization, no external
  consumers).

- `RulesConverter.checkLimitations()` now builds the errors index and the
  sources index lazily on first truncation access (via a new synchronous
  `Lazy` utility) and caches them, instead of constructing both `Map`s
  eagerly on every conversion. Conversions that do not truncate any rule
  (no `maxNumberOf*` limit exceeded) no longer pay the cost of building the
  two indexes. Observable behaviour is unchanged.

- `$removeheader` rules combined with an incompatible modifier are now
  rejected by `RuleDeclarativeValidator` with an `UnsupportedModifierError` and
  skipped during conversion (no declarative rule emitted), instead of being
  rejected at parse time by a hard `SyntaxError` in the `Rule` constructor.
  This aligns `$removeheader` handling with the package's existing
  "report limitation + skip" convention. Incompatible modifiers are detected
  in two ways: any loop-reachable modifier absent from
  `REMOVEHEADER_COMPATIBLE_MODIFIERS` (aligned with tsurlfilter's
  `RemoveHeaderCompatibleOptions`, e.g. `$method`), and the field-only `$to`
  modifier (which tsurlfilter also rejects). Compatible modifiers (e.g.
  `$third-party`, `$important`, `$domain`, `$denyallow`, content-type
  modifiers) are unchanged.

### Added

- Added a cross-package compatibility test (`rule-parity.test.ts`) that proves
  dnr-converter's `Rule` stays behaviourally compatible with
  `@adguard/tsurlfilter`'s `NetworkRule` across modifier sets (enabled/
  disabled), priority, URL pattern, `$badfilter` detection/negation, and text
  roundtrip. `@adguard/tsurlfilter` is now a `devDependency` (test-only).

- Added a standalone, manually-run HITL benchmark
  (`benchmarks/cold-start-benchmark.ts`, `pnpm bench:cold-start`) that measures
  the cold-start cost of runtime filter-list preparation
  (`FilterListParser.parse`, the `FilterList.prepare()` equivalent) and
  end-to-end runtime conversion (`FilterConverter.convert`) on a 100k+ line
  filter list, writing a recorded baseline to `benchmarks/RESULTS.md`. The
  benchmark is not part of the test suite and is not wired into CI.

- Initial release.

### Fixed

- Dockerfile: swapped the `built-tsurlfilter` and `built-dnr-converter` stages
  in the dependency chain so that tsurlfilter builds before dnr-converter.
  This is required because `@adguard/tsurlfilter` is now a devDependency of
  dnr-converter, and Nx's `^build` task pipeline detects it as a build
  dependency.
- Dockerfile: fixed `test-dnr-converter` stage where `echo > /out/.test-run-id`
  ran before `mkdir -p /out/tests-reports`, causing the `/out` directory to not
  exist when the write was attempted.
- `SourceMap.deserializeSources()` now rejects VLQ segments that contain
  trailing data after exactly 3 values (the decoder verifies the whole segment
  is consumed), instead of silently ignoring the remainder. This hardens the
  deserialization contract against malformed/crafted metadata.
- `RulesConverter.checkLimitations()` now filters truncated rules' sources and
  errors from the original arrays in input order, instead of regrouping by
  declarative rule id and flattening. The serialized source map is now
  byte-for-byte identical regardless of whether truncation happened (previously
  the order could change when a rule id appeared in non-contiguous positions).
