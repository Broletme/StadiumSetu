import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as jwt from 'jsonwebtoken';
import { createClient } from '@supabase/supabase-js';

export interface OpsUser {
  userId: string;
  role: string | null;
  assignedZone: string | null;
}

@Injectable()
export class SupabaseAuthGuard implements CanActivate {
  private supabase;

  constructor(private readonly configService: ConfigService) {
    // Service role client for reading ops_users table
    this.supabase = createClient(
      this.configService.getOrThrow<string>('SUPABASE_URL'),
      this.configService.getOrThrow<string>('SUPABASE_SERVICE_ROLE_KEY'),
    );
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const authHeader: string | undefined = request.headers['authorization'];

    if (!authHeader?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing or malformed Authorization header');
    }

    const token = authHeader.slice(7);
    const jwtSecret = this.configService.getOrThrow<string>('SUPABASE_JWT_SECRET');

    // Verify the Supabase JWT offline using the project JWT secret
    let payload: jwt.JwtPayload;
    try {
      payload = jwt.verify(token, jwtSecret) as jwt.JwtPayload;
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }

    const userId = payload.sub;
    if (!userId) {
      throw new UnauthorizedException('Token missing subject claim');
    }

    // Look up the user's role from ops_users
    const { data, error } = await this.supabase
      .from('ops_users')
      .select('role, assigned_zone')
      .eq('auth_id', userId)
      .single();

    if (error || !data) {
      throw new ForbiddenException('User is not registered as an ops user');
    }

    // Attach user context to the request for downstream use
    const opsUser: OpsUser = {
      userId,
      role: data.role,
      assignedZone: data.assigned_zone,
    };
    request.user = opsUser;

    return true;
  }
}
