//@ts-check

// COMPLETED: goal #1: Get the schema in the third argument callback to properly infer `Goal1ExpectedType`:
/**
 * @typedef {object} Goal1ExpectedType
 * @prop {{ id: number, username: string, hashedPassword: string }} users
 * @prop {{ userId: number, roleId: number }} userRoles
 * @prop {{ id: number, title: string, description?: string }} roles
 */

// goal #2: Get the schema in the third argument to contain the functions ready for configuring all additional info about the contexts.
// `schema` should look like:
/**
 * @template {object} TSchema
 * @typedef {object} Goal2ExpectedType
 * @prop {(realTableName: string) => Goal2ExpectedType<TSchema>} from
 * @prop {() => Goal2ExpectedType<TSchema>} hasMany
 * @prop {() => Goal2ExpectedType<TSchema>} hasOne
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

/** @typedef {"int"|"float"|"varchar"|"datetime"|"nvarchar"|"blob"|"mediumblob"|"largeblob"|"boolean"|"bit"|"bigint"} DataType */

/**
 * Definition for how a column will actually appear on the internal side of Kinship.
 * @template {string[]} TAttributes
 * Attributes that the column has
 * @template {DataType} TDataType
 * Data type of the column
 * @typedef {object} __ColumnDef
 * @prop {TDataType} __type
 * Data type of the column
 * @prop {TAttributes} __attributes
 * Various SQL attributes that the column represents
 * @prop {number=} __size
 * The size (if applicable) of the column
 * @prop {InferDataType<TDataType>=} __default
 * Default value that should be used upon insertions.
 */

/**
 * @template {DataType} TType
 * @param {TType} type 
 * @param {number=} size
 */
function __decorators(type, size=undefined) {
    /**
     * @template {string[]} TAttributes
     * @template {DataType} TDataType
     * @param {__ColumnDef<TAttributes, TDataType>} t
     * @returns {KinshipColumnBuilder<TDataType>}
     */
    function newProxy(t) {
        return new Proxy(/** @type {any} */ (t), {
            get(t,p,r) {
                if(typeof p !== "string") {
                    throw Error("prop not a string");
                }
                if(["__attributes", "__size", "__type", "__default", "__seed", "__incrementValue"].includes(p)) {
                    return t[p];
                }
                if(t.__attributes.includes(p)) {
                    // already defined.
                }
                t.__attributes.push(p);
                switch(p) {
                    case "default": return (defaultValue) => {
                        t.__default = defaultValue;
                        return newProxy(t);
                    }
                    case "identity": return (seed, incrementValue) => {
                        t.__seed = seed;
                        t.__incrementValue = incrementValue;
                        return newProxy(t);
                    }
                }
                if(p === "default") {
                    /**
                     * @param {TDataType} defaultValue
                     */
                    return (defaultValue) => {
                        t.__default = defaultValue;
                        return newProxy(t);
                    }
                }
                return newProxy(t);
            }
        });
    }
    return newProxy({ __type: type, __size: size, __attributes:[] });
}

const float = __decorators("float", 2 ** 64);
const int = __decorators("int", 2 ** 32);
const bigint = __decorators("int", 2 ** 64);
const datetime = __decorators("datetime");
const boolean = __decorators("boolean", 1);
const bit = __decorators("bit", 1);
/**
 * @param {number} size 
 */
const varchar = (size) => __decorators("varchar", size);
/**
 * @param {number} size 
 */
const nvarchar = (size) => __decorators("nvarchar", size);
/**
 * @param {number} size 
 */
const blob = __decorators("blob", 2 ** 16 - 1);
/**
 * @param {number} size 
 */
const mediumblob = __decorators("mediumblob", 2 ** 24 - 1);
/**
 * @param {number} size 
 */
const largeblob = __decorators("largeblob", 2 ** 32 - 1);

/**
 * @template T
 * @typedef {T extends infer U ? {[K in keyof U]: U[K] } : never} FriendlyType
 */

/**
 * @template {DataType} TType
 * @template {string} [TDeterioriatingAttributes=never]
 * @typedef {Omit<Attributes<TType, TDeterioriatingAttributes>, TDeterioriatingAttributes>} KinshipColumnBuilder
 */

/**
 * @template {DataType} TType
 * @template {string} [TAttributes=never]
 * @typedef {object} Attributes
 * @prop {(seed: number, incrementAmount: number) => KinshipColumnBuilder<TType, TAttributes|"identity">} identity
 * @prop {KinshipColumnBuilder<TType, TAttributes|"primaryKey">} primaryKey
 * @prop {KinshipColumnBuilder<TType, TAttributes|"foreignKey">} foreignKey
 * @prop {KinshipColumnBuilder<TType, TAttributes|"notNull">} notNull
 * @prop {(defaultValue: InferDataType<TType>) => KinshipColumnBuilder<TType, TAttributes|"default">} default
 */

/** 
 * @template {DataType} TDataType 
 * @typedef {TDataType extends "varchar"|"nvarchar"
 * ? string 
 * : TDataType extends "int"|"float" 
 *   ? number
 *   : TDataType extends "bigint"
 *     ? bigint
 *     : TDataType extends "datetime" 
 *       ? Date
 *       : TDataType extends "blob"|"mediumblob"|"largeblob"
 *         ? Uint8Array
 *         : TDataType extends "boolean"|"bit"
 *           ? boolean|0|1
 *           : never
 * } InferDataType 
 */

/**
 * @template {string|symbol|number} TKeyToReturn
 * @template TPossibleDecorator
 * @template {keyof Attributes<?,?>} TAttributesRequired
 * @typedef {TPossibleDecorator extends KinshipColumnBuilder<?, infer TAttributes extends keyof Attributes<any,any>> ? TAttributes extends TAttributesRequired ? TKeyToReturn : never : TKeyToReturn} ReturnKeyIfAttributesPresent
 */

/**
 * @template {string|symbol|number} TKeyToReturn
 * @template TPossibleDecorator
 * @template {keyof Attributes<?,?>} TAttributesRequired
 * @typedef {TPossibleDecorator extends KinshipColumnBuilder<?, infer TAttributes extends keyof Attributes<any,any>> ? TAttributes extends TAttributesRequired ? never : TKeyToReturn : TKeyToReturn} ReturnKeyIfAttributesNotPresent
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
/** @template T @typedef {T extends KinshipColumnBuilder<?, infer TAttributes> ? TAttributes : never} ExtractAttributes */

/**
 * @template {object} TSchema
 * @typedef {{[K in keyof TSchema as ReturnIfExtends<K, ExtractAttributes<TSchema[K]>, "notNull"|"primaryKey", false>]-?: InferDataType<ExtractType<TSchema[K]>>}} RefinedSchemaRequired
 */

/**
 * @template {object} TSchema
 * @typedef {{[K in keyof TSchema as ReturnIfExtends<K, ExtractAttributes<TSchema[K]>, "notNull"|"primaryKey", true>]?: InferDataType<ExtractType<TSchema[K]>>}} RefinedSchemaOptional
 */

/** @template {object} TSchema @typedef {FriendlyType<RefinedSchemaRequired<TSchema> & RefinedSchemaOptional<TSchema>>} RefinedSchema */

kinship(adapterCnn, {
    users: table({
        id: int.primaryKey.identity(1,1),
        username: varchar(32).notNull,
        hashedPassword: varchar(128).notNull.default("abc"),
        a: bit.default(true)
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
