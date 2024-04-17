//@ts-check
// goal #1: Get the schema in the third argument callback to properly infer `Goal1ExpectedType`:
/**
 * @typedef {object} Goal1ExpectedType
 * @prop {{ id: number, username: string, hashedPassword: string }} users
 * @prop {{ userId: number, roleId: number }} userRoles
 * @prop {{ id: number, title: string, description?: string }} roles
 */

/**
 * @template {object} TSchema
 * @typedef {TSchema} InferSchema
 */

/**
 * @template {object} TTableSchema
 * @param {TTableSchema} schema
 * @returns {RefinedSchema<TTableSchema>}
 */
function table(schema) {
    return schema;
}

/** @typedef {any} AdapterConnection */

/**
 * @template {object} TInitialSchema
 * @template {object} TConfiguredSchema
 * @param {AdapterConnection} adapterConnection 
 * @param {TInitialSchema} initialSchema 
 * @param {(schema: TInitialSchema) => TConfiguredSchema} schemaConfiguration 
 */
function kinship(adapterConnection, initialSchema, schemaConfiguration) {

}

kinship(adapterCnn, {
    users: table({
        id: int.primaryKey,
        username: varchar(32).notNull,
        hashedPassword: varchar(128).notNull
    }),
    userRoles: table({
        userId: int.primaryKey.foreignKey,
        roleId: int.primaryKey.foreignKey
    }),
    roles: table({
        id: int.primaryKey,
        title: varchar(16).notNull,
        description: varchar(128)
    })
}, schema => {
    schema = schema.users
        .from("dbo.User")
        .hasMany(m => m.roles
            .on(m => m.id.equals(m => m.userId))
            .from(m => m.userRoles)
        );
    scheam = schema.userRoles
        .from("dbo.xUserRole")
        .hasOne(m => m.user
            .on(m => m.userId.equals(m => m.id))
            .from(m => m.users)
        );
    schema = schema.roles
        .from("dbo.Role")
        .hasOne(m => m.role
            .on(m => m.roleId.equals(m => m.id))
            .from(m => m.roles)
        );
    return schema;
});

/** @typedef {"int"|"varchar"|"datetime"} DataType */

/**
 * @template {DataType} TType
 * @param {TType} type 
 * @param {number=} size
 */
function __decorators(type, size=undefined) {
    /**
     * @template {string[]} TDecorators
     * @template {DataType} TDataType
     * @param {TDataType} type 
     * @param {number|undefined} size 
     * @param {TDecorators} decorators
     * @returns {KinshipColumnBuilder<TDataType>}
     */
    function newProxy(type, size, decorators) {
        return new Proxy(/** @type {any} */ ({
            type,
            size,
            decorators
        }), {
            get(t,p,r) {
                if(typeof p !== "string") {
                    throw Error("prop not a string");
                }
                if(t.decorators.includes(p)) {
                    // already defined.
                }
                t.decorators.push(p);
                return newProxy(t.type, t.size, t.decorators);
            }
        });
    }
    return newProxy(type, size, []);
}

const int = __decorators("int");
const varchar = (size) => __decorators("varchar", size);
const datetime = __decorators("datetime");

/**
 * @template T
 * @typedef {T extends infer U ? {[K in keyof U]: U[K] } : never} FriendlyType
 */

/**
 * @template {DataType} TType
 * @template {string} [TDeterioriatedKeys=never]
 * @typedef {Omit<Decorators<TType, TDeterioriatedKeys>, TDeterioriatedKeys>} KinshipColumnBuilder
 */

/**
 * @template {DataType} TType
 * @template {string} [TDeterioriatedKeys=never]
 * @typedef {object} Decorators
 * @prop {KinshipColumnBuilder<TType, TDeterioriatedKeys|"primaryKey">} primaryKey
 * @prop {KinshipColumnBuilder<TType, TDeterioriatedKeys|"foreignKey">} foreignKey
 * @prop {KinshipColumnBuilder<TType, TDeterioriatedKeys|"readonly">} readonly
 * @prop {KinshipColumnBuilder<TType, TDeterioriatedKeys|"notNull">} notNull
 */

/** 
 * @template {DataType} TDataType 
 * @template {boolean} TReadOnly
 * @typedef {TDataType extends "varchar" 
 * ? TReadOnly extends true ? Readonly<string> : string 
 * : TDataType extends "int"|"float" 
 *   ? TReadOnly extends true ? Readonly<number> : number
 *   : TDataType extends "datetime" 
 *     ? TReadOnly extends true ? Readonly<Date> : Date 
 *     : never
 * } InferDataType 
 */

/**
 * @template {string|symbol|number} TKeyToReturn
 * @template TPossibleDecorator
 * @template {keyof Decorators<?,?>} TDecoratorsRequired
 * @typedef {TPossibleDecorator extends KinshipColumnBuilder<?, infer TDecorators extends keyof Decorators<any,any>> ? TDecorators extends TDecoratorsRequired ? TKeyToReturn : never : TKeyToReturn} ReturnKeyIfDecoratorsPresent
 */

/**
 * @template {string|symbol|number} TKeyToReturn
 * @template TPossibleDecorator
 * @template {keyof Decorators<?,?>} TDecoratorsRequired
 * @typedef {TPossibleDecorator extends KinshipColumnBuilder<?, infer TDecorators extends keyof Decorators<any,any>> ? TDecorators extends TDecoratorsRequired ? never : TKeyToReturn : TKeyToReturn} ReturnKeyIfDecoratorsNotPresent
 */

/**
 * @template TReturnType
 * @template TCheckType
 * @template TConditionType
 * @template {boolean} [TReverse=false]
 * @typedef {TConditionType extends TCheckType 
 * ? TReverse extends true ? never : TReturnType 
 * : TReverse extends true ? TReturnType : never} ReturnIfExtends
 */

/** @template T @typedef {T extends KinshipColumnBuilder<infer TType, ?> ? TType : never} ExtractType */
/** @template T @typedef {T extends KinshipColumnBuilder<?, infer TDecorators> ? TDecorators : never} ExtractDecorators */

/**
 * @template {object} TSchema
 * @typedef {{[K in keyof TSchema as ReturnIfExtends<K, ExtractDecorators<TSchema[K]>, "notNull"|"primaryKey", false>]-?: InferDataType<ExtractType<TSchema[K]>, IsReadOnly<TSchema[K]>>}} RefinedSchemaRequired
 */

/**
 * @template {object} TSchema
 * @typedef {{[K in keyof TSchema as ReturnIfExtends<K, ExtractDecorators<TSchema[K]>, "notNull"|"primaryKey", true>]?: InferDataType<ExtractType<TSchema[K]>, IsReadOnly<TSchema[K]>>}} RefinedSchemaOptional
 */

/** @template T @typedef {ExtractDecorators<T> extends "readonly" ? true : false} IsReadOnly */

/** @template {object} TSchema @typedef {FriendlyType<RefinedSchemaRequired<TSchema> & RefinedSchemaOptional<TSchema>>} RefinedSchema */


const users = table({
    id: int.primaryKey,
    username: varchar(32).notNull,
    hashedPassword: varchar(128),
    dateCreated: datetime.notNull.readonly
});

users