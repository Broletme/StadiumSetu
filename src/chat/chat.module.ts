import { Module } from '@nestjs/common';
import { ChatController } from './chat.controller.js';
import { ChatService } from './chat.service.js';
import { ZonesModule } from '../zones/zones.module.js';

/**
 * ChatModule — imports ZonesModule so ChatService can inject ZonesService
 * without duplicating its Supabase client or repository logic.
 */
@Module({
  imports: [ZonesModule],
  controllers: [ChatController],
  providers: [ChatService],
})
export class ChatModule {}
