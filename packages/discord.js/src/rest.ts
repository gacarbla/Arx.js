import type {
    RequestOptions,
    RestFile,
    RestLike,
    RestResponse,
} from "@arx.js/discord";

interface RawFile {
    data: Buffer | Uint8Array | string;
    name: string;
    contentType?: string;
}

interface DiscordJsRest {
    get(route: string, options?: Record<string, unknown>): Promise<unknown>;
    post(route: string, options?: Record<string, unknown>): Promise<unknown>;
    put(route: string, options?: Record<string, unknown>): Promise<unknown>;
    patch(route: string, options?: Record<string, unknown>): Promise<unknown>;
    delete(route: string, options?: Record<string, unknown>): Promise<unknown>;
}

/** Adapts discord.js' REST manager to the ARX `RestLike` contract. */
export class DiscordJsRestAdapter implements RestLike {
    constructor(private readonly rest: DiscordJsRest) {}

    public request<T>(route: string, options: RequestOptions = {}): Promise<T> {
        const method = (options.method ?? "GET").toUpperCase();

        return this.dispatch<T>(method, route, options);
    }

    public get<T>(route: string, options: RequestOptions = {}): Promise<T> {
        return this.request<T>(route, { ...options, method: "GET" });
    }

    public post<T>(route: string, body?: unknown, options: RequestOptions = {}): Promise<T> {
        return this.request<T>(route, { ...options, method: "POST", body });
    }

    public put<T>(route: string, body?: unknown, options: RequestOptions = {}): Promise<T> {
        return this.request<T>(route, { ...options, method: "PUT", body });
    }

    public patch<T>(route: string, body?: unknown, options: RequestOptions = {}): Promise<T> {
        return this.request<T>(route, { ...options, method: "PATCH", body });
    }

    public delete<T>(route: string, options: RequestOptions = {}): Promise<T> {
        return this.request<T>(route, { ...options, method: "DELETE" });
    }

    public async requestWithResponse<T>(
        route: string,
        options: RequestOptions = {}
    ): Promise<RestResponse<T>> {
        const data = await this.request<T>(route, options);
        const body = data === undefined ? null : JSON.stringify(data);

        return {
            data,
            response: new Response(body, {
                status: 200,
                headers: { "content-type": "application/json" },
            }),
        };
    }

    private async dispatch<T>(
        method: string,
        route: string,
        options: RequestOptions
    ): Promise<T> {
        const data = await this.toRestOptions(options);

        switch (method) {
            case "POST":
                return (await this.rest.post(route, data)) as T;
            case "PUT":
                return (await this.rest.put(route, data)) as T;
            case "PATCH":
                return (await this.rest.patch(route, data)) as T;
            case "DELETE":
                return (await this.rest.delete(route, data)) as T;
            default:
                return (await this.rest.get(route, data)) as T;
        }
    }

    private async toRestOptions(options: RequestOptions): Promise<Record<string, unknown>> {
        const {
            method: _method,
            body,
            files,
            retries: _retries,
            timeout: _timeout,
            headers,
            ...rest
        } = options;

        return {
            ...rest,
            body,
            ...(headers ? { headers: Object.fromEntries(new Headers(headers).entries()) } : {}),
            ...(files?.length ? { files: await Promise.all(files.map(toRawFile)) } : {}),
        };
    }
}

async function toRawFile(file: RestFile): Promise<RawFile> {
    let data: Buffer | Uint8Array | string;

    if (typeof file.data === "string") {
        data = file.data;
    } else if (file.data instanceof Blob) {
        data = Buffer.from(await file.data.arrayBuffer());
    } else if (file.data instanceof ArrayBuffer) {
        data = Buffer.from(file.data);
    } else if (ArrayBuffer.isView(file.data)) {
        data = Buffer.from(file.data.buffer, file.data.byteOffset, file.data.byteLength);
    } else {
        data = Buffer.from(file.data as ArrayBuffer);
    }

    return {
        name: file.filename ?? file.name ?? "file",
        data,
        ...(file.contentType ? { contentType: file.contentType } : {}),
    };
}
