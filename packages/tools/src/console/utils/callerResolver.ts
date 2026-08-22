import path from "node:path";

export interface CallerInfo {
    filePath: string;
    line: number;
    column: number;
}

export class CallerResolver {
    public static getCaller(): CallerInfo {
        const originalPrepareStackTrace = Error.prepareStackTrace;
        let callerInfo: CallerInfo = { filePath: "unknown", line: 0, column: 0 };

        try {
            Error.prepareStackTrace = (_, stack) => stack;
            const err = new Error();
            const stack = err.stack as unknown as NodeJS.CallSite[];

            if (stack && Array.isArray(stack)) {
                for (let i = 0; i < stack.length; i++) {
                    const fileName = stack[i].getFileName();
                    if (
                        fileName &&
                        !fileName.includes("src/console") &&
                        !fileName.includes("node_modules") &&
                        !fileName.startsWith("node:")
                    ) {
                        callerInfo = {
                            filePath: path.resolve(fileName.replace("file://", "")),
                            line: stack[i].getLineNumber() || 0,
                            column: stack[i].getColumnNumber() || 0,
                        };
                        break;
                    }
                }
            }
        } catch {
            
        } finally {
            Error.prepareStackTrace = originalPrepareStackTrace;
        }

        return callerInfo;
    }
}