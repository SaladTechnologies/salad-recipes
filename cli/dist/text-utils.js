"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.camelToSnakeCase = camelToSnakeCase;
exports.snakeAllKeys = snakeAllKeys;
exports.snakeToCamel = snakeToCamel;
exports.camelAllKeys = camelAllKeys;
exports.validateRecipeJson = validateRecipeJson;
const assert_1 = __importDefault(require("assert"));
function camelToSnakeCase(str) {
    return str.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase();
}
function snakeAllKeys(obj) {
    if (Array.isArray(obj)) {
        return obj.map(snakeAllKeys);
    }
    else if (typeof obj === 'object' && obj !== null) {
        return Object.fromEntries(Object.entries(obj).map(([key, value]) => {
            if (key === 'environmentVariables') {
                return [camelToSnakeCase(key), value]; // Keep environmentVariables as is
            }
            return [camelToSnakeCase(key), snakeAllKeys(value)];
        }));
    }
    return obj;
}
function snakeToCamel(str) {
    return str.replace(/_([a-z])/g, (match, letter) => letter.toUpperCase());
}
function camelAllKeys(obj) {
    if (Array.isArray(obj)) {
        return obj.map(camelAllKeys);
    }
    else if (obj !== null && typeof obj === 'object') {
        return Object.fromEntries(Object.entries(obj).map(([key, value]) => {
            if (key === 'environment_variables') {
                return [snakeToCamel(key), value]; // Keep environmentVariables as is
            }
            return [snakeToCamel(key), camelAllKeys(value)];
        }));
    }
    return obj;
}
function validateRecipeJson(recipe) {
    if (!recipe || typeof recipe !== 'object') {
        return false;
    }
    const { form, container_template: containerTemplate, patches, ui } = recipe;
    (0, assert_1.default)(form, 'Recipe must contain a "form" property');
    (0, assert_1.default)(form.title, 'Recipe form must contain a "title" property');
    (0, assert_1.default)(form.description, 'Recipe form must contain a "description" property');
    (0, assert_1.default)(containerTemplate, 'Recipe must contain a "container_template" property');
    (0, assert_1.default)(containerTemplate.readme, 'Recipe container_template must contain a "readme" property');
    (0, assert_1.default)(patches, 'Recipe must contain a "patches" property');
    (0, assert_1.default)(Array.isArray(patches), 'Recipe "patches" property must be an array');
    for (const patch of patches) {
        (0, assert_1.default)(Array.isArray(patch), 'Each patch in "patches" must be an array');
    }
    (0, assert_1.default)(recipe.documentation_url, 'Recipe must contain a "documentation_url" property');
    (0, assert_1.default)(recipe.short_description, 'Recipe must contain a "short_description" property');
    return true;
}
