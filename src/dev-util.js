//@ts-check

export function isPrimitive(field) {
    switch(typeof field) {
        case "bigint":
        case "boolean":
        case "number":
        case "string":
        case "undefined":
            return true;
    }
    return false;
}