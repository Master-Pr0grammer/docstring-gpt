import * as vscode from 'vscode';

export class Editor {
	editor:vscode.TextEditor|undefined;
	indent:string;

	constructor(editor:vscode.TextEditor|undefined) {
		this.editor = editor;

		// Set correct tab
		this.indent = this.editor ? this.calculateIndent() : '';

	}

    // Update active document editor
    public update_editor(editor:vscode.TextEditor|undefined){
        this.editor = editor;
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
        return this.editor ? this.editor.document.fileName : 'ERROR: No File Open';
    }

    public get_all_text():string {
        return this.editor ? this.editor.document.getText(): '';
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