//@ts-check
import { KinshipContext } from "../src/context/context.js";

/**
 * @typedef {object} MyType
 * @prop {number=} id
 * @prop {number} a
 * @prop {string} b
 */

/** @type {KinshipContext<MyType>} */
const ctx = new KinshipContext(/** @type {import("../src/index.js").KinshipAdapter<any>}*/ ({}), "Abc");

ctx.beforeInsert((m, { $$itemNumber, count }) => {
    m.id = count + $$itemNumber;
}, async () => {
    return {
        count: await ctx.count() 
    }
});

ctx.select(m => [m.id, m.a]).then(r => {
    const x = r[0];
    
    r[0].id;
    r[0].a;
})

ctx.select(m => m.id).then(r => {
    r[0].id
})

/** @type {import("../src/types.js").ReconstructSqlTable<MyType, { a: any, id: any }>} */
const x = {
    a: 0,
    id: undefined
};