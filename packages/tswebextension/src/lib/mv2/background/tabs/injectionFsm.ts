import { FSM, Transitions } from '../utils/fsm';

/**
 * Cosmetic rules injection states.
 */
export const enum InjectionState {
    Idle = 'idle',
    Loading = 'loading',
    Completed = 'completed',
}

/**
 * Cosmetic rules injection events.
 */
export const enum InjectionEvent {
    Start = 'start',
    Success = 'success',
    Failure = 'failure',
}

/**
 * FSM for managing the injection of the cosmetic rules in specific frame.
 */
export type InjectionFsm = FSM<InjectionState, InjectionEvent>;

/**
 * Declarative description of the {@link InjectionFsm} transitions.
 */
const injectionsTransitions: Transitions<InjectionState, InjectionEvent> = {
    [InjectionState.Idle]: {
        [InjectionEvent.Start]: InjectionState.Loading,
    },
    [InjectionState.Loading]: {
        [InjectionEvent.Success]: InjectionState.Completed,
        [InjectionEvent.Failure]: InjectionState.Idle,
    },
    [InjectionState.Completed]: {},
};

/**
 * Factory for creating a new {@link InjectionFsm}.
 *
 * @param initialState Initial state of the FSM.
 * @returns New FSM instance.
 */
export function createInjectionFsm(initialState = InjectionState.Idle): InjectionFsm {
    return new FSM(injectionsTransitions, initialState);
}
