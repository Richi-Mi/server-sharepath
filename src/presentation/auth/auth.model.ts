import { t } from "elysia"

export namespace AuthModel {

    export const signUpBody = t.Object({
        username:           t.String({ error: "El username es necesario" }),
        nombre_completo:    t.String({ error: "El nombre completo es necesario" }),
        correo:             t.String({ error: "El correo es necesario" }),
        password:           t.String({ error: "La contraseña es necesaria" }),
        role:               t.Optional(t.String()),
        foto: t.Optional(
            t.File({ format: ["image/jpeg", "image/png", "image/jpg"] })
        )
    })

    export type SignUpBody = typeof signUpBody.static

    export const signInBody = t.Object({
        correo:     t.String({ error: "El correo es necesario" }),
        password:   t.String({ error: "La contraseña es necesaria" })
    })
    
    export type SignInBody = typeof signInBody.static
    
}