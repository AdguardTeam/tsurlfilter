# DNR Converter — VLQ Source-Map Size Benchmark Results

This file records the VLQ size-comparison baselines used to decide whether to
adopt base64 VLQ encoding for the serialized source map. The benchmark is
reproducible via `pnpm bench:vlq`.

> Run the benchmark manually (`pnpm bench:vlq`) and commit the updated table
to record a new baseline.

## Decision

**VLQ adopted.** The serialized source-map format has been switched from a
compact JSON array of `[declarativeRuleId, sourceRuleIndex, filterId]` triples
to a base64 VLQ string. The decision was based on the following measurements.

## Single-filter baseline (EasyList + EasyPrivacy)

- **Date**: 2026-06-23T20:12:55.729Z
- **Node.js**: v22.22.1
- **Platform**: darwin/x64
- **Filter lines (non-empty)**: 138,149
- **Filter size**: 3.44 MB
- **Source-map triples**: 109,517

| Format | Size (bytes) | Size (KB) |
| --- | --- | --- |
| Current JSON (array of triples) | 2,426,515 | 2369.64 |
| Base64 VLQ | 1,492,126 | 1457.15 |

- **Absolute savings**: 934,389 bytes (912.49 KB)
- **Reduction**: 38.51%

## Full-set baseline (50 chromium-mv3 rulesets)

Measured across all 50 declarative rulesets in the chromium-mv3 filter set.

- **Rulesets with source map**: 50
- **Total triples**: 316,742
- **Current JSON total**: 7,171,443 B (6.84 MB)
- **Base64 VLQ total**: 4,356,603 B (4.15 MB)
- **Absolute savings**: 2,814,840 B (2.68 MB)
- **Reduction**: 39.25%

## Notes

- The old format was `JSON.stringify` of `[[declarativeRuleId, sourceRuleIndex, filterId], ...]` (field names removed to reduce size).
- The new format encodes each triple as one comma-separated base64 VLQ segment (`encodeVlq(id) + encodeVlq(index) + encodeVlq(filterId)`), mirroring the source-map "mappings" format.
- Arithmetic (not bitwise) is used for VLQ magnitude to support values up to 2^31-1 (declarative rule IDs are text hashes) without 32-bit overflow.
- The format change requires no migration: the generator and reader always ship in lockstep (same dnr-converter version).
