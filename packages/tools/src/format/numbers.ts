import config from "./config"

export type NumberInputMap = {
    string: string
    number: number
    currency: string
    words: string
}

export type NumberOutputMap = {
    number: number
    string: string
    currency: string
    percent: string
    words: string
}

type RequiresNumberFormat<T extends keyof NumberOutputMap> = T extends "currency" | "string"
    ? [decimals?: number]
    : T extends "words"
    ? [lang?: "es" | "en"]
    : []

export type NumbersArgs<F extends keyof NumberInputMap, T extends keyof NumberOutputMap> = [
    value: NumberInputMap[F],
    to?: T,
    ...rest: RequiresNumberFormat<T>
]

export interface NumberDefaults {
    currencySymbol: string
    decimals: number
    lang: "es" | "en"
}

const UNITS_ES = ["cero", "uno", "dos", "tres", "cuatro", "cinco", "seis", "siete", "ocho", "nueve"]
const TENS_ES = ["", "diez", "veinte", "treinta", "cuarenta", "cincuenta", "sesenta", "setenta", "ochenta", "noventa"]
const TEENS_ES: Record<number, string> = {
    11: "once", 12: "doce", 13: "trece", 14: "catorce", 15: "quince",
    16: "dieciséis", 17: "diecisiete", 18: "dieciocho", 19: "diecinueve"
}

const UNITS_EN = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine"]
const TENS_EN = ["", "ten", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"]
const TEENS_EN: Record<number, string> = {
    11: "eleven", 12: "twelve", 13: "thirteen", 14: "fourteen", 15: "fifteen",
    16: "sixteen", 17: "seventeen", 18: "eighteen", 19: "nineteen"
}

function numberToWords(num: number, lang: "es" | "en"): string {
    const n = Math.floor(Math.abs(num))
    if (n < 10) return lang === "es" ? UNITS_ES[n] : UNITS_EN[n]
    if (n > 10 && n < 20) return lang === "es" ? TEENS_ES[n] : TEENS_EN[n]

    if (n < 100) {
        const tens = Math.floor(n / 10)
        const rest = n % 10
        if (lang === "es") {
            if (tens === 2 && rest > 0) return `veinti${UNITS_ES[rest]}`
            return rest === 0 ? TENS_ES[tens] : `${TENS_ES[tens]} y ${UNITS_ES[rest]}`
        } else {
            return rest === 0 ? TENS_EN[tens] : `${TENS_EN[tens]}-${UNITS_EN[rest]}`
        }
    }

    return new Intl.NumberFormat(lang === "es" ? "es-ES" : "en-US").format(num)
}

function wordsToNumber(words: string, lang: "es" | "en"): number {
    const clean = words.toLowerCase().trim()

    const mapES: Record<string, number> = {
        cero: 0, uno: 1, una: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10,
        once: 11, doce: 12, trece: 13, catorce: 14, quince: 15, dieciséis: 16, diecisiete: 17, dieciocho: 18, diecinueve: 19,
        veinte: 20, veintiuno: 21, veintidós: 22, veintitrés: 23, veinticuatro: 24, veinticinco: 25, veintiséis: 26,
        veintisiete: 27, veintiocho: 28, veintinueve: 29, treinta: 30, cuarenta: 40, cincuenta: 50, sesenta: 60,
        setenta: 70, ochenta: 80, noventa: 90, cien: 100, ciento: 100
    }

    const mapEN: Record<string, number> = {
        zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
        eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19,
        twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90, hundred: 100
    }

    const map = lang === "es" ? mapES : mapEN
    if (map[clean] !== undefined) return map[clean]

    const tokens = clean.split(/[\s-]+/).filter((t) => t !== "y")
    let total = 0
    for (const token of tokens) {
        if (map[token] !== undefined) {
            total += map[token]
        }
    }

    return total
}

export function numbersCore<
    F extends keyof NumberInputMap,
    T extends keyof NumberOutputMap
>(
    from: F,
    defaults: NumberDefaults,
    ...args: any[]
): any {
    const rawValue = args[0]
    const to = (args[1] ?? "string") as keyof NumberOutputMap
    const option = args[2]

    let baseNumber: number

    switch (from) {
        case "number":
            baseNumber = rawValue as number
            break
        case "string":
            baseNumber = parseFloat(rawValue as string)
            break
        case "currency":
            baseNumber = parseFloat(String(rawValue).replace(/[^0-9.-]+/g, ""))
            break
        case "words":
            baseNumber = wordsToNumber(rawValue as string, defaults.lang)
            break
        default:
            throw new Error(`Invalid 'from' type: ${from}`)
    }

    if (isNaN(baseNumber)) {
        throw new Error(`Invalid number value provided for input '${from}'`)
    }

    switch (to) {
        case "number":
            return baseNumber

        case "string": {
            const dec = (option as number | undefined) ?? defaults.decimals
            return baseNumber.toFixed(dec)
        }

        case "currency": {
            const dec = (option as number | undefined) ?? defaults.decimals
            return `${baseNumber.toFixed(dec)} ${defaults.currencySymbol}`
        }

        case "percent": {
            const dec = defaults.decimals
            return `${(baseNumber * 100).toFixed(dec)}%`
        }

        case "words": {
            const lang = (option as "es" | "en" | undefined) ?? defaults.lang
            return numberToWords(baseNumber, lang)
        }

        default:
            throw new Error(`Invalid 'to' type: ${to}`)
    }
}