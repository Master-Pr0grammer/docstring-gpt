import * as vscode from 'vscode';
import OpenAI from "openai";

//Define class for LLM
export class LLM {
	endpoint:string;
	apikey:string;
	model:string;
	temperature:number;

	system_prompt:string;
	format_specs:string;

	client:OpenAI;

	constructor() {
		const config = vscode.workspace.getConfiguration('Docstring-GPT');
		this.endpoint = String(config.get('llm.endpoint'));
		this.apikey = String(config.get('llm.apikey'));
		this.model = String(config.get('llm.model'));
		this.temperature = Number(config.get('advanced.temperature'));

		this.system_prompt = String(config.get('systemPrompt'));
		this.format_specs = String(config.get("documentationSpecification"));

		this.client = new OpenAI({apiKey:this.apikey, baseURL:this.endpoint});
	}

	// Update settings
	public update_settings(){
		const config = vscode.workspace.getConfiguration('Docstring-GPT');
		this.endpoint = String(config.get('llm.endpoint'));
		this.apikey = String(config.get('llm.apikey'));
		this.model = String(config.get('llm.model'));
		this.temperature = Number(config.get('advanced.temperature'));

		this.system_prompt = String(config.get('systemPrompt'));
		this.format_specs = String(config.get("documentationSpecification"));

		this.client = new OpenAI({apiKey:this.apikey, baseURL:this.endpoint});
	}

	// Generate a docstring
	public async generate_docstring(function_definition: string, language:string): Promise<AsyncIterable<any>>{
		const input = `Language: ${language}\n\nFunction to document:\n\`\`\`\n${function_definition}\n\`\`\`\n\n${this.format_specs}`;

		const generator = await this.client.chat.completions.create({
			model: this.model,
			messages: [
				{"role": "system", "content": this.system_prompt},
				{"role":"user", "content":input}
			],
			stream:true,
			temperature:this.temperature
		});
		return generator;
	}

	// Generate chat response
	public async generate_chat_response(chat_history:OpenAI.Chat.Completions.ChatCompletionMessage[]): Promise<AsyncIterable<any>>{
		const generator = await this.client.chat.completions.create({
			model: this.model,
			messages: chat_history,
			stream:true,
			temperature:this.temperature
		});

		return generator;
	}
}