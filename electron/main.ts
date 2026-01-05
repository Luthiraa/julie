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
    console.log('Executing Computer Action: ' + args.action);
    try {
        let result;
        const [x, y] = args.coordinate || [0, 0];

        switch (args.action) {
            case 'mouse_move':
                await ComputerAction.mouseMove(x, y);
                result = "Moved mouse to " + x + ", " + y;
                break;
            case 'left_click':
                await ComputerAction.leftClick(x, y);
                result = "Left clicked at " + x + ", " + y;
                break;
            case 'right_click':
                await ComputerAction.rightClick(x, y);
                result = "Right clicked at " + x + ", " + y;
                break;
            case 'double_click':
                await ComputerAction.doubleClick(x, y);
                result = "Double clicked at " + x + ", " + y;
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
                result = "Dragged from " + current.x + "," + current.y + " to " + x + "," + y;
                break;
            case 'scroll':
                const amount = parseInt(args.text || "-5");
                await ComputerAction.scroll(x, y, amount); // Scroll at current location or specified?
                result = "Scrolled by " + amount;
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
        return "Error: " + error.message;
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

const JULIE_SYSTEM_PROMPT = [
    "You are Julie, a helpful and precise AI assistant.",
    "",
    "CORE RULES:",
    "1.  **Answer Directly**: Do not analyze the user's intent out loud. Do not say \"The user wants...\". Just give the answer.",
    "2.  **Be Concise**: Keep answers short and to the point. Use bullet points.",
    "3.  **Context Aware**: You have access to the conversation history. Use it to answer follow-up questions (e.g., \"times 5\" refers to the previous result).",
    "4.  **No Meta-Talk**: Never explain your reasoning process unless explicitly asked. Never output \"Expression Analysis\" or similar headers.",
    "",
    "AGENTIC CAPABILITIES:",
    "You have access to a terminal on the user's machine. When the user asks you to perform a task that requires file manipulation, system information, or executing commands, use the 'execute_terminal_command' tool.",
    "-   **DIRECT EXECUTION**: The command you provide becomes the argument to a 'exec' call.",
    "-   **GUI APPS**: If launching a GUI app (e.g., vscode, notepad), use 'Start-Process name' or 'start name' so it does not block the terminal.",
    "-   **DO NOT** try to open a new terminal window for simple tasks. **NEVER** use 'start powershell' just to run a command.",
    "-   **ALWAYS** provide the actual command to run (e.g., 'Get-ChildItem', 'npm install', 'code .').",
    "-   **ONE SHOT**: **NEVER** run the same command twice. If you see the output in the history, the task is DONE. Do not ask to run it again.",
    "-   **Output**: If you use a tool, your response will be processed by the system.",
    "",
    "BROWSER CAPABILITIES:",
    "You can control a web browser to perform tasks. Use the 'browser_action' tool.",
    "-   **Navigation**: Use 'navigate' to go to a URL.",
    "-   **Interaction**: 'click' elements, 'type' text, 'press_key' (for Enter, Tab, etc), 'scroll'.",
    "-   **Reading**: 'read_page' to get the current page content and interactive elements.",
    "-   **CRITICAL**: Call 'read_page' ONLY ONCE after navigation. Do NOT call it repeatedly. After reading, summarize what you found and complete the task.",
    "-   **NEVER LOOP**: If you already called 'read_page' and see the output in history, the reading is DONE. Summarize the findings and stop.",
    "-   **SELECTORS**: Do NOT use :has-text() pseudo-class (it fails). Use the exact selectors provided by 'read_page' or standard CSS.",
    "",
    "KEYBOARD CAPABILITIES:",
    "You can directly type text into the user's active window using the 'keyboard_action' tool.",
    "-   **Use Case**: When the user explicitly asks you to \"write\" or \"type\" the solution/text into their current view (e.g., \"write this code\", \"type the answer\").",
    "-   **Action**: Use 'type' to type long text. Use 'press_key' for special keys (not fully supported yet, stick to typing).",
    "-   **Important**: This tool types BLINDLY into whatever window was active before they interacted with you. Ensure you have the text ready."
].join('\\n');

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
        description: "Control a web browser to navigate, click, type, press keys, or read page content.",
        parameters: {
            type: "object",
            properties: {
                action: {
                    type: "string",
                    enum: ["launch", "navigate", "click", "type", "press_key", "scroll", "read_page", "get_url", "execute_script"],
                    description: "The action to perform."
                },
                url: { type: "string", description: "URL for 'navigate' action." },
                selector: { type: "string", description: "CSS selector for 'click' or 'type' action." },
                text: { type: "string", description: "Text to type for 'type' action." },
                key: { type: "string", description: "Key to press for 'press_key' action (e.g. 'Enter', 'Tab', 'ArrowDown')." },
                direction: { type: "string", enum: ["up", "down"], description: "Direction for 'scroll' action." },
                script: { type: "string", description: "JavaScript code for 'execute_script' action." }
            },
            required: ["action"]
        }
    }
};

// ... (KEYBOARD_TOOL_DEF)

// ... (ipcMain handlers)

// Browser Action Handler
ipcMain.handle('trigger-browser-action', async (_, args: any) => {
    console.log('Executing Browser Action: ' + args.action);
    try {
        switch (args.action) {
            case 'launch':
                await browserManager.launch();
                if (args.url) {
                    return await browserManager.navigate(args.url);
                }
                return "Browser launched.";
            case 'launch_fresh':
                await browserManager.launchFresh();
                if (args.url) {
                    return await browserManager.navigate(args.url);
                }
                return "Fresh browser launched.";
            case 'navigate':
                return await browserManager.navigate(args.url);
            case 'click':
                return await browserManager.click(args.selector);
            case 'type':
                return await browserManager.type(args.selector, args.text);
            case 'press_key':
                return await browserManager.press_key(args.key);
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
        return 'Error executing browser action: ' + error.message;
    }
});
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
        const tempFilePath = path.join(os.tmpdir(), "audio_" + Date.now() + ".wav");
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
    console.log("Executing Agentic Command: " + command);
    return new Promise((resolve) => {
        let finalCommand = command;
        let execOptions: any = { cwd: os.homedir() };

        // Platform specific shell wrapping
        if (process.platform === 'win32') {
            // Force PowerShell on Windows
            finalCommand = "powershell.exe -NoProfile -NonInteractive -Command \"" + command.replace(/"/g, '\\"') + "\"";
        } else {
            // Use zsh/bash on macOS/Linux
            // We generally just exec() but setting shell to /bin/zsh is safer
            execOptions.shell = '/bin/zsh';
        }

        exec(finalCommand, execOptions, (error, stdout, stderr) => {
            if (error) {
                console.error("Exec Error: " + error.message);
                resolve("Error: " + error.message + "\nStderr: " + stderr);
                return;
            }
            const output = (stdout && stdout.toString().trim()) || (stderr && stderr.toString().trim()) || "Success (no output).";
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
                    console.log("Recovered <function> style tool call: " + toolName);
                    return {
                        type: 'tool_call',
                        id: "call_xml_" + Date.now(),
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
                                id: "call_json_" + Date.now(),
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
        console.error("Groq Error (" + model + "):", error);

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
            // IMPROVED REGEX: Prioritize full XML tag match first
            let matchRobust = failedGen.match(/<function=(\w+)[^>]*>(.*?)<\/function>/s);

            if (!matchRobust) {
                // Fallback to loose match (stops at > or </function)
                matchRobust = failedGen.match(/<function=(\w+)\s*(.*?)(?:>|<\/function>)/s);
            }

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

                console.log("Recovered tool call: " + name + " with args " + args);
                return {
                    type: 'tool_call',
                    id: "call_recovered_" + Date.now(),
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
            content: "Error: " + error.message
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


    // --- DEMO MODE INTERCEPTOR (FULL STATE MOCK) ---
    // Scan entire history to determine persistent Demo State
    const userHistory = fullMessages.filter(m => m.role === 'user').map(m => m.content.toString().toLowerCase());

    // Check for specific demo triggers in the history
    const isBuilderDemo = userHistory.some(msg => msg.includes("neon-dream") && msg.includes("create"));
    const isGhostDemo = userHistory.some(msg => (msg.includes("onlinegdb") || msg.includes("online gdb") || msg.includes("gdb")) && (msg.includes("fibonacci") || msg.includes("code")));
    const isResearcherDemo = userHistory.some(msg => msg.includes("x.com") && msg.includes("openai") && msg.includes("latest"));
    const isSocialDemo = userHistory.some(msg => (msg.includes("twitter") || msg.includes("x.com")) && (msg.includes("engage") || msg.includes("like") || msg.includes("comment")));
    const isJournalDemo = userHistory.some(msg => msg.includes("dentist") || msg.includes("reminder") || ((msg.includes("notes") || msg.includes("calendar")) && msg.includes("add")));

    // Helper to simulate "Thinking" time for the video
    const simulateThought = async () => await new Promise(resolve => setTimeout(resolve, 1500));

    // 1. THE BUILDER (Neon Dream)
    if (isBuilderDemo) {
        console.log("DEMO MODE: Builder Workflow Triggered");
        await simulateThought();

        // Check for specific commands in history (App.tsx adds actual command strings)
        const hasMkdir = fullMessages.some(m => m.role === 'assistant' && m.content.toString().includes("mkdir"));
        const hasNodeWrite = fullMessages.some(m => m.role === 'assistant' && m.content.toString().includes("node -e"));
        const hasOpen = fullMessages.some(m => m.role === 'assistant' && m.content.toString().includes("open ") && m.content.toString().includes("index.html"));

        // Calculate step
        let step = 0;
        if (hasMkdir) step = 1;
        if (hasNodeWrite) step = 2;
        if (hasOpen) step = 3;

        if (step === 0) {
            // STEP A: Create Folder
            const desktopPath = path.join(os.homedir(), 'Desktop', 'neon-dream');
            return {
                type: 'tool_call',
                id: "call_demo_build_1",
                function: {
                    name: "execute_terminal_command",
                    arguments: JSON.stringify({ command: "mkdir -p \"" + desktopPath + "\"" })
                }
            };
        } else if (step === 1) {
            // STEP B: Write File
            const htmlContent = `
<!DOCTYPE html>
<html>
<head><style>body{margin:0;background:#000;overflow:hidden;}</style></head>
<body>
<script type="module">
import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth/window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({antialias:true});
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);
const geometry = new THREE.BoxGeometry(1, 1, 1);
const material = new THREE.MeshBasicMaterial({color: 0x00ff00, wireframe: true});
const cube = new THREE.Mesh(geometry, material);
scene.add(cube);
camera.position.z = 2;
function animate() {
    requestAnimationFrame(animate);
    cube.rotation.x += 0.01;
    cube.rotation.y += 0.01;
    renderer.render(scene, camera);
}
animate();
</script>
</body>
</html>`;
            const filePath = path.join(os.homedir(), 'Desktop', 'neon-dream', 'index.html');
            // Use Base64 to safely write complex HTML content through the shell
            const b64Content = Buffer.from(htmlContent).toString('base64');
            const writeCmd = "node -e 'require(\"fs\").writeFileSync(\"" + filePath + "\", Buffer.from(\"" + b64Content + "\", \"base64\"))'";

            return {
                type: 'tool_call',
                id: "call_demo_build_2",
                function: {
                    name: "execute_terminal_command",
                    arguments: JSON.stringify({ command: writeCmd })
                }
            };
        } else if (step === 2) {
            // STEP C: Open File
            const filePath = path.join(os.homedir(), 'Desktop', 'neon-dream', 'index.html');
            return {
                type: 'tool_call',
                id: "call_demo_build_3",
                function: {
                    name: "execute_terminal_command",
                    arguments: JSON.stringify({ command: "open \"" + filePath + "\"" })
                }
            };
        } else {
            // STEP D: Final Response
            return "I've created the 'neon-dream' project on your Desktop, added the 3D cube application, and opened it for you.";
        }
    }

    // 2. THE GHOST WRITER (Colab + Fibonacci in C)
    if (isGhostDemo) {
        console.log("DEMO MODE: Ghost Writer (Colab) Triggered");
        await simulateThought();

        // Count browser_action calls to determine step
        const browserActionCount = fullMessages.filter(m => m.role === 'assistant' && m.content.toString().includes("browser_action")).length;
        const keyboardActionCount = fullMessages.filter(m => m.role === 'assistant' && m.content.toString().includes("keyboard_action")).length;
        const totalActions = browserActionCount + keyboardActionCount;

        // Hide Julie while working
        if (totalActions === 0 && win) {
            win.hide();
            console.log("Hiding Julie for Ghost Writer demo...");
        }

        if (totalActions === 0) {
            // STEP 1: Navigate to OnlineGDB C compiler
            return {
                type: 'tool_call',
                id: "call_demo_ghost_1",
                function: {
                    name: "browser_action",
                    arguments: JSON.stringify({ action: "navigate", url: "https://www.onlinegdb.com/online_c_compiler" })
                }
            };
        } else if (totalActions === 1) {
            // STEP 2: Select all (Cmd+A)
            return {
                type: 'tool_call',
                id: "call_demo_ghost_2",
                function: {
                    name: "browser_action",
                    arguments: JSON.stringify({ action: "press_key", key: "Meta+a" })
                }
            };
        } else if (totalActions === 2) {
            // STEP 3: Delete selected text
            return {
                type: 'tool_call',
                id: "call_demo_ghost_3",
                function: {
                    name: "browser_action",
                    arguments: JSON.stringify({ action: "press_key", key: "Backspace" })
                }
            };
        } else if (totalActions === 3) {
            // STEP 4: Type the Fibonacci code in C
            const fibonacciCode = `#include <stdio.h>

int fibonacci(int n) {
    if (n <= 1) return n;
    return fibonacci(n - 1) + fibonacci(n - 2);
}

int main() {
    int n = 10;
    printf("Fibonacci sequence: ");
    for (int i = 0; i < n; i++) {
        printf("%d ", fibonacci(i));
    }
    printf("\\n");
    return 0;
}`;

            return {
                type: 'tool_call',
                id: "call_demo_ghost_4",
                function: {
                    name: "keyboard_action",
                    arguments: JSON.stringify({ action: "type", text: fibonacciCode })
                }
            };
        } else {
            // STEP 5: Final Response - Show Julie again
            if (win) {
                win.show();
                console.log("Showing Julie after Ghost Writer demo...");
            }
            return "Done! I've opened OnlineGDB and typed out a Fibonacci sequence implementation in C. Click the green 'Run' button to execute it!";
        }
    }

    // 3. THE RESEARCHER (X.com)
    if (isResearcherDemo) {
        console.log("DEMO MODE: Researcher Workflow Triggered");
        await simulateThought();

        // Count browser_action calls in history (App.tsx adds "I will run: browser_action")
        const browserActionCount = fullMessages.filter(m => m.role === 'assistant' && m.content.toString().includes("browser_action")).length;

        if (browserActionCount === 0) {
            // STEP A: Navigate
            return {
                type: 'tool_call',
                id: "call_demo_research_1",
                function: {
                    name: "browser_action",
                    arguments: JSON.stringify({ action: "navigate", url: "https://x.com/OpenAI" })
                }
            };
        } else if (browserActionCount === 1) {
            // STEP B: Read Page
            return {
                type: 'tool_call',
                id: "call_demo_research_2",
                function: {
                    name: "browser_action",
                    arguments: JSON.stringify({ action: "read_page" })
                }
            };
        } else {
            // STEP C: Final Response (Simulated Summary)
            return "I've checked the latest from @OpenAI on X. The most recent post discusses the release of their new o1 model updates, highlighting improved reasoning capabilities and reduced latency. The community response seems very positive, with many users showcasing creative benchmarks.";
        }
    }

    // 4. SOCIAL MEDIA ENGAGEMENT (Like & Comment Demo)
    if (isSocialDemo) {
        console.log("DEMO MODE: Social Media Engagement Triggered");
        await simulateThought();

        // Count actions to determine step
        const browserActionCount = fullMessages.filter(m => m.role === 'assistant' && m.content.toString().includes("browser_action")).length;
        const computerActionCount = fullMessages.filter(m => m.role === 'assistant' && m.content.toString().includes("computer_action")).length;
        const totalActions = browserActionCount + computerActionCount;

        // Hide Julie's window while browser actions are happening
        if (totalActions === 0 && win) {
            win.hide();
            console.log("Hiding Julie for Social Media demo...");
        }

        if (totalActions === 0) {
            // STEP 1: Navigate to X.com home timeline
            return {
                type: 'tool_call',
                id: "call_demo_social_1",
                function: {
                    name: "browser_action",
                    arguments: JSON.stringify({ action: "navigate", url: "https://x.com/home" })
                }
            };
        } else if (totalActions === 1) {
            // STEP 2: Scroll to load posts
            return {
                type: 'tool_call',
                id: "call_demo_social_2",
                function: {
                    name: "browser_action",
                    arguments: JSON.stringify({ action: "scroll", direction: "down" })
                }
            };
        } else if (totalActions === 2) {
            // STEP 3: Click LIKE on first post (Twitter uses data-testid="like")
            return {
                type: 'tool_call',
                id: "call_demo_social_3",
                function: {
                    name: "browser_action",
                    arguments: JSON.stringify({ action: "click", selector: '[data-testid="like"]' })
                }
            };
        } else if (totalActions === 3) {
            // STEP 4: Scroll more
            return {
                type: 'tool_call',
                id: "call_demo_social_4",
                function: {
                    name: "browser_action",
                    arguments: JSON.stringify({ action: "scroll", direction: "down" })
                }
            };
        } else if (totalActions === 4) {
            // STEP 5: Click LIKE on another post
            return {
                type: 'tool_call',
                id: "call_demo_social_5",
                function: {
                    name: "browser_action",
                    arguments: JSON.stringify({ action: "click", selector: '[data-testid="like"]' })
                }
            };
        } else if (totalActions === 5) {
            // STEP 6: Click REPLY button to open comment box
            return {
                type: 'tool_call',
                id: "call_demo_social_6",
                function: {
                    name: "browser_action",
                    arguments: JSON.stringify({ action: "click", selector: '[data-testid="reply"]' })
                }
            };
        } else if (totalActions === 6) {
            // STEP 7: Type a comment
            return {
                type: 'tool_call',
                id: "call_demo_social_7",
                function: {
                    name: "browser_action",
                    arguments: JSON.stringify({ action: "type", selector: '[data-testid="tweetTextarea_0"]', text: "holy!" })
                }
            };
        } else if (totalActions === 7) {
            // STEP 8: Submit the reply (press Enter or click Reply button)
            return {
                type: 'tool_call',
                id: "call_demo_social_8",
                function: {
                    name: "browser_action",
                    arguments: JSON.stringify({ action: "click", selector: '[data-testid="tweetButton"]' })
                }
            };
        } else {
            // STEP 9: Final Response - Show Julie again
            if (win) {
                win.show();
                console.log("Showing Julie after Social Media demo...");
            }
            return "Done! I've liked 2 posts on your timeline and left a comment saying 'holy!'. Your engagement is complete!";
        }
    }

    // 5. THE JOURNAL (Notes + Calendar)
    if (isJournalDemo) {
        console.log("DEMO MODE: Journal Triggered");
        await simulateThought();

        // Count actions by looking for specific commands in history
        const notesOpened = fullMessages.some(m => m.role === 'assistant' && m.content.toString().includes("open -a Notes"));
        const calendarOpened = fullMessages.some(m => m.role === 'assistant' && m.content.toString().includes("open -a Calendar"));
        const keyboardActions = fullMessages.filter(m => m.role === 'assistant' && m.content.toString().includes("keyboard_action")).length;

        // Calculate step based on what's been done
        let step = 0;
        if (notesOpened) step = 1;
        if (notesOpened && keyboardActions >= 1) step = 2;
        if (calendarOpened) step = 3;
        if (calendarOpened && keyboardActions >= 2) step = 4;
        if (calendarOpened && keyboardActions >= 3) step = 5;

        // Hide Julie while working
        if (step === 0 && win) {
            win.hide();
            console.log("Hiding Julie for Journal demo...");
        }

        // Get today's date
        const today = new Date();
        const dateStr = today.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

        if (step === 0) {
            // STEP 1: Open Notes app
            return {
                type: 'tool_call',
                id: "call_demo_journal_1",
                function: {
                    name: "execute_terminal_command",
                    arguments: JSON.stringify({ command: "open -a Notes" })
                }
            };
        } else if (step === 1) {
            // STEP 2: Type the note
            return {
                type: 'tool_call',
                id: "call_demo_journal_2",
                function: {
                    name: "keyboard_action",
                    arguments: JSON.stringify({ action: "type", text: "Call dentist and reschedule appointment - need to move to next week" })
                }
            };
        } else if (step === 2) {
            // STEP 3: Open Calendar app
            return {
                type: 'tool_call',
                id: "call_demo_journal_3",
                function: {
                    name: "execute_terminal_command",
                    arguments: JSON.stringify({ command: "open -a Calendar" })
                }
            };
        } else if (step === 3) {
            // STEP 4: Press Cmd+N to create new event
            return {
                type: 'tool_call',
                id: "call_demo_journal_4",
                function: {
                    name: "keyboard_action",
                    arguments: JSON.stringify({ action: "type", text: "" })
                }
            };
        } else if (step === 4) {
            // STEP 5: Type calendar event with today's date
            return {
                type: 'tool_call',
                id: "call_demo_journal_5",
                function: {
                    name: "keyboard_action",
                    arguments: JSON.stringify({ action: "type", text: `Call Dentist - Reschedule (${dateStr})` })
                }
            };
        } else {
            // STEP 6: Final Response - Show Julie again after delay
            await new Promise(resolve => setTimeout(resolve, 2000)); // 2 second delay
            if (win) {
                win.show();
                console.log("Showing Julie after Journal demo...");
            }
            return `Done! I've saved your reminder in Notes and added 'Call Dentist - Reschedule' to your Calendar for ${dateStr}.`;
        }
    }
    // -----------------------------

    return await askGroqWithFallback(fullMessages, model, 1, tools);
})



// Get Running Apps Handler
ipcMain.handle('get-running-apps', async () => {
    return new Promise((resolve) => {
        const script = [
            'tell application "System Events"',
            '    set appNames to name of every process whose background only is false',
            '    return appNames',
            'end tell'
        ].join('\\n');

        exec("osascript -e '" + script + "'", (error, stdout) => {
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
    console.log("Executing Keyboard Action: " + action + " Target: " + (args.targetApp || 'Auto'));

    if (win) {
        win.blur();
        win.hide();
    }

    // Slight delay to allow hide animation
    await new Promise(r => setTimeout(r, 500));

    return new Promise((resolve, reject) => {
        const action = args.action || 'type';

        if (action === 'type' && args.text) {
            const targetApp = args.targetApp; // No escaping needed for file writing logic

            // "True Typewriter" Logic
            const lines = args.text.split('\n');
            let scriptCommands = "";

            // For file-based AppleScript, we need proper escaping of double quotes inside strings
            const escape = (str: string) => str.replace(/\\/g, '\\\\').replace(/"/g, '\\"');

            // Build the core typing commands
            for (const line of lines) {
                if (line.length > 0) {
                    scriptCommands += 'keystroke "' + escape(line) + '"\n';
                    scriptCommands += 'delay 0.05\n';
                }
                scriptCommands += 'key code 36\n'; // Enter
                scriptCommands += 'delay 0.05\n';
            }

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

            // Write to temp file to avoid shell escaping limits
            const tempScriptPath = path.join(os.tmpdir(), "julie_keyboard_" + Date.now() + ".scpt");
            fs.writeFileSync(tempScriptPath, script);

            exec('osascript "' + tempScriptPath + '"', (error, stdout, stderr) => {
                // Clean up
                try { fs.unlinkSync(tempScriptPath); } catch (e) { }

                // Restore window after typing
                if (win) {
                    win.show();
                }

                if (error) {
                    console.error("Keyboard Error:", error);
                    // Truncate long error messages
                    const msg = error.message.length > 200 ? error.message.substring(0, 200) + "..." : error.message;
                    resolve("Error(typing): " + msg);
                    return;
                }
                resolve("Typed text successfully into: " + (stdout || "Active Window").trim());
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
