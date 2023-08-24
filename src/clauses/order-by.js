//@ts-check
import { KinshipBase } from "../context/base.js";

export class OrderByBuilder {
    /** @type {KinshipBase} */ #base;


    /**
     * @param {KinshipBase} kinshipBase 
     */
    constructor(kinshipBase) {
        this.#base = kinshipBase;
    }
}