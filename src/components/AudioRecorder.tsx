import { useState, useEffect, useRef } from 'react'
import { Mic, Square } from 'lucide-react'

interface AudioRecorderProps {
    onTranscript: (text: string) => void
}

export function AudioRecorder({ onTranscript }: AudioRecorderProps) {
    const [isListening, setIsListening] = useState(false)
    const mediaRecorderRef = useRef<MediaRecorder | null>(null)
    const intervalRef = useRef<number | null>(null)

    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
            const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' })
            mediaRecorderRef.current = mediaRecorder

            mediaRecorder.ondataavailable = async (event) => {
                if (event.data.size > 0) {
                    const buffer = await event.data.arrayBuffer()
                    try {
                        const text = await (window as any).ipcRenderer.invoke('transcribe-audio', buffer)
                        if (text && text.trim()) {
                            onTranscript(text)
                        }
                    } catch (err) {
                        console.error("Transcription error:", err)
                    }
                }
            }

            mediaRecorder.start()
            setIsListening(true)

            // Chunk audio every 3 seconds
            intervalRef.current = window.setInterval(() => {
                if (mediaRecorder.state === 'recording') {
                    mediaRecorder.stop()
                    mediaRecorder.start()
                }
            }, 3000)

        } catch (err) {
            console.error("Error accessing microphone:", err)
            alert("Could not access microphone. Please check permissions.")
        }
    }

    const stopRecording = () => {
        if (mediaRecorderRef.current) {
            mediaRecorderRef.current.stop()
            mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop())
        }
        if (intervalRef.current) {
            clearInterval(intervalRef.current)
        }
        setIsListening(false)
    }

    useEffect(() => {
        return () => {
            stopRecording()
        }
    }, [])

    return (
        <button
            onClick={isListening ? stopRecording : startRecording}
            className={`icon-btn ${isListening ? 'recording' : ''}`}
            title={isListening ? "Stop Listening" : "Start Listening"}
        >
            {isListening ? (
                <Square size={16} fill="currentColor" />
            ) : (
                <Mic size={18} />
            )}
        </button>
    )
}
