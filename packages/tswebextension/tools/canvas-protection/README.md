# Verify canvas protection in browsers

Use this guide to compare native behavior with the actual built package in
loaded test extensions.

## Prepare the test environment

1. Obtain explicit permission for browser work in the current task before
   launching browser-backed checks. Use only dedicated headless test profiles;
   do not attach personal profiles, tabs or unrelated browser processes.
2. Use the repository's Node.js 22+ and pnpm 10.33.4 environment. Build from the
   repository root, including dependencies:

   ```sh
   pnpm exec lerna run build --scope=@adguard/tswebextension --include-dependencies
   ```

3. Use the installed Playwright Chromium runtime. For Firefox, provide a
   compatible Nightly binary using `CANVAS_FIREFOX_BINARY` if the harness's
   recorded `output-canvas-protection/firefox-lifetime/Firefox Nightly.app`
   does not exist. Install `geckodriver` on the test machine and use the
   repository's `web-ext` dependency. Lifecycle checks require a Firefox test
   distribution that permits the permanent unsigned fixture XPI.
4. Allow user scripts and applicable hosts for the Chromium fixture extension.
   On Chrome 138+ the control is Allow User Scripts; earlier Chrome versions
   use Developer mode. Allow the fixture extension in private/incognito windows
   in each browser. Let the harness operate these controls only in its owned
   profile, and inspect the API/readback evidence. Missing prerequisites are
   failures or unavailable capabilities, not passing protection cases.
5. Inspect existing canvas harness processes and reports before starting another
   run. Preserve a prior `report.json` and its log because the suite's report
   path is reused. Run benchmarks serially without concurrent builds, lint or
   browser workloads, and disclose any accidental overlap.

## Run native-wrapper controls

From the package directory, install the locked browser runtimes and run the
complete native project:

```sh
pnpm exec playwright install chromium firefox
pnpm exec vitest run --project canvas-native
```

For headless Linux without a GPU/display, provide Mesa EGL (`libegl1`,
`libegl-mesa0` and `libgl1-mesa-dri` on Debian/Ubuntu) and set
`MOZ_WEBGL_FORCE_EGL=1`. The native Firefox instance enables its real WebGL
backend. The repository Docker test stage supplies this environment; it keeps
both browsers and all assertions. Packed consumer fixtures are compiled by
their own strict TypeScript project after the package tarball is installed.

This project executes browser-native and wrapper comparisons. It does not
load the production consumer extension or establish registration, startup,
private-window or host-permission coverage. Record the actual browser version
and runner. A default runtime's failure remains a failure; an independently
audited alternative runtime is a separate reference, not a passed default
command. Preserve original failures and unmodified assertions.

## Run the built extension suites

From the package directory, select one browser and one suite per command:

```sh
pnpm exec tsx tools/canvas-protection/run-extension-tests.ts --browser chromium --suite engine
pnpm exec tsx tools/canvas-protection/run-extension-tests.ts --browser firefox --suite engine
pnpm exec tsx tools/canvas-protection/run-extension-tests.ts --browser chromium --suite lifecycle
pnpm exec tsx tools/canvas-protection/run-extension-tests.ts --browser firefox --suite lifecycle
pnpm exec tsx tools/canvas-protection/run-extension-tests.ts --browser chromium --suite benchmark
pnpm exec tsx tools/canvas-protection/run-extension-tests.ts --browser firefox --suite benchmark
```

For delivery-only diagnostics, select `--suite delivery`. Delivery probes do
not establish pixel/noise behavior. The engine, lifecycle and benchmark suites
bundle the actual MV2/MV3 `dist` entry, use public configuration methods, and
record artifact hashes and genuine registration results. Do not substitute
synthetic page injection, unit mocks or a `scripting.registerContentScripts`
probe for `userScripts` evidence.

Read `output-canvas-protection/<browser>-<suite>/report.json` and the command's
exit code. Preserve the report and log with its runtime, executable, profile,
hardware, artifact hashes, commands and failures. Engine/lifecycle failures
cannot be waived by a passing benchmark or delivery-only probe.

## Check the observable boundaries

- Compare ordinary supported 2D raw/decoded PNG output against the independent
  source-coordinate oracle. Check unchanged source state and actual native
  conversions, failures, callback timing/count, MIME and quality.
- Compare ordinary WebGL/non-2D HTML exports with native-only owner controls.
  They expose native fingerprints even within bounds; do not count them as
  protected diversification. Keep transferred WebGL HTML exports in the
  protected path. Compare their decoded layouts to the independent native
  representation around the same protected source bitmap.
- Exercise both original attribute axes around 32767, the inclusive area
  predicate at 268435456, small crops from oversized originals and attribute
  crossings caused by actual argument conversion. Native-only allocation
  probes and predicate tests do not establish production wrapper behavior or
  browser allocation throughout the size domain. Preserve native failures.
- Classify actual returned color space/pixel format separately from requested
  options. An ignored P3/float16 request returning uint8 is not P3/float16 proof.
- Correlate lifecycle operations and the selected document's URL/time origin
  with its first read, registration acknowledgment and generation. Capture
  preack, fresh postack and reload/navigation results without replacing an
  absent page context with current background state.

Keep the three intervals separate: Chromium access restoration may run a
previous snapshot until reconciliation; running-browser registration loss may
leave new documents native until reinstallation; ordinary Firefox cold startup
may leave restored/new documents native until current registration is
acknowledged. No maximum duration is promised, and later installation cannot
undo exposure. Earlier native captures need reload/navigation. Fresh supported
postack documents must pass early first-inline checks. An active acknowledged
Chromium registration must also work with a stopped worker.

## Interpret benchmark results

Record native/protected median and p95 for raw/URL/Blob APIs at 256×128,
1024×1024 and 4096×4096. Preserve all samples and callback evidence. Report the
actual browser process-tree sampled RSS baseline/maximum/delta separately
from latency. RSS covers navigation/setup, all APIs and allocator history,
not an isolated scratch allocation. A baseline-only row cannot establish a
transient peak; zero sampled growth does not prove zero overhead. State
hardware and concurrent work. There is no predetermined performance budget.
