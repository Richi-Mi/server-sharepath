import Elysia, { t } from "elysia";
import { ResenaController } from "./resena.controller";
import { ResenaModel } from "./resena.model";
import { authService } from "../services/auth.service";

export const resenaRoutes = new Elysia({ prefix: "/resena", name: "Resena" })
    .decorate('resenaController', new ResenaController())
    .use(authService)
    
    .post("/publicacion/:id", async ({ params, body, store, resenaController, status }) => {
        const publicacionId = Number(params.id);
        
        const nuevaResena = await resenaController.createResena(publicacionId, store.user, body);        
        return status(201, { ...nuevaResena });
    }, {
        params: ResenaModel.publicacionParams,
        body: ResenaModel.createResenaBody
    })

    .get("/publicacion/:id", async ({ params, store, resenaController, status }) => {
        const publicacionId = Number(params.id);
        
        const authUser = store.user || undefined;
        const reseñas = await resenaController.getResenasByPublicacion(publicacionId, authUser);
        
        return status(200, reseñas);
    }, {
        params: ResenaModel.publicacionParams
    })

    .put("/:id", async ({ params, body, store, resenaController, status }) => {
        const resenaId = Number(params.id);
        const resenaActualizada = await resenaController.updateResena(resenaId, store.user, body);
        return status(200, { ...resenaActualizada });
    }, {
        params: ResenaModel.resenaParams,
        body: ResenaModel.updateResenaBody
    })

    .delete("/:id", async ({ params, store, resenaController, status }) => {
        const resenaId = Number(params.id);
        const resenaEliminada = await resenaController.deleteResena(resenaId, store.user);
        return status(200, { ...resenaEliminada });
    }, {
        params: ResenaModel.resenaParams
    });