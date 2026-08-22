export type DateInputMap = {
    template: string
    string: string
    timestamp: number
    date: Date
    now: undefined
}

export type DateOutputMap = {
    date: Date
    timestamp: number
    "string:shortdate": string
    "string:longdate": string
}

type RequiresDateTemplate<T extends keyof DateOutputMap> = T extends "string:shortdate" | "string:longdate"
    ? [customTemplate?: string]
    : []

export type DateArgs<F extends keyof DateInputMap, T extends keyof DateOutputMap> =
    F extends "template"
    ? [template: string, date?: Date]
    : F extends "now"
    ? [value?: undefined, to?: T, ...rest: RequiresDateTemplate<T>]
    : [value: DateInputMap[F], to?: T, ...rest: RequiresDateTemplate<T>]

export interface DateDefaults {
    shortDate: string
    longDate: string
}

export function dateTemplateToDate(template: string, date: Date = new Date()): string {
    const map: Record<string, string> = {
        YYYY: String(date.getFullYear()),
        YY: String(date.getFullYear()).slice(-2),
        MM: String(date.getMonth() + 1).padStart(2, "0"),
        M: String(date.getMonth() + 1),
        DD: String(date.getDate()).padStart(2, "0"),
        D: String(date.getDate()),
        hh: String(date.getHours()).padStart(2, "0"),
        h: String(date.getHours()),
        mm: String(date.getMinutes()).padStart(2, "0"),
        m: String(date.getMinutes()),
        ss: String(date.getSeconds()).padStart(2, "0"),
        s: String(date.getSeconds()),
    }

    return template.replace(/\{(YYYY|YY|MM|M|DD|D|hh|h|mm|m|ss|s)\}/g, (_, key) => map[key])
}

export function datesCore<
    F extends keyof DateInputMap,
    T extends keyof DateOutputMap
>(
    from: F,
    defaults: DateDefaults,
    ...args: any[]
): any {
    if (from === "template") {
        const templateStr = args[0] as string
        const targetDate = (args[1] as Date | undefined) ?? new Date()
        return dateTemplateToDate(templateStr, targetDate)
    }

    const value = args[0]
    const to = (args[1] ?? "string:shortdate") as keyof DateOutputMap
    const customTemplate = args[2] as string | undefined

    let baseDate: Date

    switch (from) {
        case "now":
            baseDate = new Date()
            break
        case "date":
            baseDate = value as Date
            break
        case "timestamp":
            baseDate = new Date(value as number)
            break
        case "string":
            baseDate = new Date(value as string)
            break
        default:
            throw new Error(`Invalid 'from' type: ${from}`)
    }

    if (isNaN(baseDate.getTime())) {
        throw new Error(`Invalid date value provided for input '${from}'`)
    }

    switch (to) {
        case "date":
            return baseDate

        case "timestamp":
            return baseDate.getTime()

        case "string:shortdate": {
            const template = customTemplate ?? defaults.shortDate
            return dateTemplateToDate(template, baseDate)
        }

        case "string:longdate": {
            const template = customTemplate ?? defaults.longDate
            return dateTemplateToDate(template, baseDate)
        }

        default:
            throw new Error(`Invalid 'to' type: ${to}`)
    }
}