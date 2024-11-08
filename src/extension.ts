// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import OpenAI from "openai";

//Local LLM info
const endpoint = "http://localhost:11434/v1";
const apikey = "ollama";
const model = "llama3.1";

const openai = new OpenAI({apiKey:apikey, baseURL:endpoint});

//Define class for LLM
class LLM {
	endpoint:string;
	apikey:string;
	model:string;
	temperature:number;

	client:OpenAI;

	constructor(endpoint:string, apikey:string, model:string, temperature:number) {
	  this.endpoint = endpoint;
	  this.apikey = apikey;
	  this.model = model;
	  this.temperature = temperature;

	  this.client = new OpenAI({apiKey:this.apikey, baseURL:this.endpoint});
	}

	public set_endpoint(endpoint:string){
		this.endpoint = endpoint;
		this.client = new OpenAI({apiKey:this.apikey, baseURL:this.endpoint});
	}

	public set_apikey(apikey:string){
		this.apikey = apikey;
		this.client = new OpenAI({apiKey:this.apikey, baseURL:this.endpoint});
	}

	public set_model(model:string){
		this.model = model;
	}

	public set_temperature(temperature:number){
		this.temperature = temperature;
	}

	//Call LLM
	public async api_call(function_definition: string): Promise<AsyncIterable<any>>{
		const config = vscode.workspace.getConfiguration('Docstring-GPT');
		const system_prompt:string = String(config.get('systemPrompt'));
		const format_specs:string = String(config.get("documentationSpecification"));
		const temperature:Number = Number(config.get('advanced.temperature'));
	
		console.log('System Prompt:', system_prompt);
		console.log('Documentation Specification:', format_specs);
		console.log('Temperature:', temperature);
	
		const completion = await this.client.chat.completions.create({
			model: model,
			messages: [
				{"role": "system", "content": system_prompt + "\n\n" + format_specs},
				{"role":"user", "content":function_definition}
			],
			stream:true,
			temperature:this.temperature
		});
		return completion;
	}
}

class Editor {
	editor:vscode.TextEditor;
	indent:string;

	constructor(editor:vscode.TextEditor) {
		this.editor = editor;

		//Set correct tab
		const { insertSpaces, tabSize } = this.editor.options;
		this.indent = '';
		
		if (typeof insertSpaces === 'boolean') {
			const indentStyle = insertSpaces ? 'Spaces' : 'Tabs';
			if (indentStyle === 'Tabs'){
				this.indent = '\t';
			}
			else if (typeof tabSize === 'number'){
				this.indent = ' '.repeat(tabSize);
			}
		}
	}

	public get_selection_text() {
		const document = this.editor.document;
		const current_selection = this.editor.selection;

		// Get the word within the selection
		return document.getText(current_selection);
	}

	public async insert_docstring(generator:AsyncIterable<any>){
		const document = this.editor.document;
		var current_selection = this.editor.selection;
		var text = document.getText(current_selection);

		const text_arr = text.split('\n');
		const num_indent = text_arr[1].split(this.indent).length - 1;

		var docstring = "";

		for await (const chunk of generator) {
			docstring += chunk.choices[0].delta.content;  // Do something with each chunk

			// Calculate the new range (we assume the docstring is inserted at the start of the selection)
			const temp =  text.split('\n');
			const Lines = temp.length - 1;
			
			const newEndPosition = new vscode.Position(current_selection.start.line + Lines, temp.slice(-1)[0].length);
			const selection_range = new vscode.Range(current_selection.start, newEndPosition);
			
			//create replacement string
			const temp_docstring = docstring.replaceAll('"""', '').replaceAll('\n','\n'+this.indent.repeat(num_indent)); // Get rid of generated comment tags & fix tabs
			const new_text = text_arr[0] + '\n' + this.indent.repeat(num_indent) + '"""' + temp_docstring + '"""\n\n' + text_arr.slice(1, text_arr.length).join('\n');
			
			//replace current text with updated text
			this.editor.edit(editBuilder => {
				editBuilder.replace(selection_range, new_text);
			});

			text = new_text;
		}
	}


}

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
	vscode.window.showInformationMessage('Docstring-GPT Now Active!');

	const user_LLM = new LLM(endpoint, apikey, model, 0.0);

	// Docsring generation command definition
	const disposable = vscode.commands.registerCommand('docstring-gpt.generateDocstring', async () => {
		if (vscode.window.activeTextEditor){
			const editor = new Editor(vscode.window.activeTextEditor);

			const function_def = editor.get_selection_text();
			const generator = await user_LLM.api_call(function_def);
			
			editor.insert_docstring(generator);
		}
	});

	context.subscriptions.push(disposable);
}

// This method is called when your extension is deactivated
export function deactivate() {}
