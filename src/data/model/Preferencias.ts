import { Column, Entity, PrimaryGeneratedColumn, ManyToOne, JoinColumn, type Relation } from "typeorm";
import { Usuario } from "./Usuario";

// TODO: Check Preferences Table and EndPoints

@Entity ()
export class Preferencias {
    @PrimaryGeneratedColumn()
    id : number; 

    @ManyToOne(() => Usuario, user => user.preferencias, { eager: true })
    @JoinColumn({ name: "correo", referencedColumnName: "correo" })
    usuario : Relation<Usuario>;

    @Column("varchar")
    correo : string; 

    @Column("text", { array: true, nullable: true })
    lugares_preferidos : string[]; 

    @Column("text", { array: true, nullable: true })
    estados_visitados : string[]; 

    @Column("text", { array: true, nullable: true })
    actividades_preferidas : string[]; 
    
}