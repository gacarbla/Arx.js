/**
 * 
 * @
 * @  [EN] DEVELOPED BY GACARBLA
 * @  [ES] DESARROLLADO POR GACARBLA
 * @  [PT] DESENVOLVIDO POR GACARBLA
 * @
 * 
 **/

/**
 * 
 * FILE AND FOLDER MANAGEMENT LOGIC FILE
 * 
 * It is saved separately from the rest of the code so that it can be
 * quickly customized and adapted to the environment in which it is
 * working.
 * 
 * Feel free to modify it as you wish, but be careful,
 * 
 * it is used by `@arx.js/tools/files`.
 * 
 * - DO NOT ADD FUNCTIONS
 * - DO NOT REMOVE FUNCTIONS
 * 
 **/

import * as fs from "node:fs";
import * as path from "node:path";

/**
 * 
 * [EN] Generic file and folder management helper
 * 
 * [ES] Helper genérico de gestión de archivos y carpetas
 * 
 * [PT] Auxiliar genérico para gerenciamento de arquivos e pastas
 * 
 **/
export class Helper {
  static file = {
    /**
     * Guardas/sobrescribe un archivo en el disco.
     * Crea los directorios superiores si no existen.
     */
    save: (filePath: string, content: string | Uint8Array | NodeJS.ArrayBufferView): void => {
      const dir = path.dirname(filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(filePath, content);
    },

    /**
     * Crea un nuevo archivo únicamente si no existe previamente.
     */
    new: (filePath: string, content: string | Uint8Array | NodeJS.ArrayBufferView): void => {
      if (fs.existsSync(filePath)) {
        throw new Error(`File already exists at path: "${filePath}"`);
      }
      Helper.file.save(filePath, content);
    },

    /**
     * Obtiene el contenido de un archivo como buffer o string (si se indica encoding).
     */
    get: (filePath: string, encoding: BufferEncoding = "utf-8"): string => {
      return fs.readFileSync(filePath, { encoding });
    },

    /**
     * Elimina un archivo del sistema de archivos.
     */
    remove: (filePath: string): void => {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    },

    /**
     * Renombra un archivo manteniendo la misma ruta base.
     */
    rename(oldPath: string, newPath: string) {
      if (!fs.existsSync(oldPath)) {
        throw new Error(`Cannot rename: Source path does not exist - ${oldPath}`);
      }
      fs.renameSync(oldPath, newPath);
    },

    /**
     * Copia un archivo de una ruta a otra.
     */
    clone: (sourcePath: string, destinationPath: string): void => {
      const destDir = path.dirname(destinationPath);
      if (!fs.existsSync(destDir)) {
        fs.mkdirSync(destDir, { recursive: true });
      }
      fs.copyFileSync(sourcePath, destinationPath);
    },

    /**
     * Mueve un archivo de origen a destino.
     */
    move: (sourcePath: string, destinationPath: string): void => {
      const destDir = path.dirname(destinationPath);
      if (!fs.existsSync(destDir)) {
        fs.mkdirSync(destDir, { recursive: true });
      }
      fs.renameSync(sourcePath, destinationPath);
    }
  };

  static folder = {
    /**
     * Crea un nuevo directorio de forma recursiva.
     */
    new: (folderPath: string): void => {
      if (!fs.existsSync(folderPath)) {
        fs.mkdirSync(folderPath, { recursive: true });
      }
    },

    /**
     * Elimina un directorio y todo su contenido de forma recursiva.
     */
    remove: (folderPath: string): void => {
      if (fs.existsSync(folderPath)) {
        fs.rmSync(folderPath, { recursive: true, force: true });
      }
    },

    /**
     * Clona/Copia un directorio entero recursivamente a otra ruta.
     */
    clone: (sourceFolderPath: string, destinationFolderPath: string): void => {
      fs.cpSync(sourceFolderPath, destinationFolderPath, { recursive: true });
    },

    /**
     * Mueve un directorio a una nueva ubicación.
     */
    move: (sourceFolderPath: string, destinationFolderPath: string): void => {
      const destParent = path.dirname(destinationFolderPath);
      if (!fs.existsSync(destParent)) {
        fs.mkdirSync(destParent, { recursive: true });
      }
      fs.renameSync(sourceFolderPath, destinationFolderPath);
    },

    /**
     * Obtiene la lista de nombres de archivos y subdirectorios dentro del directorio.
     */
    getFiles: (folderPath: string): string[] => {
      if (!fs.existsSync(folderPath)) {
        return [];
      }
      return fs.readdirSync(folderPath);
    },

    /**
     * Renombra una carpeta manteniendo su ruta base.
     */
    rename: (folderPath: string, newFolderName: string): void => {
      const targetFolderPath = path.join(path.dirname(folderPath), newFolderName);
      fs.renameSync(folderPath, targetFolderPath);
    }
  };
}