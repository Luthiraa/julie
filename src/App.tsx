import { useState, useRef, useEffect } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import 'katex/dist/katex.min.css'
import {
  Sparkles,
  Wand2,
  MessageSquare,
  RefreshCw,
  ArrowUp,
  X,
  Camera
} from 'lucide-react'
import './index.css'
import './App.css'
import { AudioRecorder } from './components/AudioRecorder'

function App() {
  const [isExpanded, setIsExpanded] = useState(false)
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState<{ role: 'user' | 'assistant', content: string | any[] }[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [activeTab, setActiveTab] = useState('Chat')
  const [transcriptHistory, setTranscriptHistory] = useState('')
  const [isScreenshotMode, setIsScreenshotMode] = useState(false)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Scroll to bottom of chat
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const toggleExpand = async () => {
    const newExpandedState = !isExpanded
    setIsExpanded(newExpandedState)

    if (newExpandedState) {
      await (window as any).ipcRenderer.invoke('resize-window', { width: 700, height: 500 })
      // Force focus slightly after render to ensure window is ready
      setTimeout(() => {
        inputRef.current?.focus()
      }, 100)
    } else {
      await (window as any).ipcRenderer.invoke('resize-window', { width: 300, height: 60 })
    }
  }

  const handleTranscript = async (text: string) => {
    console.log("Transcript chunk:", text)
    setTranscriptHistory(prev => prev + " " + text)
  }

  const toggleScreenshotMode = () => {
    const newMode = !isScreenshotMode
    setIsScreenshotMode(newMode)
    console.log('Screenshot Mode:', newMode ? 'ON' : 'OFF')
  }

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()


    if (!input.trim() && !transcriptHistory.trim() && !isScreenshotMode) return

    // Silent Capture if Mode is ON
    let currentScreenshot = null
    if (isScreenshotMode) {
      currentScreenshot = await (window as any).ipcRenderer.invoke('capture-screen')
    }

    const userText = input || (currentScreenshot ? "Analyze this screen." : "(Audio Input)")

    // Construct User Message Content
    let content: any = userText

    // If we have a screenshot, format as array for Vision API
    if (currentScreenshot) {
      content = [
        { type: "text", text: userText },
        { type: "image_url", image_url: { url: currentScreenshot } }
      ]
    }

    // Add User Message to State (Text ONLY, no image preview in chat)
    const newMessages = [...messages, { role: 'user' as const, content: userText }]
    setMessages(newMessages)

    setInput('')
    setIsLoading(true)

    try {
      // Construct message history for API

      let finalUserContent = content
      if (transcriptHistory.trim()) {
        const contextText = `\n\n[Context from Audio Transcript]: ${transcriptHistory}`

        if (Array.isArray(finalUserContent)) {
          finalUserContent[0].text += contextText
        } else {
          finalUserContent += contextText
        }
      }

      // Create a copy of messages for the API call
      // We need to be careful: previous messages in state are strings (markdown),
      // but this new one might be an array (for Vision).
      // The backend handles the array check.
      const apiMessages = [
        ...messages.map(m => ({ role: m.role, content: m.content })), // Send previous history as is
        { role: 'user', content: finalUserContent }
      ]

      const result = await (window as any).ipcRenderer.invoke('ask-groq', apiMessages)

      // Add Assistant Message
      setMessages(prev => [...prev, { role: 'assistant', content: result }])

      setTranscriptHistory('')
    } catch (error: any) {
      setMessages(prev => [...prev, { role: 'assistant', content: `Error: ${error.message}` }])
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

  // --- COLLAPSED VIEW (PILL) ---
  if (!isExpanded) {
    return (
      <div className="app-container drag-region">
        <div className="pill-container">
          <div className="pill-content" style={{ justifyContent: 'center', gap: '8px' }}>
            {/* Controls only - Removed Search */}
            <div className="flex items-center gap-2 no-drag">
              <span className="text-white font-medium text-sm pr-2 border-r border-white/10 mr-2">Cluely</span>

              <button
                onClick={toggleScreenshotMode}
                className={`screenshot-btn ${isScreenshotMode ? 'active' : ''}`}
                title={isScreenshotMode ? "Screen Context: ON" : "Screen Context: OFF"}
              >
                <Camera size={16} />
              </button>

              <div className="no-drag">
                <AudioRecorder onTranscript={handleTranscript} />
              </div>

              <button
                onClick={toggleExpand}
                className="icon-btn"
                title="Expand"
              >
                <ArrowUp size={18} />
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // --- EXPANDED VIEW (CARD) ---
  return (
    <div className="app-container">
      <div className="cluely-card">

        {/* Header */}
        <div className="card-header drag-region">
          <div className="flex items-center gap-2 no-drag">
            <button
              className={`tab-button ${activeTab === 'Chat' ? 'active' : ''}`}
              onClick={() => setActiveTab('Chat')}
            >
              Chat
            </button>
            <button
              className={`tab-button ${activeTab === 'Transcript' ? 'active' : ''}`}
              onClick={() => setActiveTab('Transcript')}
            >
              Transcript
            </button>
          </div>

          <div className="header-spacer drag-region" />

          <div className="flex items-center gap-2 no-drag">
            <button
              onClick={toggleExpand}
              className="icon-btn ghost"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Content Area (Chat History) */}
        <div className="card-content no-drag">
          {messages.length === 0 ? (
            <div className="text-white/30 text-center mt-8 flex flex-col items-center gap-2">
              <Sparkles size={24} className="text-white/20" />
              <p>{transcriptHistory ? "Listening..." : "Ready to assist."}</p>
            </div>
          ) : (
            messages.map((msg, idx) => (
              <div key={idx} className={`message-row ${msg.role}`}>
                <div className={`message-bubble ${msg.role}`}>
                  <ReactMarkdown
                    remarkPlugins={[remarkMath]}
                    rehypePlugins={[rehypeKatex]}
                  >
                    {typeof msg.content === 'string' ? msg.content : 'Image Content'}
                  </ReactMarkdown>
                </div>
              </div>
            ))
          )}
          {isLoading && (
            <div className="message-row assistant">
              <div className="message-bubble assistant text-white/50 animate-pulse">
                Thinking...
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Quick Actions */}
        <div className="quick-actions no-drag">
          <div className="action-item"><Sparkles size={14} /> Assist</div>
          <div className="action-item"><Wand2 size={14} /> What should I say next?</div>
          <div className="action-item"><MessageSquare size={14} /> Follow-up questions</div>
          <div className="action-item"><RefreshCw size={14} /> Recap</div>
        </div>

        {/* Input Area */}
        <div className="input-area no-drag">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask, ⌘ ↵ to start typing"
            className="input-field"
            rows={1}
          />

          <div className="input-footer">
            <div className="left-controls flex items-center gap-2">
              <button
                onClick={toggleScreenshotMode}
                className={`screenshot-btn ${isScreenshotMode ? 'active' : ''}`}
                title={isScreenshotMode ? "Screen Context: ON" : "Screen Context: OFF"}
              >
                <Camera size={16} />
              </button>
              <AudioRecorder onTranscript={handleTranscript} />
            </div>

            <button
              className="send-button"
              onClick={() => handleSubmit()}
              disabled={isLoading || (!input.trim() && !transcriptHistory.trim())}
            >
              <ArrowUp size={18} />
            </button>
          </div>
        </div>

      </div>
    </div>
  )
}

export default App
