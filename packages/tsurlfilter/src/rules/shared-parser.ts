/**
 * @file Shared structural parser pipeline for tsurlfilter's rule classes.
 *
 * `RuleFactory` and the `NetworkRule` / `CosmeticRule` / `HostRule` AST
 * fallbacks used to keep one `RuleParserPipeline` each. A pipeline grows its
 * token buffers to the largest rule it has parsed and keeps them until
 * `reset()`, so four instances retained up to four times the peak size for the
 * lifetime of the process (F-012, A08-C07).
 *
 * One instance is enough: parsing is synchronous and the result is consumed
 * before the next call. Consumers reset it at list boundaries.
 */

import { RuleParserPipeline } from '@adguard/agtree';

/**
 * Parser pipeline shared by all tsurlfilter rule parsing entry points.
 */
export const sharedRuleParser = new RuleParserPipeline();
