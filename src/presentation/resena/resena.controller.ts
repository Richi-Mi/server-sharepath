import { PostgresDataSource } from "../../data/PostgresDataSource";
import { Resena, Publicacion, Usuario } from "../../data/model";
import { CustomError } from "../../domain/CustomError";

interface AuthUser {
    correo: string;
}

export class ResenaController {
    constructor(
        private resenaRepository = PostgresDataSource.getRepository(Resena),
        private publicacionRepository = PostgresDataSource.getRepository(Publicacion),
        private usuarioRepository = PostgresDataSource.getRepository(Usuario)
    ) {}

    private canAccessPublication = async (
        publicacionId: number, 
        authUser?: AuthUser
    ): Promise<{publicacion: Publicacion, canAccess: boolean}> => {
        const publicacion = await this.publicacionRepository.findOne({
            where: { id: publicacionId, privacity_mode: true },
            relations: ['user_shared']
        });

        if (!publicacion) {
            throw new CustomError("Publicación no encontrada", 404);
        }

        return { publicacion, canAccess: true };
    };

    public createResena = async (
        publicacionId: number,
        authUser: AuthUser,
        data: { score: number; commentario?: string }
    ): Promise<Resena> => {
        const { publicacion, canAccess } = await this.canAccessPublication(publicacionId, authUser);
        
        if (!canAccess) {
            throw new CustomError("No tienes acceso a esta publicación", 403);
        }

        if (publicacion.user_shared.correo === authUser.correo) {
            throw new CustomError("No puedes crear una reseña de tu propia publicación", 400);
        }

        const existingResena = await this.resenaRepository.findOne({
            where: {
                publicacion: { id: publicacionId },
                usuario: { correo: authUser.correo }
            }
        });

        if (existingResena) {
            throw new CustomError("Ya has creado una reseña para esta publicación", 400);
        }

        const usuario = await this.usuarioRepository.findOneBy({
            correo: authUser.correo
        });

        if (!usuario) {
            throw new CustomError("Usuario no encontrado", 404);
        }

        const nuevaResena = new Resena();
        nuevaResena.score = data.score;
        nuevaResena.commentario = data.commentario || null;
        nuevaResena.publicacion = publicacion;
        nuevaResena.usuario = usuario;

        return await this.resenaRepository.save(nuevaResena);
    };

    public updateResena = async (
        resenaId: number,
        authUser: AuthUser,
        data: { score?: number; commentario?: string }
    ): Promise<Resena> => {
        const resena = await this.resenaRepository.findOne({
            where: { id: resenaId },
            relations: ['usuario', 'publicacion', 'publicacion.user_shared']
        });

        if (!resena) {
            throw new CustomError("Reseña no encontrada", 404);
        }

        if (resena.usuario.correo !== authUser.correo) {
            throw new CustomError("No tienes permiso para modificar esta reseña", 403);
        }

        if (data.score !== undefined) {
            resena.score = data.score;
        }
        if (data.commentario !== undefined) {
            resena.commentario = data.commentario;
        }

        return await this.resenaRepository.save(resena);
    };

    public deleteResena = async (
        resenaId: number,
        authUser: AuthUser
    ): Promise<Resena> => {
        const resena = await this.resenaRepository.findOne({
            where: { id: resenaId },
            relations: ['usuario']
        });

        if (!resena) {
            throw new CustomError("Reseña no encontrada", 404);
        }

        if (resena.usuario.correo !== authUser.correo) {
            throw new CustomError("No tienes permiso para eliminar esta reseña", 403);
        }

        return await this.resenaRepository.remove(resena);
    };

    public getResenasByPublicacion = async (
        publicacionId: number,
        authUser?: AuthUser
    ): Promise<Resena[]> => {
        const { canAccess } = await this.canAccessPublication(publicacionId, authUser);
        
        if (!canAccess) {
            throw new CustomError("No tienes acceso a esta publicación", 403);
        }

        return await this.resenaRepository.find({
            where: { publicacion: { id: publicacionId } },
            relations: ['usuario'],
            order: { id: 'DESC' }
        });
    };
}