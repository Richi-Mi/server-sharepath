import { afterAll, beforeAll, describe, expect, test, jest } from "bun:test";
import { AuthController } from "../../../src/presentation/auth/auth.controller";
import { AuthModel } from "../../../src/presentation/auth/auth.model";
import { Usuario } from "../../../src/data/model";
import { FileDataSource } from "../../../src/data/FileDataSource";
import { TestPostgresDataSource } from "../../data/TestPostgresDataSource";
import { CustomError } from "../../../src/domain/CustomError";

describe('Testing en el controlador de Authenticación', () => {

    beforeAll( async () => {
        await TestPostgresDataSource.initialize()
    })

    const authController = new AuthController(TestPostgresDataSource.getRepository(Usuario))

    test('Should create new user', async () => {

        // Given
        const user : AuthModel.SignUpBody = {
            username: "test1",
            nombre_completo: "José Ricardo Mendoza Castañeda",
            correo: "test@gmail.com",
            password: "12345678",
        }

        const mockSaveFile = jest.fn().mockReturnValue("http://www.image.com/image.png")
        FileDataSource.prototype.saveFile = mockSaveFile

        // Act
        const result = await authController.doRegister(user)

        // Assert
        expect(result).toBeInstanceOf(Usuario)
        expect(result.correo).toBe(user.correo)
        expect(result.username).toBe(user.username)
        expect(result.nombre_completo).toBe(user.nombre_completo)
        expect(mockSaveFile).not.toBeCalled()
    })

    test('Should return Usuario if login was successfull', async () => {
        // Given
        const data : AuthModel.SignInBody = {
            correo: "test@gmail.com",
            password: "12345678"
        }
        // Act
        const result = await authController.doLogin(data)

        // Assert
        expect(result).toBeInstanceOf(Usuario)
        expect(result.correo).toBe(data.correo)

    })

    test('Should throw error if user does not exist', async () => {
        // Given
        const data : AuthModel.SignInBody = {
            correo: "no_existo@gmail.com",
            password: "12345678"
        }
        // Act  
        authController.doLogin(data)
            .then( () => {} )
            .catch( err => {
                // Assert
                expect(err).toBeInstanceOf(CustomError)
                expect(err.statusCode).toBe(401)
            })
    })
    test('Should throw error if password is incorrect', async () => {
        // Given
        const data : AuthModel.SignInBody = {
            correo: "test@gmail.com",
            password: "123456789"
        }   
        // Act
        authController.doLogin(data)
            .then( () => { throw new Error('XD') } )
            .catch( err => {
                // Assert
                expect(err).toBeInstanceOf(CustomError)
                expect(err.statusCode).toBe(401)
            })
    })

    afterAll( async () => {
        await TestPostgresDataSource.query("DELETE FROM usuario")
        // Destroy database instance
        await TestPostgresDataSource.destroy()
    })

})