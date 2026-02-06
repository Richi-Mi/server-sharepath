import { DataSource } from "typeorm";
import { Actividad, Amigo, Foto, Itinerario, History, Lugar, Mensaje, Notificacion, Preferencias, Publicacion, Reporte, Resena, Usuario } from "../../src/data/model";

export const TestPostgresDataSource = new DataSource({
    type: "postgres",

    host: Bun.env.DB_HOST,
    port: Number(Bun.env.DB_PORT),
    username: Bun.env.DB_USER,
    password: Bun.env.DB_PASSWORD,
    database: "test_db_itinerarios",

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
