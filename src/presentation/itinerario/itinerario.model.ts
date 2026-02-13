import { t } from "elysia";

export namespace ItinerarioModel {
    export const getItinerarioParams = t.Object({
        id: t.String(),
    });

    export const regItinerarioCuerpo = t.Object({
        title: t.String({ error: "Debe llevar un título el itinerario" }),
        actividades: t.Optional(
            t.Array(
                t.Object({
                    fecha: t.Optional(
                        t.String({ error: "Debe llevar una hora de inicio" })
                    ),
                    lugarId: t.String({ error: "Debe llevar un lugar" }),
                })
            )
        ),
    });

    export type RegItinerarioCuerpo = typeof regItinerarioCuerpo.static;

    export const modItinerarioCuerpo = t.Object({
        title: t.String({ error: "Debe llevar un título el itinerario" }),
        actividades: t.Optional(
            t.Array(
                t.Object({
                    fecha: t.Optional(
                        t.String({ error: "Debe llevar una hora de inicio" })
                    ),
                    lugarId: t.String({ error: "Debe llevar un lugar" }),
                })
            )
        ),
    });

    export type ModItinerarioCuerpo = typeof modItinerarioCuerpo.static;

    /// buscar itinerarios
    export const buscarIti = t.Object({
        q: t.Optional(t.String()), // Término de búsqueda general
        category: t.Optional(t.String()), // Nuevo filtro
        state: t.Optional(t.String()), // Nuevo filtro
    });

    export type BuscarIti = typeof buscarIti.static;
}
