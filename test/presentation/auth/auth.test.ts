import { describe, test, mock, expect } from "bun:test";
import { AuthModel } from "../../../src/presentation/auth/auth.model";
import { Usuario, UserRole } from "../../../src/data/model";
import { authPlugin } from "../../../src/presentation/auth";
import { treaty } from '@elysiajs/eden'


describe('Testing in endpoints on Auth', () => {

    const user: AuthModel.SignUpBody = {
        username: "test1",
        nombre_completo: "José Ricardo Mendoza Castañeda",
        correo: "test@gmail.com",
        password: "12345678",
    }

    const doRegisterMock = mock(async () => Promise.resolve(user as Usuario))
    const doLoginMock = mock(async () => Promise.resolve(user as Usuario))

    const authController = {
        doRegister: doRegisterMock,
        doLogin: doLoginMock
    }

    const authRoutes = authPlugin(authController as any)
    const api = treaty(authRoutes)

    test('Should call register user of auth controller', async () => {
        // Act
        const response = await api.auth.register.post(user)
        
        // Assert
        expect(response.status).toBe(201)
        expect(doRegisterMock).toHaveBeenCalledTimes(1)
        expect(doRegisterMock).toHaveBeenCalledWith(user)
    })

    test('Should call login user of auth controller', async () => {
        // Act
        const response = await api.auth.put({
            correo: "test@gmail.com",
            password: "12345678"
        })
        
        // Assert
        expect(response.status).toBe(200)
        expect(doLoginMock).toHaveBeenCalledTimes(1)
    })

})