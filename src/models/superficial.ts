import { StartsWith } from "./string";

type UnionToIntersection<T> = 
  (T extends any ? (x: T) => any : never) extends 
  (x: infer R) => any ? R : never;

export type Isolate<T extends object|undefined, K extends string> = StartsWith<K, "$"> extends never ? UnionToIntersection<K extends keyof T 
    ? Pick<T, K> 
    : {[K2 in keyof T as T[K2] extends object|undefined 
        ? K2 
        : never
    ]: Isolate<T[K2] & (object|undefined), K>}> : { [K2 in K]: number };