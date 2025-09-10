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
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const assert_1 = __importDefault(require("assert"));
const child_process_1 = require("child_process");
const inquirer_1 = __importDefault(require("inquirer"));
const marked_1 = require("marked");
const cli_html_1 = __importDefault(require("cli-html"));
const ora_1 = __importDefault(require("ora"));
const text_utils_1 = require("../text-utils");
class Deploy extends core_1.Command {
    run() {
        return __awaiter(this, void 0, void 0, function* () {
            const { args, flags } = yield this.parse(Deploy);
            this.saladApiKey = process.env.SALAD_API_KEY;
            if (!flags['dry-run'] && !this.saladApiKey) {
                this.error('SALAD_API_KEY environment variable is not set.');
            }
            let recipeFile = args['recipe-file'];
            if (!recipeFile && !flags.list) {
                this.error('You must provide a recipe file or use the --list flag to choose a recipe interactively.');
            }
            else if (flags.list) {
                const recipeRootDir = flags['recipe-dir'];
                recipeFile = yield this.promptRecipes(recipeRootDir);
            }
            if (flags.export) {
                const recipeDir = path_1.default.dirname(recipeFile);
                (0, child_process_1.execSync)(`npx recipe export ${recipeDir}`);
            }
            yield this.deployRecipe(recipeFile, flags['dry-run']);
        });
    }
    deployRecipe(recipePath, dryRun) {
        return __awaiter(this, void 0, void 0, function* () {
            (0, assert_1.default)(fs_1.default.existsSync(recipePath), `Recipe file does not exist: ${recipePath}`);
            const recipe = JSON.parse(fs_1.default.readFileSync(recipePath, 'utf8'));
            const { form, container_template: containerTemplate, patches, ui } = recipe;
            (0, assert_1.default)(form, 'Recipe must contain a "form" property');
            (0, assert_1.default)(form.title, 'Recipe form must contain a "title" property');
            (0, assert_1.default)(form.description, 'Recipe form must contain a "description" property');
            (0, assert_1.default)(containerTemplate, 'Recipe must contain a "container_template" property');
            (0, assert_1.default)(patches, 'Recipe must contain a "patches" property');
            (0, assert_1.default)(recipe.documentation_url, 'Recipe must contain a "documentation_url" property');
            (0, assert_1.default)(recipe.short_description, 'Recipe must contain a "short_description" property');
            this.log(`===Recipe Deployment Wizard===`);
            this.log(`Deploying recipe: ${recipePath}\n\n`);
            try {
                const html = yield (0, marked_1.marked)(`# ${form.title}\n${form.description}`);
                this.log((0, cli_html_1.default)(html));
            }
            catch (e) {
                this.error(`Error rendering recipe description: ${e.message}`);
            }
            const inputs = yield this.getInputs(form, ui);
            Object.assign(inputs, yield this.getConstantInputs(containerTemplate));
            const output = this.applyPatches(containerTemplate, inputs, patches);
            const readme = output.readme;
            delete output.readme; // Remove readme from the output to avoid sending it to the API
            const snakedOutput = (0, text_utils_1.snakeAllKeys)(output); // Convert all keys to snake_case
            let containerGroup = snakedOutput;
            if (!dryRun) {
                this.log('\nSalad Organization:');
                const org = (yield inquirer_1.default.prompt([
                    {
                        type: 'input',
                        name: 'org',
                        message: 'Enter your Salad organization Name:',
                        required: true,
                    },
                ])).org;
                if (!org) {
                    this.error('Organization is required.');
                    return;
                }
                this.log('\nSalad Project:');
                const project = (yield inquirer_1.default.prompt([
                    {
                        type: 'input',
                        name: 'project',
                        message: 'Enter your Salad project Name:',
                        required: true,
                    },
                ])).project;
                if (!project) {
                    this.error('Project is required.');
                    return;
                }
                this.log(`Creating container group with the following configuration, in org '${org}', project '${project}':`);
                this.log(JSON.stringify(snakedOutput, null, 2));
                const confirmation = (yield inquirer_1.default.prompt([
                    {
                        type: 'confirm',
                        name: 'confirm',
                        message: 'Do you want to proceed with the deployment?',
                        default: true,
                    },
                ])).confirm;
                process.stdin.destroy();
                if (!confirmation) {
                    this.log('Deployment cancelled.');
                    return;
                }
                try {
                    containerGroup = yield this.createContainerGroup(org, project, snakedOutput);
                    containerGroup.apiKey = this.saladApiKey; // Include API key in output for readme rendering
                    this.log(`Container group created successfully: ${containerGroup.id}`);
                }
                catch (error) {
                    this.error(`Error creating container group: ${error.message}`);
                }
                const url = `https://portal.salad.com/organizations/${org}/projects/${project}/containers/${containerGroup.name}`;
                this.log(`\nYou can view the container group at: ${url}`);
                try {
                    // open the URL in the default browser
                    (0, child_process_1.execSync)(`xdg-open "${url}"`, { stdio: 'ignore' });
                }
                catch (error) {
                    this.error(`Failed to open URL in browser: ${error.message}`);
                }
            }
            else {
                this.log('Dry run mode enabled. The following container group would be created:');
                this.log(JSON.stringify(snakedOutput, null, 2));
                this.log('No actual deployment will occur.');
                if (containerGroup.networking) {
                    containerGroup.networking.dns = 'fake-placeholder-dsf8i7ukj.salad.cloud';
                }
                containerGroup.apiKey = 'thisisatotallyfakeapikeyforreadmegeneration';
            }
            const readmePath = path_1.default.resolve(`./${containerGroup.name}.readme.mdx`);
            try {
                fs_1.default.writeFileSync(readmePath, this.renderReadme(readme, (0, text_utils_1.camelAllKeys)(containerGroup)));
                this.log(`Readme written to: ${readmePath}`);
            }
            catch (error) {
                this.error(`Error writing readme: ${error.message}`);
            }
        });
    }
    getInputs(form, ui) {
        return __awaiter(this, void 0, void 0, function* () {
            const input = {};
            for (const field in form.properties) {
                const required = (form === null || form === void 0 ? void 0 : form.required.includes(field)) ? '(required) ' : '';
                this.log(`${required}${form.properties[field].title}:\n${form.properties[field].description || ''}`);
                let value;
                if (form.properties[field].type === 'boolean') {
                    value = (yield inquirer_1.default.prompt([
                        {
                            type: 'confirm',
                            name: field,
                            message: form.properties[field].title,
                            default: form.properties[field].default || false,
                        },
                    ]))[field];
                }
                else if (form.properties[field].type === 'number') {
                    value = (yield inquirer_1.default.prompt([
                        {
                            type: 'number',
                            name: field,
                            message: form.properties[field].title,
                            default: form.properties[field].default,
                        },
                    ]))[field];
                }
                else if (form.properties[field].type === 'string' && form.properties[field].enum) {
                    let enumOptions = form.properties[field].enum;
                    let usedLabels = false;
                    let defaultValue = form.properties[field].default;
                    if (ui && ui[field] && ui[field]['ui:enumNames']) {
                        (0, assert_1.default)(Array.isArray(ui[field]['ui:enumNames']), `ui:enumNames for field "${field}" must be an array`);
                        (0, assert_1.default)(ui[field]['ui:enumNames'].length === enumOptions.length, `ui:enumNames for field "${field}" must have the same length as enum options`);
                        enumOptions = ui[field]['ui:enumNames'];
                        defaultValue = ui[field]['ui:enumNames'][form.properties[field].enum.indexOf(defaultValue)];
                        usedLabels = true;
                    }
                    value = (yield inquirer_1.default.prompt([
                        {
                            type: 'list',
                            name: field,
                            message: form.properties[field].title,
                            choices: enumOptions,
                            default: defaultValue,
                        },
                    ]))[field];
                    if (usedLabels) {
                        // If using labels, map back to original enum values
                        const index = enumOptions.indexOf(value);
                        if (index !== -1) {
                            value = form.properties[field].enum[index];
                        }
                        else {
                            this.error(`Selected option "${value}" is not valid.`);
                        }
                    }
                }
                else if (form.properties[field].type === 'string') {
                    value = (yield inquirer_1.default.prompt([
                        {
                            type: 'input',
                            name: field,
                            message: form.properties[field].title,
                            default: form.properties[field].default || '',
                        },
                    ]))[field];
                }
                else {
                    throw new Error(`Unsupported field type "${form.properties[field].type}" for field "${field}".`);
                }
                if (form.required.includes(field) && (value === undefined || value === null || value === '')) {
                    throw new Error(`Field "${field}" is required but no value was provided.`);
                }
                input[field] = value;
            }
            if (form.dependencies) {
                for (const depField in form.dependencies) {
                    if (!form.dependencies[depField].oneOf) {
                        console.error(`Invalid dependency format for field "${depField}". Expected "oneOf" property.`);
                        continue;
                    }
                    for (const dep of form.dependencies[depField].oneOf) {
                        const matches = dep.properties[depField].enum.includes(input[depField]);
                        if (matches) {
                            const subForm = JSON.parse(JSON.stringify(dep));
                            delete subForm.properties[depField]; // Remove the dependency field from the sub-input
                            const subInputs = yield this.getInputs(subForm, ui);
                            Object.assign(input, subInputs);
                            break; // Only apply the first matching dependency
                        }
                    }
                }
            }
            return input;
        });
    }
    getConstantInputs(containerGroup) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            const constantInputs = {};
            constantInputs['replicas'] = (yield inquirer_1.default.prompt([
                {
                    type: 'number',
                    name: 'replicas',
                    message: 'Number of replicas',
                    default: containerGroup.replicas || 1,
                },
            ])).replicas;
            constantInputs['autostartPolicy'] = (yield inquirer_1.default.prompt([
                {
                    type: 'confirm',
                    name: 'autostartPolicy',
                    message: 'Start the container group automatically?',
                    default: (_a = containerGroup.autostartPolicy) !== null && _a !== void 0 ? _a : true,
                },
            ])).autostartPolicy;
            return constantInputs;
        });
    }
    setNestedValue(obj, path, value) {
        const lastKey = path[path.length - 1];
        const parentPath = path.slice(0, -1);
        // Navigate to the parent object
        let current = obj;
        for (const key of parentPath) {
            if (!(key in current) || typeof current[key] !== 'object') {
                current[key] = {};
            }
            current = current[key];
        }
        // Set the value
        current[lastKey] = value;
        return obj;
    }
    removeNestedValue(obj, path) {
        const lastKey = path[path.length - 1];
        const parentPath = path.slice(0, -1);
        // Navigate to the parent object
        let current = obj;
        for (const key of parentPath) {
            if (!(key in current)) {
                return obj; // Path does not exist, nothing to remove
            }
            current = current[key];
        }
        // Remove the value
        if (current && lastKey && lastKey in current) {
            delete current[lastKey];
        }
        return obj;
    }
    applyPatches(containerTemplate, inputs, patches) {
        const output = JSON.parse(JSON.stringify(containerTemplate)); // Deep copy to avoid mutating the original
        for (const patchBlock of patches) {
            for (const patch of patchBlock) {
                if (patch.op === 'test') {
                    const fieldToTest = patch.path.split('/').pop();
                    if (inputs[fieldToTest] !== patch.value) {
                        break; // Skip this block if the test fails
                    }
                }
                else if (patch.op === 'copy') {
                    const sourceField = patch.from.split('/').pop();
                    const sourceValue = inputs[sourceField];
                    if (sourceValue === undefined || sourceValue === '') {
                        continue;
                    }
                    const targetField = patch.path.split('/').slice(2);
                    this.setNestedValue(output, targetField, sourceValue);
                }
                else if (patch.op === 'add') {
                    const targetField = patch.path.split('/').slice(2);
                    // Traverse output to find the target field, and add the value
                    this.setNestedValue(output, targetField, patch.value);
                }
                else if (patch.op === 'remove') {
                    const targetField = patch.path.split('/').slice(2);
                    this.removeNestedValue(output, targetField);
                }
                else {
                    throw new Error(`Unsupported patch operation: ${patch.op}`);
                }
            }
        }
        return output;
    }
    createContainerGroup(org, project, containerGroupDefinition) {
        return __awaiter(this, void 0, void 0, function* () {
            const url = `https://api.salad.com/api/public/organizations/${org}/projects/${project}/containers`;
            const spinner = (0, ora_1.default)(`Creating container group ${containerGroupDefinition.name} in org '${org}', project '${project}'...`).start();
            const response = yield fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Salad-Api-Key': this.saladApiKey,
                },
                body: JSON.stringify(containerGroupDefinition),
            });
            if (!response.ok) {
                let body = yield response.text();
                try {
                    body = JSON.parse(body);
                    body = JSON.stringify(body, null, 2);
                }
                catch (e) { }
                spinner.fail(`Failed to create container group: ${response.status} - ${response.statusText}\n${body}`);
                this.error(`Failed to create container group: ${response.status} - ${response.statusText}\n${body}`);
            }
            spinner.succeed(`Container group ${containerGroupDefinition.name} created successfully.`);
            return response.json();
        });
    }
    renderReadme(readme, props) {
        if (!readme)
            return '';
        // Readme has js template literals that need to be evaluated
        const literalRegex = /=?{(`[^`]+`)}/g;
        const allMatches = readme.matchAll(literalRegex);
        if (!allMatches) {
            console.warn('No template literals found in readme. Returning original readme.');
            return readme;
        }
        let renderedReadme = readme;
        for (const match of allMatches) {
            const fullMatch = match[0];
            const literal = match[1];
            const renderedLiteral = eval(literal);
            // if the literal is preceded by a =, wrap it in quotes
            if (fullMatch.startsWith('=')) {
                renderedReadme = renderedReadme.replace(fullMatch, `="${renderedLiteral}"`);
            }
            else {
                renderedReadme = renderedReadme.replace(fullMatch, renderedLiteral);
            }
        }
        return renderedReadme;
    }
    promptRecipes(recipeRootDir) {
        return __awaiter(this, void 0, void 0, function* () {
            const recipeDirs = fs_1.default.readdirSync(recipeRootDir, {
                withFileTypes: true,
            });
            const recipePaths = recipeDirs
                .filter((dir) => dir.isDirectory())
                .map((dir) => path_1.default.join(recipeRootDir, dir.name, 'recipe.json'))
                .filter((file) => fs_1.default.existsSync(file));
            const recipes = recipePaths.map((recipePath) => {
                try {
                    const content = fs_1.default.readFileSync(recipePath, 'utf-8');
                    return { content: JSON.parse(content), path: recipePath };
                }
                catch (error) {
                    this.error(`Error reading recipe at ${recipePath}: ${error.message}`);
                }
            });
            const recipeFile = (yield inquirer_1.default.prompt([
                {
                    type: 'list',
                    name: 'recipe',
                    message: `Choose a recipe to deploy (${recipes.length} available):`,
                    choices: recipes.map((recipe) => {
                        return {
                            name: recipe.content.form.title,
                            value: recipe.path,
                        };
                    }),
                    default: recipes[0].path,
                    pageSize: 10, // Show 10 recipes at a time
                },
            ])).recipe;
            return recipeFile;
        });
    }
}
Deploy.args = {
    'recipe-file': core_1.Args.file({
        description: 'JSON file containing the recipe to deploy',
        required: false,
        exists: true,
    }),
};
Deploy.description = 'Deploy a recipe to Salad Cloud';
Deploy.examples = ['<%= config.bin %> <%= command.id %>'];
Deploy.flags = {
    list: core_1.Flags.boolean({
        description: 'interactively choose a recipe to deploy from a list',
        required: false,
        default: false,
        char: 'l',
    }),
    'recipe-dir': core_1.Flags.directory({
        description: 'directory containing recipes to list',
        required: false,
        exists: true,
        default: './recipes',
        char: 'd',
    }),
    export: core_1.Flags.boolean({
        description: 'Rebuild the recipe.json before deploying',
        required: false,
        default: false,
        char: 'e',
    }),
    'dry-run': core_1.Flags.boolean({
        description: 'Show the recipe deployment without actually deploying it',
        required: false,
        default: false,
    }),
};
exports.default = Deploy;
