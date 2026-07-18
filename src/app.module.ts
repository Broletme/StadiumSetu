import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ChatModule } from './chat/chat.module';
import { OpsModule } from './ops/ops.module';
import { ZonesModule } from './zones/zones.module';
import { CongestionModule } from './congestion/congestion.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true, // makes ConfigService available everywhere without importing ConfigModule
    }),
    ChatModule,
    OpsModule,
    ZonesModule,
    CongestionModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
