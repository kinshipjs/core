//@ts-check
import { KinshipContext } from "./src/context/context.js";

/** @type {KinshipContext<{a: number, b: string}>} */
const ctx = new KinshipContext({}, "", {});
ctx.select()