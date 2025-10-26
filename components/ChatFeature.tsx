import React, { useState, useRef, useEffect } from 'react';
import type { ChatMessage, GroundingChunk } from '../types';
import { Role } from '../types';
import * as geminiService from '../services/geminiService';
import { decode, decodeAudioData } from '../utils/media';
import { PlayIcon, CopyIcon } from './common/Icons';

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
    const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
    const chatEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const handleSendMessage = async () => {
        if (!prompt.trim() || isLoading) return;
        const userMessage: ChatMessage = { role: Role.USER, text: prompt };
        setMessages(prev => [...prev, userMessage]);
        const currentPrompt = prompt;
        setPrompt('');
        setIsLoading(true);
        setError(null);

        try {
            const { model, config, tools } = modeConfig[mode];
            const response = await geminiService.generateText(currentPrompt, model, config, tools);
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
            const audioBuffer = await decodeAudioData(decode(audioBase64), outputAudioContext, 24000, 1);
            const source = outputAudioContext.createBufferSource();
            source.buffer = audioBuffer;
            source.connect(outputAudioContext.destination);
            source.start();
        } catch (e: any) {
            setError("TTS failed: " + e.message);
        }
    };
    
    const copyToClipboard = (text: string, index: number) => {
        navigator.clipboard.writeText(text);
        setCopiedIndex(index);
        setTimeout(() => setCopiedIndex(null), 2000);
    };

    const renderMessage = (msg: ChatMessage, index: number) => {
        const isUser = msg.role === Role.USER;
        return (
            <div key={index} className={`flex items-end ${isUser ? 'justify-end' : 'justify-start'} mb-4`}>
                <div className={`max-w-xl p-4 rounded-lg shadow-md ${isUser ? 'bg-indigo-600 rounded-br-none' : 'bg-slate-700 rounded-bl-none'}`}>
                    <p className="whitespace-pre-wrap">{msg.text}</p>
                    {msg.role === Role.MODEL && msg.text && (
                        <div className="mt-3 border-t border-slate-600/50 pt-2 flex items-center justify-between">
                             {msg.sources && msg.sources.length > 0 ? (
                                <div className="text-xs text-slate-400">
                                    <p className="font-bold mb-1">Sources:</p>
                                    <ul className="list-disc pl-4 space-y-1">
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
                            ) : <div />}
                            <div className="flex items-center space-x-2 self-end">
                                <button onClick={() => copyToClipboard(msg.text, index)} className="p-1 rounded-full hover:bg-slate-600 transition-colors" title="Copy text">
                                    {copiedIndex === index ? 
                                        <span className="text-xs text-indigo-400 px-1">Copied!</span> : 
                                        <CopyIcon className="w-5 h-5 text-slate-400" />
                                    }
                                </button>
                                <button onClick={() => playTTS(msg.text)} className="p-1 rounded-full hover:bg-slate-600 transition-colors" title="Read aloud">
                                    <PlayIcon className="w-5 h-5 text-slate-400" />
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        );
    };

    return (
        <div className="h-full flex flex-col bg-slate-800 rounded-xl">
            <header className="p-4 border-b border-slate-700 flex items-center justify-between flex-shrink-0">
                <h2 className="text-xl font-bold">Chat</h2>
                <div className="relative">
                    <select value={mode} onChange={e => setMode(e.target.value as ChatMode)} className="bg-slate-700 border border-slate-600 rounded-md px-3 py-1.5 text-sm appearance-none focus:ring-2 focus:ring-indigo-500 focus:outline-none">
                        {Object.entries(modeConfig).map(([key, value]) => <option key={key} value={key}>{value.label}</option>)}
                    </select>
                </div>
            </header>
            <main className="flex-1 p-4 overflow-y-auto">
                {messages.length === 0 && !isLoading && <div className="text-center text-slate-400 pt-8">Start a conversation!</div>}
                {messages.map(renderMessage)}
                {isLoading && (
                    <div className="flex justify-start mb-4">
                        <div className="max-w-xl p-4 rounded-lg bg-slate-700 rounded-bl-none">
                            <div className="flex items-center">
                                <span className="text-slate-300 mr-3">DivtIndia's Chatbox is typing</span>
                                <div className="w-2 h-2 bg-indigo-400 rounded-full animate-pulse-fast"></div>
                                <div className="w-2 h-2 bg-indigo-400 rounded-full animate-pulse-fast" style={{animationDelay: '0.2s'}}></div>
                                <div className="w-2 h-2 bg-indigo-400 rounded-full animate-pulse-fast" style={{animationDelay: '0.4s'}}></div>
                            </div>
                        </div>
                    </div>
                )}
                <div ref={chatEndRef} />
            </main>
            {error && <div className="p-4 text-red-400 border-t border-slate-700 flex-shrink-0">{error}</div>}
            <footer className="p-4 border-t border-slate-700 flex-shrink-0">
                <div className="flex items-center bg-slate-700 rounded-lg">
                    <input
                        type="text"
                        value={prompt}
                        onChange={e => setPrompt(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleSendMessage())}
                        placeholder={modeConfig[mode].placeholder}
                        className="flex-1 bg-transparent p-4 focus:outline-none resize-none"
                        disabled={isLoading}
                    />
                    <button onClick={handleSendMessage} disabled={isLoading || !prompt.trim()} className="p-4 text-indigo-400 disabled:text-slate-500 hover:text-indigo-300 disabled:cursor-not-allowed transition-colors">
                        Send
                    </button>
                </div>
            </footer>
        </div>
    );
};

export default ChatFeature;
