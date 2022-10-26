import zod from "zod";

/**
 * In some cases we want to preprocessing input before validation
 * For example, cast stringified value to needed type
 */
export class SchemaPreprocessor {
    public static booleanValidator = zod.preprocess(SchemaPreprocessor.castStringToBoolean, zod.boolean());

    public static numberValidator = zod.preprocess(SchemaPreprocessor.castStringToNumber, zod.number());

    private static castStringToNumber(value: unknown) {
        if (typeof value === "string") {
            return Number(value);
        }

        return value;
    }

    private static castStringToBoolean(value: unknown) {
        if (typeof value === "string") {
            try {
                return Boolean(JSON.parse(value));
            } catch (e) {
                return value;
            }
        }

        return value;
    }
}
