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
 * @template {object} TTableModel
 * @typedef {{[K in keyof Partial<TTableModel> as import("../models/string.js").Join<TTableModel, K & string>]: SelectClauseProperty}} SelectedColumnsModel
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
 * @template {object} TTableModel
 * @typedef {import("../models/string.js").Deflate<TTableModel>} SpfSelectCallbackModel
 */

export default {};