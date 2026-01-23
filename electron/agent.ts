import { ipcMain, BrowserWindow } from 'electron';
import { Groq } from 'groq-sdk';
import { Ollama } from 'ollama';

// Types (simplified for internal use, similar to App.tsx)
interface Message {
    role: 'system' | 'user' | 'assistant' | 'tool';
    content: string | any[] | null;
    tool_calls?: ToolCall[];
    tool_call_id?: string;
    name?: string;
}

interface ToolCall {
    id: string;
    type: 'function';
    function: {
        name: string;
        arguments: string;
    };
}

export class Agent {
    private messages: Message[] = [];
    private isRunning: boolean = false;
    private window: BrowserWindow | null = null;
    private actionCount: number = 0;
    private MAX_ACTIONS: number = 10;

    // Dependencies
    private groq: Groq;
    private ollama: Ollama;
    private useLocalFallback: boolean = false;
    private currentModel: string;
    private tools: any[];

    constructor(win: BrowserWindow, groqClient: Groq, ollamaClient: Ollama, tools: any[]) {
        this.window = win;
        this.groq = groqClient;
        this.ollama = ollamaClient;
        this.tools = tools;
        this.currentModel = "llama-3.3-70b-versatile"; // Default
    }

    public async start(initialMessages: Message[], isSmart: boolean = false, isPremium: boolean = false) {
        if (this.isRunning) {
            console.log("Agent already running. Stopping previous instance.");
            this.stop();
        }

        this.isRunning = true;
        this.actionCount = 0;
        this.messages = [...initialMessages];

        // Determine model based on initial context
        const hasImage = this.messages.some(m => Array.isArray(m.content));

        if (isPremium) {
            this.currentModel = "grok-beta"; // x.ai
        } else if (hasImage) {
            this.currentModel = "meta-llama/llama-4-scout-17b-16e-instruct";
        } else if (isSmart) {
            this.currentModel = "llama-3.3-70b-versatile";
        } else {
            this.currentModel = "llama-3.3-70b-versatile";
        }

        console.log(`[Agent] Starting with model: ${this.currentModel}`);
        this.emit('agent-started', { model: this.currentModel });

        // Kick off the loop
        await this.loop();
    }

    public stop() {
        this.isRunning = false;
        this.emit('agent-stopped', {});
        console.log("[Agent] Stopped.");
    }

    public async resumeWithApproval(toolCallId: string, approved: boolean) {
        if (!this.isRunning) return; // Should not happen usually

        if (approved) {
            // We need to execute the tool that was waiting
            // But wait, the loop() handles execution. 
            // We need a way to tell the loop to proceed.
            // See implementation logic below.
        }
    }

    // Main Agent Loop
    private async loop() {
        while (this.isRunning) {
            if (this.actionCount >= this.MAX_ACTIONS) {
                this.emit('agent-message', "⚠️ Maximum consecutive actions reached. Stopping.");
                this.stop();
                return;
            }

            try {
                // 1. Ask LLM
                console.log("[Agent] Thinking...");
                this.emit('agent-thinking', {});

                const response = await this.callLLM();

                if (!this.isRunning) return; // Stopped while thinking

                // 2. Handle Response
                if (response.tool_calls && response.tool_calls.length > 0) {
                    // Handle Tool Call
                    const toolCall = response.tool_calls[0];
                    await this.handleToolCall(toolCall);
                } else {
                    // Just a message
                    const content = response.content || "No response.";
                    this.messages.push({ role: 'assistant', content });
                    this.emit('agent-message', content);

                    // If no tool call, we are done with this turn
                    // UNLESS we want to keep going? Usually an agent stops when it just talks.
                    this.stop();
                    return;
                }

            } catch (error: any) {
                console.error("[Agent] Error in loop:", error);
                this.emit('agent-error', error.message);
                this.stop();
                return;
            }
        }
    }

    private async callLLM(): Promise<any> {
        // 0. Try x.ai (Premium)
        if (this.currentModel === 'grok-beta') {
            console.log(`[Agent] Calling x.ai with model: ${this.currentModel}`);
            // We need to fetch from x.ai
            // Hardcoding key here or passing it? passing it is better but for speed/simplicity in this context:
            const XAI_KEY = ""; // Removed for OSS

            try {
                const body: any = {
                    model: "grok-beta",
                    messages: this.messages,
                    stream: false,
                    temperature: 0
                };
                if (this.tools && this.tools.length > 0) {
                    body.tools = this.tools;
                }

                const response = await fetch("https://api.x.ai/v1/chat/completions", {
                    method: "POST",
                    headers: {
                        "Authorization": `Bearer ${XAI_KEY}`,
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify(body)
                });

                if (!response.ok) throw new Error(await response.text());
                const data: any = await response.json();
                return data.choices[0].message;

            } catch (e: any) {
                console.error("[Agent] x.ai Failed:", e);
                throw e;
            }
        }

        // 1. Try Groq
        try {
            console.log(`[Agent] Calling Groq with model: ${this.currentModel}`);
            const params: any = {
                messages: this.messages,
                model: this.currentModel,
            };

            if (this.tools && this.tools.length > 0) {
                params.tools = this.tools;
                params.tool_choice = "auto";
            }

            const completion = await this.groq.chat.completions.create(params);
            const message = completion.choices[0].message;

            // HALLUCINATION FIX: Check if content IS a tool call (JSON string)
            // Llama 3/4 sometimes outputs <function=name> or just JSON codes without proper tool_calls structure
            if (!message.tool_calls || message.tool_calls.length === 0) {
                const recovered = this.recoverToolCall(message.content);
                if (recovered) {
                    return { ...message, tool_calls: [recovered], content: null };
                }
            }

            return message;

        } catch (error: any) {
            console.error("[Agent] Groq Error:", error.message);
            // Check for Rate Limit (429) or other retryable errors
            if (error?.status === 429 || error?.error?.code === 'rate_limit_exceeded') {
                console.log("[Agent] Rate limit hit. Switching to Ollama fallback.");
                return await this.askOllamaFallback();
            }
            throw error;
        }
    }

    private recoverToolCall(content: string | null): any | null {
        if (!content) return null;

        // Pattern 1: <function=name>{json}</function>
        const funcMatch = content.match(/<function=([^>]+)>(.*?)<\/function>/s) || content.match(/<function=([^>]+)>(.*)/s);
        if (funcMatch) {
            let name = funcMatch[1].trim();
            const jsonContent = funcMatch[2].trim().replace(/^[:"']+/, ''); // Cleanup leading colon/quotes
            try {
                return {
                    id: "call_rec_" + Date.now(),
                    type: 'function',
                    function: {
                        name: name.replace(/["':]+$/, ''),
                        arguments: jsonContent // Keep as string for now, will be parsed later
                    }
                };
            } catch (e) { }
        }

        // Pattern 2: Embedded JSON block { "name": "...", "parameters": ... }
        // Simple heuristic search
        try {
            const start = content.indexOf('{');
            if (start > -1) {
                const jsonStr = content.substring(start);
                // Trying to parse the first JSON object found? 
                // This is risky without balancing braces, but let's try strict parse if possible or simple regex
            }
        } catch (e) { }

        return null;
    }

    private async askOllamaFallback(): Promise<any> {
        try {
            // Ensure Ollama is running
            // We can't easily spawn processes here without importing child_process, 
            // but we assume main.ts or user has it. We will try to just call it.

            const hasImage = this.messages.some(m => Array.isArray(m.content));
            const model = hasImage ? 'qwen3-vl:4b' : 'llama3.2';

            // Convert messages
            const ollamaMessages = this.messages.map(m => {
                if (Array.isArray(m.content)) {
                    // Simplify for Ollama
                    const text = m.content.find((c: any) => c.type === 'text')?.text || "";
                    const img = m.content.find((c: any) => c.type === 'image_url')?.image_url?.url || "";
                    const base64 = img.replace(/^data:image\/\w+;base64,/, "");
                    return { role: m.role, content: text, images: base64 ? [base64] : undefined };
                }
                return { role: m.role, content: typeof m.content === 'string' ? m.content : "" };
            });

            const response: any = await this.ollama.chat({
                model,
                messages: ollamaMessages,
                tools: this.tools, // Ollama supports tools now
                stream: false
            });

            return response.message;

        } catch (error: any) {
            console.error("[Agent] Ollama Fallback Failed:", error);
            throw new Error("Agente failed to execute using both Groq and Local Fallback.");
        }
    }

    private async handleToolCall(toolCall: any) {
        const functionName = toolCall.function.name;
        const functionArgs = toolCall.function.arguments;

        console.log(`[Agent] Tool Call: ${functionName}`);

        // Parse Args
        let args: any;
        try {
            args = JSON.parse(functionArgs);
        } catch (e) {
            console.error("Failed to parse tool args", e);
            // Attempt recovery or fail
            args = {};
        }

        // 3. Ask for Approval (Send IPC to UI)
        // We pause the loop here by awaiting a Promise that resolves when IPC comes back
        const approved = await this.requestApproval(functionName, args);

        if (!approved) {
            this.messages.push({
                role: 'assistant',
                content: `I wanted to run ${functionName} but it was denied.`
            }); // Simulate denial in history? 
            // Or better: Add the tool call to history, then a tool result saying "User denied"

            // Add the tool call to history so LLM knows it tried
            this.messages.push({
                role: 'assistant',
                content: null,
                // @ts-ignore
                tool_calls: [toolCall]
            });

            // Add denial result
            this.messages.push({
                role: 'tool' as any,
                tool_call_id: toolCall.id,
                content: "User denied this action."
            });

            this.emit('agent-feed-update', this.messages);
            return; // Loop continues, LLM sees denial
        }

        // 4. Execute
        this.actionCount++;
        this.emit('agent-status', `Executing ${functionName}...`);

        // Add tool call to history
        this.messages.push({
            role: 'assistant',
            content: null,
            // @ts-ignore
            tool_calls: [toolCall]
        });


        // Execute Logic (reused implementation from main.ts via IPC handlers or direct call?)
        // Since we are in Main, we can call the handlers directly if they are exported, 
        // or we can invoke the logic.
        // Ideally, we pass an 'Executor' to the Agent.

        let result = "";
        try {
            // emitted event to main to run the tool? 
            // Or better, we just use the IPC handlers which are global in main.
            // But we can't easily call ipcMain handlers from within main without a bit of hack.
            // Better: Refactor tool execution logic in main.ts to be standalone functions, then import them.
            // For now, I'll emit an event "execute-tool" and wait for result? 
            // No, that's adding async complexity within the same process.

            // I will define a callback for execution passed in constructor.
            result = await this.executeToolCallback(functionName, args);

        } catch (err: any) {
            result = `Error: ${err.message}`;
        }

        // 5. Add Result to History
        this.messages.push({
            role: 'tool' as any,
            tool_call_id: toolCall.id,
            content: result
        });

        this.emit('agent-feed-update', this.messages);

        // Loop loops back to step 1
    }

    private requestApproval(name: string, args: any): Promise<boolean> {
        return new Promise((resolve) => {
            this.emit('agent-request-approval', {
                toolName: name,
                toolArgs: args
            });

            // We need to listen for a specific one-time event from IPC
            // This is tricky. simpler:
            // We assign the resolver to a variable 
            this.pendingApprovalResolve = resolve;
        });
    }

    // Approval Resolver
    private pendingApprovalResolve: ((approved: boolean) => void) | null = null;

    public resolveApproval(approved: boolean) {
        if (this.pendingApprovalResolve) {
            this.pendingApprovalResolve(approved);
            this.pendingApprovalResolve = null;
        }
    }

    // External Execution Handler (set by main.ts)
    public executeToolCallback: (name: string, args: any) => Promise<string> = async () => "No executor defined";

    private emit(channel: string, data: any) {
        if (this.window && !this.window.isDestroyed()) {
            this.window.webContents.send(channel, data);
        }
    }
}
