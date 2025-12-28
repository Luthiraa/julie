import fs from 'node:fs'
import os from 'node:os'
import { app, BrowserWindow, ipcMain, globalShortcut, screen, desktopCapturer } from 'electron'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import 'dotenv/config'
import Groq from 'groq-sdk'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Initialize Groq
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

FORMATTING:
- Use Markdown.
- Use LaTeX for math: $E=mc^2$.
- No headers (#).
`

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

async function askGroqWithFallback(messages: any[], model: string = "llama-3.3-70b-versatile", retries = 1): Promise<string> {
    try {
        const completion = await groq.chat.completions.create({
            messages,
            model,
        });
        return completion.choices[0]?.message?.content || "No response.";
    } catch (error: any) {
        console.error(`Groq Error (${model}):`, error);

        // Check for Rate Limit (429)
        if (error?.status === 429 && retries > 0) {
            console.log("Rate limit hit. Switching to fallback model: llama-3.1-8b-instant");
            return askGroqWithFallback(messages, "llama-3.1-8b-instant", retries - 1);
        }

        return `Error: ${error.message}`;
    }
}

ipcMain.handle('ask-groq', async (_, args: any) => {
    if (!currentApiKey) {
        return "Error: API Key not configured. Please add one in Settings.";
    }

    // Handle both old (array only) and new ({messages, isSmart}) signatures
    let messages: any[];
    let isSmart = false;

    if (Array.isArray(args)) {
        messages = args;
    } else {
        messages = args.messages;
        isSmart = !!args.isSmart;
    }

    // Determine if we need Vision model
    // Check if the last message (user) has content that is an array (which implies image)
    const lastMsg = messages[messages.length - 1];
    const hasImage = Array.isArray(lastMsg?.content);

    let model = "llama-3.3-70b-versatile"; // Default

    if (hasImage) {
        model = "meta-llama/llama-4-scout-17b-16e-instruct";
    } else if (isSmart) {
        model = "llama-3.3-70b-versatile"; // Fallback to best available Llama model
        console.log("Using Smart Model: llama-3.3-70b-versatile");
    }

    // Prepend system prompt if not already present
    // We construct the full message chain here to ensure system prompt is always first
    const fullMessages = [
        { role: "system", content: JULIE_SYSTEM_PROMPT },
        ...(Array.isArray(messages) ? messages : [{ role: "user", content: String(messages) }])
    ];

    return await askGroqWithFallback(fullMessages, model);
})

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
