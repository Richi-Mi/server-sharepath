import Elysia from "elysia";
import { authService } from "../services/auth.service";
import { ReporteController } from "./reporte.controller";
import { ReporteModel } from "./reporte.model";
import { CustomError } from "../../domain/CustomError";

export const reportsRoutes = new Elysia({ prefix: "/reports" })
    .decorate('reporteController', new ReporteController())
    .use(authService)
    .get("/", async ({ store, reporteController, status }) => {
        if (store.user.role !== "admin") {
            throw new CustomError("Acceso denegado: se requiere rol admin", 403);
        }
        const data = await reporteController.getAll();
        return status(200, data);
    })
    .post("/", async ({ body, store: { user: { correo } }, reporteController, status }) => {
        const created = await reporteController.create(body, correo);
        return status(201, { ...created});
    }, {
        body: ReporteModel.Create
    })
    .get("/:id", async ({ params, store, reporteController, status }) => {
        if (store.user.role !== "admin") {
            throw new CustomError("Acceso denegado: se requiere rol admin", 403);
        }
        const idNum = Number(params.id);
        const result = await reporteController.getById(idNum);
        if (!result) return status(404, { message: "Reporte no encontrado" });
        return status(200, { ...result});
    }, {
        params: ReporteModel.Params
    })
    .put("/:id", async ({ params, body, store, reporteController, status }) => {
        if (store.user.role !== "admin") {
            throw new CustomError("Acceso denegado: se requiere rol admin", 403);
        }
        const idNum = Number((params as any).id);
        const updated = await reporteController.update(idNum, body as any);
        if (!updated) return status(404, { message: "Reporte no encontrado" });
        return status(200, updated);
    }, {
        params: ReporteModel.Params,
        body: ReporteModel.Update
    })
    .get("/admin/preview", async ({ store, reporteController, status }) => {
        // Validación de seguridad
        if (store.user.role !== "admin") throw new CustomError("Requiere permisos de admin", 403);

        const result = await reporteController.getAdminReportsPreview();
        return status(200, result);
    })
    .get("/admin/detail/:id", async ({ params, store, reporteController, status }) => {
    if (store.user.role !== "admin") throw new CustomError("Requiere admin", 403);
    
    const idNum = Number(params.id);
    const result = await reporteController.getAdminDetail(idNum);
    
    if (!result) return status(404, { message: "Reporte no encontrado" });
    
    return Response.json(result); 
}, {
    params: ReporteModel.Params
})
    .post("/admin/ban/:id", async ({ params, store, reporteController, status }) => {
        if (store.user.role !== "admin") throw new CustomError("Requiere admin", 403);

        const idNum = Number(params.id);
        const result = await reporteController.banPublication(idNum);
        
        return status(200, result);
    }, {
        params: ReporteModel.Params
    })
    .delete("/:id", async ({ params, store, reporteController, status }) => {
        if (store.user.role !== "admin") {
            throw new CustomError("Acceso denegado: se requiere rol admin", 403);
        }
        const idNum = Number(params.id);        
        const deleted = await reporteController.delete(idNum);

        if( deleted.affected === 0 ) 
            return status(404, { message: "Reporte no encontrado" });
        
        return status(204, { message: "Reporte eliminado exitosamente " });
    }, {
        params: ReporteModel.Params
    });
    