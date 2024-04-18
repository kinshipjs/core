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
 * @typedef {object} PrototypeCallbacks
 * @prop {() => Promise<void>} delete
 * @prop {() => Promise<void>} insert
 * @prop {() => Promise<void>} update
 * @prop {() => RefinedSchema<TTableSchema>} jsonify
 */

/**
 * @template {object} TTableSchema
 * @typedef {{[K in keyof RefinedSchema<TTableSchema>]: RefinedSchema<TTableSchema>[K]}} PrototypeAttributes
 */

/**
 * @template {object} TTableSchema
 * @typedef {FriendlyType<PrototypeAttributes<TTableSchema> & PrototypeCallbacks<TTableSchema>>} KinshipTablePrototype
 */

/**
 * @template {object} TTableSchema
 * @param {string} realTableName
 * @param {TTableSchema} schema
 * @returns {{new (model?: FriendlyType<Partial<RefinedSchema<TTableSchema>>>): KinshipTablePrototype<TTableSchema>, insert: (records: RefinedSchema<TTableSchema>|RefinedSchema<TTableSchema>[]|ModelPrototype|ModelPrototype[]) => void} }
 */
function table(realTableName, schema) {
    console.log(schema);
    class ModelPrototype {
        constructor(model) {
            console.log(schema);
            for (const key in schema) {
                if(model && key in model) {
                    this[ /** @type {any} */(key)] = model[key];
                } else {
                    this[ /** @type {any} */(key)] = schema[key].__default;
                }
            }
        }

        insert() {

        }

        /**
         * @param {ModelPrototype|ModelPrototype[]} records
         */
        static insert(records) {
        }
    }
    return /** @type {any} */ (ModelPrototype)
}

const Test = table("test", {
    id: int.primaryKey,
    TEST_TEST_TEST: varchar(50).default("this is just a test")
});
const test = new Test();
Test.insert(test);

/**
 * @template {object} TTableSchema
 * @param {string} realTableName
 * @param {TTableSchema} schema
 * @returns {Readonly<RefinedSchema<TTableSchema>>}
 */
function view(realViewName, schema) {
    // should return a KinshipContext but without access to any type of `update`, `delete`, or `insert` functions.
    return schema;
}

class KinshipView {
    hasMany() {

    }

    hasOne() {

    }

    include() {

    }

    then() {

    }

    where() {

    }

    sortBy = this.orderBy;
    orderBy() {

    }

    groupBy() {

    }

    limit = this.take;
    take() {

    }

    offset = this.skip;
    skip() {

    }
}

class KinshipTable extends KinshipView {
    insert() {

    }

    delete() {

    }

    update() {

    }

    onDelete = this.#on(ActionType.Delete);
    onInsert = this.#on(ActionType.Insert);
    onQuery = this.#on(ActionType.Query);
    onUpdate = this.#on(ActionType.Update);
    
    /**
     * @param {ActionType} type 
     */
    #on(type) {

    }
}

/** @enum {number} */
const ActionType = {
    Delete: 0,
    Insert: 1,
    Query: 2,
    Update: 3
};

/** @typedef {any} AdapterConnection */

/**
 * @template {object} TInitialSchema
 * @template {object} TConfiguredSchema
 * @param {AdapterConnection} adapterConnection 
 * @param {TInitialSchema} initialSchema 
 */
function kinship(adapterConnection, initialSchema) {
    return initialSchema;
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
 * @template {"notNull" extends TAttributes ? InferDataType<TType> : InferDataType<TType>|null} [TTrueDataType="notNull" extends TAttributes ? InferDataType<TType> : InferDataType<TType>|null]
 * @typedef {object} Attributes
 * @prop {(seed: number, incrementAmount: number) => KinshipColumnBuilder<TType, TAttributes|"identity">} identity
 * @prop {KinshipColumnBuilder<TType, TAttributes|"primaryKey">} primaryKey
 * @prop {KinshipColumnBuilder<TType, TAttributes|"foreignKey">} foreignKey
 * @prop {KinshipColumnBuilder<TType, TAttributes|"notNull">} notNull
 * @prop {(defaultValue: TTrueDataType) => KinshipColumnBuilder<TType, TAttributes|"default">} default
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

// const ctx = kinship(adapterCnn, {
//     users: table("dbo.User", {
//         id: int.primaryKey.identity(1,1),
//         username: varchar(32).notNull,
//         email: varchar(64).notNull,
//         hashedPassword: varchar(128),
//         emailVerified: boolean.default(false)
//     }),
//     userRoles: table("dbo.xUserRole", {
//         userId: int.primaryKey.foreignKey,
//         roleId: int.primaryKey.foreignKey
//     }),
//     roles: table("dbo.Role", {
//         id: int.primaryKey,
//         title: varchar(16).notNull,
//         description: varchar(128)
//     })
// });
