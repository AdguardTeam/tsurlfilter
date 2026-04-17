FROM adguard/node-ssh:22.17--0 AS base
SHELL ["/bin/bash", "-lc"]

RUN npm install -g pnpm@10.7.0

WORKDIR /tsurlfilter

ENV PNPM_STORE=/pnpm-store
# Disable Nx daemon in Docker: each RUN step is a fresh process, and the daemon
# socket from a previous stage would cause Nx to hang for 120 s before failing.
ENV NX_DAEMON=false

# ============================================================================
# Stage: deps
# Cached until package.json/pnpm-lock.yaml changes
# ============================================================================
FROM base AS deps

COPY pnpm-lock.yaml pnpm-workspace.yaml ./

# Copy all package.json files needed for workspace resolution
COPY package.json ./
COPY packages/logger/package.json ./packages/logger/
COPY packages/css-tokenizer/package.json ./packages/css-tokenizer/
COPY packages/agtree/package.json ./packages/agtree/
COPY packages/tsurlfilter/package.json ./packages/tsurlfilter/
COPY packages/tswebextension/package.json ./packages/tswebextension/
COPY packages/dnr-rulesets/package.json ./packages/dnr-rulesets/
COPY packages/adguard-api/package.json ./packages/adguard-api/
COPY packages/adguard-api-mv3/package.json ./packages/adguard-api-mv3/
COPY packages/eslint-plugin-logger-context/package.json ./packages/eslint-plugin-logger-context/
COPY packages/examples/adguard-api/package.json ./packages/examples/adguard-api/
COPY packages/examples/adguard-api-mv3/package.json ./packages/examples/adguard-api-mv3/
COPY packages/examples/tswebextension-mv2/package.json ./packages/examples/tswebextension-mv2/
COPY packages/examples/tswebextension-mv3/package.json ./packages/examples/tswebextension-mv3/
COPY packages/benchmarks/agtree-benchmark/package.json ./packages/benchmarks/agtree-benchmark/
COPY packages/benchmarks/agtree-browser-benchmark/package.json ./packages/benchmarks/agtree-browser-benchmark/
COPY packages/benchmarks/css-tokenizer-benchmark/package.json ./packages/benchmarks/css-tokenizer-benchmark/
COPY packages/benchmarks/tsurlfilter-benchmark/package.json ./packages/benchmarks/tsurlfilter-benchmark/

# --ignore-scripts is safe here: this monorepo has no native / postinstall deps.
# The flag skips only lifecycle scripts (husky prepare, etc.) which are
# unnecessary inside Docker and would otherwise require a full git history.
RUN --mount=type=cache,target=/pnpm-store,id=tsurlfilter-pnpm \
    pnpm config set store-dir /pnpm-store && \
    pnpm install --frozen-lockfile --ignore-scripts

# ============================================================================
# Stage: source-base
# Root-level configs and scripts (rarely change). Used as the foundation for
# both the per-level source stages below and the utility `source` stage.
# ============================================================================
FROM deps AS source-base

# NOTE: This list must be kept in sync manually. If you add a new root-level
# config file (e.g. .prettierrc, turbo.json, tsconfig.base.json), add it here
# as well — otherwise the build may silently use wrong or missing configs.
COPY nx.json lerna.json vitest.config.ts .eslintignore ./
COPY scripts/ ./scripts/
COPY bamboo-specs/scripts/ ./bamboo-specs/scripts/

# ============================================================================
# Stage: source
# Full source copy for utility stages that need all files
# (increment-*, update-*, dnr-rulesets-auto-build).
# The main test/build chain uses per-level source stages below instead.
# ============================================================================
FROM source-base AS source

COPY packages/ ./packages/

# ============================================================================
# Build layers following the dependency hierarchy.
# Source is copied just-in-time before each build step so that a change in a
# higher-level package (e.g. tswebextension) does not invalidate the Docker
# layer cache for lower-level packages (e.g. logger, agtree, tsurlfilter).
#
# Dependency tree (see README.md for full details):
#   source-leaf-packages:      logger + css-tokenizer + eslint-plugin (leaf packages, no workspace deps)
#   source-with-agtree:        agtree (depends on css-tokenizer)
#   source-with-tsurlfilter:   tsurlfilter (depends on agtree, css-tokenizer)
#   source-with-tswebextension: tswebextension (depends on tsurlfilter, agtree, logger)
#
# Stages that need packages outside this chain (e.g. dnr-rulesets, adguard-api)
# add their own COPY statements directly after FROM.
# NOTE: If a package gains a new workspace dependency, update the corresponding
# COPY blocks in the affected test/build stages manually.
# ============================================================================

FROM source-base AS source-leaf-packages
COPY packages/logger/ ./packages/logger/
COPY packages/css-tokenizer/ ./packages/css-tokenizer/
COPY packages/eslint-plugin-logger-context/ ./packages/eslint-plugin-logger-context/

FROM source-leaf-packages AS built-css-tokenizer-and-logger
RUN --mount=type=cache,target=/pnpm-store,id=tsurlfilter-pnpm \
    pnpm config set store-dir /pnpm-store && \
    npx lerna run build --scope @adguard/logger --scope @adguard/css-tokenizer

FROM built-css-tokenizer-and-logger AS source-with-agtree
COPY packages/agtree/ ./packages/agtree/

FROM source-with-agtree AS built-agtree
RUN --mount=type=cache,target=/pnpm-store,id=tsurlfilter-pnpm \
    pnpm config set store-dir /pnpm-store && \
    npx lerna run build --scope @adguard/agtree

FROM built-agtree AS source-with-tsurlfilter
COPY packages/tsurlfilter/ ./packages/tsurlfilter/

FROM source-with-tsurlfilter AS built-tsurlfilter
RUN --mount=type=cache,target=/pnpm-store,id=tsurlfilter-pnpm \
    pnpm config set store-dir /pnpm-store && \
    npx lerna run build --scope @adguard/tsurlfilter

FROM built-tsurlfilter AS source-with-tswebextension
COPY packages/tswebextension/ ./packages/tswebextension/

FROM source-with-tswebextension AS built-tswebextension
RUN --mount=type=cache,target=/pnpm-store,id=tsurlfilter-pnpm \
    pnpm config set store-dir /pnpm-store && \
    npx lerna run build --scope @adguard/tswebextension

# ============================================================================
# Test stages
#
# Test stages must not be cached. The Bamboo JUnit parser rejects XML files
# whose mtime predates the task start time. TEST_RUN_ID is written to /out/
# so that the output directory always differs between builds — preventing
# BuildKit from serving a cached COPY --from layer with stale timestamps.
# However, on re-runs of the same build, TEST_RUN_ID (= buildNumber) is
# identical, so Docker may serve cached output with old mtimes. CI job
# scripts touch the extracted XML files after `docker build --output` to
# ensure Bamboo always accepts them.
# ============================================================================

# ============================================================================
# Stage: test-logger
# Runs test:prod (lint + smoke + test:ci) for @adguard/logger
# ============================================================================
FROM built-css-tokenizer-and-logger AS test-logger

ARG TEST_RUN_ID

RUN --mount=type=cache,target=/pnpm-store,id=tsurlfilter-pnpm \
    pnpm config set store-dir /pnpm-store && \
    mkdir -p /out/tests-reports && \
    echo "${TEST_RUN_ID}" > /out/.test-run-id && \
    set +e; \
    ./bamboo-specs/scripts/timeout-wrapper.sh 600s sh -c \
      'cd packages/logger && pnpm test:prod'; \
    EXIT_CODE=$?; \
    ./bamboo-specs/scripts/copy-test-reports.sh packages/logger; \
    echo ${EXIT_CODE} > /out/exit-code.txt; \
    exit 0

FROM scratch AS test-logger-output
COPY --from=test-logger /out/ /

# ============================================================================
# Stage: test-css-tokenizer
# Runs test:prod (lint + smoke + test:ci) for @adguard/css-tokenizer
# ============================================================================
FROM built-css-tokenizer-and-logger AS test-css-tokenizer

ARG TEST_RUN_ID

RUN --mount=type=cache,target=/pnpm-store,id=tsurlfilter-pnpm \
    pnpm config set store-dir /pnpm-store && \
    mkdir -p /out/tests-reports && \
    echo "${TEST_RUN_ID}" > /out/.test-run-id && \
    set +e; \
    ./bamboo-specs/scripts/timeout-wrapper.sh 600s sh -c \
      'cd packages/css-tokenizer && pnpm test:prod'; \
    EXIT_CODE=$?; \
    ./bamboo-specs/scripts/copy-test-reports.sh packages/css-tokenizer; \
    echo ${EXIT_CODE} > /out/exit-code.txt; \
    exit 0

FROM scratch AS test-css-tokenizer-output
COPY --from=test-css-tokenizer /out/ /

# ============================================================================
# Stage: test-eslint-plugin-logger-context
# Runs test:prod (lint) for @adguard/eslint-plugin-logger-context
# ============================================================================
FROM built-css-tokenizer-and-logger AS test-eslint-plugin-logger-context

ARG TEST_RUN_ID

RUN --mount=type=cache,target=/pnpm-store,id=tsurlfilter-pnpm \
    pnpm config set store-dir /pnpm-store && \
    mkdir -p /out/tests-reports && \
    echo "${TEST_RUN_ID}" > /out/.test-run-id && \
    set +e; \
    ./bamboo-specs/scripts/timeout-wrapper.sh 600s sh -c \
      'cd packages/eslint-plugin-logger-context && pnpm test:prod'; \
    EXIT_CODE=$?; \
    ./bamboo-specs/scripts/copy-test-reports.sh packages/eslint-plugin-logger-context eslint-plugin-logger-context; \
    echo ${EXIT_CODE} > /out/exit-code.txt; \
    exit 0

FROM scratch AS test-eslint-plugin-logger-context-output
COPY --from=test-eslint-plugin-logger-context /out/ /

# ============================================================================
# Stage: test-agtree
# Runs test:prod (lint + smoke + test:ci) for @adguard/agtree
# ============================================================================
FROM built-agtree AS test-agtree

ARG TEST_RUN_ID

RUN --mount=type=cache,target=/pnpm-store,id=tsurlfilter-pnpm \
    pnpm config set store-dir /pnpm-store && \
    mkdir -p /out/tests-reports && \
    echo "${TEST_RUN_ID}" > /out/.test-run-id && \
    set +e; \
    ./bamboo-specs/scripts/timeout-wrapper.sh 600s sh -c \
      'cd packages/agtree && pnpm test:prod'; \
    EXIT_CODE=$?; \
    ./bamboo-specs/scripts/copy-test-reports.sh packages/agtree; \
    echo ${EXIT_CODE} > /out/exit-code.txt; \
    exit 0

FROM scratch AS test-agtree-output
COPY --from=test-agtree /out/ /

# ============================================================================
# Stage: test-tsurlfilter
# Runs test:prod (lint + smoke + test:ci) for @adguard/tsurlfilter
# ============================================================================
FROM built-tsurlfilter AS test-tsurlfilter

ARG TEST_RUN_ID

RUN --mount=type=cache,target=/pnpm-store,id=tsurlfilter-pnpm \
    pnpm config set store-dir /pnpm-store && \
    mkdir -p /out/tests-reports && \
    echo "${TEST_RUN_ID}" > /out/.test-run-id && \
    set +e; \
    ./bamboo-specs/scripts/timeout-wrapper.sh 600s sh -c \
      'cd packages/tsurlfilter && pnpm test:prod'; \
    EXIT_CODE=$?; \
    ./bamboo-specs/scripts/copy-test-reports.sh packages/tsurlfilter; \
    echo ${EXIT_CODE} > /out/exit-code.txt; \
    exit 0

FROM scratch AS test-tsurlfilter-output
COPY --from=test-tsurlfilter /out/ /

# ============================================================================
# Stage: test-tswebextension
# Runs test:prod (lint + smoke + test:ci) for @adguard/tswebextension
# ============================================================================
FROM built-tswebextension AS test-tswebextension

ARG TEST_RUN_ID

RUN --mount=type=cache,target=/pnpm-store,id=tsurlfilter-pnpm \
    pnpm config set store-dir /pnpm-store && \
    mkdir -p /out/tests-reports && \
    echo "${TEST_RUN_ID}" > /out/.test-run-id && \
    set +e; \
    ./bamboo-specs/scripts/timeout-wrapper.sh 600s sh -c \
      'cd packages/tswebextension && pnpm test:prod'; \
    EXIT_CODE=$?; \
    ./bamboo-specs/scripts/copy-test-reports.sh packages/tswebextension; \
    echo ${EXIT_CODE} > /out/exit-code.txt; \
    exit 0

FROM scratch AS test-tswebextension-output
COPY --from=test-tswebextension /out/ /

# ============================================================================
# Stage: test-dnr-rulesets
# Runs test:prod (lint + smoke + test:ci) for @adguard/dnr-rulesets
# ============================================================================
FROM built-tsurlfilter AS test-dnr-rulesets

COPY packages/dnr-rulesets/ ./packages/dnr-rulesets/

ARG TEST_RUN_ID

RUN --mount=type=cache,target=/pnpm-store,id=tsurlfilter-pnpm \
    pnpm config set store-dir /pnpm-store && \
    mkdir -p /out/tests-reports && \
    echo "${TEST_RUN_ID}" > /out/.test-run-id && \
    npx lerna run build --scope @adguard/dnr-rulesets; \
    BUILD_EXIT=$?; \
    if [ $BUILD_EXIT -ne 0 ]; then \
      echo $BUILD_EXIT > /out/exit-code.txt; \
      exit 0; \
    fi; \
    set +e; \
    ./bamboo-specs/scripts/timeout-wrapper.sh 600s sh -c \
      # Run assets validation last to prevent JUnit XML report missing
      # if the validation fails
      'cd packages/dnr-rulesets && pnpm test:prod && pnpm validate:assets'; \
    EXIT_CODE=$?; \
    ./bamboo-specs/scripts/copy-test-reports.sh packages/dnr-rulesets; \
    echo ${EXIT_CODE} > /out/exit-code.txt; \
    exit 0

FROM scratch AS test-dnr-rulesets-output
COPY --from=test-dnr-rulesets /out/ /

# ============================================================================
# Stage: test-examples
# Builds and lints all four example packages
# No JUnit XML output (no vitest)
# ============================================================================
FROM built-tswebextension AS test-examples

COPY packages/adguard-api/ ./packages/adguard-api/
COPY packages/adguard-api-mv3/ ./packages/adguard-api-mv3/
COPY packages/dnr-rulesets/ ./packages/dnr-rulesets/
COPY packages/examples/ ./packages/examples/

ARG TEST_RUN_ID

RUN --mount=type=cache,target=/pnpm-store,id=tsurlfilter-pnpm \
    pnpm config set store-dir /pnpm-store && \
    mkdir -p /out && echo "${TEST_RUN_ID}" > /out/.test-run-id && \
    npx lerna run build --scope @adguard/api --scope @adguard/api-mv3 && \
    npx lerna run build --scope tswebextension-mv2 --include-dependencies && \
    npx lerna run lint --scope tswebextension-mv2 && \
    npx lerna run build --scope tswebextension-mv3 --include-dependencies && \
    npx lerna run lint --scope tswebextension-mv3 && \
    npx lerna run build --scope adguard-api-example --include-dependencies && \
    npx lerna run lint --scope adguard-api-example && \
    npx lerna run build --scope adguard-api-mv3-example --include-dependencies && \
    npx lerna run lint --scope adguard-api-mv3-example && \
    mkdir -p /out/artifacts && \
    cp packages/examples/adguard-api/build/extension.zip /out/artifacts/examples-adguard-api-extension.zip && \
    cp packages/examples/adguard-api-mv3/build/extension.zip /out/artifacts/examples-adguard-api-mv3-extension.zip

FROM scratch AS test-examples-output
COPY --from=test-examples /out/ /

# ============================================================================
# Stage: test-adguard-api-mv3
# Builds @adguard/api-mv3, runs test:prod (lint + test:ci) for @adguard/api-mv3
# ============================================================================
FROM built-tswebextension AS test-adguard-api-mv3

COPY packages/adguard-api-mv3/ ./packages/adguard-api-mv3/
COPY packages/dnr-rulesets/ ./packages/dnr-rulesets/

ARG TEST_RUN_ID

RUN --mount=type=cache,target=/pnpm-store,id=tsurlfilter-pnpm \
    pnpm config set store-dir /pnpm-store && \
    mkdir -p /out/tests-reports && \
    echo "${TEST_RUN_ID}" > /out/.test-run-id && \
    npx lerna run build --scope @adguard/api-mv3; \
    BUILD_EXIT=$?; \
    if [ $BUILD_EXIT -ne 0 ]; then \
      echo $BUILD_EXIT > /out/exit-code.txt; \
      exit 0; \
    fi; \
    set +e; \
    ./bamboo-specs/scripts/timeout-wrapper.sh 600s sh -c \
      'cd packages/adguard-api-mv3 && pnpm test:prod'; \
    EXIT_CODE=$?; \
    ./bamboo-specs/scripts/copy-test-reports.sh packages/adguard-api-mv3; \
    echo ${EXIT_CODE} > /out/exit-code.txt; \
    exit 0

FROM scratch AS test-adguard-api-mv3-output
COPY --from=test-adguard-api-mv3 /out/ /

# ============================================================================
# Stage: test-adguard-api
# Runs test:prod (lint) for @adguard/api
# ============================================================================
FROM built-tswebextension AS test-adguard-api

COPY packages/adguard-api/ ./packages/adguard-api/

ARG TEST_RUN_ID

RUN --mount=type=cache,target=/pnpm-store,id=tsurlfilter-pnpm \
    pnpm config set store-dir /pnpm-store && \
    mkdir -p /out/tests-reports && \
    echo "${TEST_RUN_ID}" > /out/.test-run-id && \
    set +e; \
    ./bamboo-specs/scripts/timeout-wrapper.sh 600s sh -c \
      'cd packages/adguard-api && pnpm test:prod'; \
    EXIT_CODE=$?; \
    ./bamboo-specs/scripts/copy-test-reports.sh packages/adguard-api adguard-api; \
    echo ${EXIT_CODE} > /out/exit-code.txt; \
    exit 0

FROM scratch AS test-adguard-api-output
COPY --from=test-adguard-api /out/ /

# ============================================================================
# Stage: build-logger
# Builds @adguard/logger and packs .tgz
# ============================================================================
FROM built-css-tokenizer-and-logger AS build-logger

ARG TEST_RUN_ID

RUN --mount=type=cache,target=/pnpm-store,id=tsurlfilter-pnpm \
    pnpm config set store-dir /pnpm-store && \
    mkdir -p /out && echo "${TEST_RUN_ID}" > /out/.test-run-id && \
    cd packages/logger && \
    pnpm tgz && \
    mkdir -p /out/artifacts && \
    mv logger.tgz /out/artifacts/ && \
    cp dist/build.txt /out/artifacts/

FROM scratch AS build-logger-output
COPY --from=build-logger /out/ /

# ============================================================================
# Stage: build-css-tokenizer
# Builds @adguard/css-tokenizer and packs .tgz
# ============================================================================
FROM built-css-tokenizer-and-logger AS build-css-tokenizer

ARG TEST_RUN_ID

RUN --mount=type=cache,target=/pnpm-store,id=tsurlfilter-pnpm \
    pnpm config set store-dir /pnpm-store && \
    mkdir -p /out && echo "${TEST_RUN_ID}" > /out/.test-run-id && \
    cd packages/css-tokenizer && \
    pnpm tgz && \
    mkdir -p /out/artifacts && \
    mv css-tokenizer.tgz /out/artifacts/ && \
    cp dist/build.txt /out/artifacts/

FROM scratch AS build-css-tokenizer-output
COPY --from=build-css-tokenizer /out/ /

# ============================================================================
# Stage: build-agtree
# Builds @adguard/agtree and packs .tgz
# ============================================================================
FROM built-agtree AS build-agtree

ARG TEST_RUN_ID

RUN --mount=type=cache,target=/pnpm-store,id=tsurlfilter-pnpm \
    pnpm config set store-dir /pnpm-store && \
    mkdir -p /out && echo "${TEST_RUN_ID}" > /out/.test-run-id && \
    cd packages/agtree && \
    pnpm tgz && \
    mkdir -p /out/artifacts && \
    mv agtree.tgz /out/artifacts/ && \
    cp dist/build.txt /out/artifacts/

FROM scratch AS build-agtree-output
COPY --from=build-agtree /out/ /

# ============================================================================
# Stage: build-tsurlfilter
# Builds @adguard/tsurlfilter and packs .tgz
# ============================================================================
FROM built-tsurlfilter AS build-tsurlfilter

ARG TEST_RUN_ID

RUN --mount=type=cache,target=/pnpm-store,id=tsurlfilter-pnpm \
    pnpm config set store-dir /pnpm-store && \
    mkdir -p /out && echo "${TEST_RUN_ID}" > /out/.test-run-id && \
    cd packages/tsurlfilter && \
    pnpm tgz && \
    mkdir -p /out/artifacts && \
    mv tsurlfilter.tgz /out/artifacts/ && \
    cp dist/build.txt /out/artifacts/

FROM scratch AS build-tsurlfilter-output
COPY --from=build-tsurlfilter /out/ /

# ============================================================================
# Stage: build-tswebextension
# Builds @adguard/tswebextension and packs .tgz
# ============================================================================
FROM built-tswebextension AS build-tswebextension

ARG TEST_RUN_ID

RUN --mount=type=cache,target=/pnpm-store,id=tsurlfilter-pnpm \
    pnpm config set store-dir /pnpm-store && \
    mkdir -p /out && echo "${TEST_RUN_ID}" > /out/.test-run-id && \
    cd packages/tswebextension && \
    pnpm tgz && \
    mkdir -p /out/artifacts && \
    mv tswebextension.tgz /out/artifacts/ && \
    cp dist/build.txt /out/artifacts/

FROM scratch AS build-tswebextension-output
COPY --from=build-tswebextension /out/ /

# ============================================================================
# Stage: build-dnr-rulesets
# Builds @adguard/dnr-rulesets and packs .tgz
# ============================================================================
FROM built-tsurlfilter AS build-dnr-rulesets

COPY packages/dnr-rulesets/ ./packages/dnr-rulesets/

ARG TEST_RUN_ID

RUN --mount=type=cache,target=/pnpm-store,id=tsurlfilter-pnpm \
    pnpm config set store-dir /pnpm-store && \
    mkdir -p /out && echo "${TEST_RUN_ID}" > /out/.test-run-id && \
    npx lerna run build --scope @adguard/dnr-rulesets && \
    cd packages/dnr-rulesets && \
    pnpm tgz && \
    mkdir -p /out/artifacts && \
    mv dnr-rulesets.tgz /out/artifacts/ && \
    cp dist/build.txt /out/artifacts/

FROM scratch AS build-dnr-rulesets-output
COPY --from=build-dnr-rulesets /out/ /

# ============================================================================
# Stage: build-eslint-plugin-logger-context
# Builds @adguard/eslint-plugin-logger-context and packs .tgz
# ============================================================================
FROM built-css-tokenizer-and-logger AS build-eslint-plugin-logger-context

ARG TEST_RUN_ID

RUN --mount=type=cache,target=/pnpm-store,id=tsurlfilter-pnpm \
    pnpm config set store-dir /pnpm-store && \
    mkdir -p /out && echo "${TEST_RUN_ID}" > /out/.test-run-id && \
    npx lerna run build --scope @adguard/eslint-plugin-logger-context && \
    npx lerna run lint --scope @adguard/eslint-plugin-logger-context && \
    cd packages/eslint-plugin-logger-context && \
    pnpm tgz && \
    mkdir -p /out/artifacts && \
    mv eslint-plugin-logger-context.tgz /out/artifacts/ && \
    cp dist/build.txt /out/artifacts/

FROM scratch AS build-eslint-plugin-logger-context-output
COPY --from=build-eslint-plugin-logger-context /out/ /

# ============================================================================
# Stage: build-adguard-api
# Builds @adguard/api, the example extension, and packs .tgz
# ============================================================================
FROM built-tswebextension AS build-adguard-api

COPY packages/adguard-api/ ./packages/adguard-api/
COPY packages/examples/adguard-api/ ./packages/examples/adguard-api/

ARG TEST_RUN_ID

RUN --mount=type=cache,target=/pnpm-store,id=tsurlfilter-pnpm \
    pnpm config set store-dir /pnpm-store && \
    mkdir -p /out && echo "${TEST_RUN_ID}" > /out/.test-run-id && \
    npx lerna run build --scope @adguard/api && \
    npx lerna run lint --scope @adguard/api && \
    npx lerna run build --scope adguard-api-example --include-dependencies && \
    cd packages/adguard-api && \
    pnpm tgz && \
    mkdir -p /out/artifacts && \
    mv adguard-api.tgz /out/artifacts/ && \
    cp dist/build.txt /out/artifacts/ && \
    cp /tsurlfilter/packages/examples/adguard-api/build/extension.zip /out/artifacts/

FROM scratch AS build-adguard-api-output
COPY --from=build-adguard-api /out/ /

# ============================================================================
# Stage: build-adguard-api-mv3
# Builds @adguard/api-mv3, runs test:ci, builds example, and packs .tgz
# ============================================================================
FROM built-tswebextension AS build-adguard-api-mv3

COPY packages/adguard-api-mv3/ ./packages/adguard-api-mv3/
COPY packages/dnr-rulesets/ ./packages/dnr-rulesets/
COPY packages/examples/adguard-api-mv3/ ./packages/examples/adguard-api-mv3/

ARG TEST_RUN_ID

RUN --mount=type=cache,target=/pnpm-store,id=tsurlfilter-pnpm \
    pnpm config set store-dir /pnpm-store && \
    mkdir -p /out && echo "${TEST_RUN_ID}" > /out/.test-run-id && \
    npx lerna run build --scope @adguard/api-mv3 && \
    npx lerna run lint --scope @adguard/api-mv3 && \
    npx lerna run test:ci --scope @adguard/api-mv3 && \
    npx lerna run build --scope @adguard/dnr-rulesets && \
    cd packages/examples/adguard-api-mv3 && \
    pnpm install --ignore-scripts && \
    pnpm run build && \
    cd /tsurlfilter/packages/adguard-api-mv3 && \
    pnpm tgz && \
    mkdir -p /out/artifacts && \
    mv adguard-api-mv3.tgz /out/artifacts/ && \
    cp dist/build.txt /out/artifacts/ && \
    cp /tsurlfilter/packages/examples/adguard-api-mv3/build/extension.zip /out/artifacts/

FROM scratch AS build-adguard-api-mv3-output
COPY --from=build-adguard-api-mv3 /out/ /

# ============================================================================
# Stage: increment-tswebextension
# Increments @adguard/tswebextension version and extracts modified files
# ============================================================================
FROM source AS increment-tswebextension

RUN --mount=type=cache,target=/pnpm-store,id=tsurlfilter-pnpm \
    pnpm config set store-dir /pnpm-store && \
    touch /tmp/.pre-increment-marker && \
    pnpm run increment tswebextension && \
    mkdir -p /out/modified && \
    find . -newer /tmp/.pre-increment-marker -type f \
      -not -path './.git/*' \
      -not -path './node_modules/*' \
      -not -path './**/node_modules/*' \
      -not -path './**/dist/*' \
      | sed 's|^\./||' | while IFS= read -r f; do \
        mkdir -p "/out/modified/$(dirname "$f")"; \
        cp "$f" "/out/modified/$f"; \
      done

FROM scratch AS increment-tswebextension-output
COPY --from=increment-tswebextension /out/ /

# ============================================================================
# Stage: increment-agtree
# Increments @adguard/agtree version and extracts modified files
# ============================================================================
FROM source AS increment-agtree

RUN --mount=type=cache,target=/pnpm-store,id=tsurlfilter-pnpm \
    pnpm config set store-dir /pnpm-store && \
    touch /tmp/.pre-increment-marker && \
    pnpm run increment agtree && \
    mkdir -p /out/modified && \
    find . -newer /tmp/.pre-increment-marker -type f \
      -not -path './.git/*' \
      -not -path './node_modules/*' \
      -not -path './**/node_modules/*' \
      -not -path './**/dist/*' \
      | sed 's|^\./||' | while IFS= read -r f; do \
        mkdir -p "/out/modified/$(dirname "$f")"; \
        cp "$f" "/out/modified/$f"; \
      done

FROM scratch AS increment-agtree-output
COPY --from=increment-agtree /out/ /

# ============================================================================
# Stage: increment-dnr-rulesets
# Increments @adguard/dnr-rulesets version and extracts modified files
# ============================================================================
FROM source AS increment-dnr-rulesets

RUN --mount=type=cache,target=/pnpm-store,id=tsurlfilter-pnpm \
    pnpm config set store-dir /pnpm-store && \
    touch /tmp/.pre-increment-marker && \
    pnpm run increment dnr-rulesets && \
    mkdir -p /out/modified && \
    find . -newer /tmp/.pre-increment-marker -type f \
      -not -path './.git/*' \
      -not -path './node_modules/*' \
      -not -path './**/node_modules/*' \
      -not -path './**/dist/*' \
      | sed 's|^\./||' | while IFS= read -r f; do \
        mkdir -p "/out/modified/$(dirname "$f")"; \
        cp "$f" "/out/modified/$f"; \
      done

FROM scratch AS increment-dnr-rulesets-output
COPY --from=increment-dnr-rulesets /out/ /

# ============================================================================
# Stage: increment-dnr-converter
# Placeholder for DNR Converter increment (TODO: AG-45668)
# ============================================================================
FROM source AS increment-dnr-converter

RUN --mount=type=cache,target=/pnpm-store,id=tsurlfilter-pnpm \
    pnpm config set store-dir /pnpm-store && \
    touch /tmp/.pre-increment-marker && \
    echo "TODO: Implement dnr-converter increment (AG-45668)" && \
    mkdir -p /out/modified

FROM scratch AS increment-dnr-converter-output
COPY --from=increment-dnr-converter /out/ /

# ============================================================================
# Stage: dnr-rulesets-auto-build
# Increments version (auto-deploy), builds, tests, packs @adguard/dnr-rulesets
# Extracts both artifacts and modified source files
# ============================================================================
FROM source AS dnr-rulesets-auto-build

ARG TEST_RUN_ID

RUN --mount=type=cache,target=/pnpm-store,id=tsurlfilter-pnpm \
    pnpm config set store-dir /pnpm-store && \
    mkdir -p /out && echo "${TEST_RUN_ID}" > /out/.test-run-id && \
    touch /tmp/.pre-build-marker && \
    npx lerna run increment:auto-deploy --scope @adguard/dnr-rulesets && \
    DNR_FILTER_KNOWN_ONLY=true npx lerna run build --scope @adguard/dnr-rulesets --include-dependencies && \
    npx lerna run test --scope @adguard/dnr-rulesets && \
    cd packages/dnr-rulesets && \
    pnpm tgz && \
    mkdir -p /out/artifacts && \
    mv dnr-rulesets.tgz /out/artifacts/ && \
    cp dist/build.txt /out/artifacts/ && \
    cd /tsurlfilter && \
    mkdir -p /out/modified && \
    find . -newer /tmp/.pre-build-marker -type f \
      -not -path './.git/*' \
      -not -path './node_modules/*' \
      -not -path './**/node_modules/*' \
      -not -path './**/dist/*' \
      -not -name '*.tgz' \
      | sed 's|^\./||' | while IFS= read -r f; do \
        mkdir -p "/out/modified/$(dirname "$f")"; \
        cp "$f" "/out/modified/$f"; \
      done

FROM scratch AS dnr-rulesets-auto-build-output
COPY --from=dnr-rulesets-auto-build /out/ /

# ============================================================================
# Stage: update-companiesdb
# Runs the companiesdb update for @adguard/tswebextension
# Exit code 0 = changes detected, 1 = no meaningful changes
# ============================================================================
FROM source AS update-companiesdb

ARG TEST_RUN_ID

RUN --mount=type=cache,target=/pnpm-store,id=tsurlfilter-pnpm \
    pnpm config set store-dir /pnpm-store && \
    mkdir -p /out && echo "${TEST_RUN_ID}" > /out/.test-run-id && \
    touch /tmp/.pre-update-marker && \
    mkdir -p /out/modified && \
    set +e; \
    pnpm --filter @adguard/tswebextension update:companiesdb; \
    EXIT_CODE=$?; \
    if [ ${EXIT_CODE} -eq 0 ]; then \
      find . -newer /tmp/.pre-update-marker -type f \
        -not -path './.git/*' \
        -not -path './node_modules/*' \
        -not -path './**/node_modules/*' \
        -not -path './**/dist/*' \
        | sed 's|^\./||' | while IFS= read -r f; do \
          mkdir -p "/out/modified/$(dirname "$f")"; \
          cp "$f" "/out/modified/$f"; \
        done; \
    fi; \
    echo ${EXIT_CODE} > /out/exit-code.txt; \
    exit 0

FROM scratch AS update-companiesdb-output
COPY --from=update-companiesdb /out/ /

# ============================================================================
# Stage: update-docs-mv3
# Runs the tsurlfilter MV3 docs update
# ============================================================================
FROM source AS update-docs-mv3

ARG TEST_RUN_ID

RUN --mount=type=cache,target=/pnpm-store,id=tsurlfilter-pnpm \
    pnpm config set store-dir /pnpm-store && \
    mkdir -p /out && echo "${TEST_RUN_ID}" > /out/.test-run-id && \
    touch /tmp/.pre-update-marker && \
    ./bamboo-specs/scripts/timeout-wrapper.sh 600s ./bamboo-specs/scripts/tsurlfilter-update-docs-mv3.sh && \
    mkdir -p /out/modified && \
    find . -newer /tmp/.pre-update-marker -type f \
      -not -path './.git/*' \
      -not -path './node_modules/*' \
      -not -path './**/node_modules/*' \
      -not -path './**/dist/*' \
      | sed 's|^\./||' | while IFS= read -r f; do \
        mkdir -p "/out/modified/$(dirname "$f")"; \
        cp "$f" "/out/modified/$f"; \
      done

FROM scratch AS update-docs-mv3-output
COPY --from=update-docs-mv3 /out/ /
