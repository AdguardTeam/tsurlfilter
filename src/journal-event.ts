import { IRule } from './rules/rule';
import { Request } from './request';

/**
 * Rule journal event
 */
export class JournalEvent {
    /**
     * Request
     */
    public readonly request: Request;

    /**
     * Event rules
     */
    public readonly rules: IRule[];

    /**
     * Constructor
     *
     * @param request
     * @param rules
     */
    constructor(request: Request, rules: IRule[]) {
        this.request = request;
        this.rules = rules;
    }
}
