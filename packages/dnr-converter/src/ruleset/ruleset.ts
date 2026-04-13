/**
 * @file Contains the {@link IRuleset} interface and the {@link Ruleset} class
 * for the simple conversion flow ({@link FilterConverter}).
 */

import * as v from 'valibot';

import { type DeclarativeRule, DeclarativeRuleValidator } from '../declarative-rule';
import { isSafeRule } from '../utils/is-safe-rule';

import { type IBaseRuleset } from './types';

/**
 * Extended rule set interface for the simple conversion flow
 * ({@link FilterConverter}). Adds synchronous access to declarative rules and
 * serialization on top of the base {@link IBaseRuleset}.
 */
export interface IRuleset extends IBaseRuleset {
    /**
     * Returns list of ruleset's declarative rules.
     *
     * @returns List of ruleset's declarative rules.
     */
    getDeclarativeRules(): DeclarativeRule[];

    /**
     * Serializes the rule set to a plain JSON string of declarative rules.
     *
     * @returns Serialized declarative rules as a JSON string.
     */
    serialize(): string;
}

/**
 * Rule set that holds converted declarative rules in memory without
 * source maps, hash maps, or lazy loading. Implements {@link IRuleset}
 * and is returned by the simple conversion flow ({@link FilterConverter}).
 */
export class Ruleset implements IRuleset {
    /**
     * Id of rule set.
     */
    private readonly id: string;

    /**
     * Array of converted declarative rules.
     */
    private readonly declarativeRules: DeclarativeRule[];

    /**
     * Number of converted declarative unsafe rules.
     */
    private readonly unsafeRulesCount: number;

    /**
     * Number of converted declarative regexp rules.
     */
    private readonly regexpRulesCount: number;

    /**
     * Creates a new {@link Ruleset}.
     *
     * @param id Rule set identifier.
     * @param declarativeRules All converted declarative rules.
     */
    constructor(
        id: string,
        declarativeRules: DeclarativeRule[],
    ) {
        this.id = id;
        this.declarativeRules = declarativeRules;
        this.unsafeRulesCount = declarativeRules.filter((r) => !isSafeRule(r)).length;
        this.regexpRulesCount = declarativeRules
            .filter(({ condition: { regexFilter } }) => regexFilter !== undefined)
            .length;
    }

    /** @inheritdoc */
    public getId(): string {
        return this.id;
    }

    /** @inheritdoc */
    public getRulesCount(): number {
        return this.declarativeRules.length;
    }

    /** @inheritdoc */
    public getUnsafeRulesCount(): number {
        return this.unsafeRulesCount;
    }

    /** @inheritdoc */
    public getRegexpRulesCount(): number {
        return this.regexpRulesCount;
    }

    /** @inheritdoc */
    public getDeclarativeRules(): DeclarativeRule[] {
        return this.declarativeRules;
    }

    /** @inheritdoc */
    public serialize(): string {
        return JSON.stringify(this.declarativeRules);
    }

    /**
     * Reconstructs a {@link Ruleset} from a JSON string produced by
     * {@link serialize}.
     *
     * @param id Rule set identifier.
     * @param json JSON string produced by {@link serialize}.
     *
     * @returns Reconstructed {@link Ruleset}.
     */
    public static deserialize(id: string, json: string): Ruleset {
        const rules = v.parse(v.array(DeclarativeRuleValidator), JSON.parse(json));

        return new Ruleset(id, rules);
    }
}
