import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
} from '@nestjs/common';
import { ChatService } from './chat.service.js';
import type { ChatResponseDto } from './chat.types.js';

/**
 * ChatController — fan-facing natural-language chat endpoint.
 *
 * POST /chat   → process a free-text fan message, return a natural-language reply
 *               plus optional structured sectionData for the frontend 3D view.
 */
@Controller('chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  async handleMessage(
    @Body() body: Record<string, unknown>,
  ): Promise<ChatResponseDto> {
    const message = String(body?.message ?? '').trim();

    if (!message) {
      return {
        reply: "Please type a message so I can help you find your seat!",
        sectionData: null,
      };
    }

    return this.chatService.handleMessage(message);
  }
}
