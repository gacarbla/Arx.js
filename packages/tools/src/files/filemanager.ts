import { Directory, SynchronizedDirectory } from "./models";
import type { DirectoryTree, ExecutableDirectoryTree } from "./types";
import { Memory, MemoryNode } from "../cache/memory";


export type MappedMemoryTree<T extends DirectoryTree> = {
    [K in keyof T]?: SynchronizedDirectory & MappedMemoryTree<T[K]>;
};

export class FileManager<T extends DirectoryTree = DirectoryTree> {
    main_dir: SynchronizedDirectory | undefined;
    #structure: T | undefined;

    constructor(private readonly main_dir_path: string) { }

    async syncDir(): Promise<void> {
        this.main_dir = await new Directory(this.main_dir_path).sync();
    }

    async setStructure<const S extends DirectoryTree>(
        structure: S
    ): Promise<FileManager<S>> {
        this.#structure = structure as unknown as T;
        await this.#applyStructure()
        return this as unknown as FileManager<S>;
    }

    get structure(): ExecutableDirectoryTree | undefined {
        if (!this.#structure) return undefined;
        return Object.assign({}, this.#structure, {
            apply: async () => {
                await this.#applyStructure();
            }
        }) as ExecutableDirectoryTree;
    }

    async buildMemory(): Promise<MappedMemoryTree<T>> {
        if (!this.main_dir) {
            await this.syncDir();
        }

        if (!this.#structure) {
            throw new Error("No se ha definido una estructura en FileManager. Llama a setStructure() primero.");
        }

        await this.main_dir!.syncMemory();

        const getSubDirInstance = async (
            parent: SynchronizedDirectory,
            folderName: string
        ): Promise<SynchronizedDirectory> => {
            if (parent.memory) {
                const contentContainer = (parent.memory as any).content;
                const existing = contentContainer.get(folderName);
                if (existing) return existing as SynchronizedDirectory;
            }

            const targetPath = `${parent.completePath}/${folderName}`;
            const subDir = new SynchronizedDirectory(targetPath, { useCache: parent.useCache });
            if (parent.useCache) {
                await subDir.syncMemory();
            }
            return subDir;
        };

        const buildMemoryTree = (
            currentNode: MemoryNode<any, string, any>,
            currentDir: SynchronizedDirectory,
            tree: DirectoryTree
        ) => {
            for (const [folderName, subTree] of Object.entries(tree)) {
                if (folderName === "apply") continue;

                currentNode.addChild(folderName, (childNode) => {
                    if (subTree && Object.keys(subTree).length > 0) {
                        const subDir = (currentDir.memory as any)?.content?.get(folderName);
                        if (subDir) {
                            buildMemoryTree(childNode, subDir, subTree);
                        }
                    }
                });
            }
        };

        const memoryInstance = Memory((m) => {
            buildMemoryTree(m, this.main_dir!, this.#structure!);
        });

        const populateMemoryObject = async (
            currentDir: SynchronizedDirectory,
            tree: DirectoryTree,
            targetObj: any
        ) => {
            for (const [folderName, subTree] of Object.entries(tree)) {
                if (folderName === "apply") continue;

                const subDirInstance = await getSubDirInstance(currentDir, folderName);
                targetObj[folderName] = subDirInstance;

                if (subTree && Object.keys(subTree).length > 0) {
                    await populateMemoryObject(subDirInstance, subTree, subDirInstance);
                }
            }
        };

        await populateMemoryObject(this.main_dir!, this.#structure!, memoryInstance);

        return memoryInstance as MappedMemoryTree<T>;
    }

    async #applyStructure(): Promise<void> {
        if (!this.#structure) {
            return;
        }
        if (!this.main_dir) {
            await this.syncDir();
        }

        const createTreeRecursive = async (
            currentDir: SynchronizedDirectory,
            tree: DirectoryTree
        ): Promise<void> => {
            for (const [folderName, subTree] of Object.entries(tree)) {
                if (folderName === "apply") continue;
                const subDir = await currentDir.createSubdirectory(folderName);
                if (subTree && Object.keys(subTree).length > 0) {
                    await createTreeRecursive(subDir, subTree);
                }
            }
        };

        await createTreeRecursive(this.main_dir!, this.#structure);
        await this.main_dir!.syncMemory();
    }
}