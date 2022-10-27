export class I18n {
    public static normalize(locales: string[], locale: string): string | null {
        const lang = locale.replace("-", "_");

        if (locales.includes(lang)) {
            return lang;
        }

        const langParts = lang.split("_");

        if (locales.includes(langParts[0])) {
            return langParts[0];
        }

        return null;
    }
}
