// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import OpenAI from "openai";

//Local LLM info
const endpoint = "http://localhost:11434/v1";
const apikey = "ollama";
const model = "llama3.1";

const openai = new OpenAI({apiKey:apikey, baseURL:endpoint});

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('Congratulations, your extension "docstring-gpt" is now active!');
	vscode.window.showInformationMessage('DEBUG: Docstring-GPT Now Active!');


	const disposable2 = vscode.commands.registerCommand('docstring-gpt.helloWorld', async () => {
		// Get the active text editor
		const editor = vscode.window.activeTextEditor;

		if (editor) {
			const document = editor.document;
			const selection = editor.selection;

			// Get the word within the selection
			const text = document.getText(selection);
			vscode.window.showInformationMessage('Generating Docstring...');
			const temp = await api_call(text);
			const docstring = temp.replace('\n', '\n\t');

			const text_arr = text.split('\n');
			const new_text = text_arr[0] + '\n    """' + docstring + '"""\n' + text_arr.slice(1, text_arr.length);
			vscode.window.showInformationMessage('Done!');
			editor.edit(editBuilder => {
				editBuilder.replace(selection, new_text);
			});
		}
	});

	context.subscriptions.push(disposable2);
}

async function api_call(function_definition: string): Promise<string>{
	const completion = await openai.chat.completions.create({
		model: model,
		messages: [
			{"role": "system", "content": "You are a expert docstring generator. You are given a function, and tasked with generating a docstring for the function. Only output the content of the docstring, nothing else."},
			//{"role":"system", "content":"you are a helpfull assistant"},
			{"role":"user", "content":function_definition}
		]
	});
	if (completion.choices[0].message.content!==null){
		return completion.choices[0].message.content;
	}
	else{
		return "Error occured with generation.";
	}
}

// This method is called when your extension is deactivated
export function deactivate() {}
