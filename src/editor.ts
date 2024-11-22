import * as vscode from 'vscode';

export class Editor {
	private editor:vscode.TextEditor|undefined;
    private notebook_editor:vscode.NotebookEditor|undefined;
	indent:string;

	constructor(editor:vscode.TextEditor|undefined, notebook_editor:vscode.NotebookEditor|undefined) {
		this.editor = editor;
        this.notebook_editor = notebook_editor;

		// Set correct tab
		this.indent = this.editor ? this.calculateIndent() : '';

	}

    // Update active document editor
    public update_editor(editor:vscode.TextEditor|undefined, notebook_editor:vscode.NotebookEditor|undefined){
        this.editor = editor;
        this.notebook_editor = notebook_editor;
    }

    private calculateIndent(): string {
        if (!this.editor) { return ''; }

        const { insertSpaces, tabSize } = this.editor.options;
        if (typeof insertSpaces === 'boolean') {
            if (insertSpaces && typeof tabSize === 'number') {
                return ' '.repeat(tabSize);
            } else if (!insertSpaces) {
                return '\t';
            }
        }
        return '';
    }

    public get_document_filename():string {
        var fileName:string;
        if (this.notebook_editor){
            fileName = this.notebook_editor.notebook.uri.fsPath;
        }
        else if (this.editor){
            fileName = this.editor.document.fileName;
        }
        else{
            fileName = '[ERROR: NO FILE OPEN]';
            console.log('[EDITOR ERROR: NO FILE OPEN]');
        }
        return fileName;
    }

    public get_all_text():string {
        var text:string;
        if (this.notebook_editor){
            text = '';
            const notebook_type = this.notebook_editor.notebook.notebookType;
            const cells = this.notebook_editor.notebook.getCells();
            for (var i=0; i<cells.length; i++){
                var cell_type = cells[i].kind.toString();
                if (notebook_type==='jupyter-notebook' && cell_type==='1'){
                    cell_type = 'markdown';
                }
                else if (notebook_type==='jupyter-notebook' && cell_type==='2'){
                    cell_type = 'python';
                }
                const cell_content = cells[i].document.getText();

                text+=`[CELL #${i}, CELL TYPE: ${cell_type}]\n\n\`\`\`\n${cell_content}\n\`\`\`\n\n\n`;
            }
        }
        else if (this.editor){
            text = this.editor.document.getText();
        }
        else { text = ''; 
            console.log('[EDITOR ERROR: NO TEXT READ]');
        }
        return text;
    }

	public get_selection_text():string {
		// Get the word within the selection
		return this.editor ? this.editor.document.getText(this.editor.selection) : '';
	}

	public async insert_docstring(generator:AsyncIterable<any>) {
        if (this.editor)
        {
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
                
                // Create replacement string
                const temp_docstring = docstring.replaceAll('"""', '').replaceAll('\n','\n'+this.indent.repeat(num_indent)); // Get rid of generated comment tags & fix tabs
                const new_text = text_arr[0] + '\n' + this.indent.repeat(num_indent) + '"""' + temp_docstring + '"""\n\n' + text_arr.slice(1, text_arr.length).join('\n');
                
                // Replace current text with updated text
                this.editor.edit(editBuilder => {
                    editBuilder.replace(selection_range, new_text);
                });

                text = new_text;
            }
        }
	}
}