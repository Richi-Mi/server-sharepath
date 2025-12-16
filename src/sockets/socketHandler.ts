import { type Server as SocketIOServer, type Socket } from "socket.io";
import { randomBytes } from "crypto";

import { PostgresDataSource as pgdb } from "../data/PostgresDataSource";
import { Amigo, FriendRequestState, Mensaje, Usuario, estadoMensaje } from "../data/model";
import { In } from "typeorm";

/*guardaMensaje*/
async function guardaMensaje(text: string, emisor: string, receptor: string) {
  const repo = pgdb.getRepository(Mensaje);

  const nuevoMensaje = new Mensaje();
  nuevoMensaje.text = text;

  nuevoMensaje.emisor = { correo: emisor } as Usuario;
  nuevoMensaje.receptor = { correo: receptor } as Usuario;

  nuevoMensaje.horaMensaje = new Date();
  nuevoMensaje.edoMensaje = estadoMensaje.ENVIADO;

  return await repo.save(nuevoMensaje);
}

/*misMensajes*/

async function misMensajes(miCorreo: string, amigo: string)
{
  const repo = pgdb.getRepository(Mensaje);

  const mensajes = await repo.find({
    where: [
      { emisor: { correo: miCorreo }, receptor: { correo: amigo } }, //Mensajes que envie
      { receptor: { correo: miCorreo }, emisor: { correo: amigo } }, //Menajes que recibi
    ],
    relations: ["emisor", "receptor"], //Quienes son emisor y receptor
    order: { horaMensaje: "ASC" }, //Orden cronologico de los mensajes
  });

  //Se ponen los mensajes en el formato que usa el front
  return mensajes.map((m) => ({
    content: m.text,
    from: m.emisor.correo,
    to: m.receptor.correo,

    createdAt: m.horaMensaje,
    status: m.edoMensaje
  }));  
}

async function getFriends(miCorreo: string) {
  const amigosRepo = pgdb.getRepository(Amigo);

  const relaciones = await amigosRepo.find({
    where: [
      //Muestra todos los amigos que tengo, ya sea que envie o recibi la solicitud, y la aceptaron
      {
        //Yo envie la solicitud de amistad y somos amigos (mandar solicitud)
        requesting_user: { correo: miCorreo },
        status: FriendRequestState.FRIEND,
      },
      {
        //Yo recibi la solicitud de amistad y somos amigos (enviar solicitud)
        receiving_user: { correo: miCorreo },
        status: FriendRequestState.FRIEND,
      },
    ],
    relations: ["requesting_user", "receiving_user"],
  });

  const misAmigos = relaciones.map((relacion) => {
    //Si yo envie la solicitud, mi amigo es quien la recibio.
    //Si yo recibi la solicitud, mi amigo la envio.

    // if(envie = yo)
    //   amigo = recibe
    // else
    //   amigo = envia

    const amigo =
      relacion.requesting_user.correo === miCorreo
        ? relacion.receiving_user
        : relacion.requesting_user;
    return {
      userID: amigo.correo,
      username: amigo.username,
      foto_url: amigo.foto_url
    };
  });

  return misAmigos;
}

//Clases de Store
class InMemorySessionStore {
  sessions = new Map();
  findSession(id: string) {
    return this.sessions.get(id);
  }
  saveSession(id: string, session: any) {
    this.sessions.set(id, session);
  }
  findAllSessions() {
    return [...this.sessions.values()];
  }
}

class InMemoryMessageStore {
  messages: any[] = [];
  saveMessage(message: any) {
    this.messages.push(message);
  }
  findMessagesForUser(userID: string) {
    return this.messages.filter(
      ({ from, to }) => from === userID || to === userID
    );
  }
}

const sessionStore = new InMemorySessionStore();
//const messageStore = new InMemoryMessageStore();
/**
 * Configura todos los .on y la autenticacion de Socket.io (sessionID y token).
 * @param io La instancia del servidor de Socket.io
 * @param app La instancia de la app de Elysia. Esta no se utiliza y se puso como comentario
 */

//export function funcionesSockets(io: SocketIOServer, app: Elysia<any, any> | void) {
let io: SocketIOServer;

// 1. Esta función se llama UNA vez en tu index.ts al arrancar
export const initSocketIO = (serverInstance: SocketIOServer) => {
  io = serverInstance;
};

// 2. Esta es la función que usarás en tus CONTROLADORES
export const notificarUsuario = (userId: string, data: any) => {
  if (!io) return;

  // Convertimos los datos al formato que tu Frontend espera
  // Asegúrate que estos campos coincidan con lo que usa tu NotificationCard
  const payload = {
    id: Date.now(), // ID temporal
    tipo: data.tipo, // "FRIEND_REQUEST", "COMMENT", etc.
    leido: false,
    fecha: new Date(),
    actor_nombre: data.actorName,
    actor_avatar: data.actorAvatar || "/img/angel.jpg",
    actor_username: data.actorUsername,
    preview: {
      mensaje: data.mensaje,
      linkId: data.linkId,
    },
    linkId: data.linkId,
  };

  io.to(userId).emit("receive notification", payload);
};

export function funcionesSockets(io: SocketIOServer) {
  // Middleware de Autenticación "Proxy"
  io.use(async (socket: Socket, next) => {
    //Reconexion con sessionID, es decir, si hay sessionID utilizala para la reconexcion, si no hay sessionID asigna una nueva
    const sessionID = socket.handshake.auth.sessionID;
    if (sessionID) {
      const session = sessionStore.findSession(sessionID);
      if (session) {
        
        (socket as any).sessionID = sessionID;
        (socket as any).userID = session.userID;
        (socket as any).username = session.username;
        return next();
      }
    }

    //Conexion nueva con token
    const token = socket.handshake.auth.token; //Token que envia el cliente
    if (!token) {
      return next(new Error("No se proporcionó token"));
    }

    //Se hace una consulta a la base para verificar si el token existe, es valido o ya expiro
    //Se puede quitar y leer los datos que vienen en el token, pero debe agregarse una nueva
    //biblioteca (jsonwebtoken)
    const URL = Bun.env.HOST+'/user' || "http://localhost:4000/user";
    try {
      const res = await fetch(URL, {
        //const res = await fetch("https://harol-lovers.up.railway.app/user", {
        method: "GET",

        headers: {
          "Content-Type": "application.json",
          token: token,
        },
      });

      if (!res.ok) {
        throw new Error("Token inválido (rechazado por el backend)");
      }

      //JSON que se envia: { token: "...", usuario: { ... } }
      const userData = await res.json();

      if (!userData || !userData.correo || !userData.username) {
        return next(new Error("Datos de usuario incompletos del backend"));
      }
      (socket as any).sessionID = randomBytes(8).toString("hex"); 
      (socket as any).userID = userData.correo;
      (socket as any).username = userData.username;
      next();
    } catch (err: any) {
      return next(new Error("Error al asignar datos al socket"));
    }
  });

  //Conexion de Socketio
  io.on("connection", async (socket: Socket) => {
    //Se obtienen los datos del socket
    const { userID, username, sessionID } = (socket as any);
    
    //Unirse a la sala privada
    socket.join(userID);

    //Guardar sesion
    sessionStore.saveSession(sessionID, {
      sessionID: sessionID,
      userID: userID,
      username: username,
      connected: true,
    });

    //Emitir sesion
    socket.emit("session", { sessionID, userID, username });

    //Unirse a la sala privada
    socket.join(userID);

    socket.on("get friends list", async () => {

        const listaAmigos = await getFriends(userID); //Obtener amigos de la BD

        // const allSessions = sessionStore.findAllSessions();
        const usersMap = [];

        const mensajeRepo = pgdb.getRepository(Mensaje);

        for(const amigo of listaAmigos) {
          const isFriendOnline = sessionStore.findAllSessions().some((s: any) => s.userID === amigo.userID && s.connected);

          //Contar mensajes no leidos desde la BD
          //El emisor es mi amigo, el receptor soy yo y, el estado es menor a 2
          const sinLeer = await mensajeRepo.count({
            where: {
              emisor: { correo: amigo.userID }, //El emisor es mi amigo
              receptor: { correo: userID }, //El receptor soy yo
              edoMensaje: In([0, 1]), //El estado es menor a 2, porque 0 enviado, 1 recibido
            }
          });

          const Msg = await mensajeRepo.findOne({
            where:[
              { emisor: {correo: amigo.userID}, receptor: { correo: userID } }, //El ultimo mensaje es de mi amigo
              { receptor: { correo: amigo.userID }, emisor: { correo: userID } } //El ultimo mensaje es mio
            ],
            order: {
              horaMensaje: 'DESC'
            }
          });

          const ultimoMsg = Msg || null;

          usersMap.push({
            userID: amigo.userID,
            username: amigo.username,
            foto_url: amigo.foto_url,
            connected: isFriendOnline,
            messages: ultimoMsg?.text,
            lastMessage: ultimoMsg ? ultimoMsg.text : null,
            lastMessageHora: ultimoMsg ? ultimoMsg.horaMensaje : null,
            unreadCount: sinLeer
          })
        }

        usersMap.sort((a, b) => { //Esta parte ordena la lista de chats por orden cronologico (el mas reciente primero)
          const dateA = a.lastMessageHora ? new Date(a.lastMessageHora).getTime() : 0;
          const dateB = b.lastMessageHora ? new Date(b.lastMessageHora).getTime() : 0;

          return dateB - dateA; //El front recibe la lista de chats y se muestrab ordenadas, con esto no se modifico socket.on("users")
        });
        socket.emit("users", usersMap); //Enviar la lista de amigos como respuesta
    });

    const listaAmigos = await getFriends(userID); //Obtener amigos de la BD

    const allOnlineSessions = sessionStore.findAllSessions();

    listaAmigos.forEach((amigo) => {
      const friendSession = allOnlineSessions.find(
        (s: any) => s.userID === amigo.userID
      );
      if (friendSession && friendSession.connected) {
        socket.to(amigo.userID).emit("user connected", {
          userID: userID,
          username: username,
          connected: true,
          messages: [],
        });
      }
    });

    socket.on("fetch messages", async ({ withUserID }) => {
      const messages = await misMensajes(userID, withUserID);
      socket.emit("chat history", { withUserID, messages });
    });

    //Escuchar notificaciones
    socket.on("send notification", (data) => {
      socket.emit("receive notification", data);
    });

    //Escuchar mensajes privados
    socket.on("private message", async ({ content, to }) => {
      //messageStore.saveMessage(message);
      const mensajeGuardado = await guardaMensaje(content, userID, to); //Guarda el mensaje en la Base de Datos

      const message = {
        content: content,
        from: userID,
        to,
        createdAt: mensajeGuardado.horaMensaje, //Fecha del mensaje en la BD
        status: 0 //Enviado, cuando llega al servidor esta enviado
      };
      socket.to(to).to(userID).emit("private message", message); //Enviar al destinatario y a mi sala
    });

    //Alguien esta escribiendo
    socket.on('typing', ({ to }) => {
      socket.to(to).emit('display typing', { userID });
    })

    //Alguien dejo de escribir
    socket.on('stop typing', ({ to }) => {
      socket.to(to).emit('hide typing', { userID })
    });

    socket.on('mark messages received', async ({ withUserID }) => {
      const repo = pgdb.getRepository(Mensaje);

      await repo.createQueryBuilder()
        .update(Mensaje)
        .set({ edoMensaje: 1 })
        .where("emisorCorreo = :emisor AND receptorCorreo = :receptor AND edoMensaje < '1'", {
          emisor: withUserID, //Amigo que envia los mensajes
          receptor: userID    //Yo
        })
        .execute()

        socket.to(withUserID).emit("message received", { byUserID: userID });
    })

    socket.on('mark messages read', async ({ withUserID }) => {

      const repo = pgdb.getRepository(Mensaje);

      await repo.createQueryBuilder()
        .update(Mensaje)
        .set({ edoMensaje: 2 })
        .where("emisorCorreo = :emisor AND receptorCorreo = :receptor AND edoMensaje < '2'", {
          emisor: withUserID, //Amigo que envia mensaje
          receptor: userID    //Yo
        })
        .execute();

      socket.to(withUserID).emit("messages read", { byUserID: userID });
    });

    //Desconexion
    socket.on("disconnect", async () => {
      //userID y sessionID
      const { userID, username, sessionID } = (socket as any);

      //await new Promise(resolve => setTimeout(resolve, 1000)); Para quitar el parpadeo de desconectado/conectado (se recarga la pagina)

      //Revisa si hay otras pestanas abiertas del mismo usuario
      const matchingSockets = await io.in(userID).allSockets();
      const isDisconnected = matchingSockets.size === 0;
      if (isDisconnected) {
        const listaAmigos = await getFriends(userID); //Obtener amigos de la BD
        listaAmigos.forEach((amigo) => {
          //No usar 'socket.to()' porque el socket esta muerto, no hay socket. Si se envian mensajes y el destinatario se desconecto, no vera los mensajes
          //socket.to(friendID).emit("user disconnected", userID);

          //Usar 'io.to()' (el servidor principal). Si se envian mensajes y el destinatario se desconecto, al conectarse de nuevo vera esos mensajes
          io.to(amigo.userID).emit("user disconnected", userID);
        });
        sessionStore.saveSession(sessionID, {
          sessionID: sessionID,
          userID: userID,
          username: username,
          connected: false, //Se marca como desconectado
        });
      }
    });
  });
}
