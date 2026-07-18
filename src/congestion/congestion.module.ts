import { Module } from '@nestjs/common';
import { CongestionController } from './congestion.controller.js';
import { CongestionService } from './congestion.service.js';

/**
 * CongestionModule — isolated module for per-section crowd congestion tracking.
 *
 * ConfigModule is global, so no explicit import needed here.
 * No auth guard is applied at the controller level (matches ZonesModule pattern).
 */
@Module({
  controllers: [CongestionController],
  providers: [CongestionService],
})
export class CongestionModule {}
