import Elysia from "elysia"; 

import { UserModel } from "./usuario.model";
import { authService } from "../services/auth.service";
import { authRole } from "../services/auth.service";
import { UserController } from "./usuario.controller";

import { AuthController } from "../auth/auth.controller";
import { AuthModel } from "../auth/auth.model";
import { UserRole } from "../../data/model";
import { CustomError } from "../../domain/CustomError";
/**
 * * Rutas implementadas para la gestión de la información del usuario.
 * @author Mendoza Castañeda José Ricardo
 * @link GET    /user                 - Obtiene la información del usuario.
 * @link PUT    /user/update          - Actualiza información del usuario.
 * @link POST   /user/verify-password - Verifica si la contraseña es correcta.
 * @link PUT    /user/update-password - Actualiza la contraseña una vez verificada.
 * @link DELETE /user                 - Elimina el usuario.
 * @author Peredo Borgonio Daniel
 * @link GET    /user/search             - Busca usuarios por nombre o correo.
 * @link GET    /user/profile/:username  - Busca usuarios y regresa toda su informacion (menos su contraseña) junto con sus publicaciones
 * 
 * @admin
 * @link GET    /all                    - Ver todos los usuarios y sus itinerarios (no se si se quede asi).
 * @link PUT    /admin/:correo          - Actualizar los datos de un usuario, se indica cual por el correo.
 * @link POST   /admin/register         - Registrar un usuario.
 * @link DELETE /admin/:correo          - Eliminar un usuario, se indica cual por el correo.
 */

export const userRoutes = new Elysia({ prefix: "/user", name: "Usuario" })
    .decorate('userController', new UserController())
    .use(authService)
    .get("/", async ({ status, store: { user: { correo } }, userController }) => {

        const [user, itineraryCount, friendsCount] = await Promise.all([
            userController.getUserInfo(correo),
            userController.getItineraryCount(correo),
            userController.getFriendsCount(correo)
        ]);
        
        if( !user )
            return status(404)

        const { password, ...userData } = user

        return status(200, { ...userData, itineraryCount, friendsCount })
    })
    .put("/update", async ({ status, store: { user: { correo } }, body, userController }) => {
        const { password, ...userUpdated } = await userController.updateUser(correo, body)
        if(!userUpdated)
            return status(404, "Usuario no encontrado")
        return status(200, { ...userUpdated})
    }, {
        body: UserModel.updateUserBody
    })
    .post("/verify-password", async ({ status, store: { user: { correo } }, body, userController }) => {
        const { password } = body;
        const isValid = await userController.verifyPassword(correo, password);
        if (!isValid) {
            return status(401, { message: "Contraseña incorrecta" });
        }
        return status(200, { message: "Contraseña verificada correctamente" });
    }, {
        body: UserModel.verifyPasswordBody
    })
    .put("/update-password", async ({ status, store: { user: { correo }}, body, userController }) => {
        const { newPassword } = body; 
        await userController.updatePassword(correo, newPassword);
        return status(202, { message: "Contraseña actualizada correctamente" });
    }, {
        body: UserModel.updatePasswordBody
    })
    .delete("/", async ({ status, store: { user: { correo } }, userController }) => {
        const userDeleted = await userController.deleteUser(correo)
        if(!userDeleted)
            return status(404, "Usuario no encontrado")
        
        return status(201, { ...userDeleted })
    })
    .get("/search", async ({ status, query, userController }) => {
        const searchTerm = query.q;
        const users = await userController.searchTravelers(searchTerm);
        return status(200, users);
    }, {
        query: UserModel.searchQuery
    })

        
    .get("/profile", async ({ status, query, userController }) => {
        const terminoBusqueda = query.q;

        if (!terminoBusqueda) {
            return status(400, { message: "Falta el parámetro 'q' en la URL (?q=...)" });
        }

        try {
            
            const user = await userController.getProfileBySearch(terminoBusqueda);
            
            return status(200, user);

        } catch (error: any) {
          
            console.error("Error capturado en /profile:", error);
            const statusCode = error.status || 500;
            
            const mensajeError = error.message || "Ocurrió un error desconocido";

            return status(statusCode, { 
                error: true,
                message: mensajeError 
            });
        }
    }, {
        
    })
    .get("/profile/:username", async ({ status, params, userController }) => {
        const { username } = params as { username: string };
        
        try {
            const user = await userController.getProfileByUsername(username);
            
            if (!user) {
                return status(404, { message: "Usuario no encontrado" });
            }
            return status(200, user);
            
        }
        catch (error: any) {
            console.error("Error capturado en /profile/:username:", error);
            const statusCode = error.status || 500;
            const mensajeError = error.message || "Ocurrió un error desconocido";
            
            return status(statusCode, {
                error: true,
                message: mensajeError
            });
        }
    })
    .post("/admin/register",  async ({ status, body}) => {        
        const authController = new AuthController();
        const role = body.role === "admin" ? "admin" : "user" ;
        const usuario = await authController.doRegister({...body, role});
        return status(201, { message: `Usuario con ${usuario.correo} creado` })
    }, {
        body: AuthModel.signUpBody,
        beforeHandle: authRole("admin")
    })

    /* Ver todos los usuarios */
    .get("/all", async ({ userController }) => {
            const usuarios = await userController.getAllUsers();
            return usuarios;
    }, {   
        beforeHandle: authRole(UserRole.ADMIN)
    })

    /* Actualizar los datos de un usuario */
    .put("/admin/:correo", async ({ status, params: { correo }, body, userController }) => {
        const { password, ...userUpdated } = await userController.updateUser(correo, body)
        if(!userUpdated)
            return status(404, "Usuario no encontrado")
        return status(200, { ...userUpdated})
    }, {
        body: UserModel.updateUserBody,
        beforeHandle: authRole("admin")
    })
    

    /* Eliminar un usuario */
    .delete("/admin/:correo", async ({ status, params: { correo }, userController }) => {
        // const {password, ...usuarioEliminado} = await userController.deleteUser(correo);
        const usuarioEliminado = await userController.deleteUser(correo);

        //if(!usuarioEliminado)
        //    return status(404, { message: `Correo ${correo} no encontrado` }) //Para probar el mensaje Correo no encontrado, pero ya esta en userController.deleteUser
        return status(200, { message: `Correo ${correo} eliminado por admin`, user: usuarioEliminado });
    },{
        beforeHandle: authRole("admin")
    })
    
    .delete("/admin/delete/:username", async ({ params, store, userController, status }) => {
        if (store.user.role !== "admin") throw new CustomError("Requiere permisos de admin", 403);
        
        const { username } = params;
        const result = await userController.deleteUserByUsername(username);
        return status(200, result);
    })
    