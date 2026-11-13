export interface I18nOptions {
    /** Locale used when the interaction locale has no messages. */
    defaultLocale?: string;
    /** Messages keyed by locale and then by key. */
    messages?: Record<string, Record<string, string>>;
}

/**
 * Minimal message translator.
 *
 * Placeholders use `{name}`. Missing keys return the key so a bot can detect
 * untranslated strings without throwing.
 */
export class I18n {
    private readonly defaultLocale: string;
    private readonly messages: Record<string, Record<string, string>>;

    constructor(options: I18nOptions = {}) {
        this.defaultLocale = options.defaultLocale ?? "en-US";
        this.messages = options.messages ?? {};
    }

    public t(
        locale: string,
        key: string,
        params: Record<string, string | number> = {}
    ): string {
        const table =
            this.messages[locale] ??
            this.messages[locale.split("-")[0]!] ??
            this.messages[this.defaultLocale] ??
            {};

        const template = table[key] ?? key;
        return template.replace(/\{(\w+)\}/g, (match, name: string) =>
            params[name] !== undefined ? String(params[name]) : match
        );
    }
}
