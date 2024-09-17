// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import OpenAI from "openai";
import { Stream } from 'openai/src/streaming.js';

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
	console.log('docstring-gpt is now active!');
	vscode.window.showInformationMessage('Docstring-GPT Now Active!');


	const disposable2 = vscode.commands.registerCommand('docstring-gpt.generateDocstring', async () => {
		// Get the active text editor
		const editor = vscode.window.activeTextEditor;

		if (editor) {
			//check indentation type
			const { insertSpaces, tabSize } = editor.options;
			var indent = '';
            
            if (typeof insertSpaces === 'boolean') {
                const indentStyle = insertSpaces ? 'Spaces' : 'Tabs';
				if (indentStyle === 'Tabs'){
					indent = '\t';
				}
				else if (typeof tabSize === 'number'){
					indent = ' '.repeat(tabSize);
				}
            }

			const document = editor.document;
			const selection = editor.selection;

			// Get the word within the selection
			const text = document.getText(selection);
			const text_arr = text.split('\n');

			const generator = await api_call(text);
			var docstring = "";

			for await (const chunk of generator) {
				docstring += chunk.choices[0].delta.content;  // Do something with each chunk
				
				//create replacement string
				const temp_docstring = docstring.replaceAll('"""', '').replaceAll('\n','\n'+indent); // Get rid of generated comment tags & fix tabs
				const new_text = text_arr[0] + '\n' + indent + '"""' + temp_docstring + '"""\n\n' + text_arr.slice(1, text_arr.length).join('\n');
				const selection = editor.selection;
				
				//replace current text with updated text
				editor.edit(editBuilder => {
					editBuilder.replace(selection, new_text);
				});
			}
		}
	});

	context.subscriptions.push(disposable2);
}

async function api_call(function_definition: string): Promise<AsyncIterable<any>>{
	const completion = await openai.chat.completions.create({
		model: model,
		messages: [
			{"role": "system", "content": "You are a expert docstring generator. You are given a function, and tasked with generating a docstring for the function. Only output the content of the docstring, nothing else."},
			{"role":"user", "content":function_definition}
		],
		stream:true,
		temperature:0.0
	});
	return completion;
}

// This method is called when your extension is deactivated
export function deactivate() {}
