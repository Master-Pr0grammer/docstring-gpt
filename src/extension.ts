// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import OpenAI from "openai";
import { marked } from 'marked'; // Convert Markdown text to HTML 


//LLM info
var config = vscode.workspace.getConfiguration('Docstring-GPT');
var ENDPOINT:string = String(config.get('llm.endpoint'));
var APIKEY:string = String(config.get('llm.apikey'));
var MODEL:string = String(config.get('llm.model'));

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
			model: MODEL,
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

	const user_LLM = new LLM(ENDPOINT, APIKEY, MODEL, 0.0);

	// Docsring generation command definition
	const docString = vscode.commands.registerCommand('docstring-gpt.generateDocstring', async () => {
		if (vscode.window.activeTextEditor){
			const editor = new Editor(vscode.window.activeTextEditor);

			const function_def = editor.get_selection_text();
			const generator = await user_LLM.api_call(function_def);
			
			editor.insert_docstring(generator);
		}
	});

	let currentPanel: vscode.WebviewPanel | undefined = undefined;
	var history:OpenAI.Chat.Completions.ChatCompletionMessage[] = [];
	const ollamaChat = vscode.commands.registerCommand('docstring-gpt.ollamaChat', () => {
		
		const editor = vscode.window.activeTextEditor;
		var code = editor?.document.getText();
		if (history.length === 0){
			history.push({role:'system', content:'You are a helpful AI assistant helping a programmer work on their code. For reference, here is there most recent, updated version of their "'+editor?.document.fileName+'" code for refference (NOTE: changes may have been made since the start of the conversation, again this is the most updated version so previous messages might not agree with this code): ```\n' + code + '\n```'});
			history.push({role:'assistant', content:'Hello! How can I assist you today?'});
		}
		

		if (currentPanel) {
			currentPanel.dispose(); //Close pannel if already open
		}
		else {
			// Create and show a new webview
			currentPanel = vscode.window.createWebviewPanel(
				'ollamaChat', // Identifies the type of the webview. Used internally
				'Ollama Chat', // Title of the panel displayed to the user
				vscode.ViewColumn.Two, // Editor column to show the new webview panel in.
				{
					// And restrict the webview to only loading content from our extension's `images` directory.
					localResourceRoots: [
						vscode.Uri.joinPath(context.extensionUri, 'images'), 
						vscode.Uri.joinPath(context.extensionUri, 'src', 'media')
					],
					enableScripts: true
				}
			);

			//Set currentPannel to null if disposed by user
			currentPanel.onDidDispose(
				() => {currentPanel = undefined;},
				null,
				context.subscriptions
			);
		}

		//Render content
		if (currentPanel){
			currentPanel.iconPath = vscode.Uri.joinPath(context.extensionUri, "images", "dark_button.png");

			const image_path = vscode.Uri.joinPath(context.extensionUri, 'images', 'icon.png');
			const imageUri = currentPanel.webview.asWebviewUri(image_path);

			const css_path = vscode.Uri.joinPath(context.extensionUri, 'src', 'media', 'style.css');
			const css_Uri = currentPanel.webview.asWebviewUri(css_path);

			const script_path = vscode.Uri.joinPath(context.extensionUri, 'src', 'media', 'script.js');
			const script_Uri = currentPanel.webview.asWebviewUri(script_path);
			currentPanel.webview.html = getWebviewContent(MODEL, imageUri, css_Uri, script_Uri, history);

			// Handle messages from the webview
			currentPanel.webview.onDidReceiveMessage(
				async message => {
				  switch (message.command) {
					case 'user_msg':
						//Update system prompt in case code has changed
						const new_code = editor?.document.getText();
						if (!(new_code === code)){
							code = new_code;
							history[0]={role:'system', content:'You are a helpful AI assistant helping a programmer work on their code. For reference, here is there most recent, updated version of their "'+editor?.document.fileName+'" code for refference (NOTE: changes may have been made since the start of the conversation, again this is the most updated version so previous messages might not agree with this code): ```\n' + code + '\n```'};
							history.push({role:'user', content:message.text + ['\n\n**[CODE UPDATED]**']});
						}
						else{
							history.push({role:'user', content:message.text});
						}

						if (message.text === "/clear"){
							history = [];
							history.push({role:'system', content:'You are a helpful AI assistant helping a programmer work on their code. For reference, here is there most recent, updated version of their "'+editor?.document.fileName+'" code for refference (NOTE: changes may have been made since the start of the conversation, again this is the most updated version so previous messages might not agree with this code): ```\n' + code + '\n```'});
							history.push({role:'assistant', content:'Hello! How can I assist you today?'});
							if (currentPanel){
								currentPanel.webview.html = getWebviewContent(MODEL, imageUri, css_Uri, script_Uri, history);}
							return;
						}

						// Render user's prompt in chat history
						if (currentPanel){
							currentPanel.webview.html = getWebviewContent(MODEL, imageUri, css_Uri, script_Uri, history);
						}

						//Get LLM info
						const config = vscode.workspace.getConfiguration('Docstring-GPT');
						ENDPOINT = String(config.get('llm.endpoint'));
						APIKEY = String(config.get('llm.apikey'));
						MODEL = String(config.get('llm.model'));
						var openai = new OpenAI({apiKey:APIKEY, baseURL:ENDPOINT});
						const generator = await openai.chat.completions.create({
							model: MODEL,
							messages: history,
							stream:true,
							temperature:0.0
						});
						
						history.push({role:'assistant', content:''});

						// Push the command to the subscriptions array
						context.subscriptions.push(update);

						//Update content to create new chat
						if (currentPanel){currentPanel.webview.html = getWebviewContent(MODEL, imageUri, css_Uri, script_Uri, history);}
						for await (const chunk of generator) {
							if (chunk.choices[0].delta.content){
								history[history.length-1].content += chunk.choices[0].delta.content;
							}

							vscode.commands.executeCommand('docstring-gpt.doUpdateContent', currentPanel, String(marked(String(history[history.length-1].content)+' ⬤')));
						}
						if (currentPanel){currentPanel.webview.html = getWebviewContent(MODEL, imageUri, css_Uri, script_Uri, history);}
						return;
				  }
				},
				undefined,
				context.subscriptions
			  );
		}
	});

	// Register the update command to update webview
	let update = vscode.commands.registerCommand('docstring-gpt.doUpdateContent', (panel: vscode.WebviewPanel, chunkContent: string) => {
		if (!currentPanel) {
			return;
		}
	
		// Send a message to the webview to update the content
		panel.webview.postMessage({ command: 'doUpdateContent', content: chunkContent });
	});

	context.subscriptions.push(docString);
	context.subscriptions.push(ollamaChat);
}

function getWebviewContent(model:string, image:vscode.Uri, css:vscode.Uri, script:vscode.Uri, messages:Array<OpenAI.Chat.Completions.ChatCompletionMessage>) {
	//Build message bubbles to insert
	var chat_string = '';

	for (let i=1; i<messages.length; i++){
		var name:String;
		if (messages[i].role === 'user'){
			name = 'You';
		}
		else {
			name = model;
		}

		let message = messages[i].content;
		const chat_bubble = `
		<div class="chat-bubble">
			<h2>
				${name}
			</h2>
			<div class="markdown-container" id="markdownContent">${String(marked(String(message)))}</div>
		</div>`;
		
		//Append chat bubble to chat history
		chat_string+=chat_bubble;
	}

	return `<!DOCTYPE html>
	<html lang="en">
	<head>
		<meta charset="UTF-8">
		<meta name="viewport" content="width=device-width, initial-scale=1.0">
		<link rel="stylesheet" href="${css.toString()}">
		<title>Ollama Chat</title>
	</head>
	<body>
			<br>
			<img src="${image.toString()}" width="25%" />
			<br>
			<br>

			<div id="chat-container">
				${chat_string}
			</div>

			<form id="chat-form">
				<hr>
				<p>
					<textarea id="user_msg" name="user_msg" placeholder="Type a message..."></textarea>
					<input type="submit" value="Send">
				</p>
			</form>

	<script src="${script.toString()}"></script>
	</script>
	</body>
	</html>`;
}

// This method is called when your extension is deactivated
export function deactivate() {}
