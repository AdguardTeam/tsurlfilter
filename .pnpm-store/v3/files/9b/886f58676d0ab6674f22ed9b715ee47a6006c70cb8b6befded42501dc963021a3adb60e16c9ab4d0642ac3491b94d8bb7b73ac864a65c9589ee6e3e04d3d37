/**
 * Interface that describes network rule modifiers that has
 * lists of permitted and restricted values.
 *
 * TODO (s.atroschenko) Consider converting this into an abstract class
 * with getter-like methods. This would allow us to avoid code duplication
 * in NetworkRule by moving lists of values and aforementioned methods
 * of  ($domain, $app, $method, $to) to the abstract class.
 * The IValuesModifier interface can serve as a reference.
 * Note that this would require changes to the public API.
 */
export interface IValueListModifier<T extends string> {
    readonly permittedValues: T[] | null;
    readonly restrictedValues: T[] | null;
}
