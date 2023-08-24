//@ts-check
import { KinshipBase } from "../context/base.js";


export class ChooseBuilder {
    /** @type {KinshipBase} */ #kinshipBase;

    /**
     * @param {KinshipBase} kinshipBase 
     */
    constructor(kinshipBase) {

    }

    choose() {

    }

    
}

/** 
 * Model representing selected columns.
 * @template {object|undefined} TTableModel
 * @typedef {{[K in keyof Partial<TTableModel> as K]: SelectClauseProperty}} SelectedColumnsModel
 */

/**
 * Object to carry data tied to various information about a column being selected.
 * @typedef {import("../context/base.js").ColumnDetails} SelectClauseProperty
 */

/**
 * Model parameter that is passed into the callback function for `.select`.  
 * 
 * __NOTE: This is a superficial type to help augment the AliasModel of the context so Users can expect different results in TypeScript.__  
 * __Real return value: {@link SelectClauseProperty}__
 * @template {object|undefined} TTableModel
 * @typedef {AugmentAllValues<TTableModel>} SpfSelectCallbackModel
 */

/** AugmentAllValues  
 * Augments the type, `T`, so that all nested properties have string values reflecting their own key and their parent(s).  
 * (e.g., { Foo: { Bar: "" } } becomes { Foo: { Bar: "Foo_Bar" } })
 * @template {object|undefined} T
 * @typedef {{[K in keyof T]-?: import("../models/types.js").OnlyObjectType<T[K]> extends never ? K : AugmentAllValues<import("../models/types.js").OnlyObjectType<T[K]>>}} AugmentAllValues
 */

export default {};