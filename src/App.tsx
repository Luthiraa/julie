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
  Ban,
  Crown
} from 'lucide-react'
import './index.css'
import './App.css'
import { AudioRecorder } from './components/AudioRecorder'
import { Paywall } from './components/Paywall'

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
      content: 'What can you do?'
    },
    {
      role: 'assistant',
      content: "I'm Julie — your invisible AI assistant. I can see your screen, answer questions, and in **Agentic mode**, I can control your browser, run terminal commands, and automate tasks on your computer. Just ask!"
    }
  ])
  const [isLoading, setIsLoading] = useState(false)
  const [scenario, setScenario] = useState(scenarioOptions[0])
  const [transcriptHistory, setTranscriptHistory] = useState('')
  const [activeTab, setActiveTab] = useState<'Chat' | 'Transcript'>('Chat')
  const [isScreenshotMode, setIsScreenshotMode] = useState(false)
  const [isPrivacyMode, setIsPrivacyMode] = useState(false)
  const [isSmartMode, setIsSmartMode] = useState(false)
  const [isPremium, setIsPremium] = useState(false)
  const [showPaywall, setShowPaywall] = useState(false)
  const [accountProfile, setAccountProfile] = useState<{ email?: string | null; isPremium?: boolean; customPrompt?: string | null } | null>(null)
  const [customPrompt, setCustomPrompt] = useState('')

  // Agentic Mode State
  const [isAgenticMode, setIsAgenticMode] = useState(false)
  const [pendingCommand, setPendingCommand] = useState<PendingCommand>(null)

  // Keyboard Tool State
  const [selectedTargetApp, setSelectedTargetApp] = useState<string | null>(null)
  const [availableApps, setAvailableApps] = useState<string[]>([])

  // Settings State
  const [showSettings, setShowSettings] = useState(false)
  const [scenarios, setScenarios] = useState<string[]>(() => {
    const saved = localStorage.getItem('julie_scenarios')
    return saved ? JSON.parse(saved) : scenarioOptions
  })
  const [newScenario, setNewScenario] = useState('')

  // Sync Premium Status + cached account
  useEffect(() => {
    const bootstrap = async () => {
      try {
        const state = await window.ipcRenderer.invoke('get-account-state');
        if (state?.profile) {
          setAccountProfile(state.profile);
          if (state.profile.customPrompt) {
            setCustomPrompt(state.profile.customPrompt);
          } else {
            setCustomPrompt('');
          }
          if (state.profile.isPremium !== undefined) {
            setIsPremium(Boolean(state.profile.isPremium));
          }
        } else if (state?.isPremium !== undefined) {
          setIsPremium(Boolean(state.isPremium));
          setCustomPrompt('');
          setAccountProfile(null);
        }
        if (state?.apiKey) {
          await window.ipcRenderer.invoke('set-api-key', state.apiKey);
        }
      } catch (e) {
        console.error('Failed to bootstrap account state', e);
      }
    };
    bootstrap();
  }, [])

  useEffect(() => {
    const handleProfileUpdate = (_: any, profile: any) => {
      if (profile && profile.isPremium !== undefined) {
        setIsPremium(Boolean(profile.isPremium));
      }
      setAccountProfile(profile || null);
      if (profile?.customPrompt) {
        setCustomPrompt(profile.customPrompt);
      } else {
        setCustomPrompt('');
      }
    };
    window.ipcRenderer.on('account-profile-updated', handleProfileUpdate);
    return () => {
      window.ipcRenderer.removeListener('account-profile-updated', handleProfileUpdate);
    };
  }, []);

  const handleUpgrade = async () => {
    // Trigger upgrade
    await window.ipcRenderer.invoke('upgrade-premium');
    setIsPremium(true);
    setShowPaywall(false);
    alert("Welcome to Premium! x.ai unlocked.");
  };

  // Dynamic Loading Text

  // Dynamic Loading Text
  const [loadingText, setLoadingText] = useState('Thinking...')
  useEffect(() => {
    if (!isLoading) {
      setLoadingText('Thinking...')
      return
    }
    const texts = ['Thinking...', 'Analyzing...', 'Composing...', 'Writing...']
    let i = 0
    const interval = setInterval(() => {
      i = (i + 1) % texts.length
      setLoadingText(texts[i])
    }, 800)
    return () => clearInterval(interval)
  }, [isLoading])

  const inputRef = useRef<HTMLTextAreaElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'auto', block: 'end' })
  }, [messages])

  // Agent IPC Listeners
  useEffect(() => {
    const handleMessage = (_: any, content: string) => {
      setMessages(prev => [...prev, { role: 'assistant', content }])
      setIsLoading(false)
    }
    const handleThinking = () => {
      setIsLoading(true)
    }
    const handleApproval = (_: any, { toolName, toolArgs }: any) => {
      setPendingCommand({
        id: "pending_" + Date.now(),
        toolName,
        toolArgs,
        originalArgs: [],
        command: toolName === 'execute_terminal_command' ? toolArgs.command : undefined
      })
      setIsLoading(false)
    }
    const handleStatus = (_: any, status: string) => {
      setLoadingText(status)
    }
    const handleError = (_: any, error: string) => {
      setMessages(prev => [...prev, { role: 'assistant', content: `Error: ${error}` }])
      setIsLoading(false)
    }
    const handleStopped = () => {
      setIsLoading(false)
      setPendingCommand(null)
    }
    const handleLinkTimeout = () => {
      alert('Link request timed out. Reopen Julie settings in the desktop app to get a new code.')
    }

    const ipc = window.ipcRenderer;
    ipc.on('agent-message', handleMessage)
    ipc.on('agent-thinking', handleThinking)
    ipc.on('agent-request-approval', handleApproval)
    ipc.on('agent-status', handleStatus)
    ipc.on('agent-error', handleError)
    ipc.on('agent-stopped', handleStopped)
    ipc.on('account-link-timeout', handleLinkTimeout)

    return () => {
      ipc.removeListener('agent-message', handleMessage)
      ipc.removeListener('agent-thinking', handleThinking)
      ipc.removeListener('agent-request-approval', handleApproval)
      ipc.removeListener('agent-status', handleStatus)
      ipc.removeListener('agent-error', handleError)
      ipc.removeListener('agent-stopped', handleStopped)
      ipc.removeListener('account-link-timeout', handleLinkTimeout)
    }
  }, [])

  // Add Scenario Handler
  const handleAddScenario = () => {
    if (!newScenario.trim()) return
    const updated = [...scenarios, newScenario.trim()]
    setScenarios(updated)
    setScenario(newScenario.trim()) // Select it
    localStorage.setItem('julie_scenarios', JSON.stringify(updated))
    setNewScenario('')
  }

  const startLinkFlow = async () => {
    try {
      await window.ipcRenderer.invoke('open-settings')
      alert('Opening browser to connect Julie. Complete sign-in there and the desktop app will sync automatically.')
    } catch (error) {
      console.error('settings failed', error)
      alert('Failed to open browser. Please try again.')
    }
  }

  const openAccountSettings = async () => {
    try {
      const state = await window.ipcRenderer.invoke('get-account-state')
      if (state?.profile?.id) {
        setAccountProfile(state.profile)
        if (state.profile.customPrompt) {
          setCustomPrompt(state.profile.customPrompt)
        }
        if (state.profile.isPremium !== undefined) {
          setIsPremium(Boolean(state.profile.isPremium))
        }
        setShowSettings(true)
        return
      }
      await startLinkFlow()
    } catch (error) {
      console.error('settings failed', error)
    }
  }

  useEffect(() => {
    const init = async () => {
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

  const toggleSmartMode = () => {
    if (!isPremium) {
      setShowPaywall(true);
      return;
    }
    setIsSmartMode(!isSmartMode)
  }

  const toggleAgenticMode = () => {
    if (!isPremium) {
      setShowPaywall(true);
      return;
    }
    setIsAgenticMode(!isAgenticMode);
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

      await window.ipcRenderer.invoke('ask-groq', {
        messages: apiMessages,
        isSmart: isSmartMode,
        isAgentic: isAgenticMode
      })

      setTranscriptHistory('')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Something went wrong'
      setMessages(prev => [...prev, { role: 'assistant', content: `Error: ${message}` }])
      setIsLoading(false)
    }
  }


  // Approval Handlers (Backend Driven)
  const handleApproveCommand = async () => {
    if (!pendingCommand) return
    await window.ipcRenderer.invoke('agent-approve', { id: pendingCommand.id })
    setPendingCommand(null)
    setSelectedTargetApp(null)
    setAvailableApps([])
  }

  const handleDenyCommand = async () => {
    if (!pendingCommand) return
    await window.ipcRenderer.invoke('agent-deny', { id: pendingCommand.id })
    setPendingCommand(null)
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
          <h3>Custom Julies</h3>
          <button className="icon-btn-plain" onClick={() => setShowSettings(false)}><X size={20} /></button>
        </div>

        <div className="settings-section">
          <label>Account</label>
          {accountProfile ? (
            <>
              <div className="account-summary">
                <span className="account-email">{accountProfile.email || 'Linked account'}</span>
                <span className={`account-status ${isPremium ? 'premium' : 'standard'}`}>
                  {isPremium ? 'Premium' : 'Free'}
                </span>
              </div>
              {isPremium ? (
                <>
                  <p className="helper-text">Custom Julie prompt (managed via tryjulie.vercel.app)</p>
                  <textarea
                    readOnly
                    value={customPrompt || 'No custom prompt yet. Use the desktop link flow to add one.'}
                  />
                </>
              ) : (
                <p className="helper-text">
                  Using locally cached Groq key. Manage or rotate the key through the desktop link flow.
                </p>
              )}
              <button className="pill-btn ghost" onClick={startLinkFlow}>Manage on Web</button>
            </>
          ) : (
            <>
              <p className="helper-text">
                Link Julie to your account to unlock Premium or sync your Groq key automatically.
              </p>
              <button className="pill-btn purple" onClick={startLinkFlow}>
                Link Account
              </button>
            </>
          )}
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

        {!isPremium && (
          <div className="settings-section">
            <button className="pill-btn purple" style={{ width: '100%', justifyContent: 'center' }} onClick={() => { setShowSettings(false); setShowPaywall(true); }}>
              <Crown size={14} style={{ marginRight: 6 }} /> Upgrade to Premium
            </button>
          </div>
        )}
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
            <div className="message-bubble assistant pulse">
              {loadingText}
            </div>
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
        <button className="dock-btn" onClick={openAccountSettings}><LayoutGrid size={18} /></button>
      </div>
      <button className="dock-close no-drag" onClick={handleCloseClick}>
        <X size={18} />
      </button>
    </div>
  )

  return (
    <div className="liquid-shell">
      {showPaywall && <Paywall onClose={() => setShowPaywall(false)} onUpgrade={handleUpgrade} />}
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
                className={`pill-btn ${isSmartMode ? 'active-smart' : ''}`}
                onClick={toggleSmartMode}
              >
                <Zap size={14} />
                Smart
              </button>
              <button
                className={`pill-btn ${isAgenticMode ? 'purple' : 'ghost'}`}
                onClick={toggleAgenticMode}
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
              <button className="pill-btn ghost" onClick={() => setShowSettings(true)}>
                Manage
              </button>
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
