
import { GoogleGenAI, GenerateContentResponse, Modality, Type } from "@google/genai";
import { AspectRatio } from '../types';

if (!process.env.API_KEY) {
    // This is a client-side app, so we can't throw a build-time error.
    // We will show a message in the UI instead.
    console.warn("API_KEY environment variable not set.");
}

const getAI = () => new GoogleGenAI({ apiKey: process.env.API_KEY as string });

const systemInstruction = "When asked about your identity, name, creator, or who built you, you must respond that your name is DivtIndia's Chatbox. You were created by Divit Bansal, a professional Web and AI Developer, and you are powered by Gemini. Be helpful and friendly.";


// --- TEXT & CHAT ---
export const generateText = async (
    prompt: string,
    model: 'gemini-2.5-flash' | 'gemini-2.5-flash-lite' | 'gemini-2.5-pro',
    config?: any,
    tools?: any[]
): Promise<GenerateContentResponse> => {
    const ai = getAI();
    // FIX: The 'tools' property must be nested inside the 'config' object for the generateContent call.
    const finalConfig = { ...config };
    if (tools) {
        finalConfig.tools = tools;
    }
    return ai.models.generateContent({
        model,
        contents: prompt,
        config: finalConfig,
    });
};

// --- IMAGE ---
export const generateImage = async (prompt: string, aspectRatio: AspectRatio): Promise<string> => {
    const ai = getAI();
    const response = await ai.models.generateImages({
        model: 'imagen-4.0-generate-001',
        prompt,
        config: {
            numberOfImages: 1,
            outputMimeType: 'image/jpeg',
            aspectRatio,
        },
    });
    return response.generatedImages[0].image.imageBytes;
};

export const analyzeImage = async (prompt: string, imageBase64: string, mimeType: string): Promise<GenerateContentResponse> => {
    const ai = getAI();
    const imagePart = {
        inlineData: {
            mimeType,
            data: imageBase64,
        },
    };
    const textPart = { text: prompt };
    return ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: { parts: [imagePart, textPart] },
        config: { systemInstruction },
    });
};

export const editImage = async (prompt: string, imageBase64: string, mimeType: string): Promise<string> => {
    const ai = getAI();
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: {
            parts: [
                { inlineData: { data: imageBase64, mimeType } },
                { text: prompt },
            ],
        },
        config: {
            responseModalities: [Modality.IMAGE],
        },
    });
    const part = response.candidates[0]?.content?.parts[0];
    if (part && part.inlineData) {
        return part.inlineData.data;
    }
    throw new Error("No image data in response");
};


// --- VIDEO ---
export const generateVideoFromText = async (prompt: string, aspectRatio: '16:9' | '9:16') => {
    const ai = getAI();
    return ai.models.generateVideos({
        model: 'veo-3.1-fast-generate-preview',
        prompt,
        config: {
            numberOfVideos: 1,
            resolution: '720p',
            aspectRatio,
        }
    });
};

export const generateVideoFromImage = async (prompt: string, imageBase64: string, mimeType: string, aspectRatio: '16:9' | '9:16') => {
    const ai = getAI();
    return ai.models.generateVideos({
        model: 'veo-3.1-fast-generate-preview',
        prompt,
        image: {
            imageBytes: imageBase64,
            mimeType,
        },
        config: {
            numberOfVideos: 1,
            resolution: '720p',
            aspectRatio,
        }
    });
};

export const checkVideoOperation = async (operation: any) => {
    const ai = getAI();
    return ai.operations.getVideosOperation({ operation });
};

export const analyzeVideo = async (prompt: string, videoBase64: string, mimeType: string): Promise<GenerateContentResponse> => {
    const ai = getAI();
    // Note: This sends the whole video at once. For large videos, chunking would be needed.
    // The Gemini API currently supports videos up to 2GB and 15 mins.
    // For this example, we assume smaller videos that fit in a single request.
    const videoPart = {
        inlineData: {
            mimeType,
            data: videoBase64,
        },
    };
    const textPart = { text: prompt };
    return ai.models.generateContent({
        model: 'gemini-2.5-pro',
        contents: { parts: [videoPart, textPart] },
        config: { systemInstruction },
    });
};

// --- AUDIO ---
export const textToSpeech = async (text: string): Promise<string> => {
    const ai = getAI();
    const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: [{ parts: [{ text }] }],
        config: {
            responseModalities: [Modality.AUDIO],
            speechConfig: {
                voiceConfig: {
                    prebuiltVoiceConfig: { voiceName: 'Kore' },
                },
            },
        },
    });
    const part = response.candidates[0]?.content?.parts[0];
    if (part && part.inlineData) {
        return part.inlineData.data;
    }
    throw new Error("No audio data in response");
};

export const transcribeAudio = async (audioBase64: string, mimeType: string): Promise<GenerateContentResponse> => {
    const ai = getAI();
    const audioPart = {
        inlineData: {
            mimeType,
            data: audioBase64,
        },
    };
    const textPart = { text: "Transcribe this audio." };
    return ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: { parts: [audioPart, textPart] },
    });
};

export const getLiveSession = () => {
    const ai = getAI();
    return ai.live;
};
