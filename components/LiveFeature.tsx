
import React, { useState, useRef, useEffect, useCallback } from 'react';
import * as geminiService from '../services/geminiService';
import { fileToBase64, encode, decode, decodeAudioData } from '../utils/media';
import { GoogleGenAI, LiveServerMessage, Modality, Blob } from '@google/genai';
import { MicIcon, StopIcon } from './common/Icons';

type LiveMode = 'conversation' | 'transcribe';

const LiveFeature: React.FC = () => {
    const [mode, setMode] = useState<LiveMode>('conversation');
    const [isRecording, setIsRecording] = useState(false);
    const [isTranscribing, setIsTranscribing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [transcription, setTranscription] = useState('');
    const [conversationHistory, setConversationHistory] = useState<{user: string, model: string}[]>([]);
    
    // For transcription
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<globalThis.Blob[]>([]);

    // For live conversation
    const sessionPromiseRef = useRef<Promise<any> | null>(null);
    const inputAudioContextRef = useRef<AudioContext | null>(null);
    const outputAudioContextRef = useRef<AudioContext | null>(null);
    const micStreamRef = useRef<MediaStream | null>(null);
    const processorNodeRef = useRef<ScriptProcessorNode | null>(null);

    const stopLiveConversation = useCallback(() => {
        if (sessionPromiseRef.current) {
            sessionPromiseRef.current.then(session => session.close());
            sessionPromiseRef.current = null;
        }
        if (processorNodeRef.current) {
            processorNodeRef.current.disconnect();
            processorNodeRef.current = null;
        }
        if(micStreamRef.current) {
            micStreamRef.current.getTracks().forEach(track => track.stop());
            micStreamRef.current = null;
        }
        if(inputAudioContextRef.current && inputAudioContextRef.current.state !== 'closed'){
            inputAudioContextRef.current.close();
            inputAudioContextRef.current = null;
        }
        if(outputAudioContextRef.current && outputAudioContextRef.current.state !== 'closed'){
            outputAudioContextRef.current.close();
            outputAudioContextRef.current = null;
        }
        setIsRecording(false);
    }, []);

    useEffect(() => {
        // Cleanup on component unmount
        return () => {
            stopLiveConversation();
        };
    }, [stopLiveConversation]);

    const startLiveConversation = async () => {
        setError(null);
        setIsRecording(true);
        setConversationHistory([]);

        let currentInputTranscription = '';
        let currentOutputTranscription = '';
        let nextStartTime = 0;
        
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            micStreamRef.current = stream;

            inputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
            outputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
            
            const liveService = geminiService.getLiveSession();
            
            sessionPromiseRef.current = liveService.connect({
                model: 'gemini-2.5-flash-native-audio-preview-09-2025',
                callbacks: {
                    onopen: () => {
                        const source = inputAudioContextRef.current!.createMediaStreamSource(stream);
                        const scriptProcessor = inputAudioContextRef.current!.createScriptProcessor(4096, 1, 1);
                        processorNodeRef.current = scriptProcessor;

                        scriptProcessor.onaudioprocess = (audioProcessingEvent) => {
                            const inputData = audioProcessingEvent.inputBuffer.getChannelData(0);
                            const pcmBlob: Blob = {
                                data: encode(new Uint8Array(new Int16Array(inputData.map(f => f * 32768)).buffer)),
                                mimeType: 'audio/pcm;rate=16000',
                            };
                            sessionPromiseRef.current?.then((session) => {
                                session.sendRealtimeInput({ media: pcmBlob });
                            });
                        };
                        source.connect(scriptProcessor);
                        scriptProcessor.connect(inputAudioContextRef.current!.destination);
                    },
                    onmessage: async (message: LiveServerMessage) => {
                        if (message.serverContent?.outputTranscription) {
                            currentOutputTranscription += message.serverContent.outputTranscription.text;
                        }
                        if (message.serverContent?.inputTranscription) {
                            currentInputTranscription += message.serverContent.inputTranscription.text;
                        }
                        if (message.serverContent?.turnComplete) {
                            const fullInput = currentInputTranscription;
                            const fullOutput = currentOutputTranscription;
                            setConversationHistory(prev => [...prev, {user: fullInput, model: fullOutput}]);
                            currentInputTranscription = '';
                            currentOutputTranscription = '';
                        }

                        const audioData = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
                        if (audioData) {
                            nextStartTime = Math.max(nextStartTime, outputAudioContextRef.current!.currentTime);
                            const audioBuffer = await decodeAudioData(decode(audioData), outputAudioContextRef.current!, 24000, 1);
                            const source = outputAudioContextRef.current!.createBufferSource();
                            source.buffer = audioBuffer;
                            source.connect(outputAudioContextRef.current!.destination);
                            source.start(nextStartTime);
                            nextStartTime += audioBuffer.duration;
                        }
                    },
                    onerror: (e: any) => {
                        setError(`Live connection error: ${e.message}`);
                        console.error(e);
                        stopLiveConversation();
                    },
                    onclose: () => {
                       // Handled by user action or error
                    },
                },
                config: {
                    responseModalities: [Modality.AUDIO],
                    outputAudioTranscription: {},
                    inputAudioTranscription: {},
                },
            });

        } catch (e: any) {
            setError(`Failed to start conversation: ${e.message}`);
            setIsRecording(false);
        }
    };


    const startTranscription = async () => {
        setError(null);
        setTranscription('');
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaRecorderRef.current = new MediaRecorder(stream);
            audioChunksRef.current = [];

            mediaRecorderRef.current.ondataavailable = event => {
                audioChunksRef.current.push(event.data);
            };

            mediaRecorderRef.current.onstop = async () => {
                const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
                const audioFile = new File([audioBlob], "recording.webm", { type: "audio/webm" });
                
                setIsTranscribing(true);
                try {
                    const audioBase64 = await fileToBase64(audioFile);
                    const response = await geminiService.transcribeAudio(audioBase64, audioFile.type);
                    setTranscription(response.text);
                } catch (e: any) {
                    setError(`Transcription failed: ${e.message}`);
                } finally {
                    setIsTranscribing(false);
                }
                 // Stop mic stream
                stream.getTracks().forEach(track => track.stop());
            };

            mediaRecorderRef.current.start();
            setIsRecording(true);
        } catch (e: any) {
            setError(`Could not start recording: ${e.message}`);
        }
    };

    const stopTranscription = () => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
            mediaRecorderRef.current.stop();
            setIsRecording(false);
        }
    };

    return (
        <div className="h-full flex flex-col bg-slate-800 rounded-lg">
            <div className="p-4 border-b border-slate-700">
                <div className="flex space-x-2 bg-slate-700 p-1 rounded-lg max-w-xs">
                    {(['conversation', 'transcribe'] as LiveMode[]).map(m => (
                        <button key={m} onClick={() => setMode(m)} className={`flex-1 capitalize text-sm py-2 rounded-md transition-colors ${mode === m ? 'bg-indigo-600' : 'hover:bg-slate-600'}`}>{m}</button>
                    ))}
                </div>
            </div>
            <div className="flex-1 p-4 flex flex-col items-center justify-center">
                <div className="text-center">
                    {mode === 'conversation' ? (
                        <button onClick={isRecording ? stopLiveConversation : startLiveConversation} className={`p-4 rounded-full transition-colors ${isRecording ? 'bg-red-600 hover:bg-red-700' : 'bg-indigo-600 hover:bg-indigo-700'}`}>
                            {isRecording ? <StopIcon className="w-12 h-12" /> : <MicIcon className="w-12 h-12" />}
                        </button>
                    ) : (
                        <button onClick={isRecording ? stopTranscription : startTranscription} className={`p-4 rounded-full transition-colors ${isRecording ? 'bg-red-600 hover:bg-red-700' : 'bg-indigo-600 hover:bg-indigo-700'}`}>
                            {isRecording ? <StopIcon className="w-12 h-12" /> : <MicIcon className="w-12 h-12" />}
                        </button>
                    )}
                    <p className="mt-4 text-slate-400">{isRecording ? "Recording..." : (mode === 'conversation' ? "Start Conversation" : "Start Recording for Transcription")}</p>
                    {isTranscribing && <p className="mt-2 text-indigo-400 animate-pulse">Transcribing...</p>}
                </div>
                {error && <p className="text-red-400 text-sm mt-4 text-center">{error}</p>}
                <div className="w-full max-w-2xl mt-8 overflow-y-auto">
                    {mode === 'transcribe' && transcription && (
                        <div>
                            <h3 className="text-lg font-bold mb-2">Transcription:</h3>
                            <p className="bg-slate-700 p-4 rounded-lg whitespace-pre-wrap">{transcription}</p>
                        </div>
                    )}
                    {mode === 'conversation' && conversationHistory.length > 0 && (
                        <div>
                            <h3 className="text-lg font-bold mb-2">Conversation:</h3>
                             {conversationHistory.map((turn, index) => (
                                <div key={index} className="mb-4">
                                    <p className="text-indigo-400 font-bold">You:</p>
                                    <p className="bg-slate-700 p-2 rounded-lg mb-2">{turn.user || "..."}</p>
                                    <p className="text-teal-400 font-bold">Model:</p>
                                    <p className="bg-slate-700 p-2 rounded-lg">{turn.model || "..."}</p>
                                </div>
                             ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default LiveFeature;
