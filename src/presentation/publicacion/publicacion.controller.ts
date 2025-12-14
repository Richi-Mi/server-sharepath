import { GetPublicationAverageRatingUseCase } from "../../domain/use-cases/GetPublicationAverageRatingUseCase";
import { ShareItineraryUseCase } from "../../domain/use-cases/ShareItineraryUseCase";
import { GetUserPublicationsUseCase } from "../../domain/use-cases/GetUserPublicationsUseCase";
import { CustomError } from "../../domain/CustomError";
import { PublicacionModel } from "./publicacion.model";
import { FileDataSource } from "../../data/FileDataSource";
import { PostgresDataSource } from "../../data/PostgresDataSource";
import { Foto } from "../../data/model/Foto";
import { Publicacion } from "../../data/model";
import { Not, In } from "typeorm";

import { Itinerario, Preferencias, Amigo, Usuario } from "../../data/model";
import { AmigoController } from "../amigo/amigo.controller";

export class PublicacionController {
    
    constructor(
        private readonly getAverageRatingUseCase: GetPublicationAverageRatingUseCase = new GetPublicationAverageRatingUseCase(),
        private readonly shareItineraryUseCase: ShareItineraryUseCase = new ShareItineraryUseCase(),
        private readonly getUserPublicationsUseCase: GetUserPublicationsUseCase = new GetUserPublicationsUseCase(),
        private readonly fileDataSource = FileDataSource.getInstance("development"), 
        private readonly fotoRepository = PostgresDataSource.getRepository(Foto),
        private readonly publicacionRepository = PostgresDataSource.getRepository(Publicacion),

        private prefRepository = PostgresDataSource.getRepository(Preferencias), 
        private itineRepository = PostgresDataSource.getRepository(Itinerario),
        private amigoController : AmigoController = new AmigoController(PostgresDataSource.getRepository(Amigo), PostgresDataSource.getRepository(Usuario)),
    ) {}

    public getAverageRating = async (publicationId: number) => {
        if (isNaN(publicationId) || publicationId <= 0) {
            throw new CustomError("ID de publicación no válido", 400);
        }
        return await this.getAverageRatingUseCase.execute(publicationId);
    }
    
    public shareItinerary = async (
        itinerarioId: number, 
        userCorreo: string, 
        body: PublicacionModel.ShareBody
    ) => {
        const { descripcion, privacity_mode, fotos } = body;
        
        if (isNaN(itinerarioId) || itinerarioId <= 0) {
            throw new CustomError("ID de itinerario no válido", 400);
        }
       
        const [publication, fileUrls] = await Promise.all([
            this.shareItineraryUseCase.execute({
                itinerarioId,
                userCorreo,
                descripcion,
                privacity_mode: privacity_mode === "true" ? true : false
            }),
            this.fileDataSource.saveFiles(fotos || [])
        ])
        
        for (let i = 0; i < fileUrls.length; i++) {
            const foto = new Foto();
            foto.foto_url = fileUrls[i];
            foto.publicacion = publication;
            await this.fotoRepository.save(foto);
        }
        
        return { ...publication, fotos: fileUrls };
         
    }

    // public getMyPublications = async (userCorreo: string) => {
    //     const publicaciones = await this.publicacionRepository.find({
    //         // where: { user_shared: { correo: userCorreo } }, //Comentando esta linea se muestran todas las publicaciones
    //         relations: ['itinerario', 'fotos', 'user_shared', 'reseñas', 'reseñas.usuario'],
    //         order: { id: 'DESC' }
    //     });

    //     return publicaciones;
    // }

    public getMyPublications = async (userCorreo: string) => {
        //Obtiene las preferencias del usuario
        const preferencias = await this.prefRepository.find( {where: {correo: userCorreo}}); //No se porque no jalo con findOneBy
        
        //Funcion para pasar los estados a minusculas y sin acentos porque en la API vienen sin acentos, y en el cuestionario de preferencias con acentos.
        const sinAcentos = (texto: string) => texto.normalize('NFD').replace(/[\u0300-\u036f]/g, "").toLowerCase();

        //Obtiene:
        const lugaresPreferidos = preferencias[0]?.lugares_preferidos; //Los lugares preferidos del usuario
        const estadosVisitados = preferencias[0]?.estados_visitados; //Los estados preferidos del usuario
        const actividadesPreferidas = preferencias[0]?.actividades_preferidas; //Las actividades preferidas del usuario
        
        //Obtiene mis publicaciones
        let misPublicaciones = await this.publicacionRepository.find({
            where: { user_shared: { correo: userCorreo }},
            relations: ['itinerario', 'fotos', 'user_shared', 'reseñas', 'reseñas.usuario'],
            // order: { id: 'DESC' }
        });

        //Obtiene mis amigos
        const misAmigos = await this.amigoController.listFriend(userCorreo) || [];
        const correoAmigos = misAmigos.flatMap(a => [a.requesting_user.correo, a.receiving_user.correo])
                                        .filter(c => c !== userCorreo);

        //Obtiene las publicaciones de mis amigos
        let publicacionesAmigos = await this.publicacionRepository.find({
            where: { user_shared: { correo: In(correoAmigos) } },
            relations: ['itinerario', 'fotos', 'user_shared', 'reseñas', 'reseñas.usuario'],
        });

        //Obtiene las publicaciones de otros usuarios (ni las mias ni las de mis amigos)
        let otrasPublicaciones = await this.publicacionRepository.find({
            where: { user_shared: { correo: Not( In( [userCorreo, ...correoAmigos] ) ) } },
            relations: ['itinerario', 'fotos', 'user_shared', 'reseñas', 'reseñas.usuario', 'itinerario.actividades', 'itinerario.actividades.lugar'], //Cargar las relaciones de actividades y lugar porque sino no se pueden buscar con el filter. No se carga esa informacion
        });

        // Filtra los itinerarios que vayan de acuerdo a las preferencias del usuario
        if(preferencias && preferencias.length !== 0)
        {
            otrasPublicaciones = otrasPublicaciones.filter(pub => {
                const estados = pub.itinerario.actividades.map(act => sinAcentos(act.lugar.mexican_state)) || [];

                // console.log(estados);
                const edosSinAcentos = estadosVisitados.map(e => sinAcentos(e));

                const coincide = estados.some(estado => edosSinAcentos.includes(estado));
                return coincide;
            });   
        }

        //Obtiene todos los itinerarios
        // const itinerarios = await this.itineRepository.find({
        //     relations: ["actividades", "actividades.lugar", "owner"],
        // });

        //Agrega el promedio de calificacion de la tabla de resenas
        const agregarPromedio = async (publicaciones: typeof misPublicaciones) => {
            return await Promise.all(
                publicaciones.map(async pub => {
                    const rating = await this.getAverageRating(pub.id);
                    return { ...pub, averageRating: rating.averageRating };
                })
            );
        };

        //type PublicacionConRating = Publicacion & { averageRating: number };

        // let misPublicaciones: PublicacionConRating[] = await agregarPromedio(misPublicaciones);
        // misPublicaciones.sort((a, b) => b.averageRating - a.averageRating);
        
        //Agrega el promedio a las publicaciones
        misPublicaciones = await agregarPromedio(misPublicaciones);
        publicacionesAmigos = await agregarPromedio(publicacionesAmigos);
        otrasPublicaciones = await agregarPromedio(otrasPublicaciones);

        //Ordena las publicaciones por su promedio (score)
        (misPublicaciones as any).sort((a : any, b : any) => b.averageRating - a.averageRating);
        (publicacionesAmigos as any).sort((a : any, b : any) => b.averageRating - a.averageRating);
        (otrasPublicaciones as any).sort((a : any, b : any) => b.averageRating - a.averageRating);

        //El feed son las publicaciones:
        const feed = [
            ...misPublicaciones,    //mias,
            ...publicacionesAmigos, //de amigos,
            ...otrasPublicaciones   //de preferencias o, si no hay preferencias, todas las demas.
        ]

        return feed;   //feed del usuario
    }

    public deletePublication = async (publicationId: number, userCorreo: string) => {
        const publicacion = await this.publicacionRepository.findOne({
            where: { id: publicationId },
            relations: ['user_shared']
        });

        if (!publicacion) {
            throw new CustomError("Publicación no encontrada", 404);
        }

        if (publicacion.user_shared.correo !== userCorreo) {
            throw new CustomError("No tienes permiso para borrar esta publicación", 403);
        }

        await this.publicacionRepository.remove(publicacion);
        return { message: "Publicación eliminada correctamente" };
    }

    public getPublicationWithResenas = async (publicationId: number, authUserCorreo?: string) => {
        const publicacion = await this.publicacionRepository.findOne({
            where: { id: publicationId },
            relations: [
                'itinerario', 
                'fotos', 
                'user_shared',
                'reseñas', 
                'reseñas.usuario'
            ]
        });

        if (!publicacion) {
            throw new CustomError("Publicación no encontrada", 404);
        }

        let canAccess = false;
        
        if (publicacion.privacity_mode === false) {
            canAccess = true;
        } else if (authUserCorreo) {
            canAccess = publicacion.user_shared.correo === authUserCorreo;
        } else {
            canAccess = false;
        }

        if (!canAccess) {
            throw new CustomError("No tienes acceso a esta publicación", 403);
        }

        const response = {
            id: publicacion.id,
            descripcion: publicacion.descripcion,
            privacity_mode: publicacion.privacity_mode,
            itinerario: publicacion.itinerario ? {
                id: publicacion.itinerario.id,
                title: publicacion.itinerario.title
            } : null,
            user_shared: {
                username: publicacion.user_shared.username,
                nombre_completo: publicacion.user_shared.nombre_completo,
                foto_url: publicacion.user_shared.foto_url,
                correo: publicacion.user_shared.correo
            },
            fotos: publicacion.fotos ? publicacion.fotos.map(foto => ({
                id: foto.id,
                foto_url: foto.foto_url
            })) : [],
            reseñas: publicacion.reseñas ? publicacion.reseñas.map(resena => ({
                id: resena.id,
                score: resena.score,
                commentario: resena.commentario,
                usuario: {
                    username: resena.usuario.username,
                    nombre_completo: resena.usuario.nombre_completo,
                    foto_url: resena.usuario.foto_url
                }
            })) : []
        };

        return response;
    }
}