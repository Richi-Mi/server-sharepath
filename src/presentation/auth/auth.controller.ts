import { UserRole, Usuario } from "../../data/model";
import { AuthModel } from "./auth.model";

import { PostgresDataSource }   from "../../data/PostgresDataSource";
import { FileDataSource }       from "../../data/FileDataSource";
import { CustomError }          from "../../domain/CustomError";

export class AuthController {

    constructor( 
        private userRepository = PostgresDataSource.getRepository(Usuario),
        private fileDataSource = FileDataSource.getInstance()
    ) {}

    public doRegister = async (data : AuthModel.SignUpBody ) : Promise<Usuario> => {
        const { nombre_completo, username, correo, foto, password: uncrypted_password, role } = data
        // Hash de la contraseña
        const password      = await Bun.password.hash(uncrypted_password);

        // Verificar qué el usuario no exista.
        const userExists    = await this.userRepository.findOneBy({ correo })
        
        if( userExists )
            throw new CustomError("El correo ya está registrado", 409)

        // Verificar el username sea unico 
        const usernameExists = await this.userRepository.findOneBy({ username })
        
        if( usernameExists )
            throw new CustomError("El username ya existe", 409)


        // Creación del usuario
        const usuario = new Usuario()

        usuario.nombre_completo = nombre_completo
        usuario.username = username
        usuario.correo = correo
        usuario.password = password
        usuario.role = role === UserRole.ADMIN ? UserRole.ADMIN : UserRole.USER;
        
        // Si al registrarse se envió una foto, guardarla.
        if(foto) 
            usuario.foto_url = await this.fileDataSource.saveFile(foto);
        
        await this.userRepository.save(usuario)
      
        return usuario
    }
    public doLogin = async ({ correo, password }: AuthModel.SignInBody) : Promise<Usuario> => {
        const user = await this.userRepository.findOneBy({ correo })     
        
        // Verificar que el usuario exista
        if( !user )
            throw new CustomError("El usuario no existe", 401)

        const isPasswordValid = await Bun.password.verify(password, user.password)

        // Verificar que la contraseña sea correcta
        if (!isPasswordValid)
            throw new CustomError("Contraseña incorrecta", 401)

        return user
    }
}