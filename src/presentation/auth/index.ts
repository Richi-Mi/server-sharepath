import Elysia, { t } from "elysia"

import { AuthController } from "./auth.controller"
import { tokenPlugin } from "../../config/tokens"
import { AuthModel } from "./auth.model"

/**
 * * Modulo para el manejo de rutas de autenticación.
 * @author Mendoza Castañeda José Ricardo.
 * @link POST /auth/register - Registro de usuario.
 * @link PUT  /auth          - Login de usuario.
 */
export const authRoutes = new Elysia({ prefix: "/auth", name: "Auth" })
    .decorate('authController', new AuthController())
    .use(tokenPlugin)
    .post("/register",  async ({ status, body, authController }) => {        
        const usuario = await authController.doRegister(body)
        return status(201, { message: `Usuario con ${usuario.correo} creado` })
    }, {
        body: AuthModel.signUpBody
    })
    .put("/", async ({ status, authController, body, tokenPlugin }) => {
        const usuario = await authController.doLogin(body)
        const { correo, role, password, ...user } = usuario
        return status(200, {
            token: await tokenPlugin.sign({ correo, role }),
            usuario: { ...user, role, correo }
        })
    }, {
        body: AuthModel.signInBody
    })