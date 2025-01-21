//@ts-check

/**
 * @template TModel
 * @template {keyof TModel} TColumn
 * @typedef ITestBuilder
 * @prop {(value: TModel[TColumn]) => PropertyRetriever<TModel, ITestBuilder<TModel, TColumn>>} test
 */

/**
 * @template TModel
 * @template TBuilder
 * @typedef {{[K in keyof TModel]: TBuilder}} PropertyRetriever
 */

/**
 * @template TModel
 * @template TBuilder
 * @param {new () => TBuilder} builder
 * @returns {PropertyRetriever<TModel, TBuilder>}
 */
function PropertyRetriever(builder) {
    return new Proxy(/** @type {any} */ ({}), {

    });
}

/**
 * @typedef TestModel
 * @prop {string} foo
 * @prop {number} bar
 */

/**
 * @template TModel
 * @template {keyof TModel} [TColumn=keyof TModel]
 * @implements {ITestBuilder<TModel>}
 */
class TestBuilder {
    test() {
        return PropertyRetriever(TestBuilder);
    }
}

/** @type {PropertyRetriever<TestModel, ITestBuilder<TestModel>>} */
const a = PropertyRetriever(TestBuilder);

a.bar.test("")
    .foo.test("")