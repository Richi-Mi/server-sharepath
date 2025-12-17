import { History, Publicacion } from "../../data/model";
import { Reporte } from "../../data/model/Reporte";
import { PostgresDataSource } from "../../data/PostgresDataSource";
import { CustomError } from "../../domain/CustomError";

export class ReporteController {
    constructor(
        private readonly reporteRepository = PostgresDataSource.getRepository(Reporte),
        private readonly publicacionRepository = PostgresDataSource.getRepository(Publicacion),
        private readonly historialRepository = PostgresDataSource.getRepository(History)
    ) {}

    async create(payload: { description: string, entity_id: number }, userCorreo: string) {
        const publicacion = await this.publicacionRepository.findOneBy({ id: payload.entity_id });
        if (!publicacion)
            throw new CustomError("Publicacion no encontrada", 404);

        const reporteExistente = await this.reporteRepository.findOne({
            where: {
                usuario_emitente: { correo: userCorreo },
                publicacion: { id: payload.entity_id }
            }
        });

        if (reporteExistente) {
            throw new CustomError("Ya has reportado esta publicación anteriormente", 409);
        }

        const reporte = new Reporte();
        reporte.description = payload.description;
        reporte.publicacion = publicacion;
        reporte.usuario_emitente = { correo: userCorreo } as any;

        const historial = new History();
        historial.action_description = `Reporte creado por ${userCorreo} para la publicacion con id ${publicacion.id} dice qué : ${payload.description}`;
        historial.reporte = reporte;

        const [creationResult] = await Promise.all([
            this.reporteRepository.save(reporte),
            this.historialRepository.save(historial)
        ]);

        return creationResult;
    }

    async getAll() {
        return await this.reporteRepository.find({ relations: ["usuario_emitente", "historial"] });
    }

    async getById(id: number) {
        return await this.reporteRepository.findOne({ where: { id }, relations: ["usuario_emitente", "historial"] });
    }

    async update(id: number, payload: Partial<{ description: string, entity_id: string }>) {
        const repo = this.reporteRepository;
        const existing = await repo.findOneBy({ id } as any);
        if (!existing) return null;
        const merged = Object.assign(existing, payload);
        return await repo.save(merged as any);
    }

    async delete(id: number) {
        return await this.reporteRepository.delete(id);
    }

    async getAdminDetail(id: number) {
        const reporte = await this.reporteRepository.findOne({
            where: { id },
            relations: [
                "usuario_emitente",
                "publicacion",
                "publicacion.itinerario",
                "historial"
            ]
        });
        if (!reporte) return null;
        return reporte;
    }

    /**
     * Aceptar Reporte (Banear): Elimina la publicación reportada.
     */
    async banPublication(reporteId: number) {
        const reporte = await this.reporteRepository.findOne({
            where: { id: reporteId },
            relations: ["publicacion"]
        });
        
        if (!reporte) throw new CustomError("El reporte no existe", 404);

        // Si la publicación ya fue borrada antes, avisamos
        if (!reporte.publicacion) {
            await this.reporteRepository.delete(reporteId);
            return { message: "La publicación ya no existía. Se limpió el reporte." };
        }

        // Eliminamos la publicación 
        await this.publicacionRepository.delete(reporte.publicacion.id);
        await this.reporteRepository.delete(reporteId);
        
        return {
            message: "Publicación eliminada correctamente y reporte cerrado."
        };
    }

    /**
     * Vista previa para el Admin
     */
    async getAdminReportsPreview() {
        const reportes = await this.reporteRepository.find({
            relations: [
                "publicacion",
                "publicacion.fotos",
                "publicacion.itinerario"
            ],
            order: { id: 'DESC' }
        });

        return reportes.map(reporte => {
            const pub = reporte.publicacion;
            
            if (!pub) {
                return {
                    reporte_id: reporte.id,
                    motivo_reporte: reporte.description,
                    estatus: "Publicación eliminada previamente",
                    data: null
                };
            }

            return {
                reporte_id: reporte.id,
                motivo_reporte: reporte.description,
                data: {
                    publicacion_id: pub.id,
                    descripcion: pub.descripcion,
                    fotos: pub.fotos ? pub.fotos.map(f => f.foto_url) : [],
                    itinerario_id: pub.itinerario ? pub.itinerario.id : null,
                    itinerario_titulo: pub.itinerario ? pub.itinerario.title : "Sin itinerario asociado"
                }
            };
        });
    }
}