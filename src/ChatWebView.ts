import * as vscode from 'vscode';
import { LLM } from './LLM';
import { Editor } from './editor';
import OpenAI from "openai";
import { marked } from 'marked'; // Convert Markdown text to HTML 

export class ChatWebView {
	private panel: vscode.WebviewPanel | undefined = undefined;
    private context: vscode.ExtensionContext;
    private user_LLM: LLM;
    private editor: Editor;
    private code: string;
    private currentGenerator: AsyncIterable<any> | null = null;

	private current_file:string;


	private imageUri:vscode.Uri|undefined=undefined;
	private css_Uri:vscode.Uri|undefined=undefined;
	private script_Uri:vscode.Uri|undefined=undefined;

	private all_chats: { [file: string] : OpenAI.Chat.Completions.ChatCompletionMessage[]; } = {};

    constructor(context: vscode.ExtensionContext, user_LLM: LLM, editor: Editor) {
        this.context = context;
        this.user_LLM = user_LLM;
        this.editor = editor;
		this.current_file = editor.get_document_filename();
		this.all_chats[this.current_file] = [];
        this.code = this.editor.get_all_text();
    }

	public toggle_veiw() {
        if (this.panel) {
            this.panel.dispose();
        } else {
            this.panel = vscode.window.createWebviewPanel(
                'ollamaChat',
                'Ollama Chat',
                vscode.ViewColumn.Two,
                {
                    localResourceRoots: [
                        vscode.Uri.joinPath(this.context.extensionUri, 'images'),
                        vscode.Uri.joinPath(this.context.extensionUri, 'src', 'media')
                    ],
                    enableScripts: true
                }
            );

            this.panel.onDidDispose(
                () => {
                    this.panel = undefined;
                    this.currentGenerator = null;
                },
                null,
                this.context.subscriptions
            );

			const image_path = vscode.Uri.joinPath(this.context.extensionUri, 'images', 'icon.png');
			this.imageUri = this.panel.webview.asWebviewUri(image_path);
			const css_path = vscode.Uri.joinPath(this.context.extensionUri, 'src', 'media', 'style.css');
			this.css_Uri = this.panel.webview.asWebviewUri(css_path);
			const script_path = vscode.Uri.joinPath(this.context.extensionUri, 'src', 'media', 'script.js');
			this.script_Uri = this.panel.webview.asWebviewUri(script_path);

            // Handle messages from the webview
			this.panel.webview.onDidReceiveMessage(
				async message => {
				  this.generate_response_request(message);
				},
				undefined,
				this.context.subscriptions
			);

			// Render initial content
			this.panel.webview.html = this.getWebviewContent();
        }
    }

	public update_view(){
		this.currentGenerator = null;
		this.current_file = this.editor.get_document_filename();

		if (this.panel){
			if (!(this.current_file in this.all_chats)){
				this.all_chats[this.current_file] = [];
			}

			this.code = this.editor.get_all_text();
			this.panel.webview.html = this.getWebviewContent();
		}
	}

	private async generate_response_request(message: any) {
        if (!this.panel) {return;}
		
		//If first message, make sure to use updated code
		if (this.all_chats[this.current_file].length===2){
			this.all_chats[this.current_file] = [];
			this.all_chats[this.current_file].push({
				role: 'system',
				content: 'You are a helpful AI assistant helping a programmer work on their code. For reference, here is their most recent, updated version of their "' + this.editor.get_document_filename() + '" code for reference (NOTE: changes may have been made since the start of the conversation, again this is the most updated version so previous messages might not agree with this code): ```\n' + this.code + '\n```'
			});
			this.all_chats[this.current_file].push({ role: 'assistant', content: 'Hello! How can I assist you today?' });
		}

        switch (message.command) {
			case 'clear':
				this.code = this.editor.get_all_text();
				this.all_chats[this.current_file] = [];
                this.all_chats[this.current_file].push({
                    role: 'system',
                    content: 'You are a helpful AI assistant helping a programmer work on their code. For reference, here is their most recent, updated version of their "' + this.editor.get_document_filename() + '" code for reference (NOTE: changes may have been made since the start of the conversation, again this is the most updated version so previous messages might not agree with this code): ```\n' + this.code + '\n```'
                });
                this.all_chats[this.current_file].push({ role: 'assistant', content: 'Hello! How can I assist you today?' });
				this.panel.webview.html = this.getWebviewContent();

            case 'stop':
                this.currentGenerator = null;
                this.panel.webview.postMessage({ command: 'generationComplete' });
                break;

            case 'user_msg':
                // If this is an edit, remove the last assistant message
                if (message.isEdit && this.all_chats[this.current_file].length >= 2) {
                    if (this.all_chats[this.current_file][this.all_chats[this.current_file].length - 1].role === 'assistant') {
                        this.all_chats[this.current_file].pop(); // Remove last assistant message
                    }
                    this.all_chats[this.current_file][this.all_chats[this.current_file].length - 1].content = message.text; // Update user message
                } else {
                    // Handle new message case...
                    const new_code = this.editor.get_all_text();
                    if (new_code !== this.code) {
                        this.code = new_code;
                        this.all_chats[this.current_file][0] = {
                            role: 'system',
                            content: 'You are a helpful AI assistant helping a programmer work on their code...'
                        };
                        this.all_chats[this.current_file].push({ role: 'user', content: message.text + ['\n\n**[CODE UPDATED]**'] });
                    } else {
                        this.all_chats[this.current_file].push({ role: 'user', content: message.text });
                    }
                }

                // Continue with generation...
                this.panel.webview.html = this.getWebviewContent();
				this.panel.webview.postMessage({ command: 'toggleGenerating', content:true });
                this.currentGenerator = await this.user_LLM.generate_chat_response(this.all_chats[this.current_file]);
                this.all_chats[this.current_file].push({ role: 'assistant', content: '' });

                this.panel.webview.html = this.getWebviewContent();
				this.panel.webview.postMessage({ command: 'toggleGenerating', content:true });

                try {
                    for await (const chunk of this.currentGenerator) {
                        if (!this.currentGenerator) {break;} // Stop if generator is nullified
                        
                        if (chunk.choices[0].delta.content) {
                            this.all_chats[this.current_file][this.all_chats[this.current_file].length - 1].content += chunk.choices[0].delta.content;
                        }
						
						this.panel.webview.postMessage({ command: 'doUpdateContent', content:String(marked(String(this.all_chats[this.current_file][this.all_chats[this.current_file].length - 1].content) + ' ⬤')) });
                    }
                } finally {
                    this.currentGenerator = null;
                    this.panel.webview.postMessage({ command: 'generationComplete' });
                    this.panel.webview.html = this.getWebviewContent();
                }
                break;
        }
    }

	private getWebviewContent() {
		// Test for new session
		if (this.all_chats[this.current_file].length === 0) {
			this.code = this.editor.get_all_text();
			this.all_chats[this.current_file].push({
				role: 'system',
				content: 'You are a helpful AI assistant helping a programmer work on their code. For reference, here is their most recent, updated version of their "' + this.editor.get_document_filename() + '" code for reference (NOTE: changes may have been made since the start of the conversation, again this is the most updated version so previous messages might not agree with this code): ```\n' + this.code + '\n```'
			});
			this.all_chats[this.current_file].push({ role: 'assistant', content: 'Hello! How can I assist you today?' });
		}

		if (this.panel && this.imageUri && this.css_Uri && this.script_Uri){
			// Build message bubbles to insert
			var chat_string = '';
		
			for (let i = 1; i < this.all_chats[this.current_file].length; i++) {
				var name: String;
				if (this.all_chats[this.current_file][i].role === 'user') {
					name = 'You';
					const chat_bubble = `
					<div class="chat-bubble" data-message-id="${i}">
						<h2>${name}</h2>
						<div class="markdown-container" contenteditable="false">${String(marked(String(this.all_chats[this.current_file][i].content)))}</div>
						<button class="edit-button" title="Edit message">
							<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
								<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
								<path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
							</svg>
						</button>
					</div>`;
					chat_string += chat_bubble;
				} else {
					name = this.user_LLM.model;
					const chat_bubble = `
					<div class="chat-bubble">
						<h2>${name}</h2>
						<div class="markdown-container">${String(marked(String(this.all_chats[this.current_file][i].content)))}</div>
					</div>`;
					chat_string += chat_bubble;
				}
			}
		
			return `<!DOCTYPE html>
			<html lang="en">
			<head>
				<meta charset="UTF-8">
				<meta name="viewport" content="width=device-width, initial-scale=1.0">
				<link rel="stylesheet" href="${this.css_Uri.toString()}">
				<title>Ollama Chat</title>
			</head>
			<body>
				<img src="${this.imageUri.toString()}" width="100px" />
				
				<div id="chat-container">
					${chat_string}
				</div>

				<div class="input-container">
					<form id="chat-form">
						<div class="input-wrapper">
							<button 
								type="button" 
								class="stop-generating" 
								title="Stop generating">
								<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
									<rect x="6" y="6" width="12" height="12"></rect>
								</svg>
							</button>

							<button 
								type="button" 
								class="clear-context" 
								title="Clear">
							Clear
							</button>
							
							<textarea 
								id="user_msg" 
								name="user_msg" 
								placeholder="Type a message..."
								rows="1"
							></textarea>
							
							<button type="submit" class="submit-button" title="Send message">
								<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
									<path d="M22 2L11 13"></path>
									<path d="M22 2L15 22L11 13L2 9L22 2Z"></path>
								</svg>
							</button>
						</div>
					</form>
				</div>

				<script src="${this.script_Uri.toString()}"></script>
			</body>
			</html>`;
		}
		else{
			throw new Error("Objects Failed to Load");
		}
	}
}