"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.camelToSnakeCase = camelToSnakeCase;
exports.snakeAllKeys = snakeAllKeys;
exports.snakeToCamel = snakeToCamel;
exports.camelAllKeys = camelAllKeys;
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
