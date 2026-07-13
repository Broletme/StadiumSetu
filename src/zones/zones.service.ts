import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { SectionWithGateDto } from './zones.types.js';

@Injectable()
export class ZonesService {
  private readonly supabase: SupabaseClient;

  constructor(private readonly configService: ConfigService) {
    // Service-role client for unrestricted reads (bypasses RLS).
    // Uses the same env vars as SupabaseAuthGuard — no duplicate client registration needed.
    this.supabase = createClient(
      this.configService.getOrThrow<string>('SUPABASE_URL'),
      this.configService.getOrThrow<string>('SUPABASE_SERVICE_ROLE_KEY'),
    );
  }

  /**
   * Returns all sections with their nearest gate, ordered by section_index.
   * Used by the frontend to render the full stadium bowl map.
   */
  async allSections(): Promise<SectionWithGateDto[]> {
    const { data, error } = await this.supabase
      .from('sections')
      .select(
        `
        id,
        section_number,
        tier,
        section_index,
        nearest_gate_id,
        gate:nearest_gate_id (
          id,
          name,
          angle_deg,
          lat,
          lng
        )
      `,
      )
      .order('section_index', { ascending: true });

    if (error) {
      throw new Error(`Failed to fetch sections: ${error.message}`);
    }

    return (data ?? []) as unknown as SectionWithGateDto[];
  }

  /**
   * Finds a single section by its section_number and returns it with its
   * nearest gate. Throws NotFoundException if no matching section exists.
   *
   * @param sectionNumber - e.g. "L01", "U12"
   */
  async findSeat(sectionNumber: string): Promise<SectionWithGateDto> {
    const { data, error } = await this.supabase
      .from('sections')
      .select(
        `
        id,
        section_number,
        tier,
        section_index,
        nearest_gate_id,
        gate:nearest_gate_id (
          id,
          name,
          angle_deg,
          lat,
          lng
        )
      `,
      )
      .eq('section_number', sectionNumber)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to fetch section: ${error.message}`);
    }

    if (!data) {
      throw new NotFoundException(
        `Section "${sectionNumber}" not found`,
      );
    }

    return data as unknown as SectionWithGateDto;
  }
}
