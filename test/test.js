//@ts-check
import { KinshipContext } from '../src/index.js';

/** @type {KinshipContext<{ Id?: number, Name: string, Blah?: Date}>} */
const ksc = new KinshipContext(/** @type {any} */ ({
    execute() {
        return {
            forDescribe(cmd, args) {
                return ({
                    Id: {
                        field: "Id",
                        table: "Playlist",
                        isPrimary: true,
                        isIdentity: true,
                        isVirtual: false,
                        isNullable: false,
                        isUnique: true,
                        datatype: "int",
                        defaultValue: () => undefined
                    },
                    Name: {
                        field: "Name",
                        table: "Playlist",
                        isPrimary: false,
                        isIdentity: false,
                        isVirtual: false,
                        isNullable: false,
                        isUnique: false,
                        datatype: "string",
                        defaultValue: () => undefined
                    },
                    Blah: {
                        field: "Blah",
                        table: "Playlist",
                        isPrimary: false,
                        isIdentity: false,
                        isVirtual: false,
                        isNullable: true,
                        isUnique: false,
                        datatype: "date",
                        defaultValue: () => undefined
                    }
                });
            }
        }
    },
    serialize() {
        return {
            forQuery(data) {
                console.log(data);
            },
            forDescribe(data) {
                return { cmd: "", args: [] };
            }
        }
    }
}), "Playlist");

await ksc.select(m => ({
    id: m.Id,
    blah: m.Blah
}))
.select(m => m.id);