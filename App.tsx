import React, { useState } from 'react';
import { Feature } from './types';
import ChatFeature from './components/ChatFeature';
import ImageFeature from './components/ImageFeature';
import VideoFeature from './components/VideoFeature';
import LiveFeature from './components/LiveFeature';
import TranscriptionFeature from './components/TranscriptionFeature';
import { ChatIcon, ImageIcon, VideoIcon, MicIcon, TranscriptionIcon } from './components/common/Icons';

declare global {
    interface AIStudio {
        hasSelectedApiKey: () => Promise<boolean>;
        openSelectKey: () => Promise<void>;
    }
    interface Window {
        // Fix: Made aistudio optional to avoid declaration conflicts.
        aistudio?: AIStudio;
        webkitAudioContext: typeof AudioContext;
    }
}

const featureConfig = {
    [Feature.CHAT]: { component: ChatFeature, icon: ChatIcon },
    [Feature.IMAGE]: { component: ImageFeature, icon: ImageIcon },
    [Feature.VIDEO]: { component: VideoFeature, icon: VideoIcon },
    [Feature.LIVE]: { component: LiveFeature, icon: MicIcon },
    [Feature.TRANSCRIPTION]: { component: TranscriptionFeature, icon: TranscriptionIcon },
};

const App: React.FC = () => {
    const [activeFeature, setActiveFeature] = useState<Feature>(Feature.CHAT);

    const ActiveComponent = featureConfig[activeFeature].component;

    if (!process.env.API_KEY) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-900 text-white p-4">
                <div className="text-center p-8 bg-slate-800 rounded-lg shadow-2xl border border-slate-700">
                    <h1 className="text-3xl font-bold text-red-500 mb-4">Configuration Error</h1>
                    <p className="text-slate-300">The Gemini API key is missing.</p>
                    <p className="text-slate-400 mt-2">Please ensure the <code>API_KEY</code> environment variable is set.</p>
                </div>
            </div>
        );
    }
    
    return (
        <div className="h-screen w-screen flex flex-col md:flex-row bg-slate-900 text-white font-sans">
            {/* Sidebar */}
            <nav className="w-full md:w-64 bg-slate-950 flex-shrink-0 flex md:flex-col justify-between">
                <div>
                    <div className="p-4 mb-4 flex items-center border-b border-slate-800">
                         <div className="bg-indigo-600 p-2 rounded-lg">
                            <svg className="w-6 h-6 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                               <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 0 0-2.456 2.456Z" />
                            </svg>
                        </div>
                        <h1 className="text-xl font-bold ml-3 hidden md:block">DivtIndia's Chatbox</h1>
                    </div>
                    <ul className="flex flex-row md:flex-col p-2 md:p-4">
                        {(Object.values(Feature)).map(feature => {
                            const { icon: Icon } = featureConfig[feature];
                            const isActive = activeFeature === feature;
                            return (
                                <li key={feature} className="flex-1 md:flex-auto">
                                    <button
                                        onClick={() => setActiveFeature(feature)}
                                        className={`w-full flex items-center justify-center md:justify-start p-3 my-1 rounded-lg transition-all duration-200 ease-in-out transform hover:scale-105 ${isActive ? 'bg-indigo-600 text-white shadow-lg' : 'hover:bg-slate-800 text-slate-400'}`}
                                        aria-current={isActive ? 'page' : undefined}
                                    >
                                        <Icon className="w-6 h-6" />
                                        <span className="ml-4 hidden md:block">{feature}</span>
                                    </button>
                                </li>
                            );
                        })}
                    </ul>
                </div>
                <div className="hidden md:block p-4 border-t border-slate-800 text-center text-xs text-slate-500">
                    <p>Created by Divit Bansal</p>
                    <p>Powered by Gemini</p>
                </div>
            </nav>

            {/* Main Content */}
            <main className="flex-1 p-2 md:p-4 overflow-hidden">
                <div className="h-full w-full">
                   <ActiveComponent />
                </div>
            </main>
        </div>
    );
};

export default App;