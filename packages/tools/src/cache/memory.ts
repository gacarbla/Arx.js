import { Container } from ".";
import type { NodeContainerType, MemoryAccessor } from "./types";

export class MemoryNode<
    T = {},
    DefaultK = string,
    DefaultV = any
> {
    private _children: Record<string, MemoryNode<any, any, any>> = {};
    public container = new Container<DefaultK, DefaultV>();

    addChild<
        K extends string,
        SubTree = {}
    >(
        key: K,
        builder?: (
            child: MemoryNode<{}, DefaultK, DefaultV>
        ) => MemoryNode<SubTree, DefaultK, DefaultV> | void
    ): MemoryNode<
        T & { [P in K]: { _tree: SubTree extends {} ? SubTree : {}; _type: NodeContainerType<DefaultK, DefaultV> } },
        DefaultK,
        DefaultV
    > {
        const childNode = new MemoryNode<any, DefaultK, DefaultV>();
        if (builder) {
            builder(childNode);
        }
        this._children[key] = childNode;
        return this as any;
    }

    withTypes<KVal = string, VVal = any>() {
        return {
            addChild: <
                K extends string,
                SubTree = {}
            >(
                key: K,
                builder?: (
                    child: MemoryNode<{}, KVal, VVal>
                ) => MemoryNode<SubTree, KVal, VVal> | void
            ): MemoryNode<
                T & { [P in K]: { _tree: SubTree extends {} ? SubTree : {}; _type: NodeContainerType<KVal, VVal> } },
                DefaultK,
                DefaultV
            > => {
                return this.addChild(key as any, builder as any) as any;
            }
        };
    }

    getChild(key: string): MemoryNode<any, any, any> | undefined {
        return this._children[key];
    }
}

export type Memory<T> = MemoryAccessor<T>;

export interface MemoryConstructor {
    // Permite instanciar con o sin `new`
    new <T>(setup: (m: MemoryNode<{}, string, any>) => MemoryNode<T, string, any>): Memory<T>;
    new <T>(setup: (m: MemoryNode<{}, string, any>) => void): Memory<T>;
    <T>(setup: (m: MemoryNode<{}, string, any>) => MemoryNode<T, string, any>): Memory<T>;
    <T>(setup: (m: MemoryNode<{}, string, any>) => void): Memory<T>;
}

export const Memory = function (
    setup: (m: MemoryNode<{}, string, any>) => any
): Memory<any> {
    const rootNode = new MemoryNode<{}, string, any>();
    setup(rootNode);

    const createProxy = (currentNode: MemoryNode<any, any, any>): any => {
        return new Proxy(currentNode.container, {
            get(target, prop: string | symbol, receiver) {
                if (prop in target) {
                    const value = Reflect.get(target, prop, receiver);
                    return typeof value === "function" ? value.bind(target) : value;
                }

                if (typeof prop === "string") {
                    const childNode = currentNode.getChild(prop);
                    if (childNode) {
                        return createProxy(childNode);
                    }
                }

                return undefined;
            },
        });
    };

    return createProxy(rootNode);
} as unknown as MemoryConstructor;