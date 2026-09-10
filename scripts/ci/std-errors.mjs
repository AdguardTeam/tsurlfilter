#!/usr/bin/env node
/**
 * @file Shared error/usage reporting for the DevEx bridge CLI helpers
 * (check-pr-open.mjs, check-package-lists.mjs). Each of these used to inline
 * its own `fail`/`usageError` — the same console.error + process.exit with the
 * same `::error::` annotation prefix. This module is the single source for
 * those helpers so the annotation format and the exit-code contract cannot
 * drift between scripts.
 *
 * Annotation policy: `::error::` / `::warning::` are written to stderr, which
 * GitHub renders as step annotations. The prefix + exit-code contract is
 * carried over from the inlined helpers this module replaces (it does not keep
 * their output byte-for-byte — e.g. a developer running the local CLI also sees
 * the `::error::` prefix in their terminal).
 * Keeping one shared format means CI annotation rendering and local
 * diagnostics cannot drift apart.
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
