import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, type Relation } from "typeorm";
import { Usuario } from "./Usuario";

export enum FriendRequestState {
    PENDING,
    FRIEND,
    REJECTED,
    LOCKED
}

@Entity()
export class Amigo {
    @PrimaryGeneratedColumn()
    id: number

    @Column({ type: 'date', nullable: true })
    fecha_amistad: Date | null;

    @Column({
        type: "enum",
        enum: FriendRequestState,
        default: FriendRequestState.PENDING
    })
    status: FriendRequestState

    @ManyToOne(() => Usuario, usuario => usuario.amistadesRecibidas, { onDelete: "CASCADE", onUpdate: "CASCADE" })
    @JoinColumn({ name: "receiving_user", referencedColumnName: "correo" })
    receiving_user: Relation<Usuario>

    @ManyToOne(() => Usuario, usuario => usuario.amistadesEnviadas, { onDelete: "CASCADE", onUpdate: "CASCADE" })
    @JoinColumn({ name: "requesting_user", referencedColumnName: "correo" })
    requesting_user: Relation<Usuario>
}