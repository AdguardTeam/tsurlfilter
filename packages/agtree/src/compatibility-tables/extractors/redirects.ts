import { getCompatibilityTableData } from './extractor';
import { type RedirectDataSchema, baseFileSchema, redirectDataSchema } from './schemas';

export const getRedirectsCompatibilityTableData = async (dir: string) => {
    return getCompatibilityTableData<RedirectDataSchema>(dir, baseFileSchema(redirectDataSchema));
};
