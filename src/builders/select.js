//@ts-check

/**
 * @template TBaseModel
 * @template {TBaseModel} TCurrentStateModel
 * @template {keyof TBaseModel} TColumn
 * @typedef {object} ISelectBuilder
 * @prop {<TAlias extends string>(alias: TAlias) => ISelectBuilder<TBaseModel, TCurrentStateModel, TColumn>} as
 */

/**
 * @template TBaseModel
 * @template {TBaseModel} TCurrentStateModel
 * @template {keyof TBaseModel} TColumn
*/
export class SelectBuilder {

    /** @type {ISelectBuilder<TBaseModel, TCurrentStateModel, TColumn>['as']} */
    as() {
        return this;
    }

    /**
     * @template TPrototype
     * @param {TPrototype} prototype
     * @returns {SelectBuilder<?, ?, ?>} 
     */
    static create(prototype) {
        return new SelectBuilder();
    }

}

const sb = new SelectBuilder();