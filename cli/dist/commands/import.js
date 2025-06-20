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
class Import extends core_1.Command {
    run() {
        return __awaiter(this, void 0, void 0, function* () {
            const { args, flags } = yield this.parse(Import);
            const recipeJson = args['recipe-json'];
            const directory = args['recipe-dir'] ? args['recipe-dir'] : path_1.default.dirname(recipeJson);
            yield this.importRecipe(recipeJson, directory);
        });
    }
    importRecipe(recipeJson, directory) {
        return __awaiter(this, void 0, void 0, function* () {
            this.log(`Importing recipe from ${recipeJson} to ${directory}`);
            yield promises_1.default.mkdir(directory, { recursive: true });
            try {
                const recipeData = yield promises_1.default.readFile(recipeJson, 'utf8');
                const recipe = JSON.parse(recipeData);
                const containerGroup = recipe.container_template;
                const readme = containerGroup.readme;
                containerGroup.readme = '$replace';
                const form = recipe.form;
                const description = form.description;
                form.description = '$replace';
                const readmePath = `${directory}/container_template.readme.mdx`;
                const formPath = `${directory}/form.json`;
                const containerGroupPath = `${directory}/container-group.json`;
                const descriptionPath = `${directory}/form.description.mdx`;
                this.log(`Writing files to ${directory}`);
                yield this.writeFile(readmePath, readme);
                yield this.writeFile(formPath, JSON.stringify(form, null, 2));
                yield this.writeFile(containerGroupPath, JSON.stringify(containerGroup, null, 2));
                yield this.writeFile(descriptionPath, description);
                const miscPath = `${directory}/misc.json`;
                const { ui, documentation_url, short_description, workload_types } = recipe;
                const misc = {
                    ui: ui || {},
                    documentation_url: documentation_url || '',
                    short_description: short_description || '',
                    workload_types: workload_types || [],
                };
                yield this.writeFile(miscPath, JSON.stringify(misc, null, 2));
                for (let i = 0; i < recipe.patches.length; i++) {
                    const patches = recipe.patches[i];
                    for (let j = 0; j < patches.length; j++) {
                        const patch = patches[j];
                        if (patch.op === 'add' && patch.path === '/output/readme') {
                            const outputReadmePath = `${directory}/patches.${i}.${j}.readme.mdx`;
                            yield this.writeFile(outputReadmePath, patch.value);
                            recipe.patches[i][j].value = '$replace';
                        }
                    }
                }
                const patchesPath = `${directory}/patches.json`;
                yield this.writeFile(patchesPath, JSON.stringify(recipe.patches, null, 2));
            }
            catch (err) {
                this.error(err);
            }
        });
    }
    writeFile(path, content) {
        return __awaiter(this, void 0, void 0, function* () {
            this.log(`Writing ${path}`);
            return promises_1.default.writeFile(path, content);
        });
    }
}
Import.args = {
    'recipe-json': core_1.Args.file({
        description: 'JSON file containing the recipe to import',
        required: true,
        exists: true,
    }),
    'recipe-dir': core_1.Args.directory({
        description: 'Directory to import the recipe into',
        required: false,
        exists: false,
        default: '.',
    }),
};
Import.description = 'Import a recipe from a JSON file';
Import.examples = ['<%= config.bin %> <%= command.id %>'];
exports.default = Import;
