import { Column, Entity, ManyToOne, PrimaryGeneratedColumn, type Relation } from "typeorm";
import { Usuario } from "./Usuario";

export enum MessageStatus {
    ENVIADO, 
    RECIBIDO, 
    LEIDO 
}

@Entity()
export class Mensaje {
    @PrimaryGeneratedColumn()
    id : number

    @Column()
    text : string

    @Column({type: 'timestamp'})
    horaMensaje : Date;

    @Column({
        type: "enum",
        enum: MessageStatus
    })
    edoMensaje : MessageStatus

    @ManyToOne(() => Usuario, usuario => usuario.mensajes, { onDelete: 'CASCADE', onUpdate: 'CASCADE' })
    emisor : Relation<Usuario>

    @ManyToOne(() => Usuario, usuario => usuario.mensajes, { onDelete: 'CASCADE', onUpdate: 'CASCADE' })
    receptor : Relation<Usuario>
}