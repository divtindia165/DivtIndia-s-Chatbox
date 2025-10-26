
import React, { useState, useEffect } from 'react';
import * as geminiService from '../services/geminiService';
import { fileToBase64 } from '../utils/media';

type VideoMode = 'generate-text' | 'generate-image' | 'analyze';
type VideoAspectRatio = '16:9' | '9:16';

const videoGenLoadingMessages = [
    "Warming up the virtual cameras...",
    "Rendering the first few frames...",
    "Compositing digital effects...",
    "This can take a few minutes. Great art takes time!",
    "Almost there, adding the finishing touches...",
    "Finalizing the video stream...",
];

const VideoFeature: React.FC = () => {
    const [mode, setMode] = useState<VideoMode>('generate-text');
    const [prompt, setPrompt] = useState('');
    const [aspectRatio, setAspectRatio] = useState<VideoAspectRatio>('16:9');
    const [inputFile, setInputFile] = useState<File | null>(null);
    const [inputFileUrl, setInputFileUrl] = useState<string | null>(null);
    const [outputVideoUrl, setOutputVideoUrl] = useState<string | null>(null);
    const [analysisResult, setAnalysisResult] = useState<string>('');
    const [isLoading, setIsLoading] = useState(false);
    const [loadingMessage, setLoadingMessage] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [apiKeySelected, setApiKeySelected] = useState(false);

    useEffect(() => {
        const checkKey = async () => {
            if (window.aistudio && await window.aistudio.hasSelectedApiKey()) {
                setApiKeySelected(true);
            }
        };
        checkKey();
    }, []);

    const handleSelectKey = async () => {
        if(window.aistudio) {
            await window.aistudio.openSelectKey();
            // Assume success to avoid race condition
            setApiKeySelected(true);
        }
    };
    
    useEffect(() => {
        let interval: number;
        if (isLoading && (mode === 'generate-text' || mode === 'generate-image')) {
            setLoadingMessage(videoGenLoadingMessages[0]);
            let i = 1;
            interval = window.setInterval(() => {
                setLoadingMessage(videoGenLoadingMessages[i % videoGenLoadingMessages.length]);
                i++;
            }, 5000);
        }
        return () => clearInterval(interval);
    }, [isLoading, mode]);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setInputFile(file);
            setInputFileUrl(URL.createObjectURL(file));
        }
    };

    const pollOperation = async (operation: any) => {
        while (!operation.done) {
            await new Promise(resolve => setTimeout(resolve, 10000));
            try {
                operation = await geminiService.checkVideoOperation(operation);
            } catch (e: any) {
                if (e.message?.includes("Requested entity was not found.")) {
                    setError("API Key error. Please re-select your API key.");
                    setApiKeySelected(false);
                } else {
                    setError(`Polling failed: ${e.message}`);
                }
                return null;
            }
        }
        return operation;
    };

    const handleSubmit = async () => {
        if (isLoading || !prompt) return;
        if ((mode === 'generate-image' || mode === 'analyze') && !inputFile) {
            setError('Please upload a file.');
            return;
        }

        setIsLoading(true);
        setError(null);
        setOutputVideoUrl(null);
        setAnalysisResult('');

        try {
            if (mode === 'generate-text' || mode === 'generate-image') {
                let operation;
                if(mode === 'generate-text'){
                    operation = await geminiService.generateVideoFromText(prompt, aspectRatio);
                } else if(inputFile) {
                    const imageBase64 = await fileToBase64(inputFile);
                    operation = await geminiService.generateVideoFromImage(prompt, imageBase64, inputFile.type, aspectRatio);
                }
                
                if (operation) {
                    const finalOperation = await pollOperation(operation);
                    if (finalOperation?.response?.generatedVideos?.[0]?.video?.uri) {
                        const downloadLink = finalOperation.response.generatedVideos[0].video.uri;
                        // Appending API key is crucial for access
                        const videoResponse = await fetch(`${downloadLink}&key=${process.env.API_KEY}`);
                        const videoBlob = await videoResponse.blob();
                        setOutputVideoUrl(URL.createObjectURL(videoBlob));
                    } else if (finalOperation) {
                        setError("Video generation finished but no video URI was found.");
                    }
                }
            } else if (mode === 'analyze' && inputFile) {
                const videoBase64 = await fileToBase64(inputFile);
                const response = await geminiService.analyzeVideo(prompt, videoBase64, inputFile.type);
                setAnalysisResult(response.text);
            }
        } catch (e: any) {
             if (e.message?.includes("Requested entity was not found.")) {
                setError("API Key error. Please re-select your API key and try again.");
                setApiKeySelected(false);
            } else {
                setError(e.message || "An error occurred.");
            }
            console.error(e);
        } finally {
            setIsLoading(false);
            setLoadingMessage('');
        }
    };
    
    if (!apiKeySelected && (mode === 'generate-text' || mode === 'generate-image')) {
        return (
            <div className="h-full flex flex-col items-center justify-center bg-slate-800 rounded-lg p-8 text-center">
                <h2 className="text-2xl font-bold mb-4">API Key Required for Veo</h2>
                <p className="text-slate-400 mb-6 max-w-md">Video generation with Veo requires you to select an API key from a project with billing enabled.</p>
                <p className="text-xs text-slate-500 mb-6">Learn more about billing at <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:underline">ai.google.dev/gemini-api/docs/billing</a></p>
                <button onClick={handleSelectKey} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-6 rounded-lg transition-colors">Select API Key</button>
            </div>
        );
    }
    
    return (
        <div className="h-full flex flex-col bg-slate-800 rounded-lg">
            <div className="p-4 border-b border-slate-700">
                <div className="flex space-x-2 bg-slate-700 p-1 rounded-lg max-w-md">
                    {(['generate-text', 'generate-image', 'analyze'] as VideoMode[]).map(m => (
                        <button key={m} onClick={() => setMode(m)} className={`flex-1 capitalize text-sm py-2 rounded-md transition-colors ${mode === m ? 'bg-indigo-600' : 'hover:bg-slate-600'}`}>{m.replace('-', ' ')}</button>
                    ))}
                </div>
            </div>
            <div className="flex-1 p-4 overflow-y-auto flex flex-col md:flex-row gap-4">
                <div className="md:w-1/2 flex flex-col gap-4">
                    {(mode === 'generate-image' || mode === 'analyze') && (
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-2">Upload {mode === 'generate-image' ? 'Image' : 'Video'}</label>
                            <input type="file" accept={mode === 'generate-image' ? "image/*" : "video/*"} onChange={handleFileChange} className="w-full text-sm text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"/>
                        </div>
                    )}
                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">Prompt</label>
                        <textarea value={prompt} onChange={e => setPrompt(e.target.value)} rows={4} placeholder="An astronaut riding a horse on Mars..." className="w-full bg-slate-700 rounded-md p-2 focus:ring-2 focus:ring-indigo-500 focus:outline-none" />
                    </div>
                     {(mode === 'generate-text' || mode === 'generate-image') && (
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-2">Aspect Ratio</label>
                            <div className="flex gap-2">
                                {(['16:9', '9:16'] as VideoAspectRatio[]).map(ar => (
                                    <button key={ar} onClick={() => setAspectRatio(ar)} className={`px-3 py-1 text-sm rounded-full transition-colors ${aspectRatio === ar ? 'bg-indigo-600' : 'bg-slate-700 hover:bg-slate-600'}`}>{ar}</button>
                                ))}
                            </div>
                        </div>
                    )}
                    <button onClick={handleSubmit} disabled={isLoading} className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-600 disabled:cursor-not-allowed text-white font-bold py-2 px-4 rounded-lg transition-colors">
                        {isLoading ? 'Processing...' : 'Submit'}
                    </button>
                    {error && <p className="text-red-400 text-sm mt-2">{error}</p>}
                </div>
                <div className="md:w-1/2 flex flex-col items-center justify-center bg-slate-900/50 rounded-lg p-4 min-h-[300px]">
                    {isLoading ? <div className="text-center text-slate-400">{loadingMessage || 'Processing...'}</div> : (
                        <>
                           {(mode === 'generate-image' || mode === 'analyze') && inputFileUrl && (
                               <div className="w-full mb-4">
                                   <h3 className="text-lg font-bold mb-2">Input</h3>
                                   {inputFile?.type.startsWith('image') ?
                                       <img src={inputFileUrl} alt="Input" className="max-w-full max-h-48 rounded-lg object-contain mx-auto" /> :
                                       <video src={inputFileUrl} controls className="max-w-full max-h-48 rounded-lg object-contain mx-auto" />
                                    }
                               </div>
                           )}
                           {outputVideoUrl && (
                               <div className="w-full">
                                    <h3 className="text-lg font-bold mb-2">Generated Video</h3>
                                    <video src={outputVideoUrl} controls autoPlay loop className="w-full rounded-lg" />
                                </div>
                           )}
                           {analysisResult && (
                                <div className="w-full">
                                    <h3 className="text-lg font-bold mb-2">Analysis Result</h3>
                                    <p className="text-slate-300 whitespace-pre-wrap">{analysisResult}</p>
                                </div>
                           )}
                           {!inputFileUrl && !outputVideoUrl && !analysisResult && <p className="text-slate-500">Output will appear here</p>}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default VideoFeature;
