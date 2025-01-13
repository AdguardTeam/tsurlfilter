/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { type ExtensionStorage } from './extension-storage';

/**
 * Creates accessor decorator for the specified storage.
 *
 * @param storage The extension storage API to use.
 * @returns Accessor decorator for the specified storage.
 * @see https://github.com/tc39/proposal-decorators
 */
export function createExtensionStorageDecorator<Data extends Record<string, unknown>>(
    storage: ExtensionStorage<Data, string>, // Ensures we use our storage interface
) {
    const fields = new Set<keyof Data>();

    /**
     * Creates accessor decorator for the specified storage field.
     *
     * NOTE: You should not set the initial value to the accessor via assignment,
     * because the decorator overwrites accessor methods and doesn't use a private property, created on initialization.
     * Use Non-null assertion operator instead.
     * @example `@storage('foo') accessor bar!: string`;
     * @param field Storage field name.
     * @throws Error if the decorator is already registered for {@link field}
     * or the decorator is applied to a class member other than an accessor.
     * @returns Decorator for access to specified storage {@link field}.
     */
    return function createFieldDecorator<Field extends keyof Data>(field: Field) {
        // Prevent the use of multiple decorators on a single storage field
        if (fields.has(field)) {
            throw new Error(`Decorator for ${String(field)} field is already registered`);
        }

        fields.add(field);

        return function fieldDecorator<This>(
            _target: ClassAccessorDecoratorTarget<This, Data[Field]>,
            context: ClassAccessorDecoratorContext<This, Data[Field]>,
        ): ClassAccessorDecoratorResult<This, Data[Field]> | void {
            // Ensure the class member is an accessor
            if (context.kind !== 'accessor') {
                throw new Error('Class member is not an accessor');
            }

            // Provide getter and setter using the ExtensionStorage methods
            return {
                get(): Data[Field] {
                    return storage.get(field);
                },
                set(value: Data[Field]): void {
                    storage.set(field, value);
                },
            };
        };
    };
}
