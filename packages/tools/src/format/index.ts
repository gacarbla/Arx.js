import config from "./config"
import { DateInputMap, DateOutputMap, DateArgs, datesCore, dateTemplateToDate } from "./dates"
import { NumberInputMap, NumberOutputMap, NumbersArgs, numbersCore } from "./numbers"

export class Formatter {
    static defaultShortDate = "{DD}/{MM}/{YYYY}"
    static defaultLongDate = "{YYYY}-{MM}-{DD} {hh}:{mm}:{ss}"
    static defaultCurrencySymbol = "€"
    static defaultDecimals = 2
    static defaultLang: "es" | "en" = "es"

    config = config.current

    constructor() {
        this.config = config.current
        config.onChange((newConfig) => (this.config = newConfig))
    }

    dates<
        F extends keyof DateInputMap,
        T extends keyof DateOutputMap = "string:shortdate"
    >(
        from: F,
        ...args: DateArgs<F, T>
    ): F extends "template" ? string : DateOutputMap[T] {
        const defaults = {
            shortDate: this.config?.dates?.shortDate ?? Formatter.defaultShortDate,
            longDate: this.config?.dates?.longDate ?? Formatter.defaultLongDate,
        }
        return datesCore(from, defaults, ...args)
    }

    static dates<
        F extends keyof DateInputMap,
        T extends keyof DateOutputMap = "string:shortdate"
    >(
        from: F,
        ...args: DateArgs<F, T>
    ): F extends "template" ? string : DateOutputMap[T] {
        const defaults = {
            shortDate: Formatter.defaultShortDate,
            longDate: Formatter.defaultLongDate,
        }
        return datesCore(from, defaults, ...args)
    }

    numbers<
        F extends keyof NumberInputMap,
        T extends keyof NumberOutputMap = "string"
    >(
        from: F,
        ...args: NumbersArgs<F, T>
    ): NumberOutputMap[T] {
        const defaults = {
            currencySymbol: this.config?.numbers?.currencySymbol ?? Formatter.defaultCurrencySymbol,
            decimals: this.config?.numbers?.decimals ?? Formatter.defaultDecimals,
            lang: this.config?.numbers?.lang ?? Formatter.defaultLang,
        }
        return numbersCore(from, defaults, ...args)
    }

    static numbers<
        F extends keyof NumberInputMap,
        T extends keyof NumberOutputMap = "string"
    >(
        from: F,
        ...args: NumbersArgs<F, T>
    ): NumberOutputMap[T] {
        const defaults = {
            currencySymbol: Formatter.defaultCurrencySymbol,
            decimals: Formatter.defaultDecimals,
            lang: Formatter.defaultLang,
        }
        return numbersCore(from, defaults, ...args)
    }

    static dateTemplateToDate = dateTemplateToDate
}

export const FORMAT = {
    Formatter
}

export default FORMAT