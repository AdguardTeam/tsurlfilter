#!/usr/bin/env node
/**
 * @file Shared error/usage reporting for the DevEx bridge CLI helpers
 * (use-dev-builds.mjs, ak-dev-unpublish.mjs, devex-sweep.mjs,
 * check-pr-open.mjs, check-package-lists.mjs). Each of these used to inline its
 * own `fail`/`fatal`/`usageError` — the same console.error + process.exit with
 * the same `::error::` annotation prefix. This module is the single source for
 * those helpers so the annotation format and the exit-code contract cannot
 * drift between scripts.
 *
 * Annotation policy: `::error::` / `::warning::` are written to stderr, which
 * GitHub renders as step annotations; the exact output is preserved verbatim
 * from the inlined versions this replaces.
 */

import process from 'node:process';

/**
 * Print a fatal `::error::` annotation and exit (1 by default).
 *
 * @param {string} message Error description; the `::error::` prefix is added.
 * @param {number} [code=1] Exit code; callers that need a non-1 code (e.g. the
 *   usage-error `2` contract) pass it explicitly.
 */
export const fail = (message, code = 1) => {
    console.error(`::error::${message}`);
    process.exit(code);
};

/**
 * Print a usage `::error::usage:` annotation and exit 2 — the caller's YAML or
 * CLI invocation is misconfigured.
 *
 * @param {string} usage The usage line to include in the annotation.
 */
export const usageError = (usage) => {
    console.error(`::error::usage: ${usage}`);
    process.exit(2);
};

/**
 * Classify an npm CLI failure as "package absent" (benign) vs a real failure.
 *
 * The shared registry error taxonomy lives here so ak-dev-unpublish.mjs and
 * devex-sweep.mjs cannot drift: a failure is only "package absent" when the
 * error text unambiguously names the requested package AND is a 404/not-found.
 * A wildcard 404, a wrong registry base, or a proxy error page must NOT look
 * like "nothing to do" — the jobs that consume this are single-fire (cleanup
 * especially), so a green run that deletes nothing must not be possible.
 *
 * @param {string} text Merged npm error text (stderr, else stdout, else
 *   message).
 * @param {string} pkg The package name the query/unpublish was for (e.g.
 *   `@adguard/tsurlfilter`); must appear in the error for classification.
 * @returns {boolean} `true` when the error is a benign "package absent".
 */
export const isPackageAbsent = (text, pkg) =>
    /E404|404 not found|not found/i.test(text) && text.includes(pkg);
