//@ts-check

/**
 * Defines the property to be a one-to-one foreign object reference.
 * @template {object} T
 * Foreign object
 * @typedef {T=} FOREIGN_REF_ONE_TO_ONE
 */

/**
 * Defines the property to be a one-to-one foreign object reference.
 * @template {object} T
 * Foreign object
 * @typedef {T[]=} FOREIGN_REF_ONE_TO_MANY
 */

/**
 * Some Scalar Data Type that is supported within most query languages.
 * @typedef {ScalarStringDataType|ScalarDateDataType|ScalarNumericDataType} ScalarDataType
 */

/**
 * Some Decorator that is supported within most query languages.
 * @typedef {PRIMARY<ScalarDataType>
 * |FOREIGN<ScalarDataType, object, keyof object & string>
 * |NULLABLE<ScalarDataType>
 * |IDENTITY<ScalarDataType>
 * |UNIQUE<ScalarDataType>
 * |VIRTUAL<ScalarDataType>} Decorator
 */

/**
 * Some Decorator that is supported within most query languages.
 * @typedef {PRIMARY<ScalarNumericDataType>
* |FOREIGN<ScalarNumericDataType, object, keyof object & string>
* |NULLABLE<ScalarNumericDataType>
* |IDENTITY<ScalarNumericDataType>
* |UNIQUE<ScalarNumericDataType>
* |VIRTUAL<ScalarNumericDataType>} NumericDecorator
*/

/** 
 * Defines a column as a Primary Key.
 * @template {ScalarDataType|Decorator} T
 * Data Type of the column.
 * @typedef {T=} PRIMARY 
 */

/** 
 * Defines a column as a Foreign Key.
 * @template {ScalarDataType|Decorator} T
 * Data Type of the column.
 * @template {object} TForeignObject
 * Table object that this column references.
 * @template {keyof {[K in keyof TForeignObject as TForeignObject[K] extends string|number|undefined ? K : never]}} TForeignKey
 * Key of `TForeignObject` that this column references.
 * @typedef {T=} FOREIGN
 */

/**
 * Defines a column as a nullable column.
 * @template {ScalarDataType|Decorator} T
 * Data Type of the column. 
 * @typedef {T=} NULLABLE 
 */

/** 
 * Defines a column as a non-nullable column.
 * @template {ScalarDataType|Decorator} T 
 * Data Type of the column.
 * @typedef {NonNullable<T>} NON_NULLABLE 
 */

/**
 * Defines a column to have some default value, `V`.
 * @template {ScalarDataType|Decorator} T 
 * Data Type of the column.
 * @template {T} V 
 * The default value for this column.
 * @typedef {T=} DEFAULT 
 */

/** 
 * Defines a column to be an identity column, meaning the database auto increments this row for every insert.
 * @template {ScalarDataType|Decorator} T 
 * Data Type of the column.
 * @typedef {T=} IDENTITY 
 */

/** 
 * Defines a column to be required to be of a unique value.
 * @template {ScalarDataType|Decorator} T 
 * Data Type of the column.
 * @typedef {T} UNIQUE 
 */

/**
 * Defines a column as a virtual column. 
 * @template {ScalarDataType|Decorator} T 
 * Data Type of the column.
 * @typedef {Readonly<T>=} VIRTUAL 
 */

/** 
 * Defines a column as an unsigned numerical column.
 * @template {ScalarNumericDataType|NumericDecorator} T 
 * Data Type of the column.
 * @typedef {T} UNSIGNED 
 */

// STRING DATA TYPES

/**
 * Defines a column as some string column.
 * @typedef {TINYTEXT
* |MEDIUMTEXT
* |LONGTEXT
* |TEXT<number>
* |TINYBLOB
* |MEDIUMBLOB
* |LONGBLOB
* |BLOB<number>
* |CHAR<number>
* |VARCHAR<number>
* |BINARY<number>
* |VARBINARY<number>
* |ENUM<string|string[]>
* |SET<string|string[]>} ScalarStringDataType
*/

/** @typedef {string} TINYTEXT */
/** @typedef {string} MEDIUMTEXT */
/** @typedef {string} LONGTEXT */

/**
* @template {number} T
* @typedef {string} TEXT
*/

/** @typedef {string} TINYBLOB */
/** @typedef {string} MEDIUMBLOB */
/** @typedef {string} LONGBLOB */

/**
* @template {number} T
* @typedef {string} BLOB
*/

/**
* @template {string|string[]} T
* @typedef {T extends Array ? T[number] : T} ENUM
*/

/**
* @template {string|string[]} T
* @typedef {T extends Array ? T[number] : T} SET
*/

/**
* @template {number} [T=1]
* @typedef {string} CHAR
*/

/**
* @template {number} T
* @typedef {string} VARCHAR
*/

/**
* @template {number} T
* @typedef {string} BINARY
*/

/**
* @template {number} T
* @typedef {string} VARBINARY
*/

// DATE DATA TYPES

/** @typedef {DATE|YEAR|DATETIME<string>|TIMESPAN<string>|TIME<string>} ScalarDateDataType */

/** @typedef {Date} DATE */
/** @typedef {Date} YEAR */
/** @template {string} [T=string] @typedef {Date} DATETIME */
/** @template {string} [T=string] @typedef {Date} TIMESPAN */
/** @template {string} [T=string] @typedef {Date} TIME */

// NUMERIC DATA TYPES

/** 
* @typedef {BIT<IntRange0to63>
* |TINYINT<IntRange0to255>
* |BOOL
* |BOOLEAN
* |SMALLINT
* |MEDIUMINT
* |BIGINT
* |INT
* |FLOAT
* |FLOAT4
* |FLOAT8
* |DOUBLE
* |DOUBLE_PRECISION
* |DECIMAL<IntRange0to65,IntRange0to30>
* |DEC<IntRange0to65,IntRange0to30>} ScalarNumericDataType 
* */

/** @template {IntRange0to63} [TSize=1] @typedef {TSize extends 1 ? boolean : number} BIT */
/** @template {IntRange0to255} [TSize=1] @typedef {number} TINYINT */
/** @typedef {boolean} BOOL */
/** @typedef {boolean} BOOLEAN */
/** @typedef {number} SMALLINT */
/** @typedef {number} MEDIUMINT */
/** @typedef {bigint} BIGINT */
/** @typedef {number} INT */
/** @typedef {number} FLOAT */
/** @typedef {number} FLOAT4 */
/** @typedef {number} FLOAT8 */
/** @typedef {number} DOUBLE */
/** @typedef {number} DOUBLE_PRECISION */
/** @template {IntRange0to65} [TSize=10] @template {IntRange0to30} [TDecimalSize=0] @typedef {number} DECIMAL */
/** @template {IntRange0to65} [TSize=10] @template {IntRange0to30} [TDecimalSize=0] @typedef {number} DEC */

/** @typedef {0|1|2|3|4|5|6|7|8|9|10|11|12|13|14|15|16|17|18|19|20|21|22|23|24|25|26|27|28|29|30} IntRange0to30 */
/** @typedef {0|1|2|3|4|5|6|7|8|9|10|11|12|13|14|15|16|17|18|19|20|21|22|23|24|25|26|27|28|29|30|31|32|33|34|35|36|37|38|39|40|41|42|43|44|45|46|47|48|49|50|51|52|53|54|55|56|57|58|59|60|61|62|63} IntRange0to63 */
/** @typedef {0|1|2|3|4|5|6|7|8|9|10|11|12|13|14|15|16|17|18|19|20|21|22|23|24|25|26|27|28|29|30|31|32|33|34|35|36|37|38|39|40|41|42|43|44|45|46|47|48|49|50|51|52|53|54|55|56|57|58|59|60|61|62|63|64|65|66|67|68|69|70|71|72|73|74|75|76|77|78|79|80|81|82|83|84|85|86|87|88|89|90|91|92|93|94|95|96|97|98|99|100|101|102|103|104|105|106|107|108|109|110|111|112|113|114|115|116|117|118|119|120|121|122|123|124|125|126|127|128|129|130|131|132|133|134|135|136|137|138|139|140|141|142|143|144|145|146|147|148|149|150|151|152|153|154|155|156|157|158|159|160|161|162|163|164|165|166|167|168|169|170|171|172|173|174|175|176|177|178|179|180|181|182|183|184|185|186|187|188|189|190|191|192|193|194|195|196|197|198|199|200|201|202|203|204|205|206|207|208|209|210|211|212|213|214|215|216|217|218|219|220|221|222|223|224|225|226|227|228|229|230|231|232|233|234|235|236|237|238|239|240|241|242|243|244|245|246|247|248|249|250|251|252|253|254|255} IntRange0to255 */
/** @typedef {IntRange0to63|64|65} IntRange0to65 */