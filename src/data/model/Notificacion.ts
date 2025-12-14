import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  CreateDateColumn,
  type Relation,
} from "typeorm";
import { Usuario } from "./Usuario";

export enum NotificationType {
  FRIEND_REQUEST = "friend_request",
  POST = "new_post",
  COMMENT = "comment",
  REPORT = "report",
  FRIEND_ACCEPTED = "friend_accepted",
  FRIEND_REJECTED = "friend_rejected",
}

@Entity()
export class Notificacion {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: "enum", enum: NotificationType })
  type: NotificationType;

  @Column({ default: false })
  isRead: boolean; // Para pintar el ícono de leído/no leído

  @ManyToOne(() => Usuario, (usuario) => usuario.notificacionesEnviadas, {
    onDelete: "CASCADE",
    onUpdate: "CASCADE",
  })
  emisor: Relation<Usuario>;

  @ManyToOne(() => Usuario, (usuario) => usuario.notificacionesRecibidas, {
    onDelete: "CASCADE",
    onUpdate: "CASCADE",
  })
  receptor: Relation<Usuario>;

  @Column({ nullable: true })
  resourceId: number;

  @Column({ nullable: true })
  previewText: string

  @CreateDateColumn()
  createdAt: Date;
}
