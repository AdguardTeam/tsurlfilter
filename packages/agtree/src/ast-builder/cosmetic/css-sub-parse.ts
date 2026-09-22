/**
 * @file Shared strict-CSS sub-parse policy for cosmetic AST builders.
 *
 * The strict CSS sub-parsers reject constructs the base pipeline keeps raw
 * (pseudo-elements, namespaces, consecutive combinators, malformed
 * declarations) by throwing {@link AdblockSyntaxError}, and signal a capacity
 * overflow via `ctx.status` instead of throwing. Both outcomes mean the same
 * thing to the AST builders: fall back to `Raw` nodes so a rule the base
 * pipeline converted is never dropped.
 */

import { AdblockSyntaxError } from '../../errors/adblock-syntax-error';
import type { ParserContext } from '../../parser/context';
import { CTX_STATUS_OK } from '../../parser/context';

/**
 * Runs a strict CSS sub-parse and returns its result only when the sub-parser
 * accepted the input.
 *
 * A rejection is either an {@link AdblockSyntaxError} (the sub-parser cannot
 * represent the construct) or a non-OK `ctx.status` (the sub-parse ran out of
 * buffer capacity, e.g. a declaration list longer than
 * `DEFAULT_MAX_DECLARATIONS`). Callers must build `Raw` nodes in both cases.
 *
 * @param ctx Parser context the sub-parser writes to.
 * @param subParse Callback that runs the sub-parser and builds the AST node.
 *
 * @returns The built AST node, or `null` when the sub-parse was rejected.
 *
 * @throws Rethrows unexpected errors (anything but {@link AdblockSyntaxError}).
 */
export function tryCssSubParse<T>(ctx: ParserContext, subParse: () => T): T | null {
    let result: T;
    try {
        result = subParse();
    } catch (e) {
        if (e instanceof AdblockSyntaxError) {
            return null;
        }
        throw e;
    }

    if (ctx.status !== CTX_STATUS_OK) {
        // Consume the overflow signal so a later sub-parse in the same builder
        // is not misclassified by the stale status.
        ctx.status = CTX_STATUS_OK;
        return null;
    }

    return result;
}
