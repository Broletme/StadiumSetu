/**
 * chat.types.ts
 *
 * Shared TypeScript interfaces for the Chat module.
 * Mirrors the Groq structured-output contract and the endpoint response shape.
 */

/** Intent categories returned by the first Groq call */
export type ChatIntent = 'SEAT_LOOKUP' | 'GENERAL_HELP' | 'OUT_OF_SCOPE';

/** Parsed result of the first Groq call (intent extraction) */
export interface GroqIntentResult {
  intent: ChatIntent;
  sectionNumber: string | null;
  detectedLanguage: string;
}

/** Shape of the POST /chat request body */
export interface ChatMessageDto {
  message: string;
}

/** Shape of the POST /chat response */
export interface ChatResponseDto {
  reply: string;
  sectionData: object | null;
}
