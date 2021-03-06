import * as vscode from 'vscode';
import * as child from 'child_process';
import * as process from 'process';
import * as fs from 'fs';

import { CommandRunnerParseOnlyResult } from './results/CommandRunnerParseOnlyResult';
import { CommandRunnerTestRunResult } from './results/CommandRunnerTestRunResult';
import { CommandRunnerTestCreateResult } from './results/CommandRunnerTestCreateResult';
import { SplitScript } from '../code-quality/code-quality-base/split-script/SplitScript';

export class CommandRunner {
    public errors : string[] = [];
    private commandrunner_path : string | undefined = undefined;
    private commandrunner_uri : vscode.Uri | undefined = undefined;
    private commandrunner_user : string | undefined = undefined;
    private commandrunner_password : string | undefined = undefined;

    public constructor() {
        this.commandrunner_path = vscode.workspace.getConfiguration().get('indeni.commandRunnerPath');
        this.commandrunner_user = vscode.workspace.getConfiguration().get('indeni.commandRunnerUser');
        this.commandrunner_password = vscode.workspace.getConfiguration().get('indeni.commandRunnerPassword');

        if (this.commandrunner_path !== undefined) {
            this.commandrunner_uri = vscode.Uri.file(this.commandrunner_path);
        }
    }

    private verify_command_runner_path() : boolean {
        let result : boolean = false;

        if (this.commandrunner_path !== undefined) {
            if (fs.existsSync(this.commandrunner_path)) {
                result = true;
            }
        }
        
        if (!result) {
            vscode.window.showErrorMessage('Command runner path not specified. Please do so in application settings');
        }
        return result;
    }
    
    public RunFullCommand(input_filename : string, ip_address : string, callback : ((result : CommandRunnerParseOnlyResult) => void)) {
        if (!this.verify_command_runner_path() || this.commandrunner_uri === undefined) {
            return;
        }

        if (this.commandrunner_user === undefined) {
            this.commandrunner_user = '';
        }

        if (this.commandrunner_password === undefined) {
            this.commandrunner_password = '';
        }
        let command = this.escape_filename(this.commandrunner_uri.fsPath) + ` full-command --ssh ${this.commandrunner_user},${this.commandrunner_password} --basic-authentication ${this.commandrunner_user},${this.commandrunner_password} ` + this.escape_filename(input_filename) + " " + ip_address;
        child.exec(command, 
        (error, stdout, stderr) => {
            if (error !== null) {
                console.error(error);
            }

            if (stderr !== '') {
                console.error(stderr);
            }
            callback(new CommandRunnerParseOnlyResult(input_filename, ip_address, stdout));
        });
    }

    public RunParseOnly(filename : string, input_filename : string, callback : ((result : CommandRunnerParseOnlyResult) => void)) {
        if (!this.verify_command_runner_path() || this.commandrunner_uri === undefined) {
            return;
        }

        if (this.commandrunner_uri === undefined) {
            return;
        }
        
        child.exec(this.escape_filename(this.commandrunner_uri.fsPath) + " parse-only " + this.escape_filename(filename) + " -f " + this.escape_filename(input_filename), 
        (error, stdout, stderr) => {
            if (error !== null) {
                console.error(error);
            }

            if (stderr !== '') {
                console.error(stderr);
            }

            callback(new CommandRunnerParseOnlyResult(input_filename, filename, stdout));

        });
    }

    public async CreateTestCaseAsync(split_script : SplitScript) : Promise<CommandRunnerTestCreateResult | undefined> {
        if (!split_script.is_valid_script) {
            return Promise.reject('Invalid script');
        }

        if (this.commandrunner_uri === undefined) {
            return Promise.reject('Invalid command-runner path');
        }
        
        let case_name : string | undefined = undefined;
        await vscode.window.showInputBox({ placeHolder: 'New test case name' }).then(value => 
            {
                case_name = value;
            });

        if (case_name === undefined) {
            return Promise.reject('No test case name selected');
        }

        let test_case_map : {[key : string] : string} = {};
        const items : vscode.QuickPickItem[] = [];
        let test_cases = split_script.get_test_cases();
        if (test_cases !== undefined) {
            for (let t_case of test_cases)
            {
                if (t_case.name !== undefined && t_case.input_data_path !== undefined)
                {
                    items.push({ label: t_case.name });
                    test_case_map[t_case.name] = t_case.input_data_path;
                }
            }
            items.push({ label: 'Browse...' });
        }

        let input_filename = await vscode.window.showQuickPick(items, { placeHolder: 'Select existing input file or browse for new' });
        if (input_filename === undefined) {
            return Promise.reject('No input file specified');
        }
        
        let input_data_path : string | undefined = undefined;
        if (input_filename.label !== 'Browse...') {
            input_data_path = test_case_map[input_filename.label];
        } else {
            let path = await vscode.window.showOpenDialog({ canSelectFolders: false, canSelectMany: false, openLabel: 'Select input file...' });
            if (path !== undefined) {
            {
                    if (path.length > 0) {
                        input_data_path = path[0].fsPath;
                    }
                }
            }
        }

        if (input_data_path === undefined){
            return Promise.reject('No input file speficied');
        }

        let script_filename = split_script.header_section !== undefined? split_script.header_section.filename: '';
        
        let command = "test create " + this.escape_filename(script_filename) + " " + case_name + " " + this.escape_filename(input_data_path);
        let result = await this.RunCommandRunner(command);


        return Promise.resolve(new CommandRunnerTestCreateResult(result));
    }

    public async GetVersion() : Promise<string> {
        return new Promise<string>(resolve => {
            this.RunCommandRunner('--version').then(value => {
                //command-runner: a command line tool for executing collector commands, version: 6.0.62
                let regex_match = /version:\s+(.+)/g;
                let match = regex_match.exec(value);
                if (match) {
                    vscode.window.showInformationMessage('Command-runner version: ' + match[1]);
                }
            });
        });
    }

    public async RunCommandRunner(command : string) : Promise<string> {
        if (this.commandrunner_uri === undefined || !this.verify_command_runner_path()) {
            return Promise.reject('Invalid command-runner path');
        }

        command = this.escape_filename(this.commandrunner_uri.fsPath) + ' ' + command;

        return new Promise<string>(
            resolve => {
                child.exec(command, (error, stdout, stderr) => {
                    resolve(stdout);
                }
                );
            }
        );
    }

    public CreateTestCase(script_filename : string, case_name : string, input_filename : string, callback : ((result : CommandRunnerTestCreateResult) => void)) {
        if (!this.verify_command_runner_path || this.commandrunner_uri === undefined) {
            return new Promise<CommandRunnerTestCreateResult>(reject => new Error('No command runner path defined'));
        }

        let command = this.escape_filename(this.commandrunner_uri.fsPath) + " test create " + this.escape_filename(script_filename) + " " + case_name + " " + this.escape_filename(input_filename);
        child.exec(command, (error, stdout, stderr) => {
            if (error !== null) {
                console.error(error);
            }

            if (stderr !== '') {
                console.error(stderr);
            }
            callback(new CommandRunnerTestCreateResult(stdout));
        });
    }

    public RunTests(filename : string, selected_case : string | undefined, callback : ((result : CommandRunnerTestRunResult) => void)) {
        if (!this.verify_command_runner_path() || this.commandrunner_uri === undefined) {
            return;
        }

        let command = this.escape_filename(this.commandrunner_uri.fsPath) + " test run " + this.escape_filename(filename);
        if (selected_case !== undefined) {
            command = this.escape_filename(this.commandrunner_uri.fsPath) + " test run " + this.escape_filename(filename) + " -c " + selected_case;
        }
        

        child.exec(command, 
        (error, stdout, stderr) => {
            if (error !== null) {
                console.error(error);
            }

            if (stderr !== '') {
                console.error(stderr);
            }

            callback(new CommandRunnerTestRunResult(stdout));
        });
    }

    private escape_filename(filename : string) : string {
        if (process.platform === 'win32') {
            return "\"" + filename + "\"";
        }
        return filename.replace(/\s/g, '\\ ');
    }
}