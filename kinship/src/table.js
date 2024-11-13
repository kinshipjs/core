//@ts-check
/** @import { Infer } from "./datatypes.js" */

/**
 * @template TModel
 * @param {new () => TModel} tableProto
 * @returns {KinshipTable<TModel>}
 */
export function table(tableProto) {
    return new KinshipTable(tableProto);
}


/**
 * @template TBaseModel
 * @template [TReturnModel=Restricted<Infer<TBaseModel>, never>]
 */
class KinshipTable {
    /** @type {TBaseModel} */ #protoInstance;

    /**
     * 
     * @param {new () => TBaseModel} proto 
     */
    constructor(proto) {
        this.#protoInstance = new proto();
    }

    /**
     * 
     * @param {any} callback 
     */
    where(callback) {

    }

    /**
     * 
     * @param {any} callback 
     */
    orderBy(callback) {

    }
    
    /**
     * 
     * @param {any} callback 
     */
    groupBy(callback) {

    }

    /**
     * 
     * @param {any} callback 
     */
    select(callback) {

    }

    /**
     * @param {number} n
     */
    limit(n) {

    }

    /**
     * 
     * @param {number} n 
     */
    offset(n) {

    }

    /**
     * 
     * @param {any} callback 
     */
    leftJoin(callback) {

    }
    
    /**
     * 
     * @param {Include<Infer<TBaseModel>>} callback
     * @returns {KinshipTable<TBaseModel, >}
     */
    include(callback) {

    }

    /**
     * 
     * @param {(objs: TReturnModel[]) => void} resolve 
     * @returns {Promise<TReturnModel[]>}
     */
    async then(resolve) {
        resolve([]);
        return [];
    }
}

/**
 * @template TBaseModel
 * @template [TInclude=never]
 * @typedef {{[K in keyof TBaseModel as TBaseModel[K] extends string|number|boolean|Date ? K : K extends TInclude ? K : never]: K extends TInclude ? TBaseModel[K] extends (infer T)[] ? Restricted<T, TInclude>[] : Restricted<TBaseModel[K], TInclude> : Restricted<TBaseModel[K], TInclude>}} Restricted
 */

/**
 * @template TModel
 * @typedef {(m: {[K in keyof TModel as TModel[K] extends string|number|boolean|Date ? never : K]: { thenInclude: (m: TModel[K] extends (infer T)[] ? Include<T> : Include<TModel[K]>) => { thenInclude: Include<TModel> } }}) => any} Include
 */