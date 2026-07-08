import { Module } from '@nestjs/common';
import { OpsController } from './ops.controller';
import { SupabaseAuthGuard } from './guards/supabase-auth.guard';
import { RolesGuard } from './guards/roles.guard';

@Module({
  controllers: [OpsController],
  providers: [SupabaseAuthGuard, RolesGuard],
  exports: [SupabaseAuthGuard],
})
export class OpsModule {}
