import * as vscode from 'vscode';
import OpenAI from "openai";
import { Ollama } from 'ollama';

//Define class for LLM
export class LLM {
	endpoint:string;
	apikey:string;
	model:string;
	temperature:number;
	ctx_length:number;
	
	use_ollama_api:boolean;

	system_prompt:string;
	format_specs:string;

	begin_think_tag:string;
	end_think_tag:string;

	client:OpenAI;

	constructor() {
		const config = vscode.workspace.getConfiguration('Docstring-GPT');
		this.endpoint = String(config.get('llm.endpoint'));
		this.apikey = String(config.get('llm.apikey'));
		this.model = String(config.get('llm.model'));
		this.temperature = Number(config.get('advanced.temperature'));
		this.ctx_length = Number(config.get('llm.contentLength'));

		this.use_ollama_api = Boolean(config.get('llm.useOllamaApi'));

		this.system_prompt = String(config.get('docstring.systemPrompt'));
		this.format_specs = String(config.get("docstring.documentationSpecification"));

		this.begin_think_tag = String(config.get("advanced.beginThinkTag"));
		this.end_think_tag = String(config.get("advanced.endThinkTag"));

		this.client = new OpenAI({apiKey:this.apikey, baseURL:this.endpoint});
	}

	// Generate a docstring, returns generator returns response generator
	public async generate_docstring(function_definition: string, language:string): Promise<AsyncIterable<any>>{
		const input = `Language: ${language}\n\nFunction to document:\n\`\`\`\n${function_definition}\n\`\`\`\n\n${this.format_specs}`;
		let generator:AsyncIterable<any>;

		// OpenAI response
		if (!this.use_ollama_api){
			generator = await this.client.chat.completions.create({
				model: this.model,
				messages: [
					{"role": "system", "content": this.system_prompt},
					{"role":"user", "content":input}
				],
				stream:true,
				temperature:this.temperature,

			});
		}

		// Ollama response
		else{
			const client = new Ollama({ host: this.endpoint });
			generator = await client.chat({
				model: this.model,
				messages: [
					{"role": "system", "content": this.system_prompt},
					{"role":"user", "content":input}
				],
				stream:true,
				options:{
					'num_ctx':this.ctx_length,
					'temperature':this.temperature,
				}
			});
		}
		return generator;
	}

	// Generate chat response, returns response generator
	public async generate_chat_response(chat_history:OpenAI.Chat.Completions.ChatCompletionMessage[]): Promise<AsyncIterable<any>>{
		let generator:AsyncIterable<any>;

		// OpenAI response
		if (!this.use_ollama_api){
			generator = await this.client.chat.completions.create({
				model: this.model,
				messages: chat_history,
				stream:true,
				temperature:this.temperature
			});
		}

		// Ollama response
		else{
			const client = new Ollama({ host: this.endpoint });
			generator = await client.chat({
				model: this.model,
				messages: chat_history as any, // TODO: improve this.
				stream:true,
				options:{
					'num_ctx':this.ctx_length,
					'temperature':this.temperature,
				}
			});
		}

		return generator;
	}

	// Filter for thinking models
	public filter(response:string): [string, string]{
		let user_repsonse:string = '';
		let thinking_response:string = '';

		// No filter if tags are null
		if (this.begin_think_tag === "null" || this.end_think_tag === "null"){ return ['', response]; }

		const user_repsonse_begin = response.indexOf(this.end_think_tag);
		if (user_repsonse_begin !== -1){
			user_repsonse = response.slice(user_repsonse_begin + this.end_think_tag.length, response.length);
			thinking_response = response.slice(this.begin_think_tag.length, user_repsonse_begin);
		}
		else{
			thinking_response = response.slice(this.begin_think_tag.length,response.length);
		}
	
		return [thinking_response, user_repsonse];
	}
}