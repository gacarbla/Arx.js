import { Container } from ".";

export interface NodeContainerType<K = any, V = any> {
    key: K;
    value: V;
}

export type MemoryAccessor<T> = {
    [K in keyof T]: T[K] extends { _tree: infer SubTree; _type: NodeContainerType<infer KeyT, infer ValT> }
    ? ([keyof SubTree] extends [never]
        ? Container<KeyT, ValT>
        : MemoryAccessor<SubTree> & Container<KeyT, ValT>)
    : T[K] extends NodeContainerType<infer KeyT, infer ValT>
    ? Container<KeyT, ValT>
    : Container<string, any>;
};