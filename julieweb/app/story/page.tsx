import Link from "next/link";
import styles from "./page.module.css";
import DemoSlideshow from "./DemoSlideshow";

export default function Story() {
    return (
        <div className={styles.page}>
            <div className={styles.backgroundImage} />

            <main className={styles.main}>
                <div className={styles.column}>
                    <Link href="/" className={styles.backLink}>
                        ← Back
                    </Link>

                    <h1 className={styles.title}>
                        Why I Built Julie
                    </h1>

                    <p className={styles.timeline}>
                        December 22, 2024 — January 2025 · ~2 weeks
                    </p>

                    <section className={styles.section}>
                        <p className={styles.body}>
                            I thought Cluely was a solid idea early on, but over time it felt like it drifted toward pricing, friction, and controversy instead of pure usefulness. That got me wondering: could I build the same core idea, but stripped down, open source, and focused purely on giving people an unfair productivity advantage?
                        </p>

                        <p className={styles.body}>
                            OpenAI has a desktop GPT app now, which is great, but it doesn't really solve the "don't break my flow" problem. You still end up switching tabs, dragging things around, or copy-pasting context. Every context switch costs you 20+ minutes of deep focus. It's not bad, but it's not invisible either.
                        </p>

                        <p className={styles.body}>
                            So I built Julie over a weekend — mostly for fun and to see if I actually could. The result is something that genuinely feels like a superpower. Julie lives on top of your workspace, sees what you see, listens when you want it to, and responds without forcing you to context-switch. No cheating angle, no gimmicks. Just a pure productivity multiplier that keeps you in the same mental lane while you work.
                        </p>

                        <p className={styles.body}>
                            Unlike traditional AI assistants, Julie operates as a ghost in your machine — appearing only when needed and disappearing while executing tasks. The interface is intentionally minimal. I'm trying hard not to turn it into a full chat app with tabs, settings, and feeds.
                        </p>
                    </section>

                    <section className={styles.section}>
                        <h2 className={styles.sectionTitle}>The Philosophy</h2>
                        <p className={styles.body}>
                            The goal has always been the same: don't break my flow. Every time you alt-tab, open a new window, or copy-paste context, you're paying a tax on your focus. Julie eliminates that tax entirely. It helps for 20 seconds and disappears — not a second life you have to manage. Most assistants expect you to paste context and explain yourself. Julie flips that. Your screen is the context.
                        </p>

                        <p className={styles.body}>
                            The result is an unfair advantage. While others are managing multiple windows, explaining their context to ChatGPT, and waiting for responses, you're already done. The AI just works — instantly, silently, and without breaking your train of thought. That's the multiplier effect I was chasing.
                        </p>

                        <p className={styles.body}>
                            This isn't meant to replace anything or start drama. I mostly wanted to prove that this kind of assistant can exist without paywalls, subscriptions, or hype. If it's useful to others, that's a win. It's fully open source and costs $0.
                        </p>

                        <p className={styles.body}>
                            It's opt-in for permissions (screen + accessibility/automation) and meant to be used with you watching, not silently running. Content protection keeps Julie invisible from screen recordings — she's truly a ghost.
                        </p>
                    </section>

                    <section className={styles.section}>
                        <h2 className={styles.sectionTitle}>Core Capabilities</h2>
                        <ul className={styles.featureList}>
                            <li className={styles.featureItem}>
                                <span className={styles.featureName}>General AI Assistant</span>: hears what you hear, sees what you see, gives you real-time answers for any question instantly
                            </li>
                            <li className={styles.featureItem}>
                                <span className={styles.featureName}>Writing Agent</span>: draft and rewrite in your voice, then iterate while staying in the overlay (no new workspace)
                            </li>
                            <li className={styles.featureItem}>
                                <span className={styles.featureName}>Coding Agent</span>: implement and refactor with multi-step edits, while your editor stays the source of truth
                            </li>
                            <li className={styles.featureItem}>
                                <span className={styles.featureName}>Computer-Use Agent</span>: take the next step (click, type, navigate) instead of just telling you what to do
                            </li>
                        </ul>
                    </section>

                    <section className={styles.section}>
                        <h2 className={styles.sectionTitle}>System Control</h2>
                        <ul className={styles.featureList}>
                            <li className={styles.featureItem}>
                                <span className={styles.featureName}>Terminal Execution</span>: run arbitrary shell commands with full stdout/stderr capture, sandboxed via Node.js child_process with configurable timeouts
                            </li>
                            <li className={styles.featureItem}>
                                <span className={styles.featureName}>Browser Automation</span>: full Puppeteer control: navigate, click, type, scroll, read pages, execute scripts. Connects to existing Chrome sessions (preserving logins) or spawns fresh instances
                            </li>
                            <li className={styles.featureItem}>
                                <span className={styles.featureName}>Keyboard Automation</span>: direct keystroke injection via AppleScript into any focused application, with multiline support and special character handling
                            </li>
                            <li className={styles.featureItem}>
                                <span className={styles.featureName}>Computer Vision & Mouse</span>: full-screen capture via Electron's desktopCapturer, plus click, double-click, right-click, and scroll at any coordinates
                            </li>
                            <li className={styles.featureItem}>
                                <span className={styles.featureName}>Application Management</span>: list running processes, switch focus, launch apps by name
                            </li>
                            <li className={styles.featureItem}>
                                <span className={styles.featureName}>Voice Input</span>: real-time transcription via Groq's Whisper Large V3 Turbo with automatic silence detection
                            </li>
                        </ul>
                    </section>

                    <section className={styles.section}>
                        <h2 className={styles.sectionTitle}>Demo Workflows</h2>
                        <p className={styles.body}>
                            I built several demo workflows to showcase what Julie can do. These are fully reproducible, deterministic examples you can run on your own machine.
                        </p>
                        <ul className={styles.featureList}>
                            <li className={styles.featureItem}>
                                <span className={styles.featureName}>The Builder</span> — creates a project folder on Desktop, writes a Three.js spinning cube HTML file, and opens it in browser
                            </li>
                            <li className={styles.featureItem}>
                                <span className={styles.featureName}>The Ghost Writer</span> — navigates to OnlineGDB, selects all code, deletes it, and types a Fibonacci implementation while Julie hides during execution
                            </li>
                            <li className={styles.featureItem}>
                                <span className={styles.featureName}>The Researcher</span> — goes to X.com, finds latest posts from a profile, reads page content via DOM extraction, and returns a parsed summary
                            </li>
                            <li className={styles.featureItem}>
                                <span className={styles.featureName}>Twitter Engagement</span> — opens timeline, clicks like buttons, opens reply modal, types and submits comments
                            </li>
                            <li className={styles.featureItem}>
                                <span className={styles.featureName}>The Journal</span> — opens macOS Notes, types a reminder, opens Calendar, creates a new event, then reappears with confirmation
                            </li>
                        </ul>
                        <DemoSlideshow />
                    </section>

                    <section className={styles.section}>
                        <h2 className={styles.sectionTitle}>Under the Hood</h2>
                        <p className={styles.body}>
                            Julie runs on a multi-process Electron architecture with strict separation between the renderer (React 18) and main process (Node.js). The main process handles all system-level operations — spawning child processes for shell execution, managing Puppeteer browser instances, and dispatching AppleScript commands through osascript. The renderer stays lightweight, focused purely on UI state and message rendering.
                        </p>

                        <p className={styles.body}>
                            IPC channels are typed and explicitly defined: call-agent for inference requests, run-command for terminal execution, trigger-browser-action for Puppeteer dispatch, trigger-keyboard-action for keystroke injection, and trigger-computer-action for mouse/screen control. Each handler is isolated — a failed browser action doesn't crash terminal execution.
                        </p>

                        <p className={styles.body}>
                            Memory management uses a sliding-window context compression algorithm. Token count is estimated at ~4 characters per token, with an 8K context budget reserving 2K for response generation. When the window fills, older messages are dropped FIFO while preserving the system prompt. This prevents unbounded memory growth during long sessions.
                        </p>

                        <p className={styles.body}>
                            Browser automation uses connection pooling — Puppeteer connects to an existing Chrome DevTools Protocol session on port 9222 when available (preserving cookies/auth state), or spawns a fresh instance with a persistent user data directory. Connections are held open across actions to avoid the ~2s cold-start penalty per navigation.
                        </p>

                        <p className={styles.body}>
                            Shell commands execute in sandboxed child processes via Node's child_process.exec() with configurable timeouts. Stdout and stderr are captured and streamed back to the conversation context. Path resolution uses os.homedir() for cross-user portability. AppleScript injection runs through temporary file execution to handle multiline scripts and special character escaping.
                        </p>

                        <p className={styles.body}>
                            Screen capture leverages Electron's desktopCapturer for full-resolution frame grabs. Mouse events are dispatched via CGEventPost for precise coordinate targeting. The overlay window uses setContentProtection(true) to exclude itself from screen recordings and captures — Julie stays invisible in your own recordings.
                        </p>

                        <p className={styles.body}>
                            Voice input implements debounced silence detection — audio buffers are analyzed for amplitude thresholds before triggering transcription, reducing unnecessary inference calls. Messages stream incrementally to the UI using async iterators, keeping the interface responsive during long-running operations.
                        </p>
                    </section>

                    <section className={styles.section}>
                        <h2 className={styles.sectionTitle}>Local Intelligence</h2>
                        <p className={styles.body}>
                            Julie now runs fully offline using local models, optimized specifically for M4 silicon. For text reasoning, I settled on <strong>Qwen3 8B</strong>, and for vision capabilities, <strong>Qwen3-VL 4B</strong>.
                        </p>

                        <p className={styles.body}>
                            The choice of these specific parameter sizes is intentional. On an M4 Mac, they sit in the sweet spot — small enough to reside entirely in high-bandwidth memory without choking the system, but large enough to maintain coherent reasoning. This allows Julie to run comfortably in the background, leaving the main system resources free for your actual work.
                        </p>

                        <p className={styles.body}>
                            To make this viable for real-time interaction, I leaned heavily into inference acceleration. The engine uses Metal Performance Shaders (MPS) to offload matrix operations directly to the GPU, paired with aggressive 4-bit quantization. This combination keeps token generation snappy and thermal impact minimal, ensuring that "local" doesn't mean "slow" or "hot".
                        </p>
                    </section>

                    <section className={styles.section}>
                        <h2 className={styles.sectionTitle}>What's Next</h2>
                        <p className={styles.body}>
                            I'm still iterating on v1.0 and curious about two things: What safety and UX patterns actually feel acceptable for daily computer-use agents? And what's the one workflow you'd want this to do end-to-end without context switching?
                        </p>

                        <ul className={styles.featureList}>
                            <li className={styles.featureItem}>
                                <span className={styles.featureName}>Headless Browser Mode</span> — move browser automation to fully async, headless execution. This means Puppeteer runs in the background without stealing focus, enabling true parallel task execution while you keep working. The goal is zero visual interruption during browser workflows.
                            </li>
                            <li className={styles.featureItem}>
                                <span className={styles.featureName}>Deterministic Execution</span> — make workflows more reproducible by reducing reliance on timing heuristics and flaky selectors. I want to implement proper wait conditions, retry logic with exponential backoff, and DOM-based action verification so the same workflow produces consistent results every time.
                            </li>
                            <li className={styles.featureItem}>
                                <span className={styles.featureName}>Context Compression</span> — implement smarter context windowing using summarization and semantic chunking. Instead of FIFO message dropping, compress older context into summaries that preserve key facts. This extends effective memory while staying within token budgets.
                            </li>

                        </ul>

                        <p className={styles.body}>
                            This is still a minimal version. Let me know your thoughts — I'd love to hear what works and what doesn't. The repo and installers are up on GitHub if you want to try it or poke holes in it.
                        </p>
                    </section>

                    <p className={styles.techStack}>
                        Built with Electron 28+, React 18, TypeScript, Vite, Groq API (Llama 3.3), Whisper Large V3 Turbo, Puppeteer, and CSS Variables.
                    </p>

                    <p className={styles.tagline}>
                        Julie: The Unfair Advantage For Productivity
                    </p>
                </div>
            </main>
        </div>
    );
}
