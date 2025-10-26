import React, { useState, useRef, useEffect, useCallback } from 'react';
import * as geminiService from '../services/geminiService';
import { encode, decode, decodeAudioData } from '../utils/media';
import { LiveServerMessage, Modality, Blob } from '@google/genai';
import { MicIcon, StopIcon } from './common/Icons';

const LiveFeature: React.FC = () => {
    const [isRecording, setIsRecording] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [conversationHistory, setConversationHistory] = useState<{user: string, model: string}[]>([]);
    
    const sessionPromiseRef = useRef<Promise<any> | null>(null);
    const audioResourcesRef = useRef<{
        inputCtx: AudioContext;
        outputCtx: AudioContext;
        stream: MediaStream;
        processor: ScriptProcessorNode;
    } | null>(null);

    const stopLiveConversation = useCallback(() => {
        if (sessionPromiseRef.current) {
            sessionPromiseRef.current.then(session => session.close()).catch(console.error);
            sessionPromiseRef.current = null;
        }
        if (audioResourcesRef.current) {
            audioResourcesRef.current.processor?.disconnect();
            audioResourcesRef.current.stream?.getTracks().forEach(track => track.stop());
            if (audioResourcesRef.current.inputCtx?.state !== 'closed') {
                audioResourcesRef.current.inputCtx.close().catch(console.error);
            }
            if (audioResourcesRef.current.outputCtx?.state !== 'closed') {
                audioResourcesRef.current.outputCtx.close().catch(console.error);
            }
            audioResourcesRef.current = null;
        }
        setIsRecording(false);
    }, []);

    useEffect(() => {
        return () => {
            stopLiveConversation();
        };
    }, [stopLiveConversation]);

    const startLiveConversation = async () => {
        if (isRecording) return;
        setError(null);
        setIsRecording(true);
        setConversationHistory([]);

        let currentInputTranscription = '';
        let currentOutputTranscription = '';
        let nextStartTime = 0;
        
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const inputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
            const outputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
            
            const liveService = geminiService.getLiveSession();
            
            const systemInstruction = "When asked about your identity, name, creator, or who built you, you must respond that your name is DivtIndia's Chatbox. You were created by Divit Bansal, a professional Web and AI Developer, and you are powered by Gemini. Be helpful and friendly.";

            sessionPromiseRef.current = liveService.connect({
                model: 'gemini-2.5-flash-native-audio-preview-09-2025',
                callbacks: {
                    onopen: () => {
                        const source = inputAudioContext.createMediaStreamSource(stream);
                        const scriptProcessor = inputAudioContext.createScriptProcessor(4096, 1, 1);
                        
                        audioResourcesRef.current = {
                            inputCtx: inputAudioContext,
                            outputCtx: outputAudioContext,
                            stream: stream,
                            processor: scriptProcessor,
                        };

                        scriptProcessor.onaudioprocess = (audioProcessingEvent) => {
                            const inputData = audioProcessingEvent.inputBuffer.getChannelData(0);
                            const l = inputData.length;
                            const int16 = new Int16Array(l);
                            for (let i = 0; i < l; i++) {
                                int16[i] = inputData[i] * 32768;
                            }
                            const pcmBlob: Blob = {
                                data: encode(new Uint8Array(int16.buffer)),
                                mimeType: 'audio/pcm;rate=16000',
                            };
                            sessionPromiseRef.current?.then((session) => {
                                session.sendRealtimeInput({ media: pcmBlob });
                            });
                        };
                        source.connect(scriptProcessor);
                        scriptProcessor.connect(inputAudioContext.destination);
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
                        if (audioData && audioResourcesRef.current) {
                            const outCtx = audioResourcesRef.current.outputCtx;
                            nextStartTime = Math.max(nextStartTime, outCtx.currentTime);
                            const audioBuffer = await decodeAudioData(decode(audioData), outCtx, 24000, 1);
                            const source = outCtx.createBufferSource();
                            source.buffer = audioBuffer;
                            source.connect(outCtx.destination);
                            source.start(nextStartTime);
                            nextStartTime += audioBuffer.duration;
                        }
                    },
                    onerror: (e: any) => {
                        setError(`Live connection error: ${e.message || 'An unknown error occurred'}`);
                        console.error(e);
                        stopLiveConversation();
                    },
                    onclose: () => {
                       stopLiveConversation();
                    },
                },
                config: {
                    systemInstruction,
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

    return (
        <div className="h-full flex flex-col bg-slate-800 rounded-xl">
            <header className="p-4 border-b border-slate-700">
                <h2 className="text-xl font-bold">Live Conversation</h2>
            </header>
            <main className="flex-1 p-4 flex flex-col items-center justify-center">
                <div className="text-center">
                    <button onClick={isRecording ? stopLiveConversation : startLiveConversation} className={`p-4 rounded-full transition-colors ${isRecording ? 'bg-red-600 hover:bg-red-700 animate-pulse' : 'bg-indigo-600 hover:bg-indigo-700'}`}>
                        {isRecording ? <StopIcon className="w-12 h-12" /> : <MicIcon className="w-12 h-12" />}
                    </button>
                    <p className="mt-4 text-slate-400">{isRecording ? "Conversation in progress..." : "Start Conversation"}</p>
                </div>
                {error && <p className="text-red-400 text-sm mt-4 text-center">{error}</p>}
                <div className="w-full max-w-2xl mt-8 overflow-y-auto">
                    {conversationHistory.length > 0 && (
                        <div className="space-y-4">
                            <h3 className="text-lg font-bold mb-2">Conversation History:</h3>
                             {conversationHistory.map((turn, index) => (
                                <div key={index} className="border-b border-slate-700 pb-2">
                                    <p className="text-indigo-400 font-bold">You:</p>
                                    <p className="bg-slate-700 p-2 rounded-lg mb-2">{turn.user || "..."}</p>
                                    <p className="text-teal-400 font-bold">Model:</p>
                                    <p className="bg-slate-700 p-2 rounded-lg">{turn.model || "..."}</p>
                                </div>
                             ))}
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
};

export default LiveFeature;
