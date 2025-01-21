//@ts-check

//#region interface
/**
 * @template TContextPrototype
 * @typedef {object} IEntityBuilder 
 * @prop {EntityBuilder_HasOne<TContextPrototype>} hasOne
 * Configure a declared one-to-one relationship with the appropriate keys to join on.
 * @prop {EntityBuilder_HasMany<TContextPrototype>} hasMany
 * Configure a declared one-to-many relationship with the appropriate keys to join on.
 * @prop {EntityBuilder_BeforeTrigger<TContextPrototype>} beforeDelete
 * Add an event listener that acts as middleware and is triggered before a delete action is to be made.
 * @prop {EntityBuilder_BeforeTrigger<TContextPrototype>} beforeInsert
 * Add an event listener that acts as middleware and is triggered before an insert action is to be made.
 * @prop {EntityBuilder_BeforeTrigger<TContextPrototype>} beforeUpdate
 * Add an event listener that acts as middleware and is triggered before an update action is to be made.
 * @prop {EntityBuilder_AfterTrigger<TContextPrototype>} afterDelete
 * Add an event listener that acts as middleware and is triggered after a delete action is to be made.
 * @prop {EntityBuilder_AfterTrigger<TContextPrototype>} afterInsert
 * Add an event listener that acts as middleware and is triggered after an insert action is to be made.
 * @prop {EntityBuilder_AfterTrigger<TContextPrototype>} afterUpdate
 * Add an event listener that acts as middleware and is triggered after an update action is to be made.
 * @prop {EntityBuilder_SuccessEvent<TContextPrototype>} onDeleteSuccess
 * Add an event listener that is triggered when a delete action was successful.
 * @prop {EntityBuilder_SuccessEvent<TContextPrototype>} onInsertSuccess
 * Add an event listener that is triggered when an insert action was successful.
 * @prop {EntityBuilder_SuccessEvent<TContextPrototype>} onQuerySuccess
 * Add an event listener that is triggered when a query action was successful.
 * @prop {EntityBuilder_SuccessEvent<TContextPrototype>} onUpdateSuccess
 * Add an event listener that is triggered when an update action has failed.
 * @prop {EntityBuilder_FailEvent<TContextPrototype>} onDeleteFail
 * Add an event listener that is triggered when a delete action has failed.
 * @prop {EntityBuilder_FailEvent<TContextPrototype>} onInsertFail
 * Add an event listener that is triggered when an insert action has failed.
 * @prop {EntityBuilder_FailEvent<TContextPrototype>} onQueryFail
 * Add an event listener that is triggered when a query action has failed.
 * @prop {EntityBuilder_FailEvent<TContextPrototype>} onUpdateFail
 * Add an event listener that is triggered when an update action has failed.
 */
//#endregion

//#region class
/** 
 * @template TProto
 * @implements {IEntityBuilder<TProto>} 
 */
export class EntityBuilder {
    constructor() {

    }
    //#region relationships
    /** @type {IEntityBuilder<TProto>['hasOne']} */
    hasOne(callback) {

    }

    /** @type {IEntityBuilder<TProto>['hasMany']} */
    hasMany(callback) {

    }
    //#endregion
    //#region events
    /** @type {IEntityBuilder<TProto>['onDeleteFail']} */
    onDeleteFail() {

    }

    /** @type {IEntityBuilder<TProto>['onDeleteSuccess']} */
    onDeleteSuccess() {

    }

    /** @type {IEntityBuilder<TProto>['onInsertFail']} */
    onInsertFail() {

    }

    /** @type {IEntityBuilder<TProto>['onInsertSuccess']} */
    onInsertSuccess() {

    }

    /** @type {IEntityBuilder<TProto>['onQueryFail']} */
    onQueryFail() {

    }

    /** @type {IEntityBuilder<TProto>['onQuerySuccess']} */
    onQuerySuccess() {

    }

    /** @type {IEntityBuilder<TProto>['onUpdateFail']} */
    onUpdateFail() {

    }

    /** @type {IEntityBuilder<TProto>['onUpdateSuccess']} */
    onUpdateSuccess() {
        
    }
    //#endregion
    //#region triggers
    /** @type {IEntityBuilder<TProto>['afterDelete']} */
    afterDelete() {

    }

    /** @type {IEntityBuilder<TProto>['beforeDelete']} */
    beforeDelete() {

    }

    /** @type {IEntityBuilder<TProto>['afterInsert']} */
    afterInsert() {

    }

    /** @type {IEntityBuilder<TProto>['beforeInsert']} */
    beforeInsert() {

    }

    /** @type {IEntityBuilder<TProto>['afterUpdate']} */
    afterUpdate() {

    }

    /** @type {IEntityBuilder<TProto>['beforeUpdate']} */
    beforeUpdate() {

    }
    //#endregion

    //#region friend accessors
    /**
     * @protected
     */
    get __events() {
        return [];
    }

    /**
     * @protected
     */
    get __relationships() {
        return [];
    }

    /**
     * @protected
     */
    get __triggers() {
        return [];
    }
    //#endregion
}
//#endregion

//#region util types
/**
 * @template TProto
 * @callback EntityBuilder_HasOne
 * @param {(model: {[K1 in keyof InstanceType<TProto> as InstanceType<TProto>[K1] extends KinshipTable ? K1 : never]: {[K2 in keyof InstanceType<TProto>[K1] as InstanceType<TProto>[K1][K2] extends KinshipTable ? K : never]: {[K in keyof InstanceType<TProto>[K1][K2]]: { WithKeys: (key: keyof InstanceType<TProto>[K1], foreignKey: keyof InstanceType<TProto>[K1][K2]) => void }}}}) => void} callback
 */

/**
 * @template TBaseModel
 * @callback EntityBuilder_HasMany
 * @param {(model: {[K1 in keyof InstanceType<TProto> as InstanceType<TProto>[K1] extends KinshipTable ? K1 : never]: InstanceType<TProto>[K1] extends KinshipTable<infer T> ? T : "?"}) => void} callback
 */

/**
 * @template TBaseModel
 * @callback EntityBuilder_BeforeTrigger
 */

/**
 * @template TBaseModel
 * @callback EntityBuilder_AfterTrigger
 */

/**
 * @template TBaseModel
 * @callback EntityBuilder_SuccessEvent
 */

/**
 * @template TBaseModel
 * @callback EntityBuilder_FailEvent
 */
//#endregion