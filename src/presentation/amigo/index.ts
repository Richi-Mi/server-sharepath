import Elysia from "elysia";
import { AmigoController } from "./amigo.controller";
import { AmigoModel } from "./amigo.modelo";
import { PostgresDataSource } from "../../data/PostgresDataSource";
import { authService } from "../services/auth.service";
import { Amigo, Usuario } from "../../data/model";

/**
 * * Rutas CRUD FRIENDSHIP
 * @author Fenix
 * @link POST /solicitud    ->   body  "receiving": "friend email or username add " - Enviar una solicitud 
 * @link POST /cancelar     ->   - Cancerlar una solicitud pendiente
 * @link PUT  /respond      ->  body  "Id": num "state": num_action    - Responder solicitud
 * @link GET  /pendiente    - Ver lista de solicitudes aun no respondidas 
 * @link GET  /             - Ver lista de friends 
 * @link GET  /search        - buscar amigo x username
 * @link DELETE /:username   - Eliminar amigo por username
 * @link POST  /block        -> body "user: user email or username add"            - Bloquear user 
 * @link POST  /unblock      -> body "user: user email or username add"            - desloquear user 
 * @link GET   /unblock      -> body "user: user email or username add"            - desloquear user 
 */
export const amigoRoutes = new Elysia({ prefix: "/amigo", name: "Amigo" })
 .use(authService)
 .decorate("amigoController", new AmigoController(PostgresDataSource.getRepository(Amigo), PostgresDataSource.getRepository(Usuario)))

 .post("/solicitud", async ({ store: { user }, body, amigoController }) => {
    const res = await amigoController.sendRequest(user.correo, body.receiving ); 

    return { message: "Solicitud enviada", data: res  };

 }, { body: AmigoModel.envioSolicitud})

  .post("/cancelar", async ({ store: { user }, body, amigoController }) => {
    const res = await amigoController.cancelRequest(user.correo, body.receiving ); 

    return { message: "Solicitud cancelada", data: res  };

 }, { body: AmigoModel.envioSolicitud})

 .put("/respond", async ({ store: { user }, body, amigoController }) => {
    let action: "FRIEND" | "REJECT"; 
    if (body.state === 1) action = "FRIEND";
    else if (body.state === 2) action = "REJECT";
    else throw new Error("Estado de respuesta invalido");
    const res = await amigoController.respondRequest(body.Id, action, user.correo ); 

    return { message: "Solicitud actualizada", data: res  };

   }, { body: AmigoModel.respondSolicitud }) 

 .get("/pendiente", async ({ store: { user }, amigoController }) => {
    const requests = await amigoController.listRequest(user.correo);
    if (requests.length === 0)
        return { message: "No tienes solicitudes aun" };

    return { message: "Solicitudes encontradas: ", data: requests };
  })

  .get("/", async ({ store, amigoController }) => {
    return amigoController.listFriend(store.user.correo);
  })

 .get("cont/:correo", async ({ params, amigoController }) => {
    const count = await amigoController.countFriends(params.correo);
    return { message: "Cantidad de amigos: ", data: count };
  })

   .delete("/:username", async ({ store: { user }, params, amigoController }) => {
      const resp = await amigoController.removeFriend(user.username, params.username);
      return { message: "Amigo eliminado", data: resp };
    })

   .post("/block", async ({ body, store: {user}, amigoController}) => { 
    const r = await amigoController.block(user.correo, body.user )
    return { message: "Amigo bloqueado" }; 
   }, { body: AmigoModel.bloquear })

   .post("/unblock", async ({ body, store: {user}, amigoController}) => { 
    const r = await amigoController.unblock(user.correo, body.user)  
    return { message: "Amigo desbloqueado" }; 
   }, { body: AmigoModel.desbloquear  })

   .get("/listblock", async ({ store: {user}, amigoController}) => { 
      return await amigoController.listBlock(user.correo);
   })

   .get("/sugerencias", async ({ store: { user }, amigoController }) => {
        const sugerencias = await amigoController.getFriendsOfFriends(user.correo);
        return { 
            message: "Sugerencias de amigos encontradas", 
            data: sugerencias 
        };
    });
