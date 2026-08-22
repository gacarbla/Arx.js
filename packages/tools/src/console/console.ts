import { EventEmitter } from "node:events";
import { ScreenManager } from "./ui/ScreenManager";
import { LogViewer } from "./ui/LogViewer";
import { PromptManager } from "./ui/Prompts";
import { LogStorage } from "./storage/LogStorage";
import { Formatter } from "../format/index";
import { LogFormatter } from "./ui/LogFormatter";
import { CallerResolver, type CallerInfo } from "./utils/callerResolver";
import type { LogOptions } from "./types/logger";
import config from "./config";

export interface ConsoleEvents {
    log: (message: string, caller: CallerInfo) => void;
    error: (message: string, caller: CallerInfo) => void;
    warn: (message: string, caller: CallerInfo) => void;
    success: (message: string, caller: CallerInfo) => void;
    input: (type: string, result: unknown, caller: CallerInfo) => void;
}

export class Console extends EventEmitter {
    private screenManager: ScreenManager;
    private logViewer: LogViewer;
    private promptManager: PromptManager;
    private storage: LogStorage;
    private historyBuffer: string[] = [];
    private config = config.current

    public input: {
        text: (label: string) => Promise<string>;
        select: (label: string, options: string[]) => Promise<{ index: number; value: string }>;
    };

    constructor() {
        super();
        this.screenManager = new ScreenManager();
        this.logViewer = new LogViewer(this.screenManager.screen);
        this.promptManager = new PromptManager(this.screenManager.screen);
        this.storage = new LogStorage(this);

        this.input = {
            text: async (label) => {
                const caller = CallerResolver.getCaller();
                const res = await this.promptManager.text(label);
                this.emit("input", "text", res, caller);
                await this.storage.autoSave("input", `INPUT [text] (${label}): ${res}`);
                return res;
            },
            select: async (label, options) => {
                const caller = CallerResolver.getCaller();
                const res = await this.promptManager.select(label, options);
                this.emit("input", "select", res, caller);
                await this.storage.autoSave("input", `INPUT [select] (${label}): ${res.value}`);
                return res;
            },
        };

        this.screenManager.render();

        config.onChange((newConfig) => this.config = newConfig)
    }

    private write(
        level: string,
        color: string,
        args: unknown[],
        options: LogOptions = {}
    ): void {
        const caller = CallerResolver.getCaller();
        const timestamp = Formatter.dates("template", this.config.dateFormat);
        const message = LogFormatter.formatArgs(args);

        const styledLog = LogFormatter.applyTags(timestamp, level, color, message, options);
        const rawLog = `${timestamp} [${level.toUpperCase()}] [${caller.filePath}:${caller.line}] ${message}`;

        this.logViewer.addLog(styledLog);
        this.historyBuffer.push(rawLog);

        if (level !== "error" || this.listenerCount("error") > 0) {
            this.emit(level, message, caller);
        }

        this.storage.autoSave(level, rawLog);
    }

    public log(...args: unknown[]): void {
        const { cleanArgs, options } = this.extractOptions(args);
        this.write("log", "blue", cleanArgs, options);
    }

    public error(...args: unknown[]): void {
        const { cleanArgs, options } = this.extractOptions(args);
        this.write("error", "red", cleanArgs, options);
    }

    public warn(...args: unknown[]): void {
        const { cleanArgs, options } = this.extractOptions(args);
        this.write("warn", "yellow", cleanArgs, options);
    }

    public success(...args: unknown[]): void {
        const { cleanArgs, options } = this.extractOptions(args);
        this.write("success", "green", cleanArgs, options);
    }

    private extractOptions(args: unknown[]): { cleanArgs: unknown[]; options: LogOptions } {
        if (args.length === 0) return { cleanArgs: [], options: {} };

        const lastArg = args[args.length - 1];
        const isOptionsObject =
            typeof lastArg === "object" &&
            lastArg !== null &&
            !Array.isArray(lastArg) &&
            ("colorizeLine" in lastArg || "bold" in lastArg);

        if (isOptionsObject) {
            return { cleanArgs: args.slice(0, -1), options: lastArg as LogOptions };
        }

        return { cleanArgs: args, options: {} };
    }

    public async save(filePath: string): Promise<void> {
        await this.storage.save(filePath, this.historyBuffer);
    }
}