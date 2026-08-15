import type { SynchronizedDirectory } from "./models";

export type MappedMemoryTree<T extends DirectoryTree> = {
    [K in keyof T]: SynchronizedDirectory & MappedMemoryTree<T[K]>;
};

export type DirectoryTree = {
    [key: string]: DirectoryTree;
};

export type ExecutableDirectoryTree = DirectoryTree & ApplyObjectFunctionType
export type ApplyFunctionType = () => Promise<void>;
export type ApplyObjectFunctionType = {apply: () => Promise<void>};