import * as vscode from 'vscode';
import { LLM } from './LLM';
import { Editor } from './editor';
import { ChatWebView } from './ChatWebView';

// This method is called when the extension is activated
export function activate(context: vscode.ExtensionContext) {
	// vscode.window.showInformationMessage('Docstring-GPT Now Active!');
	console.log('activate');

	// Create main objectss
	const user_LLM = new LLM();
	const editor = new Editor(vscode.window.activeTextEditor, vscode.window.activeNotebookEditor, context);
	const chat_webview = new ChatWebView(context, user_LLM, editor);


	// -------------------- \/ Helper Functions \/ --------------------
	// Listen for notebook editor changes, if vscode editor changes, update editor object
	vscode.window.onDidChangeActiveNotebookEditor(()=>{
		const new_notebook_editor = vscode.window.activeNotebookEditor;
		if (new_notebook_editor) { 
			editor.update_editor(undefined, new_notebook_editor);
			chat_webview.update_view();
		}
	});

	// Listen for editor changes, if vscode editor changes, update the editor object
    vscode.window.onDidChangeActiveTextEditor(() => {
		const new_editor = vscode.window.activeTextEditor;
		if (new_editor) { 
			editor.update_editor(vscode.window.activeTextEditor, undefined);
			chat_webview.update_view();
		}
    });

	// Listener for configuration changes
    vscode.workspace.onDidChangeConfiguration(event => {
        if (event.affectsConfiguration('Docstring-GPT')) {  user_LLM.update_settings();  }
    });
	// -------------------- /\ Helper Functions /\ --------------------

	
	// Docstring generation function
	const docString = vscode.commands.registerCommand('docstring-gpt.generateDocstring', async () => {
		vscode.window.showInformationMessage('Generating Docstring...');
		const function_def = editor.get_selection_text();
		const generator = await user_LLM.generate_docstring(function_def, editor.get_languageID());
		
		editor.insert_docstring(generator);
	});

	// Chat Interface function
	const ollamaChat = vscode.commands.registerCommand('docstring-gpt.ollamaChat', () => {
		chat_webview.toggle_veiw();
	});

	// Push functions to user
	context.subscriptions.push(docString);
	context.subscriptions.push(ollamaChat);
}

// This method is called when the extension is deactivated
export function deactivate() {}