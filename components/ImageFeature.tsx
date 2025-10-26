
import React, { useState, useEffect } from 'react';
import type { AspectRatio } from '../types';
import * as geminiService from '../services/geminiService';
import { fileToBase64 } from '../utils/media';

type ImageMode = 'generate' | 'analyze' | 'edit';
const aspectRatios: AspectRatio[] = ["1:1", "16:9", "9:16", "4:3", "3:4"];

const ImageFeature: React.FC = () => {
    const [mode, setMode] = useState<ImageMode>('generate');
    const [prompt, setPrompt] = useState('');
    const [aspectRatio, setAspectRatio] = useState<AspectRatio>('1:1');
    const [inputFile, setInputFile] = useState<File | null>(null);
    const [inputImageUrl, setInputImageUrl] = useState<string | null>(null);
    const [outputImageUrl, setOutputImageUrl] = useState<string | null>(null);
    const [analysisResult, setAnalysisResult] = useState<string>('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [apiKeySelected, setApiKeySelected] = useState(false);

    useEffect(() => {
        const checkKey = async () => {
            if (mode === 'generate' && window.aistudio) {
                if (await window.aistudio.hasSelectedApiKey()) {
                    setApiKeySelected(true);
                } else {
                    setApiKeySelected(false);
                }
            }
        };
        checkKey();
    }, [mode]);

    const handleSelectKey = async () => {
        if (window.aistudio) {
            await window.aistudio.openSelectKey();
            // Assume success to avoid race condition
            setApiKeySelected(true);
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setInputFile(file);
            setInputImageUrl(URL.createObjectURL(file));
        }
    };

    const resetState = () => {
        setOutputImageUrl(null);
        setAnalysisResult('');
        setError(null);
    };

    const handleSubmit = async () => {
        if (isLoading || !prompt) return;
        if (mode !== 'generate' && !inputFile) {
            setError('Please upload an image.');
            return;
        }

        setIsLoading(true);
        resetState();

        try {
            if (mode === 'generate') {
                const base64Image = await geminiService.generateImage(prompt, aspectRatio);
                setOutputImageUrl(`data:image/jpeg;base64,${base64Image}`);
            } else if (mode === 'analyze' && inputFile) {
                const imageBase64 = await fileToBase64(inputFile);
                const response = await geminiService.analyzeImage(prompt, imageBase64, inputFile.type);
                setAnalysisResult(response.text);
            } else if (mode === 'edit' && inputFile) {
                const imageBase64 = await fileToBase64(inputFile);
                const editedImageBase64 = await geminiService.editImage(prompt, imageBase64, inputFile.type);
                setOutputImageUrl(`data:image/png;base64,${editedImageBase64}`);
            }
        } catch (e: any) {
            if (mode === 'generate' && e.message?.includes("Requested entity was not found.")) {
                setError("API Key error. Please select a key from a billed project and try again.");
                setApiKeySelected(false);
            } else {
                setError(e.message || "An error occurred.");
            }
            console.error(e);
        } finally {
            setIsLoading(false);
        }
    };
    
    if (mode === 'generate' && !apiKeySelected) {
        return (
            <div className="h-full flex flex-col items-center justify-center bg-slate-800 rounded-lg p-8 text-center">
                <h2 className="text-2xl font-bold mb-4">API Key Required for Imagen</h2>
                <p className="text-slate-400 mb-6 max-w-md">Image generation with Imagen requires you to select an API key from a project with billing enabled.</p>
                <p className="text-xs text-slate-500 mb-6">Learn more about billing at <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:underline">ai.google.dev/gemini-api/docs/billing</a></p>
                <button onClick={handleSelectKey} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-6 rounded-lg transition-colors">Select API Key</button>
                {error && <p className="text-red-400 text-sm mt-4">{error}</p>}
            </div>
        );
    }

    return (
        <div className="h-full flex flex-col bg-slate-800 rounded-lg">
            <div className="p-4 border-b border-slate-700">
                <div className="flex space-x-2 bg-slate-700 p-1 rounded-lg max-w-xs">
                    {(['generate', 'analyze', 'edit'] as ImageMode[]).map(m => (
                        <button key={m} onClick={() => setMode(m)} className={`flex-1 capitalize text-sm py-2 rounded-md transition-colors ${mode === m ? 'bg-indigo-600' : 'hover:bg-slate-600'}`}>{m}</button>
                    ))}
                </div>
            </div>
            <div className="flex-1 p-4 overflow-y-auto flex flex-col md:flex-row gap-4">
                <div className="md:w-1/2 flex flex-col gap-4">
                    {mode !== 'generate' && (
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-2">Upload Image</label>
                            <input type="file" accept="image/*" onChange={handleFileChange} className="w-full text-sm text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"/>
                        </div>
                    )}
                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">Prompt</label>
                        <textarea value={prompt} onChange={e => setPrompt(e.target.value)} rows={4} placeholder={
                            mode === 'generate' ? "A photorealistic image of a cat wearing a tiny wizard hat..." :
                            mode === 'analyze' ? "What is the main subject of this image?" :
                            "Add sunglasses to the person in the image."
                        } className="w-full bg-slate-700 rounded-md p-2 focus:ring-2 focus:ring-indigo-500 focus:outline-none" />
                    </div>
                     {mode === 'generate' && (
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-2">Aspect Ratio</label>
                            <div className="flex flex-wrap gap-2">
                                {aspectRatios.map(ar => (
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
                    {isLoading ? <div className="text-slate-400">Processing...</div> : (
                        <>
                           {mode !== 'generate' && inputImageUrl && (
                               <div className="w-full mb-4">
                                   <h3 className="text-lg font-bold mb-2">Input</h3>
                                   <img src={inputImageUrl} alt="Input" className="max-w-full max-h-64 rounded-lg object-contain mx-auto" />
                               </div>
                           )}
                           {outputImageUrl && (
                               <div className="w-full">
                                    <h3 className="text-lg font-bold mb-2">{mode === 'edit' ? 'Edited Image' : 'Generated Image'}</h3>
                                    <img src={outputImageUrl} alt="Output" className="max-w-full max-h-64 rounded-lg object-contain mx-auto" />
                                </div>
                           )}
                           {analysisResult && (
                                <div className="w-full">
                                    <h3 className="text-lg font-bold mb-2">Analysis Result</h3>
                                    <p className="text-slate-300 whitespace-pre-wrap">{analysisResult}</p>
                                </div>
                           )}
                           {!inputImageUrl && !outputImageUrl && !analysisResult && <p className="text-slate-500">Output will appear here</p>}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ImageFeature;