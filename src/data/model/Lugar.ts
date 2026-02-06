import { Column, Entity, OneToMany, PrimaryColumn, type Relation } from "typeorm"
import { Actividad } from "./Actividad"

@Entity()
export class Lugar {
    @PrimaryColumn()
    id_api_place : string

    @Column()
    category : string

    @Column()
    mexican_state : string

    @Column()
    nombre : string

    @Column({ nullable: true, type: "double precision" })
    latitud : number

    @Column({ nullable: true, type: "double precision" })
    longitud : number

    @Column({ nullable: true, type: "text" })
    foto_url : string

    @Column({ nullable: true, type: "double precision" })
    google_score : number

    @Column({ nullable: true })
    total_reviews : number

    @Column({ nullable: true, type: "text" })
    descripcion: string

    @OneToMany( () => Actividad, actividad => actividad.lugar, { cascade: true })
    actividades : Relation<Actividad[]>
}