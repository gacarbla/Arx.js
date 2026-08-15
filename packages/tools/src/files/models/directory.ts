import * as path from "node:path";
import { Memory } from "../../cache/index.js";
import { File, type FileOptions } from "./file.js";
import { Helper } from "../helper.js";

export type DirectoryElement = SynchronizedDirectory | File;

export interface DirectoryOptions extends FileOptions {
    /**
     * Define si el directorio y sus hijos utilizarán la estructura de caché en RAM (`Memory`).
     * @default true
     */
    useCache?: boolean;
}

export class Directory {
    private readonly absolutePath: string;
    readonly useCache: boolean;

    constructor(dir: string, options: DirectoryOptions = {}) {
        this.absolutePath = path.resolve(dir);
        this.useCache = options.useCache ?? true;
    }

    async sync(): Promise<SynchronizedDirectory> {
        const syncedDir = new SynchronizedDirectory(this.absolutePath, { useCache: this.useCache });
        if (this.useCache) {
            await syncedDir.syncMemory();
        }
        return syncedDir;
    }
}

export class SynchronizedDirectory {
    readonly name: string;
    readonly path: string;
    readonly completePath: string;
    readonly useCache: boolean;

    readonly memory?: Memory<any>;

    constructor(targetPath: string, options: DirectoryOptions = {}) {
        this.completePath = path.resolve(targetPath);
        this.name = path.basename(this.completePath);
        this.path = path.dirname(this.completePath);
        this.useCache = options.useCache ?? true;

        if (this.useCache) {
            this.memory = new Memory((m) =>
                m.withTypes<string, DirectoryElement>().addChild("content")
            );
        }
    }

    async syncMemory(): Promise<void> {
        if (!this.useCache || !this.memory) return;

        const rawItems = Helper.folder.getFiles(this.completePath);
        const contentContainer = (this.memory as any).content;

        for (const itemName of rawItems) {
            const itemFullPath = path.join(this.completePath, itemName);
            let element: DirectoryElement;

            try {
                const isDirectory = Helper.folder.getFiles(itemFullPath) !== undefined;
                if (isDirectory) {
                    const subDir = new SynchronizedDirectory(itemFullPath, { useCache: true });
                    await subDir.syncMemory();
                    element = subDir;
                } else {
                    element = new File(itemFullPath, { useCache: true });
                }
            } catch {
                element = new File(itemFullPath, { useCache: true });
            }

            contentContainer.set(itemName, element);
        }
    }

    async sync(): Promise<SynchronizedDirectory> {
        const newSyncedDir = new SynchronizedDirectory(this.completePath, { useCache: this.useCache });
        if (this.useCache) {
            await newSyncedDir.syncMemory();
        }
        return newSyncedDir;
    }

    private readElementsFromDisk(): DirectoryElement[] {
        const rawItems = Helper.folder.getFiles(this.completePath);
        return rawItems.map((itemName) => {
            const itemFullPath = path.join(this.completePath, itemName);
            try {
                const isDirectory = Helper.folder.getFiles(itemFullPath) !== undefined;
                if (isDirectory) {
                    return new SynchronizedDirectory(itemFullPath, { useCache: false });
                }
            } catch {
                // Es un archivo
            }
            return new File(itemFullPath, { useCache: false });
        });
    }

    getChildren(): DirectoryElement[] & Promise<DirectoryElement[]> {
        const getElements = () => {
            if (!this.useCache || !this.memory) {
                return this.readElementsFromDisk();
            }
            return Array.from((this.memory as any).content.getAll().values()) as DirectoryElement[];
        };

        const promise = (async () => {
            if (this.useCache) {
                await this.syncMemory();
            }
            return getElements();
        })();

        return Object.assign(promise, {
            [Symbol.iterator]: () => getElements()[Symbol.iterator](),
            concat: (...args: any[]) => getElements().concat(...args),
            length: getElements().length
        }) as any;
    }

    getDirectories(): SynchronizedDirectory[] & Promise<SynchronizedDirectory[]> {
        const filterDirs = (items: DirectoryElement[]) =>
            items.filter((item): item is SynchronizedDirectory => item instanceof SynchronizedDirectory);

        const promise = (async () => {
            const children = await this.getChildren();
            return filterDirs(children);
        })();

        const currentDirs = filterDirs(
            this.useCache && this.memory
                ? (Array.from((this.memory as any).content.getAll().values()) as DirectoryElement[])
                : this.readElementsFromDisk()
        );

        return Object.assign(promise, {
            [Symbol.iterator]: () => currentDirs[Symbol.iterator]()
        }) as any;
    }

    getFiles(): File[] & Promise<File[]> {
        const filterFiles = (items: DirectoryElement[]) =>
            items.filter((item): item is File => item instanceof File);

        const promise = (async () => {
            const children = await this.getChildren();
            return filterFiles(children);
        })();

        const currentFiles = filterFiles(
            this.useCache && this.memory
                ? (Array.from((this.memory as any).content.getAll().values()) as DirectoryElement[])
                : this.readElementsFromDisk()
        );

        return Object.assign(promise, {
            [Symbol.iterator]: () => currentFiles[Symbol.iterator]()
        }) as any;
    }

    async addFile(name:string): Promise<File> {
        const file = new File(path.join(this.completePath, name), {useCache: this.useCache})
        return file
    }

    async removeIfEmpty(): Promise<void> {
        const currentFiles = Helper.folder.getFiles(this.completePath);
        if (currentFiles.length > 0) {
            throw new Error(`Directory is not empty: "${this.completePath}"`);
        }
        Helper.folder.remove(this.completePath);
    }

    async remove(): Promise<void> {
        Helper.folder.remove(this.completePath);
        if (this.useCache && this.memory) {
            (this.memory as any).content.getAll().clear();
        }
    }

    async createSubdirectory(folderName: string): Promise<SynchronizedDirectory> {
        const targetPath = path.join(this.completePath, folderName);
        Helper.folder.new(targetPath);
        const subDir = new SynchronizedDirectory(targetPath, { useCache: this.useCache });

        if (this.useCache && this.memory) {
            (this.memory as any).content.set(folderName, subDir);
        }

        return subDir;
    }

    async rename(newFolderName: string): Promise<void> {
        const parentDir = path.dirname(this.completePath);

        const targetCompletePath = path.join(parentDir, newFolderName);

        Helper.folder.rename(this.completePath, newFolderName);

        (this as any).completePath = targetCompletePath;
        (this as any).name = newFolderName;

        if (this.useCache) {
            await this.syncMemory();
        }
    }

    async move(destinationFolderPath: string): Promise<void> {
        Helper.folder.move(this.completePath, destinationFolderPath);
        (this as any).completePath = path.resolve(destinationFolderPath);
        (this as any).name = path.basename(this.completePath);
        (this as any).path = path.dirname(this.completePath);

        if (this.useCache) {
            await this.syncMemory();
        }
    }

    async clone(destinationFolderPath: string): Promise<SynchronizedDirectory> {
        Helper.folder.clone(this.completePath, destinationFolderPath);
        const clonedDir = new SynchronizedDirectory(destinationFolderPath, { useCache: this.useCache });

        if (this.useCache) {
            await clonedDir.syncMemory();
        }

        return clonedDir;
    }
}