import { useState, useRef, useEffect } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import 'katex/dist/katex.min.css'
import {
  GripVertical,
  Orbit,
  CircleDot,
  X,
  Eye,
  ChevronDown,
  MessageSquare,
  Sparkles,
  ListChecks,
  HelpCircle,
  RefreshCw,
  ArrowUpRight,
  Camera
} from 'lucide-react'
import './index.css'
import './App.css'
import { AudioRecorder } from './components/AudioRecorder'

const scenarioOptions = ['Hardware Grants', 'Sales', 'Board Meetings']
const quickActions = [
  { label: 'What should I say next?', icon: MessageSquare },
  { label: 'Follow-up questions', icon: Sparkles },
  { label: 'Who am I talking to?', icon: HelpCircle },
  { label: 'Fact-check', icon: ListChecks },
  { label: 'Recap', icon: RefreshCw }
]
const suggestionChips = [
  'What do you look for in grantees?',
  'Define data processing pipeline',
  'Define signal quality'
]
const defaultTalkingPoints = [
  'What signal acquisition method are you using (EEG, ECoG, invasive, non-invasive)?',
  "What’s the planned data processing pipeline (on-device, cloud, hybrid)?"
]

type Role = 'user' | 'assistant'
type VisionBlock =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } }
type MessageContent = string | VisionBlock[]
type ChatMessage = { role: Role; content: MessageContent }

function App() {
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [scenario, setScenario] = useState(scenarioOptions[0])
  const [transcriptHistory, setTranscriptHistory] = useState('')
  const [showTranscript, setShowTranscript] = useState(false)
  const [isScreenshotMode, setIsScreenshotMode] = useState(false)
  const [isListening, setIsListening] = useState(false)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    const resize = async () => {
      try {
        await window.ipcRenderer.invoke('resize-window', { width: 960, height: 820 })
      } catch (error) {
        console.debug('resize skipped', error)
      }
    }
    resize()
    setTimeout(() => inputRef.current?.focus(), 200)
  }, [])

  const handleTranscript = async (text: string) => {
    setTranscriptHistory(prev => `${prev} ${text}`.trim())
  }

  const toggleScreenshotMode = () => {
    setIsScreenshotMode(prev => !prev)
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

      const result = await window.ipcRenderer.invoke('ask-groq', apiMessages) as string
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

  const handleEndSession = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation()
    setMessages([])
    setInput('')
    setTranscriptHistory('')
    setIsListening(false)
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

  const renderMessages = () => {
    if (!messages.length) {
      return (
        <div className="talking-points">
          <ul>
            {defaultTalkingPoints.map(point => (
              <li key={point}>{point}</li>
            ))}
          </ul>
          <div className="point-actions">
            <button className="link-btn">Tell me more</button>
            <button className="link-btn">Copy</button>
          </div>
        </div>
      )
    }

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

  const controlBar = (
    <div className="control-bar drag-region">
      <button className="circle-btn ghost" title="Move Julie">
        <GripVertical size={18} />
      </button>

      <div className="control-pill no-drag" role="button" tabIndex={0}>
        <div className="logo-lockup">
          <div className="logo-mark">
            <Orbit size={22} />
          </div>
          <div>
            <div className="logo-title">Julie</div>
            <div className={`status-chip ${isListening ? 'active' : ''}`}>
              {isListening ? 'Listening' : 'Not listening'}
            </div>
          </div>
        </div>

        <div className="pill-actions">
          <div className="pill-mic" onClick={e => e.stopPropagation()}>
            <AudioRecorder onTranscript={handleTranscript} onStateChange={setIsListening} />
          </div>
          <button className="pill-end" onClick={handleEndSession}>
            <CircleDot size={14} />
            <span>End</span>
          </button>
        </div>
      </div>

      <button className="circle-btn ghost no-drag" title="Hide Julie" onClick={handleCloseClick}>
        <X size={18} />
      </button>
    </div>
  )

  return (
    <div className="liquid-shell expanded">
      {controlBar}

      <div className="experience-card">
        <div className="card-header">
          <div className="left">
            <Eye size={18} />
            <div className="scenario-select">
              <span>{scenario}</span>
              <ChevronDown size={16} />
              <select value={scenario} onChange={e => setScenario(e.target.value)}>
                {scenarioOptions.map(option => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="right">
            <button className="link-btn" onClick={() => setShowTranscript(prev => !prev)}>
              {showTranscript ? 'Hide Transcript' : 'Show Transcript'}
            </button>
            <button className="cta secondary">Follow up questions</button>
          </div>
        </div>

        {showTranscript && (
          <div className="transcript-panel">
            <strong>Live transcript</strong>
            <p>{transcriptHistory || 'Transcript will appear here once you start speaking.'}</p>
          </div>
        )}

        <div className="insight-body">
          {renderMessages()}
        </div>

        <div className="action-row">
          {quickActions.map(action => {
            const Icon = action.icon
            return (
              <button key={action.label} className="action-chip" onClick={() => handlePromptSend(action.label)}>
                <Icon size={16} />
                {action.label}
              </button>
            )
          })}
        </div>

        <form className="input-panel" onSubmit={handleSubmit}>
          <div className="input-shell">
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="What do you look for in grantees?"
              rows={2}
            />
            <div className="input-helpers">
              <button type="button" className={`helper-btn ${isScreenshotMode ? 'active' : ''}`} onClick={toggleScreenshotMode}>
                <Camera size={15} />
                Screen
              </button>
              <button type="button" className="helper-btn">
                <ArrowUpRight size={15} />
                Get Answer
              </button>
            </div>
          </div>
          <button className="submit-btn" disabled={isLoading}>
            {isLoading ? 'Sending…' : 'Submit'}
          </button>
        </form>
      </div>

      <div className="suggestion-cloud">
        {suggestionChips.map(chip => (
          <button key={chip} className="suggestion-chip" onClick={() => handlePromptSend(chip)}>
            {chip}
          </button>
        ))}
      </div>
    </div>
  )
}

export default App
