import Elysia from "elysia";
import { LugarController } from "./lugares.controller";
import { LugarModel } from "./lugares.model";

import { authService } from "../services/auth.service";

// TODO: Checar la implementación de actualización de lugares.

/**
 * * Rutas implementadas para la gestión de lugares.
 * @author Mendoza Castañeda José Ricardo.
 * @author Gonzalez Lopez Alan Antonio.
 * @link GET    /lugar     - Obtiene los lugares de manera paginada, con limites, etc.
 * @link GET    /lugar/:id - Obtiene un lugar por su ID.
 * 
 * @admin
 * @link DELETE /lugar     - Elimina un lugar por ID. (Solo administradores)
 * @link POST   /registro  - Registra un nuevo lugar a la base de datos.
 */
export const lugarRoutes = new Elysia({ prefix: "/lugar", name: "Lugar" })
    .decorate('lugarController', new LugarController())
    .use(authService)
    .get("/", async ({ status, lugarController, query }) => {
        const lugares = await lugarController.getAllLugares(query);
        return status(200, lugares);
    }, {
        query: LugarModel.getLugaresQuery
    })
    .get("/:id", async ({ status, params, lugarController }) => {
        const lugar = await lugarController.getLugarById(params.id);
        return status(200, {...lugar});
    }, {
        params: LugarModel.getLugarParams
    })
    .post("/registro", async ({ status, body, lugarController }) => {
        const nuevoLugar = await lugarController.createLugar(body);
        return status(201, {...nuevoLugar});
    }, {
        body: LugarModel.regLugarCuerpo
    })
    .put("/:id", async ({ status, params, body, lugarController  }) => {
        const lugarActualizado = await lugarController.updateLugar(params.id, body);
        return status(200, {...lugarActualizado});
    },{
        params: LugarModel.getLugarParams,
        body: LugarModel.modLugarCuerpo,
    })
    .delete("/:id", async ({ status, params, lugarController }) => {
        const lugarBorrado = await lugarController.deleteLugar(params.id);
        return status(200, {...lugarBorrado});
    },{
        params: LugarModel.getLugarParams,
    })