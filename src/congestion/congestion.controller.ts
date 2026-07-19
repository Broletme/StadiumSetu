import { Controller, Get, HttpCode, HttpStatus, Param, Patch, Post } from '@nestjs/common';
import { CongestionService } from './congestion.service.js';
import type {
  AlertRow,
  CongestionRow,
  SimulateSpikeResult,
} from './congestion.types.js';

/**
 * CongestionController — public (no auth guard) endpoints for the ops dashboard.
 *
 * Matches the pattern of ZonesController: reads are public because the ops
 * dashboard displays live data without per-user auth for viewing.
 *
 * GET  /congestion              → all section_congestion rows (with section info)
 * POST /congestion/simulate-spike → spike 1–3 random sections + generate AI alerts
 * POST /congestion/reset        → reset all sections to baseline (low, 10–30 devices)
 * GET  /alerts                  → last 20 alerts ordered newest first
 */
@Controller()
export class CongestionController {
  constructor(private readonly congestionService: CongestionService) {}

  /**
   * GET /congestion
   * Returns all 24 section_congestion rows joined with section_number and tier.
   */
  @Get('congestion')
  getAllCongestion(): Promise<CongestionRow[]> {
    return this.congestionService.getAllCongestion();
  }

  /**
   * POST /congestion/simulate-spike
   * Randomly spikes 1–3 sections to high congestion and generates Groq alerts.
   */
  @Post('congestion/simulate-spike')
  @HttpCode(HttpStatus.OK)
  simulateSpike(): Promise<SimulateSpikeResult> {
    return this.congestionService.simulateSpike();
  }

  /**
   * POST /congestion/reset
   * Resets all sections back to low congestion baseline. Useful for demos.
   */
  @Post('congestion/reset')
  @HttpCode(HttpStatus.OK)
  resetToNormal(): Promise<{ resetCount: number }> {
    return this.congestionService.resetToNormal();
  }

  /**
   * GET /alerts
   * Returns the 20 most recent unresolved AI-generated alerts, newest first.
   */
  @Get('alerts')
  getAlerts(): Promise<AlertRow[]> {
    return this.congestionService.getAlerts();
  }

  /**
   * PATCH /alerts/:id/resolve
   * Sets resolved = true on a single alert and returns the updated row.
   */
  @Patch('alerts/:id/resolve')
  resolveAlert(@Param('id') id: string): Promise<AlertRow> {
    return this.congestionService.resolveAlert(id);
  }

  /**
   * POST /alerts/resolve-by-section/:sectionId
   * Resolves all unresolved alerts for a given section_id in one call.
   * Returns the count of resolved alerts.
   */
  @Post('alerts/resolve-by-section/:sectionId')
  @HttpCode(HttpStatus.OK)
  bulkResolveBySection(@Param('sectionId') sectionId: string): Promise<{ resolved: number }> {
    return this.congestionService.bulkResolveBySection(sectionId);
  }
}
