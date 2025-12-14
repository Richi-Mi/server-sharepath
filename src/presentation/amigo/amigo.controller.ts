import { Amigo, FriendRequestState } from "../../data/model";
import { Usuario, Notificacion, NotificationType } from "../../data/model";

import { PostgresDataSource } from "../../data/PostgresDataSource";
import { CustomError } from "../../domain/CustomError";
import { Repository } from "typeorm";

import { notificarUsuario } from "../../sockets/socketHandler";

export class AmigoController {
  constructor(
    private amigoRepository: Repository<Amigo>,
    private userRepository: Repository<Usuario>
  ) {}

  private friend(correoA: string, correoB?: string, status: FriendRequestState = FriendRequestState.FRIEND) {
    if (correoB) {
      return [
        {
          requesting_user: { correo: correoA },
          receiving_user: { correo: correoB },
          status,
        },
        {
          requesting_user: { correo: correoB },
          receiving_user: { correo: correoA },
          status,
        },
      ];
    }
    return [
      {
        requesting_user: { correo: correoA },
        status,
      },
      {
        receiving_user: { correo: correoA },
        status,
      },
    ];
  }

  async sendRequest(sender: string, receiving: string) {
    if (sender === receiving)
      throw new CustomError("No puedes enviarte una solicitud a ti", 400);

    const senderUser = await this.userRepository.findOne({
      where: [{ correo: sender }, { username: sender }],
    });
    const receivingUser = await this.userRepository.findOne({
      where: [{ correo: receiving }, { username: receiving }],
    });

    if (!senderUser || !receivingUser)
      throw new CustomError("Este usuario no existe ", 404);

    const friendRequest = await this.amigoRepository.findOne({
      where: {
        requesting_user: { username: senderUser.username },
        receiving_user: { username: receivingUser.username },
      },
    });

    if (friendRequest)
      throw new CustomError("Ya existe una solicitud de amistad", 400);

    const friendship = await this.amigoRepository.findOne({
      where: this.friend(senderUser.correo, receivingUser.correo),
    });

    if (friendship) throw new CustomError("Ya eres amigo de este viajero", 400);

    const createRequest = this.amigoRepository.create({
      requesting_user: { correo: senderUser.correo },
      receiving_user: { correo: receivingUser.correo },
      status: FriendRequestState.PENDING,
    });

    const save = await this.amigoRepository.save(createRequest);

    const newNotificacion = new Notificacion();
    newNotificacion.type = NotificationType.FRIEND_REQUEST;
    newNotificacion.isRead = false;
    newNotificacion.emisor = senderUser;
    newNotificacion.receptor = receivingUser;
    newNotificacion.resourceId = save.id;
    newNotificacion.previewText = "te ha enviado una solicitud de amistad";

    await PostgresDataSource.manager.save(newNotificacion);
    const noti = await this.userRepository.find();
    console.log(noti);

    notificarUsuario(receivingUser.correo, {
      tipo: "FRIEND_REQUEST",
      actorName: senderUser.username,
      actorUsername: senderUser.correo, // o username real
      mensaje: "te ha enviado una solicitud de amistad",
      linkId: senderUser.correo,
    });

    return this.amigoRepository.findOne({
      where: { id: save.id },
      relations: { requesting_user: true, receiving_user: true },
    });
  }

  async cancelRequest(sender: string, receiving: string) {
    const senderUser = await this.userRepository.findOne({
      where: [{ correo: sender }, { username: sender }],
    });
    const receivingUser = await this.userRepository.findOne({
      where: [{ correo: receiving }, { username: receiving }],
    }); 
    if (!senderUser || !receivingUser)
      throw new CustomError("Este usuario no existe", 404);   
    const req = await this.amigoRepository.findOne({
        where: this.friend(
            senderUser.correo,
            receivingUser.correo,
            FriendRequestState.PENDING
        )
    });
         if(!req)
            throw new CustomError("No se encontro solicitud", 404); 

        return this.amigoRepository.remove(req!); 
  }


  async respondRequest(
    requestId: number,
    action: "FRIEND" | "REJECT",
    user: string
  ) {
    const req = await this.amigoRepository.findOne({
      where: { id: requestId },
      relations: ["receiving_user", "requesting_user"],
    });

    if (!req) throw new CustomError("No se encontro solicitud", 404);

    if (action === "FRIEND") {
      req.status = FriendRequestState.FRIEND;
      req.fecha_amistad = new Date();
    } else {
      req.status = FriendRequestState.REJECTED;
    }
    const newNotificacion = new Notificacion();
    newNotificacion.type = NotificationType.FRIEND_ACCEPTED;
    newNotificacion.isRead = false;
    newNotificacion.emisor = req.receiving_user;
    newNotificacion.receptor = req.requesting_user;
    newNotificacion.resourceId = req.id;
    newNotificacion.previewText = "ha aceptado tu solicitud de amistad";

    await PostgresDataSource.manager.save(newNotificacion);
    const noti = await this.userRepository.find();
    console.log(noti);

    notificarUsuario(req.requesting_user.correo, {
       tipo: "FRIEND_ACCEPTED",
       actorName: req.receiving_user.nombre_completo,
       actorUsername: req.receiving_user.username, // o username real
       actorAvatar: req.receiving_user.foto_url,
       mensaje: "ha aceptado tu solicitud de amistad",
       linkId: req.id,
     });
    return this.amigoRepository.save(req);
    
  }

  async listRequest(correo: string) {
    const listR = await this.amigoRepository.find({
      where: {
        receiving_user: { correo },
        status: FriendRequestState.PENDING,
       
      },
       relations: ["requesting_user", "receiving_user"], 
       select:{ id:true, status:true, requesting_user:{ nombre_completo: true, username: true, foto_url: true }}

    });
    if (listR.length === 0)
      throw new CustomError("No tienes solicitudes de amistad", 400);
    return listR;
  }

  async listFriend(correo: string) {
    const listF = await this.amigoRepository.find({
      where: this.friend(correo),
      relations: ["requesting_user", "receiving_user"],
    });
    if (listF.length === 0)
      throw new CustomError("No tienes amigos aun :(", 400);
    return listF;
  }

  async searchFriend(correo: string, query: string) {
    const listF = await this.amigoRepository.find({
      where: this.friend(correo),
      relations: ["requesting_user", "receiving_user"],
    });

    const list = listF.map((a) =>
      a.requesting_user.correo === correo ? a.receiving_user : a.requesting_user
    );

    const q = query.toLowerCase();

    return list.filter((u) => u.username.toLowerCase().includes(q));
  }

  async removeFriend(user: string, friend: string){
    if (user === friend)
      throw new CustomError("No puedes eliminarte a ti", 400); 

    const relation = await this.amigoRepository.findOne({
      where: this.friend(user, friend),
    }); 

    if(!relation) 
      throw new CustomError("No son amigos", 404); 

    await this.amigoRepository.remove(relation);
    return relation;
  }

   async block(user: string, block: string ) {

        const senderUser = await this.userRepository.findOne({
             where: [{ correo: user }, { username: user }]
        });

        const receivingUser = await this.userRepository.findOne({
             where: [{ correo: block }, { username: block }]
        }); 

        if (!senderUser || !receivingUser)
           throw new CustomError("Este usuario no existe", 404); 

        const req = await this.amigoRepository.findOne({
            where: this.friend(senderUser.correo, receivingUser.correo)
        }); 

        if(req){
            req.status = FriendRequestState.LOCKED;
            return this.amigoRepository.save(req);
        }

        const blockUser = this.amigoRepository.create({
            requesting_user: senderUser,
            receiving_user: receivingUser,
            status: FriendRequestState.LOCKED
        });

        return this.amigoRepository.save(blockUser);
    }

    async unblock(user: string, block:string){
        const senderUser = await this.userRepository.findOne({
             where: [{ correo: user }, { username: user }]
        });

        const receivingUser = await this.userRepository.findOne({
             where: [{ correo: block }, { username: block }]
        }); 

        if (!senderUser || !receivingUser)
           throw new CustomError("Este usuario no existe", 404); 

        const req = await this.amigoRepository.findOne({
            where: this.friend(senderUser.correo, receivingUser.correo, FriendRequestState.LOCKED)
        }); 

        if(!req)
            throw new CustomError("Este usuario no esta bloqueado", 404);

        req.status = FriendRequestState.FRIEND;
        return this.amigoRepository.save(req!); 
    }

   async listBlock(user: string){
        const sender = await this.userRepository.findOne({
                where: [{ correo: user }, { username: user }]
        }); 

        if (!sender)
           throw new CustomError("Este usuario no existe", 404);

        const blockedUsers = await this.amigoRepository.find({
            where: {
                requesting_user: { correo: sender.correo },
                status: FriendRequestState.LOCKED
            }, 
            relations: ["receiving_user"],
        }); 

        return blockedUsers.map(block => ({ username: block.receiving_user.username, nombre_completo: block.receiving_user.nombre_completo, correo: block.receiving_user.correo, foto_url: block.receiving_user.foto_url }));
    }
    
  async getFriendsOfFriends(correo: string): Promise<
    {
      username: string;
      nombre_completo: string;
      correo: string;
      foto_url: string | null;
    }[]
  > {
    const amigosDirectos = await this.amigoRepository.find({
      where: [
        {
          requesting_user: { correo },
          status: FriendRequestState.FRIEND,
        },
        {
          receiving_user: { correo },
          status: FriendRequestState.FRIEND,
        },
      ],
      relations: ["requesting_user", "receiving_user"],
    });

    if (amigosDirectos.length === 0) {
      return [];
    }

    const correosAmigosDirectos = amigosDirectos.map((amigo) =>
      amigo.requesting_user.correo === correo
        ? amigo.receiving_user.correo
        : amigo.requesting_user.correo
    );

    const amigosDeAmigos = await this.amigoRepository
      .createQueryBuilder("amigo")
      .leftJoinAndSelect("amigo.requesting_user", "requesting_user")
      .leftJoinAndSelect("amigo.receiving_user", "receiving_user")
      .where("amigo.status = :status", { status: FriendRequestState.FRIEND })
      .andWhere(
        "(amigo.requesting_user.correo IN (:...correosAmigos) OR amigo.receiving_user.correo IN (:...correosAmigos))",
        { correosAmigos: correosAmigosDirectos }
      )
      .getMany();

    const sugerenciasMap = new Map<
      string,
      {
        username: string;
        nombre_completo: string;
        correo: string;
        foto_url: string | null;
      }
    >();

    amigosDeAmigos.forEach((amigo) => {
      const correoRequesting = amigo.requesting_user.correo;
      const correoReceiving = amigo.receiving_user.correo;

      if (correosAmigosDirectos.includes(correoRequesting)) {
        if (
          correoReceiving !== correo &&
          !correosAmigosDirectos.includes(correoReceiving)
        ) {
          const usuario = amigo.receiving_user;
          sugerenciasMap.set(usuario.correo, {
            username: usuario.username,
            nombre_completo: usuario.nombre_completo,
            correo: usuario.correo,
            foto_url: usuario.foto_url,
          });
        }
      }

      if (correosAmigosDirectos.includes(correoReceiving)) {
        if (
          correoRequesting !== correo &&
          !correosAmigosDirectos.includes(correoRequesting)
        ) {
          const usuario = amigo.requesting_user;
          sugerenciasMap.set(usuario.correo, {
            username: usuario.username,
            nombre_completo: usuario.nombre_completo,
            correo: usuario.correo,
            foto_url: usuario.foto_url,
          });
        }
      }
    });

    return Array.from(sugerenciasMap.values());
  }
}
