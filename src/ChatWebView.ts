import * as vscode from 'vscode';
import { LLM } from './LLM';
import { Editor } from './editor';
import OpenAI from "openai";
import { marked } from 'marked'; // Convert Markdown text to HTML 

export class ChatWebView {
	panel: vscode.WebviewPanel | undefined = undefined;
    private context: vscode.ExtensionContext;
    private user_LLM: LLM;
    private editor: Editor;
    private code: string;
    public history: OpenAI.Chat.Completions.ChatCompletionMessage[];
    private currentGenerator: AsyncIterable<any> | null = null;

    constructor(context: vscode.ExtensionContext, user_LLM: LLM, editor: Editor) {
        this.context = context;
        this.user_LLM = user_LLM;
        this.editor = editor;
        this.code = this.editor.get_all_text();
        this.history = [];
    }

	public toggle_veiw() {
        if (this.panel) {
            this.panel.dispose();
        } else {
            if (this.history.length === 0) {
                this.code = this.editor.get_all_text();
                this.history.push({
                    role: 'system',
                    content: 'You are a helpful AI assistant helping a programmer work on their code. For reference, here is their most recent, updated version of their "' + this.editor.get_document_filename() + '" code for reference (NOTE: changes may have been made since the start of the conversation, again this is the most updated version so previous messages might not agree with this code): ```\n' + this.code + '\n```'
                });
                this.history.push({ role: 'assistant', content: 'Hello! How can I assist you today?' });
            }

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

            this.render_content();
        }
    }

	private render_content(){
		// Render content
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

	private async generate_response_request(message: any) {
        if (!this.panel) {return;}

        const image_path = vscode.Uri.joinPath(this.context.extensionUri, 'images', 'icon.png');
        const imageUri = this.panel.webview.asWebviewUri(image_path);
        const css_path = vscode.Uri.joinPath(this.context.extensionUri, 'src', 'media', 'style.css');
        const css_Uri = this.panel.webview.asWebviewUri(css_path);
        const script_path = vscode.Uri.joinPath(this.context.extensionUri, 'src', 'media', 'script.js');
        const script_Uri = this.panel.webview.asWebviewUri(script_path);
		
		//If first message, make sure to use updated code
		if (this.history.length===2){
			this.history = [];
			this.history.push({
				role: 'system',
				content: 'You are a helpful AI assistant helping a programmer work on their code. For reference, here is their most recent, updated version of their "' + this.editor.get_document_filename() + '" code for reference (NOTE: changes may have been made since the start of the conversation, again this is the most updated version so previous messages might not agree with this code): ```\n' + this.code + '\n```'
			});
			this.history.push({ role: 'assistant', content: 'Hello! How can I assist you today?' });
		}

        switch (message.command) {
			case 'clear':
				this.code = this.editor.get_all_text();
				this.history = [];
                this.history.push({
                    role: 'system',
                    content: 'You are a helpful AI assistant helping a programmer work on their code. For reference, here is their most recent, updated version of their "' + this.editor.get_document_filename() + '" code for reference (NOTE: changes may have been made since the start of the conversation, again this is the most updated version so previous messages might not agree with this code): ```\n' + this.code + '\n```'
                });
                this.history.push({ role: 'assistant', content: 'Hello! How can I assist you today?' });
				this.panel.webview.html = this.getWebviewContent(imageUri, css_Uri, script_Uri);

            case 'stop':
                this.currentGenerator = null;
                this.panel.webview.postMessage({ command: 'generationComplete' });
                break;

            case 'user_msg':
                // If this is an edit, remove the last assistant message
                if (message.isEdit && this.history.length >= 2) {
                    if (this.history[this.history.length - 1].role === 'assistant') {
                        this.history.pop(); // Remove last assistant message
                    }
                    this.history[this.history.length - 1].content = message.text; // Update user message
                } else {
                    // Handle new message case...
                    const new_code = this.editor.get_all_text();
                    if (new_code !== this.code) {
                        this.code = new_code;
                        this.history[0] = {
                            role: 'system',
                            content: 'You are a helpful AI assistant helping a programmer work on their code...'
                        };
                        this.history.push({ role: 'user', content: message.text + ['\n\n**[CODE UPDATED]**'] });
                    } else {
                        this.history.push({ role: 'user', content: message.text });
                    }
                }

                // Continue with generation...
                this.panel.webview.html = this.getWebviewContent(imageUri, css_Uri, script_Uri);
				this.panel.webview.postMessage({ command: 'toggleGenerating', content:true });
                this.currentGenerator = await this.user_LLM.generate_chat_response(this.history);
                this.history.push({ role: 'assistant', content: '' });

                this.panel.webview.html = this.getWebviewContent(imageUri, css_Uri, script_Uri);
				this.panel.webview.postMessage({ command: 'toggleGenerating', content:true });

                try {
                    for await (const chunk of this.currentGenerator) {
                        if (!this.currentGenerator) {break;} // Stop if generator is nullified
                        
                        if (chunk.choices[0].delta.content) {
                            this.history[this.history.length - 1].content += chunk.choices[0].delta.content;
                        }
						
						this.panel.webview.postMessage({ command: 'doUpdateContent', content:String(marked(String(this.history[this.history.length - 1].content) + ' ⬤')) });
                        // vscode.commands.executeCommand(
                        //     'docstring-gpt.doUpdateContent',
                        //     this.panel,
                        //     String(marked(String(this.history[this.history.length - 1].content) + ' ⬤'))
                        // );
                    }
                } finally {
                    this.currentGenerator = null;
                    this.panel.webview.postMessage({ command: 'generationComplete' });
                    this.panel.webview.html = this.getWebviewContent(imageUri, css_Uri, script_Uri);
                }
                break;
        }
    }

	private getWebviewContent(image: vscode.Uri, css: vscode.Uri, script: vscode.Uri, is_generating:boolean=false) {
		// Build message bubbles to insert
		var chat_string = '';
	
		for (let i = 1; i < this.history.length; i++) {
			var name: String;
			if (this.history[i].role === 'user') {
				name = 'You';
				const chat_bubble = `
				<div class="chat-bubble" data-message-id="${i}">
					<h2>${name}</h2>
					<div class="markdown-container" contenteditable="false">${String(marked(String(this.history[i].content)))}</div>
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
					<div class="markdown-container">${String(marked(String(this.history[i].content)))}</div>
				</div>`;
				chat_string += chat_bubble;
			}
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
			<img src="${image.toString()}" width="100px" />
			
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

			<script src="${script.toString()}"></script>
		</body>
		</html>`;
	}
}