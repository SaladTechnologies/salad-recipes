"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@oclif/core");
const promises_1 = __importDefault(require("fs/promises"));
const path_1 = __importDefault(require("path"));
class List extends core_1.Command {
    run() {
        return __awaiter(this, void 0, void 0, function* () {
            const { args } = yield this.parse(List);
            const directory = path_1.default.resolve(args.directory);
            this.log(`Listing recipes in directory: ${directory}`);
            try {
                const recipeDirs = yield promises_1.default.readdir(directory, {
                    withFileTypes: true,
                });
                const recipePaths = recipeDirs
                    .filter((dir) => dir.isDirectory())
                    .map((dir) => path_1.default.join(directory, dir.name, 'recipe.json'));
                const recipes = yield Promise.all(recipePaths.map((recipePath) => __awaiter(this, void 0, void 0, function* () {
                    try {
                        const content = yield promises_1.default.readFile(recipePath, 'utf-8');
                        return JSON.parse(content);
                    }
                    catch (error) {
                        this.error(`Error reading recipe at ${recipePath}: ${error.message}`);
                    }
                })));
                this.log('Recipes found:');
                recipes.forEach((recipe) => {
                    if (recipe) {
                        this.log(`- ${recipe.form.title}`);
                    }
                });
            }
            catch (error) {
                this.error(`Error reading directory: ${error.message}`);
            }
        });
    }
}
List.args = {
    directory: core_1.Args.directory({
        description: 'directory containing recipes to list',
        exists: true,
        required: true,
        default: './recipes',
    }),
};
List.description = 'List all recipes in a specified directory';
List.examples = ['<%= config.bin %> <%= command.id %>'];
exports.default = List;
