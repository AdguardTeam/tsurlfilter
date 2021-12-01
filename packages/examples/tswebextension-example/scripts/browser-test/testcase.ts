import { Product } from "./product";
import { Compatibility, isCompatible } from "./compatibility";

export interface Testcase {
    id: number,
    title: string,
    link: string,
    rulesUrl?: string,
    readmeUrl?: string,
    compatibility: Compatibility,
}

export const filterCompatibleTestcases = (testcases: Testcase[], productType: Product) => {
    return testcases.filter(testcase => {

        return isCompatible(testcase.compatibility, productType);
    })
}
