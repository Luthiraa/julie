import { useState, useRef, useEffect } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import 'katex/dist/katex.min.css'
import {
  X,
  Eye,
  EyeOff,
  ChevronDown,
  MessageSquare,
  Sparkles,
  RefreshCw,
  ArrowUp,
  Home,
  Zap,
  Monitor,
  LayoutGrid,
  Terminal,
  Check,
  Ban
} from 'lucide-react'
import './index.css'
import './App.css'
import { AudioRecorder } from './components/AudioRecorder'

const scenarioOptions = ["Default"]
const quickActions = [
  { label: 'Assist', icon: Sparkles },
  { label: 'What should I say next?', icon: MessageSquare },
  { label: 'Follow-up questions', icon: MessageSquare }, // Using MessageSquare as placeholder
  { label: 'Recap', icon: RefreshCw }
]

type Role = 'user' | 'assistant'
type VisionBlock =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } }
type MessageContent = string | VisionBlock[]
type ChatMessage = { role: Role; content: MessageContent }

// Tool Types


type PendingCommand = {
  id: string
  command?: string // for terminal
  toolName?: string
  toolArgs?: any
  originalArgs: any
} | null


function App() {
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: 'user',
      content: 'Is it secure? We handle sensitive data.'
    },
    {
      role: 'assistant',
      content: "We're SOC2 compliant, use end-to-end encryption, and your data is private to your org. Plus, you control what's stored and can request deletion anytime."
    }
  ])
  const [isLoading, setIsLoading] = useState(false)
  const [scenario, setScenario] = useState(scenarioOptions[0])
  const [transcriptHistory, setTranscriptHistory] = useState('')
  const [activeTab, setActiveTab] = useState<'Chat' | 'Transcript'>('Chat')
  const [isScreenshotMode, setIsScreenshotMode] = useState(false)
  const [isPrivacyMode, setIsPrivacyMode] = useState(false)
  const [isSmartMode, setIsSmartMode] = useState(false)

  // Agentic Mode State
  const [isAgenticMode, setIsAgenticMode] = useState(false)
  const [pendingCommand, setPendingCommand] = useState<PendingCommand>(null)

  // Keyboard Tool State
  const [selectedTargetApp, setSelectedTargetApp] = useState<string | null>(null)
  const [availableApps, setAvailableApps] = useState<string[]>([])

  // Settings State
  const [showSettings, setShowSettings] = useState(false)
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('julie_api_key') || '')
  const [scenarios, setScenarios] = useState<string[]>(() => {
    const saved = localStorage.getItem('julie_scenarios')
    return saved ? JSON.parse(saved) : scenarioOptions
  })
  const [newScenario, setNewScenario] = useState('')

  const inputRef = useRef<HTMLTextAreaElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'auto', block: 'end' })
  }, [messages])

  // Save API Key Handler
  const handleSaveApiKey = async () => {
    if (!apiKey.trim()) return
    try {
      localStorage.setItem('julie_api_key', apiKey.trim())
      await window.ipcRenderer.invoke('set-api-key', apiKey.trim())
      alert('API Key Saved!')
    } catch (e) {
      console.error(e)
      alert('Failed to save API Key')
    }
  }

  // Add Scenario Handler
  const handleAddScenario = () => {
    if (!newScenario.trim()) return
    const updated = [...scenarios, newScenario.trim()]
    setScenarios(updated)
    setScenario(newScenario.trim()) // Select it
    localStorage.setItem('julie_scenarios', JSON.stringify(updated))
    setNewScenario('')
  }

  const toggleSettings = () => setShowSettings(!showSettings)

  useEffect(() => {
    const init = async () => {
      const storedKey = localStorage.getItem('julie_api_key')
      if (storedKey) {
        window.ipcRenderer.invoke('set-api-key', storedKey)
      }

      try {
        await window.ipcRenderer.invoke('resize-window', { width: 800, height: 600 })
      } catch (error) {
        console.debug('resize skipped', error)
      }
    }
    init()
    setTimeout(() => inputRef.current?.focus(), 200)
  }, [])

  const handleTranscript = async (text: string) => {
    setTranscriptHistory(prev => `${prev} ${text}`.trim())
  }

  const toggleScreenshotMode = () => {
    const newState = !isScreenshotMode
    setIsScreenshotMode(newState)
    console.log(newState ? 'use screen enabled' : 'use screen disabled')
  }

  const togglePrivacyMode = async () => {
    const newMode = !isPrivacyMode
    setIsPrivacyMode(newMode)
    try {
      await window.ipcRenderer.invoke('set-content-protection', newMode)
      console.log('Privacy Mode:', newMode)
    } catch (error) {
      console.error('Failed to toggle privacy mode:', error)
      setIsPrivacyMode(!newMode) // Revert on failure
    }
  }

  // Core Submission Logic
  const handleSubmit = async (e?: React.FormEvent, overrideText?: string) => {
    if (e) e.preventDefault()
    const typedInput = overrideText ?? input
    if (!typedInput.trim() && !transcriptHistory.trim() && !isScreenshotMode) return

    let currentScreenshot: string | null = null
    if (isScreenshotMode) {
      currentScreenshot = await window.ipcRenderer.invoke('capture-screen') as string
    }

    const userText = typedInput || (currentScreenshot ? 'Analyze this screen.' : '(Audio Input)')
    let content: MessageContent = userText

    if (currentScreenshot) {
      content = [
        { type: 'text', text: userText },
        { type: 'image_url', image_url: { url: currentScreenshot } }
      ]
    }

    const newMessages = [...messages, { role: 'user' as const, content: userText }]
    setMessages(newMessages)

    setInput('')
    setIsLoading(true)

    try {
      let finalUserContent: MessageContent = content
      if (transcriptHistory.trim()) {
        const contextText = `\n\n[Context from Audio Transcript]: ${transcriptHistory}`
        finalUserContent = Array.isArray(finalUserContent)
          ? finalUserContent.map((part, index) => {
            if (index === 0 && part.type === 'text') {
              return { ...part, text: `${part.text}${contextText}` }
            }
            return part
          })
          : `${finalUserContent}${contextText}`
      }

      const apiMessages = [
        ...messages.map(m => ({ role: m.role, content: m.content })),
        { role: 'user', content: finalUserContent }
      ]

      await callAgent(apiMessages)
      setTranscriptHistory('')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Something went wrong'
      setMessages(prev => [...prev, { role: 'assistant', content: `Error: ${message}` }])
      setIsLoading(false)
    }
  }

  // Recursive Agent Caller
  const callAgent = async (apiMessages: any[]) => {
    setIsLoading(true)
    try {
      const response = await window.ipcRenderer.invoke('ask-groq', {
        messages: apiMessages,
        isSmart: isSmartMode,
        isAgentic: isAgenticMode
      })

      if (typeof response === 'string') {
        // Fallback or simple error
        setMessages(prev => [...prev, { role: 'assistant', content: response }])
      } else if (response.type === 'content') {
        // Standard Text Response
        setMessages(prev => [...prev, { role: 'assistant', content: response.content }])
      } else if (response.type === 'tool_call') {
        // Handle Tool Call
        const { function: fn } = response
        if (fn.name === 'execute_terminal_command') {
          const args = JSON.parse(fn.arguments)
          setPendingCommand({
            id: response.id,
            command: args.command,
            toolName: fn.name,
            toolArgs: args,
            originalArgs: apiMessages // Store history to continue later
          })
          // Do NOT clear loading state? OR split flow.
          // We must stop loading to let user interact.
        } else if (fn.name === 'browser_action') {
          const args = JSON.parse(fn.arguments)
          setPendingCommand({
            id: response.id,
            toolName: fn.name,
            toolArgs: args,
            originalArgs: apiMessages
          })
        } else if (fn.name === 'keyboard_action') {
          const args = JSON.parse(fn.arguments)
          setPendingCommand({
            id: response.id,
            toolName: fn.name,
            toolArgs: args,
            originalArgs: apiMessages
          })
        } else {

          setMessages(prev => [...prev, { role: 'assistant', content: `Error: Unknown tool ${fn.name}` }])
        }
      }
    } catch (err: any) {
      setMessages(prev => [...prev, { role: 'assistant', content: `Error: ${err.message}` }])
    } finally {
      setIsLoading(false)
    }
  }

  const handleApproveCommand = async () => {
    if (!pendingCommand) return
    setIsLoading(true)
    const { command, toolName, toolArgs, originalArgs } = pendingCommand
    setPendingCommand(null)


    // Add interim "thought" to history (visual only or functional?)
    // We update the functional history for the next call
    const intermediateMessages = [
      ...originalArgs,
      { role: 'assistant', content: `I will run the command: \`${command}\`` }
    ]

    // If a target app is selected, inject it into the toolArgs
    const finalArgs = { ...toolArgs }
    if (toolName === 'keyboard_action' && selectedTargetApp) {
      finalArgs.targetApp = selectedTargetApp
    }

    setMessages(prev => [...prev, { role: 'assistant', content: `Running: \`${toolName === 'execute_terminal_command' ? command : JSON.stringify(finalArgs)}\`...` }])
    setPendingCommand(null)
    setSelectedTargetApp(null) // Reset selection
    setAvailableApps([]) // Reset apps list

    try {
      let output = ""
      if (toolName === 'execute_terminal_command' && command) {
        output = await window.ipcRenderer.invoke('run-command', command)
      } else if (toolName === 'browser_action') {
        output = await window.ipcRenderer.invoke('trigger-browser-action', finalArgs)
      } else if (toolName === 'keyboard_action') {
        output = await window.ipcRenderer.invoke('trigger-keyboard-action', finalArgs)
      }

      const nextMessages = [
        ...intermediateMessages,
        { role: 'user', content: `[SYSTEM: The command ran successfully and produced the output below. STOP. Do NOT propose to run this command again. The user can see the output. Just summarize it.]\n\n${output}` }
      ]

      // Show output in chat
      setMessages(prev => [...prev, { role: 'assistant', content: `Output:\n\`\`\`\n${output}\n\`\`\`` }])

      // Check if task is done (Terminal only for now)
      const isStartCommand = command?.trim().toLowerCase().startsWith('start');
      const isGenericSuccess = output.trim().includes('Success (no output)');

      if (isStartCommand || isGenericSuccess) {
        setMessages(prev => [...prev, { role: 'assistant', content: "Task completed successfully." }]);
        setIsLoading(false);
        return; // Stop the loop here
      }

      // Loop back to agent for other commands (like "list files" where analysis is needed)
      await callAgent(nextMessages)

    } catch (err: any) {
      setMessages(prev => [...prev, { role: 'assistant', content: `Execution Error: ${err.message}` }])
      setIsLoading(false)
    }
  }

  const handleDenyCommand = async () => {
    if (!pendingCommand) return
    const { command, originalArgs } = pendingCommand
    setPendingCommand(null)

    const nextMessages = [
      ...originalArgs,
      { role: 'assistant', content: `I wanted to run: \`${command}\`` },
      { role: 'user', content: "I denied that command. Do not run it. Ask me for something else or stop." }
    ]

    setMessages(prev => [...prev, { role: 'assistant', content: `(Command \`${command}\` denied by user)` }])
    await callAgent(nextMessages)
  }


  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  const handlePromptSend = (text: string) => {
    const trimmed = text.trim()
    if (!trimmed) return
    void handleSubmit(undefined, trimmed)
  }

  const handleCloseClick = async () => {
    try {
      await window.ipcRenderer.invoke('close-window')
    } catch (error) {
      console.error('close failed', error)
    }
  }

  const settingsOverlay = (
    <div className="settings-overlay">
      <div className="settings-modal">
        <div className="settings-header">
          <h3>Settings</h3>
          <button className="icon-btn-plain" onClick={() => setShowSettings(false)}><X size={20} /></button>
        </div>

        <div className="settings-section">
          <label>Groq API Key</label>
          <div className="input-group">
            <input
              type="password"
              placeholder="gsk_..."
              value={apiKey}
              onChange={e => setApiKey(e.target.value)}
            />
            <button className="pill-btn blue" onClick={handleSaveApiKey}>Save</button>
          </div>
          <p className="hint">Enter your key to override the default.</p>
        </div>

        <div className="settings-section">
          <label>Custom Julies (Personas)</label>
          <div className="input-group">
            <input
              type="text"
              placeholder="e.g. Code Reviewer"
              value={newScenario}
              onChange={e => setNewScenario(e.target.value)}
            />
            <button className="pill-btn blue" onClick={handleAddScenario}>Add</button>
          </div>
          <ul className="scenario-list">
            {scenarios.map(s => (
              <li key={s} onClick={() => { setScenario(s); setShowSettings(false); }}>
                {s} {s === scenario && <span className="active-tag">(Active)</span>}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )

  const renderMessages = () => {
    return (
      <div className="message-feed">
        {messages.map((msg, idx) => (
          <div key={idx} className={`message-row ${msg.role}`}>
            <div className={`message-bubble ${msg.role}`}>
              <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                {typeof msg.content === 'string' ? msg.content : 'Image context sent.'}
              </ReactMarkdown>
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="message-row assistant">
            <div className="message-bubble assistant pulse">Composing…</div>
          </div>
        )}

        {/* Pending Command Approval UI */}
        {pendingCommand && (
          <div className="command-approval-card">
            <div className="approval-header">
              <Terminal size={16} className="text-purple-400" />
              <span>Julie wants to {pendingCommand.toolName === 'execute_terminal_command' ? 'run a command' : pendingCommand.toolName === 'keyboard_action' ? 'type text' : 'perform a browser action'}:</span>
            </div>

            {/* Keyboard Action Target Picker */}
            {pendingCommand.toolName === 'keyboard_action' && (
              <div className="target-picker">
                <label>Target:</label>
                <select
                  value={selectedTargetApp || ''}
                  onChange={(e) => setSelectedTargetApp(e.target.value || null)}
                  onClick={async () => {
                    // Lazy load apps on click if empty
                    if (availableApps.length === 0) {
                      const apps = await window.ipcRenderer.invoke('get-running-apps');
                      setAvailableApps(apps);
                    }
                  }}
                >
                  <option value="">Auto (Last Active Window)</option>
                  {availableApps.map(app => (
                    <option key={app} value={app}>{app}</option>
                  ))}
                </select>
              </div>
            )}

            <div className="approval-code">
              <code>{pendingCommand.toolName === 'execute_terminal_command' ? pendingCommand.command : JSON.stringify(pendingCommand.toolArgs, null, 2)}</code>
            </div>
            <div className="approval-actions">
              <button className="approval-btn deny" onClick={handleDenyCommand}>
                <Ban size={14} /> Deny
              </button>
              <button className="approval-btn approve" onClick={handleApproveCommand}>
                <Check size={14} /> Approve & Run
              </button>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>
    )
  }

  // Floating Control Bar
  const floatingControlBar = (
    <div className="floating-dock drag-region">
      <div className="dock-content no-drag">
        <button
          className={`dock-btn ${isPrivacyMode ? 'active-privacy' : ''}`}
          onClick={togglePrivacyMode}
          title={isPrivacyMode ? "Hidden from Screen Capture" : "Visible to Screen Capture"}
        >
          {isPrivacyMode ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
        <div className="dock-divider" />
        <AudioRecorder
          onTranscript={handleTranscript}
          className="dock-btn"
        />
        <div className="dock-divider" />
        <button className="dock-btn"><ChevronDown size={18} /></button>
        <div className="dock-divider" />
        <button className="dock-btn" onClick={toggleSettings}><LayoutGrid size={18} /></button>
      </div>
      <button className="dock-close no-drag" onClick={handleCloseClick}>
        <X size={18} />
      </button>
    </div>
  )

  return (
    <div className="liquid-shell">
      {showSettings && settingsOverlay}
      {floatingControlBar}

      <div className="experience-card">
        {/* ... existing header ... */}
        <div className="card-header drag-region">
          <div className="header-left no-drag">
            <button className="icon-btn-plain"><Home size={20} /></button>
            <div className="tab-group">
              <button
                className={`tab-pill ${activeTab === 'Chat' ? 'active' : ''}`}
                onClick={() => setActiveTab('Chat')}
              >
                Chat
              </button>
              <button
                className={`tab-pill ${activeTab === 'Transcript' ? 'active' : ''}`}
                onClick={() => setActiveTab('Transcript')}
              >
                Transcript
              </button>
            </div>
          </div>
          <button className="icon-btn-plain no-drag"><ArrowUp size={18} style={{ transform: 'rotate(45deg)' }} /></button>
        </div>

        {/* Content Body */}
        <div className="insight-body">
          {activeTab === 'Chat' ? renderMessages() : (
            <div className="transcript-view">
              <p>{transcriptHistory || "No live transcript yet..."}</p>
            </div>
          )}
        </div>

        {/* Quick Actions Row */}
        <div className="quick-actions-text">
          {quickActions.map(action => (
            <button key={action.label} className="text-action-btn" onClick={() => handlePromptSend(action.label)}>
              <action.icon size={14} />
              <span>{action.label}</span>
            </button>
          ))}
        </div>

        {/* Input Area */}
        <div className="input-container">
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={isAgenticMode ? "Ask Julie to do something on your PC..." : "Ask, ⌘ ↵ to start typing"}
            rows={1}
          />

          <div className="input-footer">
            <div className="footer-left">
              <button
                className={`pill-btn blue ${isScreenshotMode ? 'active' : ''}`}
                onClick={toggleScreenshotMode}
              >
                <Monitor size={14} />
                Use Screen
              </button>
              <button
                className={`pill-btn ${isSmartMode ? 'blue' : 'ghost'}`}
                onClick={() => setIsSmartMode(!isSmartMode)}
              >
                <Zap size={14} fill={isSmartMode ? "currentColor" : "none"} />
                Smart
              </button>
              <button
                className={`pill-btn ${isAgenticMode ? 'purple' : 'ghost'}`}
                onClick={() => setIsAgenticMode(!isAgenticMode)}
                title="Allow Julie to run terminal commands"
              >
                <Terminal size={14} />
                Agentic
              </button>

              <div className="footer-divider" />
              <div className="scenario-dropdown">
                <span>{scenario}</span>
                <ChevronDown size={14} />
                <select value={scenario} onChange={e => setScenario(e.target.value)}>
                  {scenarios.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                </select>
              </div>
            </div>
            <button className="send-circle-btn" onClick={() => handleSubmit()}>
              <ArrowUp size={18} />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default App
