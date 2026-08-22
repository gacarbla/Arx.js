import fs from "node:fs/promises";
import path from "node:path";
import config from "../config";
import { Console } from "../console";
import { Formatter } from "../../format/index";

export class LogStorage {
    private currentLinesCount = 0;

    private filePath?: string
    private fileName?: string

    private config = config.current

    constructor(private console: Console) {
        config.onChange(async (newConfig) => {
            this.config = newConfig;
            await this.updateStorageConfig();
        });
    }

    public async updateStorageConfig() {
        this.updateName();
        if (!this.fileName) throw Error("No fue posible actualizar el nombre del archivo de LogStorage");
        await this.updateFilePath();
    }

    private updateName() {
        const old_name = `${this.fileName}`;
        this.fileName = this.config.logs.singleFile
            ? "console.log"
            : Formatter.dates("template", this.config.logFile.filenameTemplate);
        if (old_name === this.fileName && old_name !== "undefined") {
            process.stderr.write("[LOGSTORAGE WARN] Recuerda utilizar un nombre irrepetible para el archivo de logs.\n");
        }
    }

    private async updateFilePath() {
        if (!this.fileName) throw Error("El nombre del archivo de LogStorage no está declarado");
        const targetDir = path.resolve(this.config.logFile.directory);
        await fs.mkdir(targetDir, { recursive: true });
        this.filePath = path.join(targetDir, this.fileName);
    }

    public async autoSave(level: string, entry: string): Promise<void> {

        if (!this.config.logs.enabled) return;
        if (!this.config.logs.allowedLevels.includes(level as any)) return;

        if (
            !this.config.logFile.keepFilename
            || !this.fileName
            || this.currentLinesCount > this.config.logFile.splitAtLine
        ) {
            this.updateName()
        }

        if (!this.config.logFile.keepFilepath || !this.filePath) {
            await this.updateFilePath()
        }

        if (!this.fileName || !this.filePath) throw new Error("No fue posible obtener los valores necesarios para iniciar el LogStorage.")

        const targetDir = path.resolve(this.config.logFile.directory);

        let contentToWrite = entry + "\n";
        if (this.config.logs.singleFile && this.currentLinesCount === 0) {
            try {
                await fs.access(this.filePath);
                contentToWrite = `${this.config.logs.separator}` + contentToWrite;
            } catch { }
        }

        if (this.config.logFile.maxLines > 0 && this.currentLinesCount >= this.config.logFile.maxLines) {
            await fs.writeFile(this.filePath, contentToWrite, "utf-8");
            this.currentLinesCount = 1;
        } else {
            await fs.appendFile(this.filePath, contentToWrite, "utf-8");
            this.currentLinesCount++;
        }

        if (this.config.logFile.maxFiles > 0 && !this.config.logs.singleFile) {
            await this.cleanOldFiles(targetDir, this.config.logFile.maxFiles);
        }
    }

    private async cleanOldFiles(directory: string, maxFiles: number): Promise<void> {
        try {
            const files = await fs.readdir(directory);
            if (files.length <= maxFiles) return;

            const fileStats = await Promise.all(
                files.map(async (file) => {
                    const fullPath = path.join(directory, file);
                    const stat = await fs.stat(fullPath);
                    return { fullPath, time: stat.mtimeMs };
                })
            );

            fileStats.sort((a, b) => a.time - b.time);

            const filesToDelete = fileStats.slice(0, fileStats.length - maxFiles);
            for (const file of filesToDelete) {
                await fs.unlink(file.fullPath);
            }
        } catch {

        }
    }

    public async save(filePath: string, buffer: string[]): Promise<void> {
        const absolutePath = path.resolve(filePath);
        await fs.mkdir(path.dirname(absolutePath), { recursive: true });
        await fs.writeFile(absolutePath, buffer.join("\n"), "utf-8");
    }
}