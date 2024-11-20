import * as vscode from 'vscode';
import { LLM } from './LLM';
import { Editor } from './editor';
import OpenAI from "openai";
import { marked } from 'marked'; // Convert Markdown text to HTML 

export class ChatWebView {
	panel: vscode.WebviewPanel | undefined = undefined;
	private context: vscode.ExtensionContext;
    private user_LLM: LLM;
	private editor:Editor;
	private code:string;
	private update_command:vscode.Disposable;
	public history:OpenAI.Chat.Completions.ChatCompletionMessage[];

	constructor(context: vscode.ExtensionContext, update_command:vscode.Disposable, user_LLM: LLM, editor:Editor){
		this.context = context;
        this.user_LLM = user_LLM;
		this.editor = editor;
		this.code = this.editor.get_all_text();


		this.history = [];
		this.update_command = update_command;
	}

	public toggle_veiw(){
		//Close pannel if already open
		if (this.panel) {
			this.panel.dispose();
		}

		// Create and show a new webview
		else {
			//Get initial history
			if (this.history.length===0){
				this.code = this.editor.get_all_text();
				this.history.push({role:'system', content:'You are a helpful AI assistant helping a programmer work on their code. For reference, here is there most recent, updated version of their "'+this.editor.get_document_filename()+'" code for refference (NOTE: changes may have been made since the start of the conversation, again this is the most updated version so previous messages might not agree with this code): ```\n' + this.code + '\n```'});
				this.history.push({role:'assistant', content:'Hello! How can I assist you today?'});
			}

			this.panel = vscode.window.createWebviewPanel(
				'ollamaChat', // Identifies the type of the webview. Used internally
				'Ollama Chat', // Title of the panel displayed to the user
				vscode.ViewColumn.Two, // Editor column to show the new webview panel in.
				{
					// And restrict the webview to only loading content from our extension's `images` directory.
					localResourceRoots: [
						vscode.Uri.joinPath(this.context.extensionUri, 'images'), 
						vscode.Uri.joinPath(this.context.extensionUri, 'src', 'media')
					],
					enableScripts: true
				}
			);

			//Set currentPannel to null if disposed by user
			this.panel.onDidDispose(
				() => {this.panel = undefined;},
				null,
				this.context.subscriptions
			);
			
			//Then Render the content
			this.render_content();
		}
	}

	private render_content(){
		//Render content
		if (this.panel){
			this.panel.iconPath = vscode.Uri.joinPath(this.context.extensionUri, "images", "dark_button.png");

			const image_path = vscode.Uri.joinPath(this.context.extensionUri, 'images', 'icon.png');
			const imageUri = this.panel.webview.asWebviewUri(image_path);

			const css_path = vscode.Uri.joinPath(this.context.extensionUri, 'src', 'media', 'style.css');
			const css_Uri = this.panel.webview.asWebviewUri(css_path);

			const script_path = vscode.Uri.joinPath(this.context.extensionUri, 'src', 'media', 'script.js');
			const script_Uri = this.panel.webview.asWebviewUri(script_path);
			this.panel.webview.html = this.getWebviewContent(imageUri, css_Uri, script_Uri);

			// Handle messages from the webview
			this.panel.webview.onDidReceiveMessage(
				async message => {
				  this.generate_response_request(message);
				},
				undefined,
				this.context.subscriptions
			);
		}
	}

	private async generate_response_request(message:any){

		//Prevent unnecicary code updates
		if (this.history.length===2 && this.editor.get_all_text()!==this.code){
			this.code = this.editor.get_all_text();
			this.history.push({role:'system', content:'You are a helpful AI assistant helping a programmer work on their code. For reference, here is there most recent, updated version of their "'+this.editor.get_document_filename()+'" code for refference (NOTE: changes may have been made since the start of the conversation, again this is the most updated version so previous messages might not agree with this code): ```\n' + this.code + '\n```'});
			this.history.push({role:'assistant', content:'Hello! How can I assist you today?'});
		}

		if (this.panel){
			const image_path = vscode.Uri.joinPath(this.context.extensionUri, 'images', 'icon.png');
			const imageUri = this.panel.webview.asWebviewUri(image_path);
		
			const css_path = vscode.Uri.joinPath(this.context.extensionUri, 'src', 'media', 'style.css');
			const css_Uri = this.panel.webview.asWebviewUri(css_path);
		
			const script_path = vscode.Uri.joinPath(this.context.extensionUri, 'src', 'media', 'script.js');
			const script_Uri = this.panel.webview.asWebviewUri(script_path);
			switch (message.command) {
				case 'stop':

				case 'user_msg':

					//Update system prompt in case code has changed
					const new_code = this.editor.get_all_text();
					console.log(new_code);
					console.log(this.code);
					if (!(new_code === this.code)){
						this.code = new_code;
						this.history[0]={role:'system', content:'You are a helpful AI assistant helping a programmer work on their code. For reference, here is there most recent, updated version of their "'+this.editor.get_document_filename()+'" code for refference (NOTE: changes may have been made since the start of the conversation, again this is the most updated version so previous messages might not agree with this code): ```\n' + this.code + '\n```'};
						this.history.push({role:'user', content:message.text + ['\n\n**[CODE UPDATED]**']});
					}
					else{
						this.history.push({role:'user', content:message.text});
					}

					if (message.text === "/clear"){
						this.history = [];
						this.history.push({role:'system', content:'You are a helpful AI assistant helping a programmer work on their code. For reference, here is there most recent, updated version of their "'+this.editor.get_document_filename()+'" code for refference (NOTE: changes may have been made since the start of the conversation, again this is the most updated version so previous messages might not agree with this code): ```\n' + this.code + '\n```'});
						this.history.push({role:'assistant', content:'Hello! How can I assist you today?'});
						if (this.panel){
							this.panel.webview.html = this.getWebviewContent(imageUri, css_Uri, script_Uri);}
						return;
					}

					// Render user's prompt in chat history
					if (this.panel){
						this.panel.webview.html = this.getWebviewContent(imageUri, css_Uri, script_Uri);
					}

					//Get LLM info
					const generator = await this.user_LLM.generate_chat_response(this.history);

					this.history.push({role:'assistant', content:''});

					// Push the command to the subscriptions array
					this.context.subscriptions.push(this.update_command);

					//Update content to create new chat
					if (this.panel){this.panel.webview.html = this.getWebviewContent(imageUri, css_Uri, script_Uri);}
					for await (const chunk of generator) {
						if (chunk.choices[0].delta.content){
							this.history[this.history.length-1].content += chunk.choices[0].delta.content;
						}

						vscode.commands.executeCommand('docstring-gpt.doUpdateContent', this.panel, String(marked(String(this.history[this.history.length-1].content)+' ⬤')));
					}
					if (this.panel){this.panel.webview.html = this.getWebviewContent(imageUri, css_Uri, script_Uri);}
				return;
			}
		}
	}

	private getWebviewContent(image:vscode.Uri, css:vscode.Uri, script:vscode.Uri) {
		//Build message bubbles to insert
		var chat_string = '';
	
		for (let i=1; i<this.history.length; i++){
			var name:String;
			if (this.history[i].role === 'user'){
				name = 'You';
			}
			else {
				name = this.user_LLM.model;
			}
	
			let message = this.history[i].content;
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
}