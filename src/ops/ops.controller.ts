import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { SupabaseAuthGuard, OpsUser } from './guards/supabase-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { Roles } from './decorators/roles.decorator';

interface CreateIncidentDto {
  type: string;
  description: string;
  zone?: string;
  severity?: 'low' | 'medium' | 'high' | 'critical';
}

@Controller('ops')
@UseGuards(SupabaseAuthGuard, RolesGuard)
export class OpsController {
  /**
   * GET /ops/me — returns the authenticated ops user's profile.
   * Useful for the frontend to display role/zone info.
   */
  @Get('me')
  getMe(@Request() req: { user: OpsUser }) {
    return { user: req.user };
  }

  /**
   * POST /ops/incidents — create an incident report.
   *
   * Role restrictions:
   *   - type === "security"  → only admin
   *   - all other types     → any valid ops role
   *
   * SupabaseAuthGuard ensures the user has a valid token AND is in ops_users.
   * The security-type restriction is enforced inline here (not via @Roles)
   * because it depends on the request body, not just the user's role.
   */
  @Post('incidents')
  @Roles('admin', 'zone_lead', 'medical', 'security')
  createIncident(
    @Body() dto: CreateIncidentDto,
    @Request() req: { user: OpsUser },
  ) {
    if (dto.type === 'security' && req.user.role !== 'admin') {
      throw new ForbiddenException(
        'Only admins can create security-type incidents',
      );
    }

    // TODO: persist to DB via a service/repository
    return {
      success: true,
      message: 'Incident created',
      incident: {
        ...dto,
        createdBy: req.user.userId,
        createdByRole: req.user.role,
      },
    };
  }
}
