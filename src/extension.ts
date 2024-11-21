// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { LLM } from './LLM';
import { Editor } from './editor';
import { ChatWebView } from './ChatWebView';

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
	// vscode.window.showInformationMessage('Docstring-GPT Now Active!');
	console.log('activate');

	// Send a message to the webview to update the content
	let update = vscode.commands.registerCommand('docstring-gpt.doUpdateContent', (panel: vscode.WebviewPanel, chunkContent: string) => {
		if (!panel) { return; }
		panel.webview.postMessage({ command: 'doUpdateContent', content: chunkContent });
	});

	const user_LLM = new LLM();
	const editor = new Editor(vscode.window.activeTextEditor);
	const chat_webview = new ChatWebView(context, user_LLM, editor);


	// Listen for editor changes
    vscode.window.onDidChangeActiveTextEditor(() => {
		const new_editor = vscode.window.activeTextEditor;
		if (new_editor) { editor.update_editor(vscode.window.activeTextEditor); }
    });

	// Listener for configuration changes
    vscode.workspace.onDidChangeConfiguration(event => {
        if (event.affectsConfiguration('Docstring-GPT')) {  user_LLM.update_settings();  }
    });

	
	// Docstring generation command definition
	const docString = vscode.commands.registerCommand('docstring-gpt.generateDocstring', async () => {
		if (vscode.window.activeTextEditor){
			const editor = new Editor(vscode.window.activeTextEditor);

			const function_def = editor.get_selection_text();
			const generator = await user_LLM.generate_docstring(function_def);
			
			editor.insert_docstring(generator);
		}
	});

	// var history:OpenAI.Chat.Completions.ChatCompletionMessage[] = [];
	const ollamaChat = vscode.commands.registerCommand('docstring-gpt.ollamaChat', () => {
		chat_webview.toggle_veiw();
	});

	context.subscriptions.push(docString);
	context.subscriptions.push(ollamaChat);
}

// This method is called when your extension is deactivated
export function deactivate() {}