import fs from "fs/promises";
import path from "path";

import { CustomError } from "../domain/CustomError";

interface FileData {
    mimeType: string;
    buffer: Buffer;
}

export class FileDataSource {

    // Singleton Instance.
    static instance: FileDataSource | null = null;

    public static getInstance(environment: string = Bun.env.ENVIRONMENT): FileDataSource {
        if (this.instance === null) 
            this.instance = new FileDataSource(environment);
        return this.instance;
    }

    private uploadDir:  string;
    private hostUrl:    string = Bun.env.HOST || "http://localhost:4000";
    private availableExtensions: string[] = ["jpg", "jpeg", "png"];

    private constructor(environment: string = Bun.env.ENVIRONMENT) {
        this.uploadDir = environment === "development"
                ? path.join(import.meta.dir, "../../uploads/")
                : path.join("/fotos");
    }

    public async saveFile(foto: File): Promise<string> {
        try {
            
            // Validate extensión.
            const extension     = foto.name.split(".").pop()?.toLowerCase();
            
            if (!this.availableExtensions.includes(extension || "")) 
                throw new CustomError("Tipo de archivo no permitido", 400);

            const buffer        = Buffer.from(await foto.arrayBuffer());
            const uniqueSuffix  = Date.now() + "-" + Math.round(Math.random() * 1e9);
            const filename      = `${uniqueSuffix}-${foto.name}`;
            const filePath      = path.join(this.uploadDir, filename);

            await fs.mkdir(this.uploadDir, { recursive: true });
            await fs.writeFile(filePath, buffer);

            const publicUrl = new URL(`/fotos/${filename}`, this.hostUrl);
            return publicUrl.href;
        } catch (error) {
            throw new CustomError("Error al guardar la foto - Comuniquese con el administrador", 500);
        }
    }
    public saveFiles(fotos: File[]): Promise<string[]> {

        // Validate extensión.
        fotos.forEach( foto => {
            const extension = foto.name.split(".").pop()?.toLowerCase();

            if (!this.availableExtensions.includes(extension || "")) 
                throw new CustomError("Tipo de archivo no permitido", 400);
        })

        const savePromises = fotos.map((foto) => this.saveFile(foto));
        return Promise.all(savePromises);
    }

    public async deleteFile(filePath: string): Promise<void> {
        try {
            // Delete from URL
            const cleanName = filePath.replace("/fotos/", "").replace(/^\/+/, "");
            const fullPath = path.join(this.uploadDir, cleanName);
            await fs.unlink(fullPath);

        } catch (error: any) {
            // Delete from filePath
            try {
                const url = new URL(filePath);
                const fileName = path.basename(url.pathname);
                const fullPath = path.join(this.uploadDir, fileName);
                await fs.unlink(fullPath);
            } catch (finalError) {
                console.error(
                    "Error al eliminar la foto (segundo intento):",
                    finalError
                );
                throw new CustomError(
                    "Error al eliminar la foto - Comuniquese con el administrador",
                    500
                );
            }
        }
    }

    public async getFileFromSource(
        filePath: string
    ): Promise<FileData> {
        const foto = await fs.readFile(path.join(this.uploadDir, filePath));
        if (!foto) {
            throw new CustomError("Archivo no encontrado", 404);
        }
        const extension = filePath.split(".").pop()?.toLowerCase();
        let mimeType = "application/octet-stream";

        switch (extension) {
            case "jpg":
            case "jpeg":
                mimeType = "image/jpeg";
                break;
            case "png":
                mimeType = "image/png";
                break;
        }
        return {
            mimeType,
            buffer: foto,
        };
    }
}
