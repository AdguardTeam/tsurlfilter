# Canvas protection capabilities

This reference describes the bounded, opt-in canvas readout protection in
`@adguard/tswebextension`. The [policy contract](canvas-protection-policy-contract.md)
records activation and registration results. Protection does not prevent all
fingerprinting or hide that an extension installed wrappers.

## Readout coverage

The protected APIs are `CanvasRenderingContext2D.getImageData()`,
`HTMLCanvasElement.toDataURL()` and `HTMLCanvasElement.toBlob()`.
Drawing operations and the source bitmap remain unchanged. The two HTML
exports are protected for an ordinary canvas owned by a 2D context, and for a
placeholder transferred to an OffscreenCanvas, including transferred WebGL
sources. Direct OffscreenCanvas APIs and worker APIs are outside this scope.

- **Ordinary non-2D owner gap:** HTML exports from directly owned WebGL1,
  WebGL2, `bitmaprenderer` and other non-2D contexts, including WebGPU where
  available, call the original native exporter. Even a small, fully opaque,
  default-mode canvas inside the size domain can expose its native fingerprint.
  This gap is separate from unwrapped `WebGLRenderingContext.readPixels()`.
- **Size domain:** both original native HTML canvas attributes must be at most
  **32767**, and their product must be at most **268435456**, inclusively.
  These are the attributes at the readout/snapshot boundary after actual
  argument conversion and its page effects. The same bounds apply to all three
  APIs. A small `getImageData()` crop of an oversized original stays native and
  can expose its native fingerprint. Overridden page properties, crop/output
  sizes, encoded PNG dimensions and WebGL drawing-buffer sizes do not determine
  eligibility.
- **Browser limits:** allocation, security and export failures remain native.
  Membership in the engine's size domain is not a guarantee that the browser
  can allocate or export that bitmap. Boundary-predicate tests are not evidence
  that every in-domain allocation works.
- **Readout modes:** protection covers actual default 8-bit sRGB readouts.
  Actual float16, nondefault color spaces and unconfirmed modes remain native.
  Merely requesting float16 for a source context does not exclude a supported
  default uint8 readout. Failed in-domain preparation is not a new mode gap or
  permission to silently return native output.
- **Pixels:** only in-bounds opaque pixels are eligible. Transparent pixels,
  semitransparent pixels, alpha and padding retain native values. Each eligible
  pixel has a fixed 1/16 selection probability; 6.25% is an expected density,
  not a quota or a promise that a small bitmap changes. One RGB channel changes
  by one, with equal increase/decrease probability for values 1–254, +1 at 0
  and −1 at 255. The site seed, absolute source coordinates and original RGB
  determine the result, independently of API, crop, call order and revision.

Ordinary supported HTML 2D raw pixels and decoded lossless PNG exports agree
exactly at common opaque pixels. Transferred placeholders have a separate
native representation boundary: both exports protect one source-coordinate
bitmap, but independently demonstrated native serializer layouts, dimensions
or clipping can differ between APIs. Expected output follows the selected
native representation of that protected bitmap. This is not a native-only
mode, a bounds exclusion or protection of OffscreenCanvas methods. Unverified
transferred representations are not certified by a result for another browser.

## Delivery and version evidence

The actual built consumer engine and lifecycle suites passed on the following
named headless runtimes on macOS arm64. The fixture pages used loopback HTTP;
these runs do not establish HTTPS coverage or a minimum supported version.

| Runtime | Loaded consumer evidence | Scope |
| --- | --- | --- |
| Chromium 147.0.7727.15 | Engine 10; lifecycle 12 | Unpacked MV3; `userScripts`, MAIN world |
| Chromium 153.0.8010.12 | Engine 10; lifecycle 12 | Standard Playwright 1.63.0; unpacked MV3 |
| Firefox Nightly 159.0a1 | Engine 9; lifecycle 11 | MV2 `contentScripts`, MAIN; permanent unsigned lifecycle XPI |
| Firefox 155 / Playwright-core 1.63.0 | Native-wrapper suite | Audited reference, not loaded-extension evidence |
| Earlier Firefox 148 runner | Native-padding failures | Historical failures, not feature-support evidence |

The built suites cover 100 ordinary 2D fixtures with repeated reads and 100
resolved site contexts, owner controls, transferred source/alpha controls,
actual readout modes, both axis bounds and post-conversion crossings. Native
and protected outputs are compared against independent expected output, not
against another protected API alone. The 24 Firefox requested P3/float16 rows
returned actual default uint8 data: these are not proof of actual P3 or float16
support. Actual mode evidence is separate from requested options.

Chromium 147 used Playwright browser build 1217; Chromium 153 uses build 1243.
Firefox Nightly used build 20260930214513. The standard native test runner uses
Playwright 1.63.0 with Chromium 153 and Firefox 155. Linux CI enables genuine
headless Firefox WebGL through Mesa EGL; this test backend is not a new
product support or version boundary.

Session storage has an API floor of Chrome 102+ MV3 and Firefox 115+ including
MV2. Firefox's `contentScripts.register.world` field has an API floor of 128.
Neither API floor is a verified minimum for this complete feature. Older
versions and other browser/extension distribution paths remain unverified.

Chromium requires `userScripts`, applicable host permissions and user enablement:
Allow User Scripts on Chrome 138+, Developer mode on earlier versions. API
access is tested by calling the API, not by checking whether a namespace exists.
Firefox requires `contentScripts.register`, session storage and a live
registering background context. Private/incognito windows require the user's
extension permission. This feature does not grant any permission itself.

## Documents and frame context

Native selectors select each document URL. `allFrames` does not add inherited
origin fallback. The production bootstrap has no page bridge and no
authenticated captured top policy or generation, including in same-origin
children. A delivered child with a complete own hostname therefore uses the
**frame-local fallback (D2)**. It applies exact local and genuinely available
source predicates before hooks, records unknown inherited/source conditions
as unavailable, and does not later change its captured context.

| Document or condition | Behavior and evidence boundary |
| --- | --- |
| Delivered top HTTP document | Own URL/site/predicates; postack first-inline protection verified |
| Same/cross-origin, sandboxed HTTP, no-referrer child | Frame-local D2; no inherited-policy claim |
| Detached delivered frame | Retains its captured methods and context |
| Missing host permission or unmatched selector | No injection; no protected first-read claim |
| `about:blank`, `about:srcdoc`, `data:`, `blob:` | No supported complete-own-host delivery |
| Restricted browser URL | Absent injection; restricted-page observations do not establish first-inline timing |
| Allowed private window | Shared normal/private root/generation; intentional same-site correlation |
| Source/top data unavailable | Explicit unavailable provenance; no guesses or late upgrade |
| HTTPS, other versions/distributions | Not established by the named HTTP fixture matrix |

The site key ignores scheme and port, strips one leading `www.` and one
trailing dot, and retains the complete host for IP/credential URLs.
`example.com` and `www.example.com` share a key; `a.example.com` and
`b.example.com`, or `a.github.io` and `b.github.io`, do not. There is no new
registrable-domain or public-suffix partitioning. Synthetic trusted-top policy
tests validate the contract, not production inheritance.

## Generations and registration intervals

`browser.storage.session` owns one root/generation per browser profile/run,
shared between normal and private browsing. Worker/background restarts that
retain this store, settings/policy updates and closing a window while the
browser remains running do not rotate it. Full shutdown/startup, extension
reload/version update and disable/re-enable reset it. Unloading Firefox's
registering page alone does not rotate a retained session root.

Acknowledgment means successful browser registration after session readiness.
During replacement, an already installed snapshot can remain in use until
acknowledgment. Newly created supported documents after acknowledgment capture
the current decision and generation before their first inline script. Existing
documents keep their own captures until reload/navigation.

Three distinct delivery intervals limit that guarantee:

1. **Chromium access restoration:** revoking user-script access leaves stored
   registrations. Restoring it can reactivate the prior snapshot before
   successful reconciliation, including stale enabled/excluded decisions.
   Requested changes remain pending. Existing lifecycle calls or
   `reconcileCanvasProtection()` retry the latest request; there is no promised
   automatic restoration event or maximum delay. Earlier documents require
   reload/navigation after acknowledgment.
2. **Registration loss while the browser runs:** extension reload/update or
   unloading Firefox's registering background can remove hooks for new
   documents until successful reinstallation. Native fingerprints can already
   be exposed. A saved installed summary does not prove that registration is
   still active. Initialization/lifecycle calls or explicit consumer retry
   reinstall when the context is available; automatic wakeup and bounded delay
   are not promised. Earlier native captures require reload/navigation.
3. **Ordinary Firefox cold startup:** restored and newly opened documents may
   capture native methods from browser startup until the current registration
   is successfully acknowledged. There is no guaranteed maximum duration.
   Later installation cannot undo native exposure or replace those captures;
   reload/navigation is required. Fresh supported documents after acknowledgment
   retain strict first-inline protection with the new session generation.

These intervals do not excuse stopped-worker Chromium delivery when an active
acknowledged registration remains installed. They do not generalize to every
browser or delivery failure. The cold-start result describes the selected
Firefox channel, not the impossibility of all alternative channels. The named
lifecycle runs correlate actual operation, selected document URL/time origin,
first read and API acknowledgment; their success does not certify another
installation path or version-update distribution.

## Native behavior and detectability

Native receiver/arity validation, argument conversion order, thrown-value
identity, callback validation/count/timing, call-time `toBlob()` snapshots,
MIME/quality behavior and observable source state are preserved.
Firefox native-generated diagnostics for failed object-to-primitive conversion
have a narrow exception: native error formatting and its diagnostic page
effects can differ. Actual conversion receiver/order/count and any value thrown
by conversion remain exact. The selected native API is called once; no
successful export callback is produced. Native-requested reflection receives
the original value, and a propagating formatter-thrown value is not copied or
rewritten. This exception does not cover successful conversion followed by
numeric/range validation, receiver/arity errors, security or range errors.

Masking covers same-realm name, length, keys, constructibility, descriptors and
both stringification paths. The following are comparison probes, not a promise
of universal invisibility:

```js
const method = HTMLCanvasElement.prototype.toDataURL;
method.toString();
Function.prototype.toString.call(method);
Object.getOwnPropertyDescriptor(HTMLCanvasElement.prototype, 'toDataURL');
Reflect.ownKeys(method);
```

A seed-free own-realm marker is discoverable as
`window.__adguardCanvasInstallation` and
`window[Symbol.for('adguard.canvas.installation')]`. It records outcome and
method references for idempotence, not root/site seeds or authenticated top
policy. Root/site seeds remain in private closures and extension session
storage, never page callbacks, DOM nodes, messages or web storage. Canvas data
is not sent to telemetry. Borrowed natives from other realms, direct WebGL,
OffscreenCanvas and other fingerprinting surfaces remain separate vectors.

## Performance evidence

Measurements used Apple M4 Max, 38,654,705,664 bytes RAM, macOS Darwin 25.6.0,
headless Chromium 147 and Firefox Nightly 159. Each browser measured native and
protected raw/URL/Blob latency at 256×128, 1024×1024 and 4096×4096, including
median, p95 and sampled browser-process-tree resident memory (RSS).

The accepted Chromium 4096×4096 protected medians were 7817.2/7486.9/7496.8 ms;
Firefox's were 11279/11605/13484 ms. This is material overhead, not a release
performance budget or an optimization claim. Chromium's protected 4096 workload
overlapped two approximately one-second ESLint jobs; all samples are retained
and the machine is not described as idle. RSS spans navigation/setup, all APIs
and allocator history; zero sampled growth does not establish zero allocation.
Firefox's 24 ms native 256×128 row has one baseline RSS sample, so its actual
peak remains unresolved. Full raw samples and provenance belong to the saved
implementation evidence; the [harness guide][canvas-harness]
describes reproduction.

[canvas-harness]:
  <https://github.com/AdguardTeam/tsurlfilter/blob/master/packages/tswebextension/tools/canvas-protection/README.md>
