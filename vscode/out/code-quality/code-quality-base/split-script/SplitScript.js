"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = require("fs");
const SplitScriptIndSection_1 = require("./sections/SplitScriptIndSection");
const SplitScriptAwkSection_1 = require("./sections/SplitScriptAwkSection");
const SplitScriptXmlSection_1 = require("./sections/SplitScriptXmlSection");
const SplitScriptJsonSection_1 = require("./sections/SplitScriptJsonSection");
const path_1 = require("path");
const CommandRunner_1 = require("../../../command-runner/CommandRunner");
const path = require("path");
const fs = require("fs");
const CommandRunnerResultView_1 = require("../../../gui/CommandRunnerResultView");
const vscode = require("vscode");
const SplitScriptTestCases_1 = require("./test_cases/SplitScriptTestCases");
class SplitScript {
    constructor() {
        // Current open filename
        this.current_filename = '';
        // Current open file extension
        this.current_file_extension = '';
        // File name without path and extension
        this.current_file_basename = '';
        // Full file path without extension
        this.basepath = '';
        // Indeni script path
        this.path = '';
        this.awk_sections = [];
        this.xml_sections = [];
        this.json_sections = [];
        this.load_errors = [];
        this.current_section = undefined;
    }
    load(filename, content) {
        if (content === undefined) {
            try {
                content = fs_1.readFileSync(filename).toString();
            }
            catch (error) {
                console.error(error);
                return false;
            }
        }
        this.load_errors = [];
        let filename_match = filename.match(/([^\\/]+)$/g);
        if (filename_match) {
            this.current_filename = filename_match[0];
        }
        else {
            this.load_errors.push('Opt out on current_filename');
            return false;
        }
        let basename_match = filename.match(/^([^.]+)/g);
        if (basename_match) {
            this.basepath = basename_match[0];
        }
        else {
            this.load_errors.push('Opt out on basepath');
            return false;
        }
        let filename_split = this.current_filename.split(/^([^.]+)[\.](.*)$/g).filter((el) => {
            return el !== "";
        });
        if (filename_split.length === 2) {
            this.current_file_basename = filename_split[0];
            this.current_file_extension = filename_split[1];
        }
        else {
            return false;
        }
        this.path = filename.substring(0, filename.length - this.current_filename.length);
        for (let fn of fs_1.readdirSync(this.path)) {
            if (fn.endsWith('.ind.yaml')) {
                this.header_section = new SplitScriptIndSection_1.SplitScriptIndSection(this.path + path_1.sep + fn);
                for (let fn_sub of this.header_section.get_parser_filenames()) {
                    this.assign_section(this.path + path_1.sep + fn_sub);
                }
                break;
            }
        }
        if (this.current_filename.toLowerCase().endsWith('.ind.yaml')) {
            this.current_section = new SplitScriptIndSection_1.SplitScriptIndSection(this.current_filename, content);
        }
        else if (this.current_filename.toLowerCase().endsWith('.awk')) {
            this.current_section = new SplitScriptAwkSection_1.SplitScriptAwkSection(this.current_filename, content);
        }
        else if (this.current_filename.toLowerCase().endsWith('.json.yaml')) {
            this.current_section = new SplitScriptJsonSection_1.SplitScriptJsonSection(this.current_filename, content);
        }
        else if (this.current_filename.toLowerCase().endsWith('.xml.yaml')) {
            this.current_section = new SplitScriptXmlSection_1.SplitScriptXmlSection(this.current_filename, content);
        }
        else {
            return false;
        }
        return true;
    }
    assign_section(filename) {
        if (filename.endsWith('.ind.yaml')) {
            this.header_section = new SplitScriptIndSection_1.SplitScriptIndSection(filename);
        }
        else if (filename.endsWith('.awk')) {
            this.awk_sections.push(new SplitScriptAwkSection_1.SplitScriptAwkSection(filename));
        }
        else if (filename.endsWith('.json.yaml')) {
            this.json_sections.push(new SplitScriptJsonSection_1.SplitScriptJsonSection(filename));
        }
        else if (filename.endsWith('.xml.yaml')) {
            this.xml_sections.push(new SplitScriptXmlSection_1.SplitScriptXmlSection(filename));
        }
    }
    get is_valid_script() {
        return this.header_section !== undefined;
    }
    get script_test_folder() {
        if (this.header_section === undefined) {
            return undefined;
        }
        return this.find_test_root(this.header_section.filename.replace("parsers/src", "parsers/test").replace("parsers\\src", "parsers\\test"));
    }
    find_test_root(filepath) {
        let test_json = path.join(filepath, 'test.json');
        if (fs.existsSync(test_json)) {
            return filepath;
        }
        filepath = path.resolve(filepath, '..');
        if (fs.existsSync(path.join(filepath, 'test.json'))) {
            return filepath;
        }
        return undefined;
    }
    get_test_cases() {
        let test_root = this.script_test_folder;
        if (test_root === undefined) {
            return undefined;
        }
        let test_file = path.join(test_root, 'test.json');
        if (!fs.existsSync(test_file)) {
            return undefined;
        }
        return SplitScriptTestCases_1.SplitScriptTestCases.get(test_file);
    }
    command_runner_test_create(context) {
        if (this.header_section === undefined) {
            return;
        }
        let test_cases = this.get_test_cases();
        if (test_cases === undefined) {
            return;
        }
        if (test_cases.length <= 0) {
            return;
        }
        const items = test_cases.map(item => {
            return {
                label: item.name
            };
        });
        items.unshift({ label: 'New case' });
        vscode.window.showQuickPick(items, { 'canPickMany': false, 'placeHolder': 'Pick test case' }).then(value => {
            if (value === undefined) {
                return;
            }
            if (value.label !== 'New case') {
                this.get_test_case_name();
                return;
            }
            else {
                this.get_test_case((value) => {
                    if (value === undefined) {
                        return;
                    }
                    if (test_cases === undefined) {
                        return;
                    }
                    let test_case = test_cases.filter((tc) => {
                        return tc.name === value;
                    });
                    let selected_case = test_case[0];
                    if (selected_case.name === undefined) {
                        this.get_test_case_name();
                        return;
                    }
                    if (selected_case.input_data_path === undefined) {
                        this.get_input_file(selected_case.name);
                        return;
                    }
                    this.use_script_input(value, selected_case.input_data_path);
                });
            }
        });
    }
    use_script_input(test_case_name, test_case_input_data_path) {
        let options = [];
        options.push({ label: 'Yes' });
        options.push({ label: 'No' });
        vscode.window.showQuickPick(options, { placeHolder: 'Do you wish to use the existing input file for test case ' + test_case_name + '?' }).then(value => {
            if (value === undefined) {
                return;
            }
            if (value.label === 'No') {
                this.get_input_file(test_case_name);
            }
            else {
                this.create_test_case(test_case_name, test_case_input_data_path);
            }
        });
    }
    get_test_case_name() {
        vscode.window.showInputBox({ placeHolder: 'Select test case name' }).then((value) => {
            if (value !== undefined) {
                value = value.trim();
                if (value.match(/ /)) {
                    vscode.window.showErrorMessage('Test case should not contain spaces');
                    return;
                }
                this.get_input_file(value);
            }
        });
    }
    get_input_file(test_case_name) {
        vscode.window.showOpenDialog({ canSelectFolders: false, canSelectMany: false, openLabel: 'Open test case input file' }).then(value => {
            if (value === undefined) {
                return;
            }
            if (value.length < 1) {
                return;
            }
            this.create_test_case(test_case_name, value[0].fsPath);
        });
    }
    create_test_case(test_case_name, input_data_path) {
        if (this.header_section === undefined) {
            return;
        }
        let script_filename = this.header_section.filename;
        let cr = new CommandRunner_1.CommandRunner();
        cr.CreateTestCase(script_filename, test_case_name, input_data_path, result => {
            if (result === undefined) {
                vscode.window.showErrorMessage('Unable to create test case');
                return;
            }
            if (!result.success) {
                vscode.window.showErrorMessage('Unable to create test case');
                return;
            }
            vscode.window.showInformationMessage(`Created test case '${result.test_case}' for command '${result.script_name}'`);
        });
        /*, (result : CommandRunnerTestCreateResult) => {
        
            if (result.success) {
                vscode.window.showInformationMessage(`Created test case '${result.test_case}' for command '${result.script_name}'`);
            }
            else {
                vscode.window.showErrorMessage('Unable to create test case');
            }
        });*/
    }
    get_test_case(callback) {
        vscode.window.showInputBox({ placeHolder: 'Test case name' }).then((value) => {
            if (value === undefined) {
                callback(undefined);
            }
            else {
                let match = /[a-z]{0,}[\-]?[a-z]{0,}/gm;
                if (value.match(match)) {
                    callback(value);
                }
                callback(value);
            }
        });
    }
    command_runner_test(context) {
        if (this.header_section === undefined) {
            return;
        }
        let test_cases = this.get_test_cases();
        if (test_cases !== undefined) {
            if (test_cases.length > 0) {
                const items = test_cases.map(item => {
                    return {
                        label: item.name
                    };
                });
                items.unshift({ label: 'All' });
                vscode.window.showQuickPick(items, { 'canPickMany': false, 'placeHolder': 'Pick test case' }).then((value) => {
                    let selected_case = undefined;
                    if (value !== undefined) {
                        if (value.label !== 'All') {
                            selected_case = value.label;
                        }
                    }
                    else {
                        return;
                    }
                    if (this.header_section === undefined) {
                        return;
                    }
                    let command_runner = new CommandRunner_1.CommandRunner();
                    command_runner.RunTests(this.header_section.filename, selected_case, (result) => {
                        let view = new CommandRunnerResultView_1.CommandRunnerResultView(context.extensionPath);
                        view.show_test_result(result);
                    });
                });
            }
        }
        else {
            let command_runner = new CommandRunner_1.CommandRunner();
            command_runner.RunTests(this.header_section.filename, undefined, (result) => {
                let view = new CommandRunnerResultView_1.CommandRunnerResultView(context.extensionPath);
                view.show_test_result(result);
            });
        }
    }
    command_runner_full_command(context) {
        if (this.header_section === undefined) {
            return;
        }
        vscode.window.showInputBox({ placeHolder: 'IP Address' }).then((value) => {
            if (value === undefined || this.header_section === undefined) {
                return;
            }
            let command_runner = new CommandRunner_1.CommandRunner();
            command_runner.RunFullCommand(this.header_section.filename, value, (result) => {
                let view = new CommandRunnerResultView_1.CommandRunnerResultView(context.extensionPath);
                view.show_parser_result(result);
                return;
            });
        });
    }
    command_runner_parse(context, tests_path) {
        if (this.header_section === undefined) {
            return;
        }
        let pick_items = [];
        let test_cases = this.get_test_cases();
        if (test_cases !== undefined) {
            if (test_cases.length > 0) {
                for (let test_case of test_cases) {
                    if (test_case.name !== undefined) {
                        pick_items.push({ label: test_case.name });
                    }
                }
            }
        }
        pick_items.push({ label: 'Browse...' });
        vscode.window.showQuickPick(pick_items, { 'canPickMany': false, 'placeHolder': 'Pick test case' }).then((value) => {
            if (value !== undefined) {
                if (value.label === 'Browse...') {
                    vscode.window.showOpenDialog({ 'canSelectFolders': false, 'canSelectFiles': true, 'canSelectMany': false, 'defaultUri': (tests_path !== undefined) ? vscode.Uri.file(tests_path) : undefined }).then((value) => {
                        if (value !== undefined && this.header_section !== undefined) {
                            if (value.length > 0) {
                                let command_runner = new CommandRunner_1.CommandRunner();
                                command_runner.RunParseOnly(this.header_section.filename, value[0].fsPath, (result) => {
                                    let view = new CommandRunnerResultView_1.CommandRunnerResultView(context.extensionPath);
                                    view.show_parser_result(result);
                                    return;
                                });
                            }
                        }
                    });
                    return;
                }
                else if (test_cases !== undefined) {
                    let selected_case = test_cases.find((item) => { return item.name === value.label; });
                    if (selected_case !== undefined && this.header_section !== undefined) {
                        if (selected_case.input_data_path !== undefined) {
                            let command_runner = new CommandRunner_1.CommandRunner();
                            command_runner.RunParseOnly(this.header_section.filename, selected_case.input_data_path, (result) => {
                                let view = new CommandRunnerResultView_1.CommandRunnerResultView(context.extensionPath);
                                view.show_parser_result(result);
                                return;
                            });
                        }
                    }
                }
            }
        });
    }
}
exports.SplitScript = SplitScript;
//# sourceMappingURL=SplitScript.js.map