
import React, { useState, useRef } from 'react';
import * as geminiService from '../services/geminiService';
import { fileToBase64 } from '../utils/media';
import { MicIcon, StopIcon } from './common/Icons';

const TranscriptionFeature: React.FC = () => {
    const [isRecording, setIsRecording] = useState(false);
    const [isTranscribing, setIsTranscribing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [transcription, setTranscription] = useState('');

    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<globalThis.Blob[]>([]);
    const micStreamRef = useRef<MediaStream | null>(null);

    const startRecording = async () => {
        setError(null);
        setTranscription('');
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            micStreamRef.current = stream;
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
                
                micStreamRef.current?.getTracks().forEach(track => track.stop());
            };

            mediaRecorderRef.current.start();
            setIsRecording(true);
        } catch (e: any) {
            setError(`Could not start recording: ${e.message}`);
        }
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
            mediaRecorderRef.current.stop();
            setIsRecording(false);
        }
    };

    return (
        <div className="h-full flex flex-col bg-slate-800 rounded-lg">
            <div className="p-4 border-b border-slate-700">
                 <h2 className="text-xl font-bold">Audio Transcription</h2>
            </div>
            <div className="flex-1 p-4 flex flex-col items-center justify-center">
                <div className="text-center">
                    <button onClick={isRecording ? stopRecording : startRecording} className={`p-4 rounded-full transition-colors ${isRecording ? 'bg-red-600 hover:bg-red-700' : 'bg-indigo-600 hover:bg-indigo-700'}`}>
                        {isRecording ? <StopIcon className="w-12 h-12" /> : <MicIcon className="w-12 h-12" />}
                    </button>
                    <p className="mt-4 text-slate-400">{isRecording ? "Recording..." : "Start Recording"}</p>
                    {isTranscribing && <p className="mt-2 text-indigo-400 animate-pulse">Transcribing...</p>}
                </div>
                {error && <p className="text-red-400 text-sm mt-4 text-center">{error}</p>}
                <div className="w-full max-w-2xl mt-8 overflow-y-auto">
                    {transcription && (
                        <div>
                            <h3 className="text-lg font-bold mb-2">Result:</h3>
                            <p className="bg-slate-700 p-4 rounded-lg whitespace-pre-wrap">{transcription}</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default TranscriptionFeature;