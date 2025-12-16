//CAMBIOS DE HAROL
import { History, Publicacion } from "../../data/model";
import { Reporte } from "../../data/model/Reporte";
import { PostgresDataSource } from "../../data/PostgresDataSource";
import { CustomError } from "../../domain/CustomError";
import { UserRole, Usuario } from "../../data/model/Usuario";
import { Notificacion, NotificationType } from "../../data/model/Notificacion";
import { notificarUsuario } from "../../sockets/socketHandler";

export class ReporteController {
  constructor(
    private readonly reporteRepository = PostgresDataSource.getRepository(
      Reporte
    ),
    private readonly publicacionRepository = PostgresDataSource.getRepository(
      Publicacion
    ),
    private readonly historialRepository = PostgresDataSource.getRepository(
      History
    ),
    private readonly notificacionRepository = PostgresDataSource.getRepository(
      Notificacion
    ),
    private readonly usuarioRepository = PostgresDataSource.getRepository(
      Usuario
    )
  ) {}

  async create(
    payload: { description: string; entity_id: number },
    userCorreo: string
  ) {
    const publicacion = await this.publicacionRepository.findOneBy({
      id: payload.entity_id,
    });
    if (!publicacion) throw new CustomError("Publicacion no encontrada", 404);
    const reporteExistente = await this.reporteRepository.findOne({
      where: {
        usuario_emitente: { correo: userCorreo },
        publicacion: { id: payload.entity_id },
      },
    });
    if (reporteExistente) {
      throw new CustomError(
        "Ya has reportado esta publicación anteriormente",
        409
      );
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
      this.historialRepository.save(historial),
    ]);

    const emisor = await this.usuarioRepository.findOneBy({
      correo: userCorreo,
    });
    if (!emisor) {
      throw new CustomError(`Usuario emisor no encontrado: ${userCorreo}`, 404);
    }

    const admins = await this.usuarioRepository.findBy({
      role: UserRole.ADMIN,
    });

    for (const admin of admins) {
      const nuevaNotificacion = this.notificacionRepository.create({
        emisor: emisor,
        receptor: admin,
        type: NotificationType.REPORT,
        previewText: `ha reportado la publicación con id ${publicacion.id}`,
        resourceId: creationResult.id, // ID del reporte
        isRead: false,
      });

      const notificacionGuardada = await this.notificacionRepository.save(
        nuevaNotificacion
      );

      notificarUsuario(admin.correo, {
        id: notificacionGuardada.id,
        tipo: notificacionGuardada.type,
        actorName: emisor.nombre_completo,
        actorUsername: emisor.username,
        mensaje: notificacionGuardada.previewText,
        actorAvatar: emisor.foto_url,
        linkId: notificacionGuardada.resourceId,
      });
    }
    return creationResult;
  }

  async getAll() {
    return await this.reporteRepository.find({
      relations: ["usuario_emitente", "historial"],
    });
  }

  async getById(id: number) {
    return await this.reporteRepository.findOne({
      where: { id },
      relations: ["usuario_emitente", "historial"],
    });
  }

  async update(
    id: number,
    payload: Partial<{ description: string; entity_id: string }>
  ) {
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
        "historial",
      ],
    });
    if (!reporte) return null;
    return reporte;
  }

  /**
   * Aceptar Reporte (Banear): Elimina la publicación reportada.
   * Esto cumple: "Eliminar la publicación".
   */
  async banPublication(reporteId: number) {
    const reporte = await this.reporteRepository.findOne({
      where: { id: reporteId },
      relations: ["publicacion"],
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
      message: "Publicación eliminada correctamente y reporte cerrado.",
    };
  }
}