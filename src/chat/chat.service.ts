import {
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import Groq from 'groq-sdk';
import { ZonesService } from '../zones/zones.service.js';
import { SectionWithGateDto } from '../zones/zones.types.js';
import {
  ChatResponseDto,
  GroqIntentResult,
} from './chat.types.js';

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);
  private readonly groq: Groq;
  private readonly supabase: SupabaseClient;
  private readonly model = 'llama-3.3-70b-versatile';

  constructor(
    private readonly configService: ConfigService,
    private readonly zonesService: ZonesService,
  ) {
    this.groq = new Groq({
      apiKey: this.configService.getOrThrow<string>('GROQ_API_KEY'),
    });
    this.supabase = createClient(
      this.configService.getOrThrow<string>('SUPABASE_URL'),
      this.configService.getOrThrow<string>('SUPABASE_SERVICE_ROLE_KEY'),
    );
  }

  // ── Public entry point ─────────────────────────────────────────────────────

  async handleMessage(userId: string, message: string): Promise<ChatResponseDto> {
    // Step 1 — Extract intent + section number via Groq
    let intent: GroqIntentResult;
    try {
      intent = await this.extractIntent(message);
    } catch (err) {
      this.logger.error('Groq intent extraction failed', err);
      const response = {
        reply:
          "I'm having trouble connecting to the assistant right now. Please try again in a moment.",
        sectionData: null,
      };
      this.saveMessages(userId, message, response).catch((e) => 
        this.logger.error('Failed to save chat messages', e)
      );
      return response;
    }

    const { intent: intentType, sectionNumber, detectedLanguage } = intent;

    // Step 2 — Branch on intent
    let response: ChatResponseDto;
    
    if (intentType === 'SEAT_LOOKUP' && sectionNumber) {
      response = await this.handleSeatLookup(sectionNumber, detectedLanguage);
    } else if (intentType === 'GENERAL_HELP') {
      response = await this.handleGeneralHelp(detectedLanguage);
    } else {
      // OUT_OF_SCOPE
      response = await this.handleOutOfScope(detectedLanguage);
    }

    this.saveMessages(userId, message, response).catch((e) => 
      this.logger.error('Failed to save chat messages', e)
    );

    return response;
  }

  // ── Intent extraction ──────────────────────────────────────────────────────

  private async extractIntent(message: string): Promise<GroqIntentResult> {
    const systemPrompt = `You are a stadium navigation assistant for FIFA World Cup 2026. 
Analyze the user's message and respond ONLY with a valid JSON object — no markdown, no code blocks, no preamble.

The JSON must have exactly these fields:
- "intent": one of "SEAT_LOOKUP" | "GENERAL_HELP" | "OUT_OF_SCOPE"
  - SEAT_LOOKUP: user mentions a specific seat/section (e.g. "L02", "section 210", "my seat is U04", "sección L05")
  - GENERAL_HELP: user asks for help navigating the stadium but doesn't specify a section
  - OUT_OF_SCOPE: message is unrelated to stadium navigation (weather, sports scores, personal questions, etc.)
- "sectionNumber": extracted section identifier as a string (e.g. "L02", "U04"), or null if none found.
  Normalise to uppercase, strip whitespace. If user says "section 210" extract "210".
- "detectedLanguage": ISO 639-1 code of the language the user wrote in (e.g. "en", "hi", "es", "fr", "ar")

Example valid response:
{"intent":"SEAT_LOOKUP","sectionNumber":"L02","detectedLanguage":"en"}`;

    const completion = await this.groq.chat.completions.create({
      model: this.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: message },
      ],
      temperature: 0,
      max_tokens: 120,
    });

    const raw = completion.choices[0]?.message?.content ?? '';
    return this.parseIntentJson(raw);
  }

  private parseIntentJson(raw: string): GroqIntentResult {
    // Strip accidental markdown fences if the model ignored instructions
    const cleaned = raw
      .replace(/```json/gi, '')
      .replace(/```/g, '')
      .trim();

    try {
      const parsed = JSON.parse(cleaned) as GroqIntentResult;
      // Validate shape
      if (
        !['SEAT_LOOKUP', 'GENERAL_HELP', 'OUT_OF_SCOPE'].includes(parsed.intent)
      ) {
        throw new Error('Unknown intent value');
      }
      return {
        intent: parsed.intent,
        sectionNumber: parsed.sectionNumber ?? null,
        detectedLanguage: parsed.detectedLanguage ?? 'en',
      };
    } catch (err) {
      this.logger.warn(`Failed to parse Groq intent JSON: "${raw}"`, err);
      // Fallback — treat as general help in English
      return { intent: 'GENERAL_HELP', sectionNumber: null, detectedLanguage: 'en' };
    }
  }

  // ── Seat lookup handler ────────────────────────────────────────────────────

  private async handleSeatLookup(
    sectionNumber: string,
    lang: string,
  ): Promise<ChatResponseDto> {
    let sectionData: SectionWithGateDto | null = null;
    let reply: string;

    try {
      sectionData = await this.zonesService.findSeat(sectionNumber.toUpperCase());
      reply = await this.generateFoundReply(sectionData, lang);
    } catch (err) {
      if (err instanceof NotFoundException) {
        reply = await this.generateNotFoundReply(sectionNumber, lang);
      } else {
        this.logger.error('ZonesService.findSeat failed', err);
        reply = await this.generateNotFoundReply(sectionNumber, lang);
      }
    }

    return { reply, sectionData };
  }

  private async generateFoundReply(
    section: SectionWithGateDto,
    lang: string,
  ): Promise<string> {
    const prompt = `You are a friendly, concise stadium navigation assistant. 
Respond in the language with ISO 639-1 code: "${lang}".
Write a single short sentence (max 2 sentences) telling the fan their section info.
Section number: ${section.section_number}
Tier: ${section.tier}
Nearest gate: ${section.gate.name}
Do NOT include any JSON or technical formatting — just a natural, warm reply.`;

    try {
      const completion = await this.groq.chat.completions.create({
        model: this.model,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.6,
        max_tokens: 120,
      });
      return (
        completion.choices[0]?.message?.content?.trim() ??
        `Section ${section.section_number} is in the ${section.tier}. Head to ${section.gate.name} — it's your nearest entrance.`
      );
    } catch (err) {
      this.logger.error('Groq reply generation failed', err);
      return `Section ${section.section_number} is in the ${section.tier}. Head to ${section.gate.name} — it's your nearest entrance.`;
    }
  }

  private async generateNotFoundReply(
    sectionNumber: string,
    lang: string,
  ): Promise<string> {
    const prompt = `You are a friendly stadium navigation assistant.
Respond in the language with ISO 639-1 code: "${lang}".
Tell the fan that section "${sectionNumber}" could not be found in the stadium, and ask them to double-check and try again.
Keep it warm and short (1-2 sentences). No JSON.`;

    try {
      const completion = await this.groq.chat.completions.create({
        model: this.model,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.6,
        max_tokens: 100,
      });
      return (
        completion.choices[0]?.message?.content?.trim() ??
        `I couldn't find section "${sectionNumber}". Please double-check the number and try again!`
      );
    } catch (err) {
      this.logger.error('Groq not-found reply generation failed', err);
      return `I couldn't find section "${sectionNumber}". Please double-check the number and try again!`;
    }
  }

  // ── General help handler ───────────────────────────────────────────────────

  private async handleGeneralHelp(lang: string): Promise<ChatResponseDto> {
    const prompt = `You are a friendly stadium navigation assistant for FIFA World Cup 2026 venues.
Respond in the language with ISO 639-1 code: "${lang}".
The fan needs help but hasn't told you their seat/section number yet.
Write 1-2 short, warm sentences asking them to share their section number so you can guide them to the nearest gate.
No JSON, no technical terms.`;

    let reply: string;
    try {
      const completion = await this.groq.chat.completions.create({
        model: this.model,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
        max_tokens: 100,
      });
      reply =
        completion.choices[0]?.message?.content?.trim() ??
        "I'd love to help you find your seat! Could you share your section number? (e.g. L01, U12)";
    } catch (err) {
      this.logger.error('Groq general help reply failed', err);
      reply =
        "I'd love to help you find your seat! Could you share your section number? (e.g. L01, U12)";
    }

    return { reply, sectionData: null };
  }

  // ── Out-of-scope handler ───────────────────────────────────────────────────

  private async handleOutOfScope(lang: string): Promise<ChatResponseDto> {
    const prompt = `You are a stadium navigation assistant for FIFA World Cup 2026 venues.
Respond in the language with ISO 639-1 code: "${lang}".
The fan's message is unrelated to stadium navigation or seat finding.
Politely redirect them back to stadium-related topics in 1-2 short, friendly sentences.
Don't answer the unrelated question. No JSON.`;

    let reply: string;
    try {
      const completion = await this.groq.chat.completions.create({
        model: this.model,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
        max_tokens: 100,
      });
      reply =
        completion.choices[0]?.message?.content?.trim() ??
        "I'm only able to help with stadium navigation! Share your section number and I'll guide you to the right gate.";
    } catch (err) {
      this.logger.error('Groq out-of-scope reply failed', err);
      reply =
        "I'm only able to help with stadium navigation! Share your section number and I'll guide you to the right gate.";
    }

    return { reply, sectionData: null };
  }
  // ── Database operations ────────────────────────────────────────────────────

  private async saveMessages(userId: string, userMessage: string, assistantResponse: ChatResponseDto) {
    const { error } = await this.supabase.from('chat_messages').insert([
      {
        user_id: userId,
        role: 'user',
        content: userMessage,
        section_data: null,
      },
      {
        user_id: userId,
        role: 'assistant',
        content: assistantResponse.reply,
        section_data: assistantResponse.sectionData ?? null,
      },
    ]);

    if (error) {
      throw error;
    }
  }

  async getHistory(userId: string) {
    const { data, error } = await this.supabase
      .from('chat_messages')
      .select('role, content, section_data, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: true });

    if (error) {
      this.logger.error('Failed to fetch chat history', error);
      throw new Error('Could not fetch chat history');
    }

    return data;
  }
}
