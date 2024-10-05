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
	const docString = vscode.commands.registerCommand('docstring-gpt.generateDocstring', async () => {
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
			const num_indent = text_arr[1].split(indent).length - 1;

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
				const temp_docstring = docstring.replaceAll('"""', '').replaceAll('\n','\n'+indent.repeat(num_indent)); // Get rid of generated comment tags & fix tabs
				const new_text = text_arr[0] + '\n' + indent.repeat(num_indent) + '"""' + temp_docstring + '"""\n\n' + text_arr.slice(1, text_arr.length).join('\n');
				
				//replace current text with updated text
				editor.edit(editBuilder => {
					editBuilder.replace(selection_range, new_text);
				});

				text = new_text;
			}
		}
	});

	const ollamaChat = vscode.commands.registerCommand('docstring-gpt.ollamaChat', () => {
		// Create and show a new webview
		const panel = vscode.window.createWebviewPanel(
			'ollamaChat', // Identifies the type of the webview. Used internally
			'Ollama Chat', // Title of the panel displayed to the user
			vscode.ViewColumn.Two, // Editor column to show the new webview panel in.
			{} // Webview options. More on these later.
		);

		// And set its HTML content
		panel.webview.html = getWebviewContent();
	});

	context.subscriptions.push(docString);
	context.subscriptions.push(ollamaChat);
}

function getWebviewContent() {
	return `<!DOCTYPE html>
  <html lang="en">
  <head>
	  <meta charset="UTF-8">
	  <meta name="viewport" content="width=device-width, initial-scale=1.0">
	  <title>Cat Coding</title>
  </head>
  <body>
	  <img src="https://media.giphy.com/media/JIX9t2j0ZTN9S/giphy.gif" width="300" />
  </body>
  </html>`;
  }

//Make api call
async function api_call(function_definition: string): Promise<AsyncIterable<any>>{
	const config = vscode.workspace.getConfiguration('Docstring-GPT');
	const system_prompt:string = String(config.get('systemPrompt'));
	const format_specs:string = String(config.get("documentationSpecification"));
	const temperature:Number = Number(config.get('advanced.temperature'));

	console.log('System Prompt:', system_prompt);
	console.log('Documentation Specification:', format_specs);
    console.log('Temperature:', temperature);

	const completion = await openai.chat.completions.create({
		model: model,
		messages: [
			{"role": "system", "content": system_prompt + "\n\n" + format_specs},
			{"role":"user", "content":function_definition}
		],
		stream:true,
		temperature:0.0
	});
	return completion;
}

// This method is called when your extension is deactivated
export function deactivate() {}
