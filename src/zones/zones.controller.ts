import { Controller, Get, Param } from '@nestjs/common';
import { ZonesService } from './zones.service.js';
import { SectionWithGateDto } from './zones.types.js';

/**
 * ZonesController — public (no auth guard) endpoints for seat/gate navigation.
 *
 * GET /zones                    → all sections with nearest gate
 * GET /zones/seat/:sectionNumber → single section lookup by section number
 */
@Controller('zones')
export class ZonesController {
  constructor(private readonly zonesService: ZonesService) {}

  /**
   * GET /zones
   * Returns all 24 sections ordered by section_index, each with gate data.
   * Used by the frontend to render the full stadium bowl wayfinding map.
   */
  @Get()
  getAllSections(): Promise<SectionWithGateDto[]> {
    return this.zonesService.allSections();
  }

  /**
   * GET /zones/seat/:sectionNumber
   * Returns a single section by its section_number (e.g. L01, U12).
   * Returns 404 if the section does not exist.
   */
  @Get('seat/:sectionNumber')
  getSeat(
    @Param('sectionNumber') sectionNumber: string,
  ): Promise<SectionWithGateDto> {
    return this.zonesService.findSeat(sectionNumber);
  }
}
