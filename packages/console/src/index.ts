import { Console as ARXConsole } from "@arx.js/tools"
import ini from "ini"
import fs from "fs"
import path from "path"
import "./config"

export interface ConsoleConfig {
    enabled: boolean
    overrideGlobal: boolean
    logLevel?: "debug" | "info" | "warn" | "error"
}

export class ARXConsoleManager {
    private static nativeConsole = { ...globalThis.console }
    private static arxInstance: ARXConsole | null = null
    private static isPatched = false

    public static init(configPath: string = "./config.ini"): void {
        const config = this.loadConfig(configPath)

        if (!config.enabled) {
            this.restore()
            return
        }

        this.arxInstance = new ARXConsole()

        if (config.overrideGlobal) {
            this.overrideGlobalConsole()
        }
    }

    private static overrideGlobalConsole(): void {
        if (this.isPatched || !this.arxInstance) return

        const arx = this.arxInstance

        globalThis.console.log = (...args: any[]) => arx.info(...args)
        globalThis.console.info = (...args: any[]) => arx.info(...args)
        globalThis.console.warn = (...args: any[]) => arx.warn(...args)
        globalThis.console.error = (...args: any[]) => arx.error(...args)
        globalThis.console.success = (...args: any[]) => arx.success?.(...args) ?? arx.info(...args)

        this.isPatched = true
    }

    public static restore(): void {
        if (!this.isPatched) return

        globalThis.console.log = this.nativeConsole.log
        globalThis.console.info = this.nativeConsole.info
        globalThis.console.warn = this.nativeConsole.warn
        globalThis.console.error = this.nativeConsole.error

        this.isPatched = false
    }

    private static loadConfig(filePath: string): ConsoleConfig {
        try {
            const fullPath = path.resolve(process.cwd(), filePath)
            if (!fs.existsSync(fullPath)) {
                return { enabled: true, overrideGlobal: false }
            }

            const fileContent = fs.readFileSync(fullPath, "utf-8")
            const parsed = ini.parse(fileContent)

            return {
                enabled: parsed.console?.enabled === true || parsed.console?.enabled === "true",
                overrideGlobal: parsed.console?.overrideGlobal === true || parsed.console?.overrideGlobal === "true",
                logLevel: parsed.console?.logLevel ?? "info",
            }
        } catch {
            return { enabled: false, overrideGlobal: false }
        }
    }
}