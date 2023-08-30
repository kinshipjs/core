# SQL Row to JSON Algorithm

During the development process of Kinship (first appeared in `mysql-contexts` then `myorm`) I had to search for some algorithm that could accomplish serializing the results of a SQL query into user-friendly objects.

Unfortunately, I was never able to find a consistently easy and fast algorithm, until recently I have discovered the fastest algorithm.

I figured I would leave this algorithm on the internet in case anyone else is in need for the same thing.

## Pseudo-code

```
let rows be a resulting list of SQL rows from a joined query.
let table be the first table that was queried from, in the list of joining tables.
let schema be an object where each key is the name of the property you'd like in your final object and the value being the alias of the respective column as it appeared in the query.
let relationships be an object where each key is a table that joins with the current `table` and the value being another object:
    key of referenceTable be the name of the table being joined to.
    key of refererKey be the key, as it appeared in the command, that was joined on from the same `table` referenced above.
    key of referenceKey be the key, as it appeared in the command, that was joined on from `relationship.referenceTable`.
    key of schema be the schema for the corresponding table to `relationship.referenceTable` that is being joined to.
    key of moreRelationships be a recursive type of `relationships` but the all relationships instead belong to `relationships.referenceTable`.
    key of relationshipType be 1 if the type of this relationship is "one to one" or 2 if the type of relationship is "one to many".
let hasGroupByClause be true if the command had a "GROUP BY" clause, false otherwise.
let depth = 0

let result be equal to the return value for the invocation of `f(rows, table, schema, relationships, hasGroupByClause, depth)`.

function f(rows, table, schema, relationships, hasGroupByClause, depth):
    if records is less than or equal to (<=) 0, return `rows`.

    let allPrimaryKeys be a list of all primary keys that belong to `table`.
    if `hasGroupByClause` is true:
        let uniqueRowsByPKey be `rows`
    otherwise:
        let uniqueRowsByPKey be an empty list.
        let set be a Set that stores unique items.
        for every row in `rows`:
            [let row be the current row being looped through]
            let distinctKey be an empty string
            for every key in `allPrimaryKeys`:
                [let key be the current key being looped through]
                concatenate the value for the key, `key`, on `row` onto `distinctKey`
            end loop
            if `set` does NOT have `distinctKey`:
                push `row` into the list, `uniqueRowsByPKey`
                add `distinctKey` into `set`.
            end if
        end loop
    end if

    let serializedRows be an empty list.
    for every row within `uniqueRowsByPKey`:
        [let row be the current row being looped through]
        let newRow be an object with all of the same keys as `schema` and all values being the corresponding values from `row`. (use the value of `schema` to receive the value of `row`)
        if `hasGroupByClause` is true AND `depth` equals 0:
            assign all keys from `row` that have some distinction between non-aggregated rows and aggregated-rows. (e.g., starts with "$")
        end if
        
        for every key in `relationships`:
            [let key be the current key being looped through]
            let relationship be `relationships[key]`
            let relatedRows be a list with one item being `row`, if `hasGroupByClause` is true, 
            otherwise let relatedRows be an empty list.
            let refererValue be the value for the key, `relationship.refererKey`, on `row`.
            
            for every row within `rows`:
                [let otherRow be the current row being looped through]
                if `refererValue` is equal to the value for the key `relationship.referenceKey` on `otherRow`:
                    push `otherRow` into `relatedRows`
                end if
            end loop
            
            let serializedRows be the the return value for the recursive invocation of `f(`relatedRows`, `relationship.referenceTable`, `relationship.schema`, `relationship.moreRelationships`, `hasGroupByClause`, `depth` + 1)`.
            
            if `relationship.relationshipType` is 1 (one to one relationship) OR `hasGroupByClause` is true:
                set the value for the key `key` on `newRow` to be the zeroth (0) index of `serializedRows` (`serializedRows[0]`).
            otherwise (one to many relationship)
                set the value for the key `key` on `newRow` to be `serializedRows`.
            end if
        end loop
        push `newRow` into the `serializedRows` list.
    end loop
    return `serializedRows`
end function
```

## Actual Implementation

```js
#serialize(isGroupBy, 
    rows, 
    table=this.base.tableName, 
    schema=this.base.schema, 
    relationships=this.base.relationships, 
    depth = 0
) {
    if(rows.length <= 0) return rows;
    const pKeys = this.base.getPrimaryKeys(table);
    const uniqueRowsByPrimaryKey = isGroupBy 
        ? rows 
        : Optimized.getUniqueObjectsByKeys(rows, Optimized.map(pKeys, key => key.commandAlias));
    let serializedRows = [];
    for(let i = 0; i < uniqueRowsByPrimaryKey.length; ++i) {
        const record = uniqueRowsByPrimaryKey[i];
        const newRow = Optimized.getObjectFromSchemaAndRecord(schema, record);
        if(isGroupBy && depth === 0) {
            Optimized.assignKeysThatStartWith$To(record, newRow);
        }
        for(let key in relationships) {
            const relationship = relationships[key];
            const relatedRecords = isGroupBy 
                ? [record] 
                : Optimized.getRelatedRows(
                    rows, 
                    record[relationship.primary.alias], 
                    relationship.foreign.alias
                );
            // recurse with a new scope of records of only related records.
            const relatedRowsSerialized = this.#serialize(isGroupBy,
                relatedRecords,
                relationship.table,
                relationship.schema, 
                relationship.relationships,
                depth + 1
            );
            // set based on the type of relationship this is.
            // group by makes every record unique, and thus every related record would become 1:1.
            if(relationship.relationshipType === RelationshipType.OneToOne || isGroupBy) {
                newRow[key] = relatedRowsSerialized?.[0] ?? null;
            } else {
                newRow[key] = relatedRowsSerialized;
            }
        }
        serializedRows.push(newRow);
    }
    return serializedRows;
}
```