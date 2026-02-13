//CAMBIOS DE HAROL
import { PostgresDataSource } from "../../data/PostgresDataSource";
import { Actividad, Itinerario, Lugar, Usuario } from "../../data/model";
import { CustomError } from "../../domain/CustomError";
import { Payload } from "../services/auth.service";
import { ItinerarioModel } from "./itinerario.model";
import { Brackets } from "typeorm";

export class ItinerarioController {
    constructor(
        private itinerarioRepository = PostgresDataSource.getRepository(Itinerario),
        private usuarioRepository    = PostgresDataSource.getRepository(Usuario),
        private actividadRepository  = PostgresDataSource.getRepository(Actividad),
        private lugarRepository      = PostgresDataSource.getRepository(Lugar)
    ) { }

    public getAllItinerarios = async (
        authUser: Payload
    ): Promise<Itinerario[]> => {

        if (authUser.role === "admin") {
            return await this.itinerarioRepository.find({
                relations: ["actividades", "actividades.lugar"],
            });
        }

        return await this.itinerarioRepository.find({
            where: { owner: { correo: authUser.correo } },
            relations: ["actividades", "actividades.lugar"],
        });
    };

    public getItinerarioById = async (
        idString: string,
        authUser: Payload
    ): Promise<Itinerario> => {
        const itinerario = await this.itinerarioRepository.findOne({
            where: { id: parseInt(idString) },
            relations: ["actividades", "actividades.lugar", "owner"],
        });

        if (authUser.role === "admin" && itinerario) return itinerario;

        if (!itinerario) throw new CustomError("Itinerario no encontrado", 404);

        return itinerario;
    };

    public createItinerario = async (
        data: ItinerarioModel.RegItinerarioCuerpo,
        authUser: Payload
    ): Promise<Itinerario> => {
        const owner = await this.usuarioRepository.findOneBy({
            correo: authUser.correo,
        });

        if (!owner) throw new CustomError("Usuario no encontrado", 401);

        const nuevoItinerario = new Itinerario();

        nuevoItinerario.title = data.title;
        nuevoItinerario.owner = owner;

        if (!data.actividades)
            throw new CustomError(
                "El itinerario debe tener al menos una actividad",
                400
            );

        

        const actividadesPromises = data.actividades.map(async (actData) => {
            const actividad = new Actividad();

            if (actData.fecha) actividad.fecha = new Date(actData.fecha);

            const lugar = await this.lugarRepository.findOneBy({
                id_api_place: actData.lugarId,
            })

            if (!lugar) 
                throw new CustomError(`Lugar con ID ${actData.lugarId} no encontrado`, 404)

            actividad.lugar = lugar; //Asumimos que el lugar ya existe
            return actividad;
        });

        const actividades = await Promise.all(actividadesPromises);

        nuevoItinerario.actividades = actividades;
        await this.itinerarioRepository.save(nuevoItinerario);

        return nuevoItinerario;
    };

    public updateItinerario = async (
        idString: string,
        body: ItinerarioModel.ModItinerarioCuerpo,
        authUser: Payload
    ): Promise<Itinerario> => {
        const id = parseInt(idString);

        if (isNaN(id)) throw new CustomError("ID invalido", 400);

        const itinerario = await this.itinerarioRepository.findOne({
            where: {
                id: id,
                owner: {
                    correo: authUser.correo,
                },
            },
            relations: ["owner", "actividades"],
        });

        if (!itinerario) throw new CustomError("Itinerario no encontrado", 404);

        //Actualizar campos
        itinerario.title = body.title || itinerario.title;

        if (body.actividades) {
            // Eliminar actividades anteriores para evitar duplicados o huérfanos
            if (itinerario.actividades && itinerario.actividades.length > 0) {
                await this.actividadRepository.remove(itinerario.actividades);
            }

            // Crear las nuevas actividades (Referencia a createItinerario)
            itinerario.actividades = body.actividades.map((actData) => {
                const actividad = new Actividad();
                if (actData.fecha) actividad.fecha = new Date(actData.fecha);
                actividad.lugar = { id_api_place: actData.lugarId } as any;
                return actividad;
            });
        }

        //Guardar cambios
        await this.itinerarioRepository.save(itinerario);
        return this.getItinerarioById(idString, authUser);
    };

    public deleteItinerario = async (
        idString: string,
        authUser: Payload
    ): Promise<Itinerario> => {
        const id = parseInt(idString);

        if (isNaN(id)) throw new CustomError("ID invalido", 400);

        const itinerario = await this.itinerarioRepository.findOne({
            where: { id },
            relations: ["owner"],
        });

        if (!itinerario)
            throw new CustomError("No existe el itinerario", 404)

        if (itinerario.owner.correo !== authUser.correo && authUser.role !== "admin")
            throw new CustomError("No tienes permiso para borrar este itinerario", 403);

        await this.itinerarioRepository.remove(itinerario);
        return itinerario;
    };

    ///filtro de itinerarios
    public buscarItinerarios = async (
        buscarTerm?: string,
        categoria?: string,
        estado?: string
    ): Promise<Itinerario[]> => {
        const query = this.itinerarioRepository
            .createQueryBuilder("it")
            .leftJoinAndSelect("it.owner", "owner")
            .leftJoinAndSelect("it.actividades", "act")
            .leftJoinAndSelect("act.lugar", "lugar");
        if (categoria) {
            query.andWhere("lugar.category = :categoria", { categoria });
        }
        if (estado) {
            query.andWhere("lugar.mexican_state = :estado", { estado });
        }
        if (buscarTerm && buscarTerm.trim() !== "") {
            const term = `%${buscarTerm}%`;
            query.andWhere(
                new Brackets((qb) => {
                    qb.where("it.title ILIKE :term", { term })
                        .orWhere("lugar.nombre ILIKE :term", { term });
                })
            );
        }
        if (!buscarTerm && !categoria && !estado) {
            throw new CustomError(
                "Debe proporcionar al menos un término de búsqueda o un filtro.",
                400
            );
        }
        return await query.limit(10).getMany();
    };
}
