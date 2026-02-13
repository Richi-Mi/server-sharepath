import { Usuario } from "../../data/model";
import { UserModel } from "./usuario.model";
import { GetUserPublicationsUseCase } from "../../domain/use-cases/GetUserPublicationsUseCase";
import { PostgresDataSource } from "../../data/PostgresDataSource";
import { FileDataSource } from "../../data/FileDataSource";
import { CustomError } from "../../domain/CustomError";
import { FindManyOptions, ILike } from "typeorm";
export class UserController {

    private getUserPublicationsUseCase = new GetUserPublicationsUseCase();
    constructor(
        private userRepository = PostgresDataSource.getRepository(Usuario),
        private fileDataSource = FileDataSource.getInstance()
    ) { }

    public getAllUsers = async () => {
        const usuarios = await this.userRepository.find({
            // relations: ["amistades"],
        });

        /*Para que no se muestren las claves de los usuarios en /user/all*/
        return usuarios.map((usuario) => {
            const { password, ...usuarioC } = usuario;
            return usuarioC;
        });
    };

    public getUserInfo = async (correo: string): Promise<Usuario> => {
        const user = await this.userRepository.findOne({ where: { correo } });
        if (!user) throw new CustomError("Usuario no encontrado", 404);

        user.foto_url = user.foto_url;
        return user;
    };
    public deleteUser = async (correo: string): Promise<Usuario> => {
        const user = await this.userRepository.findOne({ where: { correo } });
        if (!user) throw new CustomError("Usuario no encontrado", 404);
        if (user.foto_url) await this.fileDataSource.deleteFile(user.foto_url);

        await this.userRepository.remove(user);
        return user;
    };

    public updateUser = async (
        correo: string,
        body: UserModel.UpdateUserBody
    ): Promise<Usuario> => {
        const user = await this.userRepository.findOne({ where: { correo } });
        if (!user) throw new CustomError("Usuario no encontrado", 404);
        user.username = body.username || user.username;
        user.nombre_completo = body.nombre_completo || user.nombre_completo;
        if (body.privacity_mode !== undefined) {
            user.privacity_mode = body.privacity_mode === "true";
        }

        if (body.foto) {
            if (user.foto_url) await this.fileDataSource.deleteFile(user.foto_url);
            user.foto_url = await this.fileDataSource.saveFile(body.foto);
        }
        await this.userRepository.save(user);
        return {
            ...user,
            foto_url: user.foto_url,
        };
    };
    public updatePassword = async (
        correo: string,
        newPassword: string
    ): Promise<void> => {
        const user = await this.userRepository.findOne({ where: { correo } });
        if (!user) throw new CustomError("Usuario no encontrado", 404);

        user.password = await Bun.password.hash(newPassword);
        await this.userRepository.save(user);
    };
    public verifyPassword = async (
        correo: string,
        password: string
    ): Promise<boolean> => {
        const user = await this.userRepository.findOne({ where: { correo } });

        if (!user) throw new CustomError("Usuario no encontrado", 404);

        return await Bun.password.verify(password, user.password);
    };

    public searchTravelers = async (
        searchTerm: string | undefined
    ): Promise<Partial<Usuario>[]> => {
        if (!searchTerm || searchTerm.trim() === "") {
            return [];
        }
        const searchPattern = ILike(`%${searchTerm}%`);
        const options: FindManyOptions<Usuario> = {
            where: [
                { nombre_completo: searchPattern, privacity_mode: true },
                { username: searchPattern, privacity_mode: true },
            ],
            select: {
                username: true,
                nombre_completo: true,
                foto_url: true,
                correo: true,
            },
            take: 10,
        };
        const users = await this.userRepository.find(options);
        return users;
    };

    public getProfileBySearch = async (termino: string) => {
        const user = await this.userRepository.findOne({
            where: [
                { username: termino },
                { correo: termino },
                { nombre_completo: termino },
            ],
        });
        if (!user) {
            throw new CustomError("Usuario no encontrado", 404);
        }
        let publicaciones: any[] = [];
        try {
            publicaciones = await this.getUserPublicationsUseCase.execute(user.correo);
        } catch (error) {
            console.error("Error cargando publicaciones:", error);
            publicaciones = [];
        }
        const responseLimpio = {
            correo: user.correo,
            username: user.username,
            nombre_completo: user.nombre_completo,
            foto_url: user.foto_url,
            privacity_mode: user.privacity_mode,
            role: user.role,
            publicaciones: publicaciones.map(pub => ({
                id: pub.id,
                descripcion: pub.descripcion,
                privacity_mode: pub.privacity_mode,
                fotos: pub.fotos,
                itinerario: pub.itinerario ? {
                    id: pub.itinerario.id,
                    nombre: pub.itinerario.nombre || "Itinerario",
                } : null
            }))
        };
        return responseLimpio;
    };


    public getItineraryCount = async (correo: string): Promise<number> => {
        const user = await this.userRepository.findOne({ where: { correo } });
        if (!user) throw new CustomError("Usuario no encontrado", 404);

        const itineraryAmount = await PostgresDataSource.getRepository("Itinerario")
            .createQueryBuilder("itinerario")
            .where("itinerario.ownerCorreo = :usuarioId", { usuarioId: correo })
            .getCount();

        return itineraryAmount;
    };
    public getFriendsCount = async (correo: string): Promise<number> => {
        const user = await this.userRepository.findOne({ where: { correo } });
        if (!user) throw new CustomError("Usuario no encontrado", 404);

        const friendsAmount = await PostgresDataSource.getRepository("Amigo")
            .createQueryBuilder("amigo")
            .where("amigo.receiving_user = :usuarioId", { usuarioId: correo })
            .orWhere("amigo.requesting_user = :usuarioId", { usuarioId: correo })
            .getCount();

        return friendsAmount;
    };

    public getProfileByUsername = async (username: string) => {
        const user = await this.userRepository.findOne({
            where: { username },
        });
        if (!user) {
            throw new CustomError("Usuario no encontrado", 404);
        }
        let publicaciones: any[] = [];
        try {
            publicaciones = await this.getUserPublicationsUseCase.execute(user.correo);
        } catch (error) {
            console.error("Error cargando publicaciones:", error);
            publicaciones = [];
        }
        const responseLimpio = {
            correo: user.correo,
            username: user.username,
            nombre_completo: user.nombre_completo,
            foto_url: user.foto_url,
            privacity_mode: user.privacity_mode,
            role: user.role,
            publicaciones: publicaciones.map(pub => ({
                id: pub.id,
                descripcion: pub.descripcion,
                privacity_mode: pub.privacity_mode,
                fotos: pub.fotos,
                itinerario: pub.itinerario ? {
                    id: pub.itinerario.id,
                    nombre: pub.itinerario.nombre || "Itinerario",
                } : null
            }))
        };
        return responseLimpio;
    }
    public deleteUserByUsername = async (username: string): Promise<{ message: string, deletedUser: string }> => {
        // 1. OJO AQUÍ: Debe decir 'username', NO 'correo'
        const user = await this.userRepository.findOne({ where: { username: username } });

        // Si no lo encuentra, lanzamos error (asegúrate de que CustomError esté importado arriba)
        if (!user) {
            throw new CustomError(`Usuario con username '${username}' no encontrado`, 404);
        }

        // 2. Eliminamos foto si existe
        if (user.foto_url) {
            try {
                await this.fileDataSource.deleteFile(user.foto_url);
            } catch (error) {
                console.error("Error borrando archivo, continuamos con la eliminación del user:", error);
            }
        }

        // 3. Eliminamos el registro
        await this.userRepository.remove(user);

        return {
            message: "Usuario eliminado correctamente",
            deletedUser: username
        };
    };
}
