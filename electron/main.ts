import fs from 'node:fs'
import os from 'node:os'
import { app, BrowserWindow, ipcMain, globalShortcut, screen, desktopCapturer } from 'electron'
import { exec } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import 'dotenv/config'
import Groq from 'groq-sdk'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
import { BrowserManager } from './browser.js'

const browserManager = new BrowserManager();


import { ComputerAction } from './computer.js';

// ... (existing code)

// Computer Action Handler
ipcMain.handle('trigger-computer-action', async (_, args: any) => {
    console.log(`Executing Computer Action: ${args.action}`);
    try {
        let result;
        const [x, y] = args.coordinate || [0, 0];

        switch (args.action) {
            case 'mouse_move':
                await ComputerAction.mouseMove(x, y);
                result = `Moved mouse to ${x}, ${y}`;
                break;
            case 'left_click':
                await ComputerAction.leftClick(x, y);
                result = `Left clicked at ${x}, ${y}`;
                break;
            case 'right_click':
                await ComputerAction.rightClick(x, y);
                result = `Right clicked at ${x}, ${y}`;
                break;
            case 'double_click':
                await ComputerAction.doubleClick(x, y);
                result = `Double clicked at ${x}, ${y}`;
                break;
            case 'drag':
                // Expect coordinate to contain [startX, startY, endX, endY] ?? 
                // Actually schema says [x,y]. Drag needs 2 points.
                // Let's assume start is current pos? Or parse text?
                // For now, let's just say drag requires coordinate=[endX, endY] and assumes current start?
                // OR we extend schema.
                // Let's implement simpler: [startX, startY] -> [endX, endY]
                // But model usually sends one coord.
                // Let's assume coordinate is DESTINATION, and start is implicit current.
                const current = await ComputerAction.getCursorPosition();
                await ComputerAction.drag(current.x, current.y, x, y);
                result = `Dragged from ${current.x},${current.y} to ${x},${y}`;
                break;
            case 'scroll':
                const amount = parseInt(args.text || "-5");
                await ComputerAction.scroll(x, y, amount); // Scroll at current location or specified?
                result = `Scrolled by ${amount}`;
                break;
            case 'get_cursor_position':
                const pos = await ComputerAction.getCursorPosition();
                result = JSON.stringify(pos);
                break;
            case 'get_screen_size':
                const size = await ComputerAction.getScreenSize();
                result = JSON.stringify(size);
                break;
            default:
                result = "Unknown computer action";
        }
        return result;
    } catch (error: any) {
        console.error("Computer Action Error:", error);
        return `Error: ${error.message}`;
    }
});
let currentApiKey = process.env.GROQ_API_KEY || '';
if (currentApiKey && !currentApiKey.startsWith('gsk_')) {
    console.error("Warning: GROQ_API_KEY environment variable does not start with 'gsk_'. Ignoring it.");
    currentApiKey = '';
}

let groq = new Groq({
    apiKey: currentApiKey || 'gsk_placeholder',
    dangerouslyAllowBrowser: false
});

// Helper to update Groq client
function updateGroqClient(newKey: string) {
    if (!newKey || !newKey.startsWith('gsk_')) {
        console.error("Invalid API Key received. Must start with 'gsk_'. Aborting update.");
        return;
    }
    currentApiKey = newKey;
    groq = new Groq({
        apiKey: currentApiKey,
        dangerouslyAllowBrowser: false
    });
    console.log("Groq Client updated with new key.");
}

const JULIE_SYSTEM_PROMPT = `
You are Julie, a helpful and precise AI assistant.

CORE RULES:
1.  **Answer Directly**: Do not analyze the user's intent out loud. Do not say "The user wants...". Just give the answer.
2.  **Be Concise**: Keep answers short and to the point. Use bullet points.
3.  **Context Aware**: You have access to the conversation history. Use it to answer follow-up questions (e.g., "times 5" refers to the previous result).
4.  **No Meta-Talk**: Never explain your reasoning process unless explicitly asked. Never output "Expression Analysis" or similar headers.

AGENTIC CAPABILITIES:
You have access to a terminal on the user's machine. When the user asks you to perform a task that requires file manipulation, system information, or executing commands, use the 'execute_terminal_command' tool.
-   **DIRECT EXECUTION**: The command you provide becomes the argument to a 'exec' call.
-   **GUI APPS**: If launching a GUI app (e.g., vscode, notepad), use 'Start-Process name' or 'start name' so it does not block the terminal.
-   **DO NOT** try to open a new terminal window for simple tasks. **NEVER** use 'start powershell' just to run a command.
-   **ALWAYS** provide the actual command to run (e.g., 'Get-ChildItem', 'npm install', 'code .').
-   **ONE SHOT**: **NEVER** run the same command twice. If you see the output in the history, the task is DONE. Do not ask to run it again.
-   **Output**: If you use a tool, your response will be processed by the system.

BROWSER CAPABILITIES:
You can control a web browser to perform tasks. Use the 'browser_action' tool.
-   **Navigation**: 'navigate' to a URL.
-   **Interaction**: 'click' elements, 'type' text, 'scroll'.
-   **Reading**: 'read_page' to get the current page content and interactive elements.
-   **General**: Always 'read_page' after navigation to understand where you are.

KEYBOARD CAPABILITIES:
You can directly type text into the user's active window using the 'keyboard_action' tool.
-   **Use Case**: When the user explicitly asks you to "write" or "type" the solution/text into their current view (e.g., "write this code", "type the answer").
-   **Action**: Use 'type' to type long text. Use 'press_key' for special keys (not fully supported yet, stick to typing).
-   **Important**: This tool types BLINDLY into whatever window was active before they interacted with you. Ensure you have the text ready.
`

const TERMINAL_TOOL_DEF: any = {
    type: "function",
    function: {
        name: "execute_terminal_command",
        description: "Execute a terminal command on the user's machine via PowerShell. Do NOT launch interactive shells (no 'start', 'code .', etc). Just run the utility directly.",
        parameters: {
            type: "object",
            properties: {
                command: {
                    type: "string",
                    description: "The PowerShell command to execute (e.g., 'Get-Process', 'npm install package', 'cat file.txt')."
                }
            },
            required: ["command"]
        }
    }
};

const BROWSER_TOOL_DEF: any = {
    type: "function",
    function: {
        name: "browser_action",
        description: "Control a web browser to navigate, click, type, or read page content.",
        parameters: {
            type: "object",
            properties: {
                action: {
                    type: "string",
                    enum: ["launch", "navigate", "click", "type", "scroll", "read_page", "get_url", "execute_script"],
                    description: "The action to perform."
                },
                url: { type: "string", description: "URL for 'navigate' action." },
                selector: { type: "string", description: "CSS selector for 'click' or 'type' action." },
                text: { type: "string", description: "Text to type for 'type' action." },
                direction: { type: "string", enum: ["up", "down"], description: "Direction for 'scroll' action." },
                script: { type: "string", description: "JavaScript code for 'execute_script' action." }
            },
            required: ["action"]
        }
    }
};

const KEYBOARD_TOOL_DEF: any = {
    type: "function",
    function: {
        name: "keyboard_action",
        description: "Type text into the ACTIVE window. Use this when the user wants you to 'write' code or text into their current editor or browser. WARNING: This types into the currently focused window, so the user must have their cursor ready.",
        parameters: {
            type: "object",
            properties: {
                text: { type: "string", description: "The text to type." },
                action: {
                    type: "string",
                    enum: ["type"],
                    description: "The action to perform."
                }
            },
            required: ["text"]
        }
    }
};

ipcMain.handle('set-api-key', (_, key: string) => {
    console.log("Received request to update API Key via IPC.");
    updateGroqClient(key);
    return true;
});

ipcMain.handle('transcribe-audio', async (_, arrayBuffer: ArrayBuffer) => {
    try {
        if (!currentApiKey) return "Error: No API Key Configured";

        const buffer = Buffer.from(arrayBuffer);
        const tempFilePath = path.join(os.tmpdir(), `audio_${Date.now()}.wav`);
        fs.writeFileSync(tempFilePath, buffer);

        const transcription = await groq.audio.transcriptions.create({
            file: fs.createReadStream(tempFilePath),
            model: "whisper-large-v3-turbo",
            response_format: "json",
            language: "en",
            temperature: 0.0,
        });

        fs.unlinkSync(tempFilePath); // Cleanup
        return transcription.text;
    } catch (error: any) {
        console.error("Transcription Error:", error);
        return ""; // Return empty string on error to avoid breaking loop
    }
});

// Capture Screen Handler
ipcMain.handle('capture-screen', async () => {
    if (!win) return null;

    // Hide window to capture clean screenshot
    win.hide();

    try {
        const sources = await desktopCapturer.getSources({
            types: ['screen'],
            thumbnailSize: { width: 1920, height: 1080 }
        });

        // Get primary display source
        const primarySource = sources[0]; // Usually the first one is the main screen
        const image = primarySource.thumbnail.toDataURL();

        win.show(); // Restore window
        return image;
    } catch (error) {
        console.error("Screen Capture Error:", error);
        win.show(); // Ensure window comes back even on error
        return null;
    }
});

ipcMain.handle('close-window', () => {
    if (win) {
        win.close();
    }
});

// Execute Command Handler
ipcMain.handle('run-command', async (_, command: string) => {
    console.log(`Executing Agentic Command: ${command}`);
    return new Promise((resolve) => {
        let finalCommand = command;
        let execOptions: any = { cwd: os.homedir() };

        // Platform specific shell wrapping
        if (process.platform === 'win32') {
            // Force PowerShell on Windows
            finalCommand = `powershell.exe -NoProfile -NonInteractive -Command "${command.replace(/"/g, '\\"')}"`;
        } else {
            // Use zsh/bash on macOS/Linux
            // We generally just exec() but setting shell to /bin/zsh is safer
            execOptions.shell = '/bin/zsh';
        }

        exec(finalCommand, execOptions, (error, stdout, stderr) => {
            if (error) {
                console.error(`Exec Error: ${error.message}`);
                resolve(`Error: ${error.message}\nStderr: ${stderr}`);
                return;
            }
            const output = stdout.trim() || stderr.trim() || "Success (no output).";
            resolve(output);
        });
    });
});

async function askGroqWithFallback(messages: any[], model: string = "llama-3.3-70b-versatile", retries = 1, tools: any[] | null = null): Promise<any> {
    try {
        const params: any = {
            messages,
            model,
        };

        if (tools && tools.length > 0) {
            params.tools = tools;
            params.tool_choice = "auto";
        }

        const completion = await groq.chat.completions.create(params);

        const choice = completion.choices[0];
        const message = choice?.message;

        // Check for tool calls first
        if (message?.tool_calls && message.tool_calls.length > 0) {
            const toolCall = message.tool_calls[0];
            return {
                type: 'tool_call',
                id: toolCall.id,
                function: {
                    name: toolCall.function.name,
                    arguments: toolCall.function.arguments
                }
            };
        }

        // HALLUCINATION FIX: Check if content IS a tool call (JSON string)
        if (message?.content) {
            const content = message.content;

            // PATTERN 1: <function=name>{json}</function>  (New Llama 4 behavior?)
            // Regex to capture name and the JSON content inside
            // Handling variations like <function=name":{...}> or <function=name>

            // Try to match the opening tag somewhat loosely
            const funcMatch = content.match(/<function=([^>]+)>(.*?)<\/function>/s) || content.match(/<function=([^>]+)>(.*)/s);

            if (funcMatch) {
                let toolName = funcMatch[1].trim();
                let jsonContent = funcMatch[2].trim();

                // CLEANUP 1: Remove trailing quote/colon from name if present
                // e.g. "browser_action":" -> "browser_action"
                toolName = toolName.replace(/["':]+$/, '');

                // CLEANUP 2: Remove leading colon/quote from JSON if present
                // e.g. ":{"action"..." -> "{"action"..."
                // e.g. "{"action"..." -> "{"action"..."
                jsonContent = jsonContent.replace(/^[:"']+/, '');

                try {
                    // Try parsing
                    const json = JSON.parse(jsonContent);
                    console.log(`Recovered <function> style tool call: ${toolName}`);
                    return {
                        type: 'tool_call',
                        id: `call_xml_${Date.now()}`,
                        function: {
                            name: toolName,
                            arguments: JSON.stringify(json)
                        }
                    };
                } catch (e) {
                    console.log("Failed to parse <function> JSON:", e);
                }
            }

            // PATTERN 2: Text containing a JSON block { "name": ... }
            const startSearchIndex = content.indexOf('{');

            if (startSearchIndex !== -1) {
                // Heuristic: Count braces to find the end of the JSON object
                let braceCount = 0;
                let startIndex = startSearchIndex;
                let endIndex = -1;

                for (let i = startIndex; i < content.length; i++) {
                    if (content[i] === '{') {
                        braceCount++;
                    } else if (content[i] === '}') {
                        braceCount--;
                        if (braceCount === 0) {
                            endIndex = i + 1;
                            break;
                        }
                    }
                }

                if (endIndex !== -1) {
                    const jsonString = content.substring(startIndex, endIndex);
                    try {
                        const json = JSON.parse(jsonString);

                        if (json.name && json.parameters) {
                            console.log("Recovered standard JSON tool call:", json.name);
                            return {
                                type: 'tool_call',
                                id: `call_json_${Date.now()}`,
                                function: {
                                    name: json.name,
                                    arguments: typeof json.parameters === 'string' ? json.parameters : JSON.stringify(json.parameters)
                                }
                            };
                        }
                    } catch (e) {
                        // ignore
                    }
                }
            }
        }

        return {
            type: 'content',
            content: message?.content || "No response."
        };

    } catch (error: any) {
        console.error(`Groq Error (${model}):`, error);

        // Check for Rate Limit (429)
        if (error?.status === 429 && retries > 0) {
            console.log("Rate limit hit. Switching to fallback model: llama-3.1-8b-instant");
            return askGroqWithFallback(messages, "llama-3.1-8b-instant", retries - 1, tools);
        }

        // RECOVERY: Handle 'tool_use_failed' where API rejects valid Llama 3 output
        // Error format often includes: error: { failed_generation: "<function=name {...}>" }
        // Deeply nested: error.error.error.failed_generation (sometimes)
        const failedGen = error?.error?.failed_generation || error?.failed_generation || error?.error?.error?.failed_generation;

        if (failedGen && typeof failedGen === 'string') {
            console.log("Attempting to parse failed generation:", failedGen);

            // Robust Regex for various Llama 3 failure modes
            // Case 1: Standard <function=name>(args) (handled by Groq usually, but sometimes leaks)
            // Case 2: Malformed <function=name args</function> (seen in logs, missing closing >)
            // Case 3: <function=name>{args}</function>
            // Case 4: <function=name={args}></function> (The bug we saw)

            // We just look for <function=NAME ...ARGS... </function> or >
            const matchRobust = failedGen.match(/<function=(\w+)\s*(.*?)(?:>|<\/function>)/s);

            if (matchRobust) {
                const name = matchRobust[1];
                let args = matchRobust[2];
                // Cleanup args if they have trailing </function
                if (args.endsWith('</function')) {
                    args = args.replace('</function', '');
                }

                // Cleanup: sometimes args starts with '=' if model hallucinated format (e.g. <function=name={...}>)
                args = args.trim();
                while (args.startsWith('=')) {
                    args = args.substring(1).trim();
                }

                console.log(`Recovered tool call: ${name} with args ${args}`);
                return {
                    type: 'tool_call',
                    id: `call_recovered_${Date.now()}`,
                    function: {
                        name: name,
                        arguments: args
                    }
                };
            }
        }

        // Return structured error
        return {
            type: 'content',
            content: `Error: ${error.message}`
        };

    }
}

ipcMain.handle('ask-groq', async (_, args: any) => {
    if (!currentApiKey) {
        return { type: 'content', content: "Error: API Key not configured. Please add one in Settings." };
    }

    // Handle both old (array only) and new ({messages, isSmart, isAgentic}) signatures
    let messages: any[];
    let isSmart = false;
    let isAgentic = false;

    if (Array.isArray(args)) {
        messages = args;
    } else {
        messages = args.messages;
        isSmart = !!args.isSmart;
        isAgentic = !!args.isAgentic;
    }

    // Determine if we need Vision model
    // Check if ANY message in the history contains an image (array content)
    const hasImage = messages.some(m => Array.isArray(m.content));

    let model = "llama-3.3-70b-versatile"; // Default

    if (hasImage) {
        // Use Vision model for the entire session if context involves images
        // llama-3.2 vision models are decommissioned.
        // Using Llama 4 Scout (current supported preview).
        model = "meta-llama/llama-4-scout-17b-16e-instruct";
    } else if (isSmart) {
        model = "llama-3.3-70b-versatile"; // Fallback to best available Llama model
        console.log("Using Smart Model: llama-3.3-70b-versatile");
    }

    const fullMessages = [
        { role: "system", content: JULIE_SYSTEM_PROMPT },
        ...(Array.isArray(messages) ? messages : [{ role: "user", content: String(messages) }])
    ];

    const COMPUTER_TOOL_DEF: any = {
        type: "function",
        function: {
            name: "computer_action",
            description: "Control the mouse and screen. Use this to click, drag, scroll, or get coordinates.",
            parameters: {
                type: "object",
                properties: {
                    action: {
                        type: "string",
                        enum: ["mouse_move", "left_click", "right_click", "double_click", "drag", "scroll", "get_cursor_position", "get_screen_size"],
                        description: "The action to perform."
                    },
                    coordinate: {
                        type: "array",
                        items: { type: "integer" },
                        description: "[x, y] coordinates for the action. Required for move/click/drag."
                    },
                    text: {
                        type: "string",
                        description: "Additional info (e.g. scroll amount)"
                    }
                },
                required: ["action"]
            }
        }
    };

    const tools = isAgentic ? [TERMINAL_TOOL_DEF, BROWSER_TOOL_DEF, KEYBOARD_TOOL_DEF, COMPUTER_TOOL_DEF] : null;


    return await askGroqWithFallback(fullMessages, model, 1, tools);
})

// Browser Action Handler
ipcMain.handle('trigger-browser-action', async (_, args: any) => {
    console.log(`Executing Browser Action: ${args.action}`);
    try {
        switch (args.action) {
            case 'launch':
                await browserManager.launch();
                if (args.url) {
                    return await browserManager.navigate(args.url);
                }
                return "Browser launched.";
            case 'navigate':
                return await browserManager.navigate(args.url);
            case 'click':
                return await browserManager.click(args.selector);
            case 'type':
                return await browserManager.type(args.selector, args.text);
            case 'scroll':
                return await browserManager.scroll(args.direction);
            case 'read_page':
                return await browserManager.readPage();
            case 'get_url':
                return await browserManager.getUrl();
            case 'execute_script':
                return await browserManager.executeScript(args.script);
            default:
                return "Error: Unknown browser action.";
        }
    } catch (error: any) {
        console.error("Browser Action Error:", error);
        return `Error executing browser action: ${error.message}`;
    }
});

// Get Running Apps Handler
ipcMain.handle('get-running-apps', async () => {
    return new Promise((resolve) => {
        const script = `
            tell application "System Events"
                set appNames to name of every process whose background only is false
                return appNames
            end tell
        `;
        exec(`osascript -e '${script}'`, (error, stdout) => {
            if (error) {
                console.error("Error getting apps:", error);
                resolve([]);
            } else {
                // Determine format: "App1, App2, App3"
                const list = stdout.trim().split(',').map(s => s.trim());
                resolve(list);
            }
        });
    });
});

// Keyboard Action Handler
ipcMain.handle('trigger-keyboard-action', async (_, args: any) => {
    const action = args.action || 'type'; // Default to 'type'
    console.log(`Executing Keyboard Action: ${action} Target: ${args.targetApp || 'Auto'}`);

    // If we have a specific target, we don't need to hide/blur as aggressively
    // because we will explicitly activate the target.
    // However, hiding Julie is still good for visual cleanliness.

    if (win) {
        win.blur();
        win.hide();
    }

    // Slight delay to allow hide animation
    await new Promise(r => setTimeout(r, 500));

    return new Promise((resolve) => {
        const action = args.action || 'type';

        if (action === 'type' && args.text) {
            const targetApp = args.targetApp ? args.targetApp.replace(/"/g, '\\"') : null;

            // "True Typewriter" Logic:
            // 1. Split text into lines.
            // 2. Keystroke each line.
            // 3. Send "Enter" (key code 36) for newlines.
            // This gives the visual effect of typing while preserving structure better than a blob.

            const lines = args.text.split('\n');
            let scriptCommands = "";

            // Helper to escape for AppleScript string
            const escape = (str: string) => str.replace(/\\/g, '\\\\').replace(/"/g, '\\"');

            for (const line of lines) {
                if (line.length > 0) {
                    scriptCommands += `keystroke "${escape(line)}"\n`;
                    scriptCommands += `delay 0.05\n`; // Tiny delay for visual effect
                }
                // Only add Enter if not the very last line (optional, but standard usually implies yes)
                // Actually, split removes delimiters, so we need to add them back.
                scriptCommands += `key code 36\n`;
                scriptCommands += `delay 0.05\n`;
            }

            // Remove the last Enter if strictly needed? 
            // Logic: split("a\nb") -> ["a", "b"]. We add enter after "a" and "b". 
            // Usually one extra enter is fine or even desired.

            let script = "";

            if (targetApp) {
                // TARGETED MODE
                script = `
                    tell application "${targetApp}" to activate
                    delay 0.5
                    tell application "System Events"
                        ${scriptCommands}
                    end tell
                    return "${targetApp}"
                 `;
            } else {
                // AUTO MODE
                script = `
                    tell application "System Events"
                        -- Switch focus logic
                        try
                            set visible of process "Electron" to false
                        end try
                        try
                            set visible of process "Julie" to false
                        end try
                        
                        delay 0.5
                        
                        set frontApp to name of first application process whose frontmost is true
                        ${scriptCommands}
                        return frontApp
                    end tell
                 `;
            }

            exec(`osascript -e '${script}'`, (error, stdout, stderr) => {
                // Restore window after typing
                if (win) {
                    win.show();
                }

                if (error) {
                    console.error("Keyboard Error:", error);
                    if (error.message.includes("1002")) {
                        resolve("Error: Permission denied. Please allow your Terminal to control your computer.");
                    } else {
                        // Truncate long error messages
                        const msg = error.message.length > 200 ? error.message.substring(0, 200) + "..." : error.message;
                        resolve(`Error (typing): ${msg}`);
                    }
                } else {
                    const appName = stdout.trim();
                    resolve(`Successfully typed into ${appName}.`);
                }
            });
        } else {
            if (win) win.show();
            resolve("Error: Invalid keyboard arguments.");
        }
    });
});

process.env.DIST = path.join(__dirname, '../dist')
process.env.VITE_PUBLIC = app.isPackaged ? process.env.DIST : path.join(process.env.DIST, '../public')

if (!process.env.VITE_PUBLIC) {
    process.env.VITE_PUBLIC = path.join(process.env.DIST, '../public')
}

let win: BrowserWindow | null
let isGhostMode = false

const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']

function createWindow() {
    const { workArea } = screen.getPrimaryDisplay()
    const width = 260
    const height = 50
    const x = Math.round(workArea.x + (workArea.width - width) / 2)
    const y = workArea.y + 20 // Padding from top

    win = new BrowserWindow({
        width,
        height,
        x,
        y,
        icon: path.join(process.env.VITE_PUBLIC!, 'icon.png'),
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: true,
            contextIsolation: false,
        },
        transparent: true,
        frame: false,
        alwaysOnTop: true,
        hasShadow: false,
        backgroundColor: '#00000000', // Fully transparent background
    })

    // Privacy: Hide from screen sharing/screenshots and Mission Control
    win.setContentProtection(true)

    if (process.platform === 'darwin') {
        win.setHiddenInMissionControl(true)
    } else {
        win.setSkipTaskbar(true)
    }

    // Visibility: Always on top of EVERYTHING (including full-screen apps)
    win.setAlwaysOnTop(true, 'screen-saver')
    win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })

    // Windows-specific: Set App User Model ID for notifications
    if (process.platform === 'win32') {
        app.setAppUserModelId('com.julie.app')
    }

    // IPC: Set Content Protection (Privacy Mode)
    ipcMain.handle('set-content-protection', (_, protect: boolean) => {
        if (win) {
            win.setContentProtection(protect)
        }
    })

    // IPC: Resize Window
    ipcMain.handle('resize-window', (_, { width, height }) => {
        if (win) {
            const { workArea } = screen.getPrimaryDisplay()
            const x = Math.round(workArea.x + (workArea.width - width) / 2)
            const y = workArea.y + 20 // Keep same top padding

            win.setBounds({ x, y, width, height }, true) // true = animate
        }
    })

    if (VITE_DEV_SERVER_URL) {
        win.loadURL(VITE_DEV_SERVER_URL)
    } else {
        win.loadFile(path.join(process.env.DIST!, 'index.html'))
    }
}

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit()
    }
})

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow()
    }
})

app.whenReady().then(() => {
    createWindow()

    // Stealth Mode: Hide from Dock and App Switcher
    if (process.platform === 'darwin') {
        app.dock?.hide()
    }

    // Toggle Ghost Mode (Click-through)
    globalShortcut.register('CommandOrControl+Shift+I', () => {
        if (win) {
            isGhostMode = !isGhostMode
            if (isGhostMode) {
                win.setIgnoreMouseEvents(true, { forward: true })
                console.log('Ghost Mode: ON')
            } else {
                win.setIgnoreMouseEvents(false)
                console.log('Ghost Mode: OFF')
            }
        }
    })

    // Toggle Window Visibility
    globalShortcut.register('CommandOrControl+]', () => {
        if (win) {
            if (win.isVisible()) {
                win.hide()
                console.log('Window Hidden')
            } else {
                win.show()
                console.log('Window Shown')
            }
        }
    })

    // Window Movement Shortcuts
    const MOVE_STEP = 20

    globalShortcut.register('CommandOrControl+Up', () => {
        if (win) {
            const { x, y, width, height } = win.getBounds()
            win.setBounds({ x, y: y - MOVE_STEP, width, height })
        }
    })

    globalShortcut.register('CommandOrControl+Down', () => {
        if (win) {
            const { x, y, width, height } = win.getBounds()
            win.setBounds({ x, y: y + MOVE_STEP, width, height })
        }
    })

    globalShortcut.register('CommandOrControl+Left', () => {
        if (win) {
            const { x, y, width, height } = win.getBounds()
            win.setBounds({ x: x - MOVE_STEP, y, width, height })
        }
    })

    globalShortcut.register('CommandOrControl+Right', () => {
        if (win) {
            const { x, y, width, height } = win.getBounds()
            win.setBounds({ x: x + MOVE_STEP, y, width, height })
        }
    })
})
