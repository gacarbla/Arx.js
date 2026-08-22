import * as path from "node:path";
import { Helper } from "../helper.js";

export interface FileOptions {
    /**
     * Define si el archivo mantendrá su contenido o metadata en caché de memoria.
     * @default true
     */
    useCache?: boolean;
}

export class File {
    readonly name: string;
    readonly path: string;
    readonly completePath: string;
    readonly useCache: boolean;

    private cachedContent: string | null = null;

    constructor(filePath: string, options: FileOptions = {}) {
        this.completePath = path.resolve(filePath);
        this.name = path.basename(this.completePath);
        this.path = path.dirname(this.completePath);
        this.useCache = options.useCache ?? true;
    }

    /**
     * Obtiene el contenido del archivo.
     * Si `useCache` es true, lo lee de la memoria cuando está disponible.
     * Si `useCache` es false, siempre lee directamente del disco.
     */
    getContent(encoding: BufferEncoding = "utf-8"): string {
        if (!this.useCache) {
            return Helper.file.get(this.completePath, encoding);
        }

        if (this.cachedContent === null) {
            this.cachedContent = Helper.file.get(this.completePath, encoding);
        }

        return this.cachedContent;
    }

    /**
     * Guarda el contenido en disco y actualiza la caché local únicamente si `useCache` está activo.
     */
    save(content: string | Uint8Array | NodeJS.ArrayBufferView): void {
        Helper.file.save(this.completePath, content);

        if (this.useCache && typeof content === "string") {
            this.cachedContent = content;
        } else {
            this.cachedContent = null;
        }
    }

    /**
     * Invalida la caché local de memoria.
     */
    clearCache(): void {
        this.cachedContent = null;
    }

    /**
     * Elimina este archivo del sistema de archivos.
     */
    remove(): void {
        Helper.file.remove(this.completePath);
        this.clearCache();
    }
}