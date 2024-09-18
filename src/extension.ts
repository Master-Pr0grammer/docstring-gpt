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
	vscode.window.showInformationMessage('Docstring-GPT Now Active!');

	// Docsring generation command definition
	const disposable = vscode.commands.registerCommand('docstring-gpt.generateDocstring', async () => {
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
			var text = document.getText(selection);
			const text_arr = text.split('\n');

			const generator = await api_call(text);
			var docstring = "";

			for await (const chunk of generator) {
				docstring += chunk.choices[0].delta.content;  // Do something with each chunk

				// Calculate the new range (we assume the docstring is inserted at the start of the selection)
				const temp =  text.split('\n');
				const Lines = temp.length - 1;
				
				const newEndPosition = new vscode.Position(selection.start.line + Lines, temp.slice(-1)[0].length);
            	const selection_range = new vscode.Range(selection.start, newEndPosition);
				
				//create replacement string
				const temp_docstring = docstring.replaceAll('"""', '').replaceAll('\n','\n'+indent); // Get rid of generated comment tags & fix tabs
				const new_text = text_arr[0] + '\n' + indent + '"""' + temp_docstring + '"""\n\n' + text_arr.slice(1, text_arr.length).join('\n');
				
				//replace current text with updated text
				editor.edit(editBuilder => {
					editBuilder.replace(selection_range, new_text);
				});

				text = new_text;
			}
		}
	});

	context.subscriptions.push(disposable);
}

//Make api call
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
