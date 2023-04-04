import { logger } from '../../../common/utils/logger';

/**
 * Possible keys for the FSM state and events.
 */
type Key = string | number | symbol;

/**
 * Declarative description of the {@link FSM} transitions.
 */
export type Transitions<State extends Key, Event extends Key> = {
    [state in State]: {
        [event in Event]?: State;
    }
};

/**
 * Simple finite state machine with synchronous transitions.
 */
export class FSM<State extends Key, Event extends Key> {
    /**
     * Creates a new FSM instance.
     *
     * @param transitions Declarative description of the FSM transitions.
     * @param state Initial state of the FSM.
     */
    constructor(
        private readonly transitions: Transitions<State, Event>,
        public state: State,
    ) {}

    /**
     * Dispatches an event to the FSM.
     *
     * If the event is valid for the current state, the FSM will transition to the next state.
     *
     * @param event Event to dispatch.
     */
    public dispatch(event: Event): void {
        // TODO: improve Transitions generic type to avoid this type assertion
        const nextState = this.transitions[this.state][event] as State | undefined;

        if (nextState) {
            this.state = nextState;
        } else {
            logger.error(`Invalid state transition: ${String(this.state)} -> ${String(event)}`);
        }
    }
}
