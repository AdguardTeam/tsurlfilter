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
    storage: ExtensionStorage<Data, string>,
) {
    const fields = new Set<keyof Data>();

    /**
     * Creates accessor decorator for the specified storage field.
     *
     * NOTE: You should not set the initial value to the accessor via assignment,
     * because decorator overwrite accessors methods and don't use private property, created on initialization.
     * Use Non-null assertion operator instead.
     * @example `@storage('foo') accessor bar!: string`;
     * @param field Storage field name.
     * @throws Error if decorator is already registered for {@link field}
     * or decorator is applied to class member different from auto accessor.
     * @returns Decorator for access to specified storage {@link field}.
     */
    return function createFieldDecorator<Field extends keyof Data>(field: Field) {
        // We prevent the use of multiple decorators on a single storage field,
        // because manipulating data through the accessors of multiple modules can be confusing.
        if (fields.has(field)) {
            throw new Error(`Decorator for ${String(field)} field is already registered`);
        }

        fields.add(field);

        return function fieldDecorator<
            // The type on which the class element will be defined.
            // For a static class element, this will be the type of the constructor.
            // For a non-static class element, this will be the type of the instance.
            This,
        >(
            _target: ClassAccessorDecoratorTarget<This, Data[Field]>,
            context: ClassAccessorDecoratorContext<This, Data[Field]>,
        ): ClassAccessorDecoratorResult<This, Data[Field]> | void {
            if (context.kind !== 'accessor') {
                throw new Error('Class member is not auto accessor');
            }

            // we do not set init descriptor, because data will be initialized asynchronously
            return {
                get(): Data[Field] {
                    return storage.get(field);
                },
                set(value: Data[Field]): void {
                    return storage.set(field, value);
                },
            };
        };
    };
}
