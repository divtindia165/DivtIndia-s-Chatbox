
import React, { useState, useRef, useEffect } from 'react';
import type { ChatMessage, GroundingChunk } from '../types';
import { Role } from '../types';
import * as geminiService from '../services/geminiService';
// FIX: Statically import `decode` for cleaner code.
import { decode, decodeAudioData } from '../utils/media';
import { PlayIcon } from './common/Icons';

type ChatMode = "fast" | "standard" | "complex" | "search" | "maps";

const systemInstruction = "When asked about your identity, name, creator, or who built you, you must respond that your name is DivtIndia's Chatbox. You were created by Divit Bansal, a professional Web and AI Developer, and you are powered by Gemini. Be helpful and friendly.";

const modeConfig: Record<ChatMode, { model: any, label: string, placeholder: string, config?: any, tools?: any[] }> = {
    fast: { model: 'gemini-2.5-flash-lite', label: 'Fast', placeholder: 'Quick question? Get a low-latency response.', config: { systemInstruction } },
    standard: { model: 'gemini-2.5-flash', label: 'Standard', placeholder: 'Ask me anything...', config: { systemInstruction } },
    complex: { model: 'gemini-2.5-pro', label: 'Complex', placeholder: 'Ask a complex question that requires deep reasoning...', config: { systemInstruction, thinkingConfig: { thinkingBudget: 32768 } } },
    search: { model: 'gemini-2.5-flash', label: 'Search Grounded', placeholder: 'Ask about recent events or news...', tools: [{ googleSearch: {} }], config: { systemInstruction } },
    maps: { model: 'gemini-2.5-flash', label: 'Maps Grounded', placeholder: 'Find places, e.g., "Good pizza near me?"', tools: [{ googleMaps: {} }], config: { systemInstruction } }
};

const ChatFeature: React.FC = () => {
    const [mode, setMode] = useState<ChatMode>('standard');
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [prompt, setPrompt] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const chatEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const handleSendMessage = async () => {
        if (!prompt.trim() || isLoading) return;
        const userMessage: ChatMessage = { role: Role.USER, text: prompt };
        setMessages(prev => [...prev, userMessage]);
        setPrompt('');
        setIsLoading(true);
        setError(null);

        try {
            const { model, config, tools } = modeConfig[mode];
            const response = await geminiService.generateText(prompt, model, config, tools);
            const modelMessage: ChatMessage = {
                role: Role.MODEL,
                text: response.text,
                sources: response.candidates?.[0]?.groundingMetadata?.groundingChunks,
            };
            setMessages(prev => [...prev, modelMessage]);
        } catch (e: any) {
            setError(e.message || "An error occurred.");
            console.error(e);
        } finally {
            setIsLoading(false);
        }
    };

    const playTTS = async (text: string) => {
        try {
            const audioBase64 = await geminiService.textToSpeech(text);
            const outputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
            const outputNode = outputAudioContext.createGain();
            outputNode.connect(outputAudioContext.destination);

            // FIX: Refactored to use async/await and avoid dynamic import for better readability.
            const audioBuffer = await decodeAudioData(
                decode(audioBase64),
                outputAudioContext, 24000, 1
            );
            
            const source = outputAudioContext.createBufferSource();
            source.buffer = audioBuffer;
            source.connect(outputNode);
            source.start();

        } catch (e: any) {
            setError("TTS failed: " + e.message);
        }
    };

    const renderMessage = (msg: ChatMessage, index: number) => {
        const isUser = msg.role === Role.USER;
        return (
            <div key={index} className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-4`}>
                <div className={`max-w-xl p-4 rounded-lg ${isUser ? 'bg-indigo-600' : 'bg-slate-700'}`}>
                    <p className="whitespace-pre-wrap">{msg.text}</p>
                    {msg.role === Role.MODEL && (
                        <div className="flex items-center justify-between mt-2">
                             {msg.sources && msg.sources.length > 0 && (
                                <div className="text-xs text-slate-400 mt-2">
                                    <p className="font-bold mb-1">Sources:</p>
                                    <ul className="list-disc pl-4">
                                        {msg.sources.map((source: GroundingChunk, i) => {
                                            const uri = source.web?.uri || source.maps?.uri;
                                            const title = source.web?.title || source.maps?.title;
                                            if (!uri) return null;
                                            return (
                                                <li key={i}><a href={uri} target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:underline">{title}</a></li>
                                            )
                                        })}
                                    </ul>
                                </div>
                            )}
                            <button onClick={() => playTTS(msg.text)} className="p-1 rounded-full hover:bg-slate-600 transition-colors">
                                <PlayIcon className="w-5 h-5" />
                            </button>
                        </div>
                    )}
                </div>
            </div>
        );
    };

    return (
        <div className="h-full flex flex-col bg-slate-800 rounded-lg">
            <div className="p-4 border-b border-slate-700 flex items-center justify-between">
                <h2 className="text-xl font-bold">Chat</h2>
                <select value={mode} onChange={e => setMode(e.target.value as ChatMode)} className="bg-slate-700 border border-slate-600 rounded-md px-3 py-1 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none">
                    {Object.entries(modeConfig).map(([key, value]) => <option key={key} value={key}>{value.label}</option>)}
                </select>
            </div>
            <div className="flex-1 p-4 overflow-y-auto">
                {messages.length === 0 && !isLoading && <div className="text-center text-slate-400">Start a conversation!</div>}
                {messages.map(renderMessage)}
                {isLoading && (
                    <div className="flex justify-start mb-4">
                        <div className="max-w-xl p-4 rounded-lg bg-slate-700">
                            <div className="flex items-center">
                                <div className="w-2 h-2 bg-indigo-400 rounded-full animate-pulse mr-2"></div>
                                <div className="w-2 h-2 bg-indigo-400 rounded-full animate-pulse mr-2 delay-150"></div>
                                <div className="w-2 h-2 bg-indigo-400 rounded-full animate-pulse delay-300"></div>
                            </div>
                        </div>
                    </div>
                )}
                <div ref={chatEndRef} />
            </div>
            {error && <div className="p-4 text-red-400 border-t border-slate-700">{error}</div>}
            <div className="p-4 border-t border-slate-700">
                <div className="flex items-center bg-slate-700 rounded-lg">
                    <input
                        type="text"
                        value={prompt}
                        onChange={e => setPrompt(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleSendMessage()}
                        placeholder={modeConfig[mode].placeholder}
                        className="flex-1 bg-transparent p-4 focus:outline-none"
                        disabled={isLoading}
                    />
                    <button onClick={handleSendMessage} disabled={isLoading || !prompt.trim()} className="p-4 text-indigo-400 disabled:text-slate-500 hover:text-indigo-300 disabled:cursor-not-allowed">
                        Send
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ChatFeature;
