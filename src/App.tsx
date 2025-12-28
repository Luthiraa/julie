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
  LayoutGrid
} from 'lucide-react'
import './index.css'
import './App.css'
import { AudioRecorder } from './components/AudioRecorder'

const scenarioOptions = ['Cluely for Sales (Roy)', 'Hardware Grants', 'Board Meetings']
const quickActions = [
  { label: 'Assist', icon: Sparkles },
  { label: 'What should I say next?', icon: MessageSquare }, // Using MessageSquare as placeholder
  { label: 'Follow-up questions', icon: MessageSquare },
  { label: 'Recap', icon: RefreshCw }
]

type Role = 'user' | 'assistant'
type VisionBlock =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } }
type MessageContent = string | VisionBlock[]
type ChatMessage = { role: Role; content: MessageContent }

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

      const result = await window.ipcRenderer.invoke('ask-groq', { messages: apiMessages, isSmart: isSmartMode }) as string
      setMessages(prev => [...prev, { role: 'assistant', content: result }])
      setTranscriptHistory('')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Something went wrong'
      setMessages(prev => [...prev, { role: 'assistant', content: `Error: ${message}` }])
    } finally {
      setIsLoading(false)
    }
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
            placeholder="Ask, ⌘ ↵ to start typing"
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
