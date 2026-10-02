# Canvas protection policy contract

The MV2 root export and the MV3 `@adguard/tswebextension/mv3` export expose the
same canvas contracts, validator and code factory. Browser-specific application
classes own registration. [Capabilities](canvas-protection-capabilities.md)
records readout, version, frame and lifecycle limits.

## Configuration and methods

`settings.stealth.protectCanvas?: boolean` is optional and defaults to disabled
when omitted. Protection requires it, `settings.stealthModeEnabled` and
`settings.filteringEnabled` to be true. Existing consumers omitting canvas
configuration retain native behavior and the existing result shape.

`canvasProtectionPolicy?: ProtectionPolicyArtifact` is a top-level
configuration field. Requested enablement without a prepared artifact returns
unavailable; it does not silently create a policy. An explicit artifact with
empty exclusion arrays expresses protection of delivered supported documents
without policy exclusions. Existing filters, rules and allowlist are not
automatically compiled into that artifact.

Both application classes expose:

- `setCanvasProtectionEnabled(enabled: boolean): Promise<RegistrationResult>`
  changes the canvas setting without rotating the session seed.
- `setCanvasProtectionPolicy(policy: ProtectionPolicyArtifact): Promise<RegistrationResult>`
  validates and replaces prepared policy without rotating the seed.
- `reconcileCanvasProtection(): Promise<RegistrationResult>` retries the latest
  persisted seed-free request against current browser access.
- `getCanvasProtectionState(): RegistrationResult` returns the current known
  request/acknowledgment state; it is not a live probe of every document.

The setters require an existing application configuration. `start()` and
`configure()` can return an optional `canvasProtection` result. Stopping the
application removes its registration but does not rewrite existing documents.

## Prepared artifact

`ProtectionPolicyArtifact` has these readonly fields:

| Field | Contract |
| --- | --- |
| `schemaVersion` | Literal `1` |
| `revision` | Nonempty producer revision, independent of seed identity |
| `browser` | `chromium-mv3` or `firefox-mv2`, matching the registration adapter |
| `selectors.matches` | Native browser URL match patterns selecting candidate documents |
| `selectors.excludeMatches` | Native exclusions only where they exactly preserve policy semantics |
| `ownFrameExclusions` | Exact prepared local exclusions with explicit request masks |
| `documentExclusions` | Exact top-document exclusions; children inherit only genuinely captured trusted context |
| `unavailableConditions` | Concrete nonempty reasons for unsupported conditions |

Native selectors may overselect candidates for exact synchronous predicates;
they must not omit documents that require protection. A complex exception
must not be approximated by excluding its whole hostname.
`protectionPolicyArtifactValidator.parse(input)` validates genuinely external
JSON once with the existing schema. Malformed trusted downstream data fails
loudly rather than silently defaulting or disappearing.

Each `PreparedPolicyRule` has `requestTypes: ('document' | 'subdocument')[]`
and a `condition: PreparedCondition`:

| Condition | Fields and meaning |
| --- | --- |
| `url-regexp` | `input`: frame/top/source URL selector; `pattern`: valid regex; `flags`: `''` or `'i'` |
| `and`, `or` | `operands`: prepared conditions, combined with three-state semantics |
| `not` | `operand`: negate an available result; unavailable stays unavailable |
| `unavailable` | `reason`: nonempty explanation of unavailable exact evaluation |

`url-regexp.input` is exactly `frame-url`, `top-url` or `source-url`.

Rules applicable to the current request type are combined as exclusions.
A decisive false in `and`, or true in `or`, can determine the result despite an
unavailable sibling. Unknown data otherwise remains unavailable, never an
invented match/nonmatch. Conditions are evaluated before canvas/masking hooks;
known exclusions retain native methods.

## Document inputs and immutable provenance

`Available<T>` is either `{ status: 'available', value: T }` or
`{ status: 'unavailable', reason: string }`.
`DocumentPolicyInput` carries the exact own `url`, `requestType`,
`sourceUrl: Available<string>` and
`inheritedTop: Available<InheritedTopContext>`.

A source URL means genuine request-source information, not an inferred
`document.referrer`. Captured top context independently records availability
of `documentExcluded`, `allowlistExcluded`, `site`, `policyRevision` and
`capturedGeneration`. Its site includes complete key, source URL and
`top-derived`/`frame-local` mode.

`DocumentProtectionContext` records `outcome` (`enabled`, `disabled`,
`excluded` or `unsupported`), `enabled`, `excluded`, captured gates, policy
revision, session generation, site, provenance and unavailable-condition
reasons. Enablement and completeness of inherited/source information are
independent. The production bootstrap has no authenticated top-context bridge;
same-origin children also use D2 when their own complete hostname is available.
Known local/available-source exclusions still apply. Unknown inherited/source
conditions stay explicit; no late message upgrades an existing document.

When trusted synchronous inherited input is supplied, its actual revision and
generation remain separate from the child's current installed snapshot.
Revision/generation skew is not relabeled. Synthetic inherited-input fixtures
do not prove production inheritance. A document created without hooks during
registration loss or Firefox cold startup has no captured protection revision
or generation; current background state cannot supply one retroactively.

## Registration result and retry boundary

`RegistrationResult` contains:

- `requested`: all three requested gates and `revision`; only `revision` is
  `null` without an artifact. The persistent request contains no seed.
- `installed`: availability of the last acknowledged revision and generation.
- `operations`: `check`, `register`, `update` or `unregister` outcomes, each
  `succeeded` or `failed`, with a reason where applicable.
- `status`: `disabled`, `installed`, `unavailable` or `failed`. Unavailable
  includes concrete `reason` and `requiredUserAction`; failed includes `reason`
  and may include a required action.

An unavailable or failed request is not installed merely because a previous
installed summary is available. Operations are serialized and acknowledgment
follows browser API success and session readiness. Chromium prefers updating
its registration. Missing policy, denied API access, failed operations and
pending requested changes remain visible to the consumer.

Three separate intervals apply. On **Chromium access restoration**, stored
prior code can reactivate until successful reconciliation of the latest
request. During **running-browser registration loss**, extension reload/update
or Firefox owner unload can leave new documents native until successful
reinstallation. During **ordinary Firefox cold startup**, restored and new
documents may retain native methods until successful current registration.
None has a guaranteed maximum duration. Native exposure is not undone later;
old documents require reload/navigation after acknowledgment. Explicit
`reconcileCanvasProtection()` or existing application lifecycle calls retry
when the extension context and access are available. There is no promised
automatic access event or Firefox background wakeup. Saved installed state
cannot prove that a removed registration is active.

Fresh supported documents after acknowledgment capture the exact latest
request, with early MAIN-world hooks when enabled. Active acknowledged
Chromium registrations must still deliver before first inline code with a
stopped worker. Detailed event/version evidence and session resets are in the
[capability reference](canvas-protection-capabilities.md#generations-and-registration-intervals).

## Standalone code factory

`createCanvasProtectionCode(snapshot: CanvasBootstrapSnapshot): string` returns
self-contained MAIN-world code from the bundled engine. The trusted snapshot
contains `session: ProtectionSession` (root and generation, each 16-byte hex),
all three gates and the prepared policy. Serialization escapes script-sensitive
characters. No pre-existing snapshot file, remote code, page bridge or exposed
extension privileges are required. The application registration path owns
session initialization; consumers must not place root/site seeds in page
properties, callbacks, DOM nodes, messages, logs or web storage.

This factory does not widen coverage: ordinary 2D and transferred HTML exports
are protected only within the shared original-attribute size and actual-mode
domain. Ordinary non-2D HTML exports stay original-native. Transferred native
serializer layouts may differ around one protected source bitmap; ordinary
2D raw/PNG equality stays exact. See the
[readout reference](canvas-protection-capabilities.md#readout-coverage).

## Future policy producer obligations

The filter-policy producer is a separate integration. It must preserve active
filters, enabled user rules and `badfilter`, normal/inverted allowlisting,
Document/SubDocument masks, standalone frame exceptions and genuinely
available inherited document decisions. Protocol, hostname, path/query, regex,
IP/IDN, port, source/target domain, case, anchors, percent encoding and modifier
semantics must remain exact. Set operations such as `to`/`denyallow` and
special-frame origin fallback cannot be approximated with broad host rules.
Unavailable top/source dependencies need explicit reasons.

The [prepared policy fixtures][prepared-policy-fixtures]
and [policy tests][prepared-policy-tests] are
executable examples of consumption. They do not implement filter-text parsing,
a completed compiler, settings UI or a knowledge-base integration.

[prepared-policy-fixtures]:
  <https://github.com/AdguardTeam/tsurlfilter/blob/master/packages/tswebextension/test/lib/common/canvas-protection/fixtures/prepared-policies.ts>

[prepared-policy-tests]:
  <https://github.com/AdguardTeam/tsurlfilter/blob/master/packages/tswebextension/test/lib/common/canvas-protection/policy.test.ts>
