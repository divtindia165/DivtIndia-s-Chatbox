export enum Feature {
  CHAT = 'Chat',
  IMAGE = 'Image Tools',
  VIDEO = 'Video Tools',
  LIVE = 'Live Audio',
  TRANSCRIPTION = 'Transcription',
}

export enum Role {
    USER = "user",
    MODEL = "model"
}

export interface ChatMessage {
    role: Role;
    text: string;
    sources?: GroundingChunk[];
}

export type AspectRatio = "1:1" | "16:9" | "9:16" | "4:3" | "3:4";

export interface GroundingChunk {
    web?: {
        uri: string;
        title: string;
    };
    maps?: {
        uri: string;
        title: string;
        placeAnswerSources?: {
            reviewSnippets?: {
                uri: string;
                title: string;
                text: string;
            }[];
        }[]
    };
}
