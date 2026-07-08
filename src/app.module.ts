import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { OpsModule } from './ops/ops.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true, // makes ConfigService available everywhere without importing ConfigModule
    }),
    OpsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
