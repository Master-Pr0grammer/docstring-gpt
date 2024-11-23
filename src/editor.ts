import * as vscode from 'vscode';
import * as fs from 'fs';

export class Editor {
	private editor:vscode.TextEditor|undefined;
    private notebook_editor:vscode.NotebookEditor|undefined;

	private indent:string;
    private language_comments:any;

	constructor(editor:vscode.TextEditor|undefined, notebook_editor:vscode.NotebookEditor|undefined, context: vscode.ExtensionContext) {
		this.editor = editor;
        this.notebook_editor = notebook_editor;

		// Set correct tab
		this.indent = this.editor ? this.calculateIndent() : '';


        const filePath = vscode.Uri.joinPath(context.extensionUri, 'src', 'languages.json');
        const languagesJsonData = fs.readFileSync(filePath.fsPath, 'utf8');
        this.language_comments = JSON.parse(languagesJsonData);

	}

    public get_languageID():string {
        if (this.editor){
            return this.editor.document.languageId;
        }
        else{
            return 'NONE';
        }
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

	public async insert_docstring(generator:AsyncIterable<any>):Promise<void> {
        if (this.editor)
        {
            const document = this.editor.document;
            var original_selection = this.editor.selection;
            var text = document.getText(original_selection);

            const origional_text_arr = text.split('\n');
            const num_indent = this.get_num_indent(text);

            var docstring = "";

            if (!(this.editor.document.languageId in this.language_comments)){
                console.log('Language Unsupported for Docstring Generation!');
                vscode.window.showInformationMessage('Language Unsupported for Docstring Generation!');
                return;
            }

            for await (const chunk of generator) {
                docstring += chunk.choices[0].delta.content;  // Append chunk to docstring

                // Calculate the new range (we assume the docstring is inserted at the start of the selection)
                const lines =  text.split('\n');
                
                const newEndPosition = new vscode.Position(original_selection.start.line + lines.length - 1, lines.slice(-1)[0].length); // = move end position to include newly generated content
                const selection_range = new vscode.Range(original_selection.start, newEndPosition);
                
                // Create replacement string
                const formated_docstring = this.enforce_format_docstring(docstring, this.editor.document.languageId); // Format docstring
                const indented_formated_docstring = formated_docstring.replaceAll('\n', '\n' + this.indent.repeat(num_indent)); // Indent docstring
                const new_text = origional_text_arr[0] + '\n' + this.indent.repeat(num_indent) + indented_formated_docstring + '\n\n' + origional_text_arr.slice(1, origional_text_arr.length).join('\n');
                
                // Replace current text with updated text
                this.editor.edit(editBuilder => {
                    editBuilder.replace(selection_range, new_text);
                });

                text = new_text;
            }
        }
	}

    private get_num_indent(text:string):number {
        const text_arr = text.split('\n');

        var count = 0;
        for (var i = 1; i<text_arr.length; i++){
            count = text_arr[i].split(this.indent).length-1;
            if (count!==0){ break; }
        }

        return count;
    }

    private enforce_format_docstring(docstring:string, languageId:string):string {
        var text = '';

        // Remove first comment tag, and extra text before docstring
        var sliced = docstring.split(this.language_comments[languageId]['comment_start']);
        if (sliced.length===1){ text = sliced[0]; }
        else{ text = sliced.splice(1).join(''); }

        // Remove second coment tag, and extra text following docstring
        var sliced = text.split(this.language_comments[languageId]['comment_end']);
        if (sliced.length===1){ text = sliced[0]; }
        else { text = sliced[0]; }

        //Remove any markdown text container
        text = text.replace("```", '');

        // Remove trailing newlines
        text = text.trim();

        // Wrap any line over 80 characters
        const wrapLine = (line: string, maxLength: number): string => {
            const indent = line.match(/^\s*/)?.[0] || ''; // Preserve leading whitespace
            let wrapped = '';
            while (line.length > maxLength) {
                let breakIndex = line.lastIndexOf(' ', maxLength);
                if (breakIndex === -1) {breakIndex = maxLength;} // If no spaces found, force split
                wrapped += indent + line.slice(0, breakIndex).trim() + '\n';
                line = indent + line.slice(breakIndex).trim();
            }
            return wrapped + line; // Add the remaining part
        };

        text = text
            .split('\n') // Split into individual lines
            .map(line => wrapLine(line, 80)) // Apply wrapping to each line
            .join('\n'); // Join the wrapped lines back


        // Append comment tags to docstring
        text = this.language_comments[languageId]['comment_start'] + '\n' + text + '\n' + this.language_comments[languageId]['comment_end'];

        return text;
    }
}