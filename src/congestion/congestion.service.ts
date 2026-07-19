import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import Groq from 'groq-sdk';
import {
  AlertRow,
  CongestionRow,
  SimulateSpikeResult,
} from './congestion.types.js';

@Injectable()
export class CongestionService {
  private readonly logger = new Logger(CongestionService.name);
  private readonly supabase: SupabaseClient;
  private readonly groq: Groq;
  private readonly model = 'llama-3.3-70b-versatile';

  constructor(private readonly configService: ConfigService) {
    this.supabase = createClient(
      this.configService.getOrThrow<string>('SUPABASE_URL'),
      this.configService.getOrThrow<string>('SUPABASE_SERVICE_ROLE_KEY'),
    );
    this.groq = new Groq({
      apiKey: this.configService.getOrThrow<string>('GROQ_API_KEY'),
    });
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  /**
   * Returns all section_congestion rows joined with section_number and tier
   * from the sections table, ordered by section_index.
   */
  async getAllCongestion(): Promise<CongestionRow[]> {
    const { data, error } = await this.supabase
      .from('section_congestion')
      .select(
        `
        section_id,
        device_count,
        level,
        updated_at,
        section:section_id (
          section_number,
          tier,
          section_index
        )
      `,
      );

    if (error) {
      throw new Error(`Failed to fetch congestion data: ${error.message}`);
    }

    return ((data ?? []) as any[]).map((row) => ({
      section_id: row.section_id,
      device_count: row.device_count,
      level: row.level,
      updated_at: row.updated_at,
      section_number: row.section?.section_number ?? '',
      tier: row.section?.tier ?? '',
      section_index: row.section?.section_index ?? 0,
    }));
  }

  /**
   * Randomly selects 1–3 sections, spikes them to device_count 150–300 and
   * level 'high', generates a Groq-powered alert for each, and saves
   * everything to the DB.
   *
   * Returns the updated section rows + newly created alert rows.
   */
  async simulateSpike(): Promise<SimulateSpikeResult> {
    // Step 1 — fetch all section IDs with their section_numbers and gates
    const { data: sections, error: sectionsError } = await this.supabase
      .from('sections')
      .select('id, section_number, tier, section_index, gate:nearest_gate_id(name)');

    if (sectionsError || !sections?.length) {
      throw new Error(`Failed to fetch sections: ${sectionsError?.message}`);
    }

    // Step 2 — pick 1–3 random sections
    const shuffled = [...sections].sort(() => Math.random() - 0.5);
    const count = Math.floor(Math.random() * 3) + 1; // 1, 2, or 3
    const spiked = shuffled.slice(0, count);

    // Fetch all gates to pass to Groq to prevent hallucinations
    const { data: gates } = await this.supabase.from('gates').select('name');
    const allGateNames = gates?.map((g) => g.name).join(', ') ?? 'Gate A, Gate B, Gate C, Gate D';

    // Step 3 — build upsert payload
    const now = new Date().toISOString();
    const upsertRows = spiked.map((s) => ({
      section_id: s.id,
      device_count: Math.floor(Math.random() * 151) + 150, // 150–300
      level: 'high' as const,
      updated_at: now,
    }));

    const { data: updatedData, error: upsertError } = await this.supabase
      .from('section_congestion')
      .upsert(upsertRows, { onConflict: 'section_id' })
      .select('section_id, device_count, level, updated_at');

    if (upsertError) {
      throw new Error(`Failed to update congestion: ${upsertError.message}`);
    }

    // Step 4 — generate Groq alert for each spiked section
    const newAlerts: AlertRow[] = [];

    for (let i = 0; i < spiked.length; i++) {
      const section = spiked[i];
      const row = upsertRows[i];

      const alertMessage = await this.generateAlert(
        section.section_number,
        section.tier,
        row.device_count,
        (section as any).gate?.name ?? 'Unknown Gate',
        allGateNames
      );

      const { data: alertData, error: alertError } = await this.supabase
        .from('alerts')
        .insert({
          section_id: section.id,
          message: alertMessage,
          severity: 'high',
        })
        .select('id, section_id, message, severity, created_at, resolved')
        .single();

      if (alertError) {
        this.logger.error(
          `Failed to insert alert for section ${section.section_number}`,
          alertError,
        );
      } else if (alertData) {
        newAlerts.push(alertData as AlertRow);
      }
    }

    // Step 5 — build the full CongestionRow response for spiked sections
    const updatedSections: CongestionRow[] = (updatedData ?? []).map((row) => {
      const sec = spiked.find((s) => s.id === row.section_id);
      return {
        section_id: row.section_id,
        device_count: row.device_count,
        level: row.level as 'high',
        updated_at: row.updated_at,
        section_number: sec?.section_number ?? '',
        tier: (sec?.tier ?? '') as 'Lower Tier' | 'Upper Tier',
        section_index: sec?.section_index ?? 0,
      };
    });

    return { updatedSections, newAlerts };
  }

  /**
   * Resets all sections back to baseline: device_count 10–30, level 'low'.
   * Useful for demo resets between test runs.
   */
  async resetToNormal(): Promise<{ resetCount: number }> {
    const { data: sections, error: fetchError } = await this.supabase
      .from('sections')
      .select('id');

    if (fetchError || !sections?.length) {
      throw new Error(`Failed to fetch sections: ${fetchError?.message}`);
    }

    const now = new Date().toISOString();
    const rows = sections.map((s) => ({
      section_id: s.id,
      device_count: Math.floor(Math.random() * 21) + 10, // 10–30
      level: 'low' as const,
      updated_at: now,
    }));

    const { error: upsertError } = await this.supabase
      .from('section_congestion')
      .upsert(rows, { onConflict: 'section_id' });

    if (upsertError) {
      throw new Error(`Failed to reset congestion: ${upsertError.message}`);
    }

    this.logger.log(`Reset ${rows.length} sections to normal congestion`);
    return { resetCount: rows.length };
  }

  /**
   * Returns the 20 most recent unresolved alerts, newest first.
   */
  async getAlerts(): Promise<AlertRow[]> {
    const { data, error } = await this.supabase
      .from('alerts')
      .select('id, section_id, message, severity, created_at, resolved')
      .eq('resolved', false)
      .order('created_at', { ascending: false })
      .limit(20);

    if (error) {
      throw new Error(`Failed to fetch alerts: ${error.message}`);
    }

    return (data ?? []) as AlertRow[];
  }

  /**
   * Sets resolved = true on a single alert by ID.
   * Returns the updated alert row.
   */
  async resolveAlert(id: string): Promise<AlertRow> {
    const { data, error } = await this.supabase
      .from('alerts')
      .update({ resolved: true })
      .eq('id', id)
      .select('id, section_id, message, severity, created_at, resolved')
      .single();

    if (error) {
      throw new Error(`Failed to resolve alert: ${error.message}`);
    }

    return data as AlertRow;
  }

  /**
   * Resolves all unresolved alerts for a given section_id.
   * Returns the count of resolved alerts.
   */
  async bulkResolveBySection(sectionId: string): Promise<{ resolved: number }> {
    const { data, error } = await this.supabase
      .from('alerts')
      .update({ resolved: true })
      .eq('section_id', sectionId)
      .eq('resolved', false)
      .select('id');

    if (error) {
      throw new Error(`Failed to resolve alerts for section: ${error.message}`);
    }

    return { resolved: data?.length ?? 0 };
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  /**
   * Calls Groq to generate a short, specific, actionable 2-sentence alert
   * for a section that just crossed into high congestion.
   */
  private async generateAlert(
    sectionNumber: string,
    tier: string,
    deviceCount: number,
    actualGateName: string,
    allGateNames: string
  ): Promise<string> {
    const systemPrompt = `You are a crowd safety AI for a FIFA World Cup 2026 stadium.
Generate a short, specific, actionable crowd-management alert.
Respond with EXACTLY 2 sentences:
- Sentence 1: describe what is happening (include the section number, tier, and exactly the detected device count provided). Do NOT invent any estimated fan counts.
- Sentence 2: give a concrete recommended action (e.g., redirect incoming fans, deploy crowd-control staff, open overflow access points).

CRITICAL RULE:
This stadium has exactly these gates: ${allGateNames}.
Section ${sectionNumber}'s nearest gate is ${actualGateName}.
When recommending fans be redirected, you may ONLY reference these real gate names. DO NOT invent gate numbers (like "Gate 17") or names that don't exist. If recommending an alternate gate away from congestion, pick one of the other real gates. Write for ops staff reading a dashboard.`;

    const userPrompt = `Section ${sectionNumber} (${tier}) has reached ${deviceCount} detected mobile devices, indicating severe overcrowding.`;

    try {
      const completion = await this.groq.chat.completions.create({
        model: this.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.6,
        max_tokens: 150,
      });

      return (
        completion.choices[0]?.message?.content?.trim() ??
        `Section ${sectionNumber} is critically overcrowded with ${deviceCount} detected devices. Immediately redirect incoming fans and deploy crowd-control staff to this section.`
      );
    } catch (err) {
      this.logger.error(
        `Groq alert generation failed for section ${sectionNumber}`,
        err,
      );
      return `Section ${sectionNumber} is critically overcrowded with ${deviceCount} detected devices. Immediately redirect incoming fans and deploy crowd-control staff to this section.`;
    }
  }
}
