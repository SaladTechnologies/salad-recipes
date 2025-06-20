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
const child_process_1 = require("child_process");
const path_1 = __importDefault(require("path"));
class Export extends core_1.Command {
    run() {
        return __awaiter(this, void 0, void 0, function* () {
            const { args, flags } = yield this.parse(Export);
            const directory = args['recipe-dir'];
            const recipeJson = path_1.default.resolve(directory, args['recipe-json']);
            yield this.exportRecipe(directory, recipeJson);
        });
    }
    exportRecipe(directory, recipeJson) {
        return __awaiter(this, void 0, void 0, function* () {
            this.log(`Exporting recipe from ${directory} to ${recipeJson}`);
            try {
                const containerGroup = JSON.parse(yield promises_1.default.readFile(`${directory}/container-group.json`, 'utf8'));
                containerGroup.readme = yield promises_1.default.readFile(`${directory}/container_template.readme.mdx`, 'utf8');
                const form = JSON.parse(yield promises_1.default.readFile(`${directory}/form.json`, 'utf8'));
                form.description = yield promises_1.default.readFile(`${directory}/form.description.mdx`, 'utf8');
                const patches = JSON.parse(yield promises_1.default.readFile(`${directory}/patches.json`, 'utf8'));
                const misc = JSON.parse(yield promises_1.default.readFile(`${directory}/misc.json`, 'utf8'));
                for (let i = 0; i < patches.length; i++) {
                    const patchArray = patches[i];
                    for (let j = 0; j < patchArray.length; j++) {
                        const patch = patchArray[j];
                        if (patch.op === 'add' && patch.path === '/output/readme' && patch.value === '$replace') {
                            const readmePatch = `${directory}/patches.${i}.${j}.readme.mdx`;
                            patches[i][j].value = yield promises_1.default.readFile(readmePatch, 'utf8');
                        }
                    }
                }
                const recipe = Object.assign({ container_template: containerGroup, form: form, patches: patches }, misc);
                yield promises_1.default.writeFile(recipeJson, JSON.stringify(recipe, null, 2));
                (0, child_process_1.execSync)(`npx prettier --write ${recipeJson}`, { stdio: 'inherit' });
            }
            catch (err) {
                console.error(`Error reading or writing recipe:`, err);
                process.exit(1);
            }
        });
    }
}
Export.args = {
    'recipe-dir': core_1.Args.directory({
        description: 'directory to export the recipe from',
        required: true,
        exists: true,
    }),
    'recipe-json': core_1.Args.string({
        description: 'file to write the exported recipe JSON to',
        required: true,
        default: 'recipe.json',
    }),
};
Export.description = 'Export a recipe to a JSON file';
Export.examples = ['<%= config.bin %> <%= command.id %>'];
exports.default = Export;
