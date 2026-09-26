# DNR metadata integration

> **Temporary PR bootstrap document.** Delete this file once implementation
> changes land in the integration branch. It must not be included in the
> final PR diff or merged into `master`. The maintained plan is in Jira.

Tracking epic: [AG-59546](https://jira.int.agrd.dev/browse/AG-59546).
Store issue: [MicrosoftEdge-Extensions#603](https://github.com/microsoft/MicrosoftEdge-Extensions/issues/603).

## Format

Serialize metadata to JSON and split it into ordered string fragments stored
as `metadata.chunk` in leading service rules of each ruleset. Reading joins
those fragments and parses the reconstructed JSON once. Each complete
serialized metadata value must fit in 65,536 UTF-8 bytes, including escaping
and the wrapper, after all resource processing.

A test package carrying metadata from 53 rulesets passed Edge draft validation
with 64 KiB chunks; 128 and 256 KiB variants failed. This is evidence for the
chosen bound, not an official store limit or acceptance of the full extension.

## Integration order

1. Implement the converter codec and counters in
   [AG-59549](https://jira.int.agrd.dev/browse/AG-59549).
2. Integrate the codec into
   [dnr-rulesets](https://jira.int.agrd.dev/browse/AG-59579) and
   [tswebextension](https://jira.int.agrd.dev/browse/AG-59550) in parallel.
3. Validate the combined packages with the extension integration and an
   in-place upgrade from the currently distributed extension.
4. Merge the integration PR into `master`, publish the converter before its
   dependents, then transfer the required changes to the publishing branches.

Task branches start from `fix/AG-59546` and target it with separate PRs. The
integration branch targets `master`. Keep it current by merging `master`
without rewriting history underneath dependent branches. A task PR merged
here does not complete its package release or publishing-branch transfer.

## Release requirements

- Ship the new reader and bundled rulesets together; legacy file parsing is
  out of scope. Isolate the breaking format through package versions and a
  new rulesets release line.
- Preserve settings, filter selections, user rules, custom filters and the
  allowlist during upgrade. Existing invalidation may rebuild derived caches
  automatically; user data must survive without manual cleanup.
- Validate the full Edge package and upgrade behavior on artifacts built from
  the actual publishing branches before rollout.
