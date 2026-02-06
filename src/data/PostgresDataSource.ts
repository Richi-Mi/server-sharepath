import { DataSource } from "typeorm";
import {
    Actividad,
    Amigo,
    History,
    Itinerario,
    Lugar,
    Mensaje,
    Publicacion,
    Reporte,
    Resena,
    Usuario,
    Preferencias,
    Notificacion,
    Foto
} from "./model";

export const PostgresDataSource = new DataSource({
    type: "postgres",

    host: Bun.env.DB_HOST,
    port: Number(Bun.env.DB_PORT),
    username: Bun.env.DB_USER,
    password: Bun.env.DB_PASSWORD,
    database: Bun.env.DB_NAME,

    synchronize: true,

    logging: false,
    entities: [
        Usuario,
        Amigo,
        Actividad,
        Itinerario,
        Lugar,
        Mensaje,
        Publicacion,
        Resena,
        Reporte,
        History,
        Preferencias,
        Foto,
        Notificacion,
    ],

    subscribers: [],
    migrations: [],
});
