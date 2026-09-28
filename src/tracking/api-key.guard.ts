import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';

@Injectable()
export class ApiKeyGuard implements CanActivate {
  private readonly logger = new Logger(ApiKeyGuard.name);
  private warnedOnce = false;

  canActivate(context: ExecutionContext): boolean {
    const apiKey = process.env.API_KEY;
    if (!apiKey) {
      if (!this.warnedOnce) {
        this.logger.warn(
          'API_KEY is not set — /tracking routes are unprotected. Set API_KEY in production.',
        );
        this.warnedOnce = true;
      }
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const provided = request.headers['x-api-key'];
    if (provided !== apiKey) {
      throw new UnauthorizedException({
        statusCode: 401,
        message: 'Invalid or missing API key',
      });
    }
    return true;
  }
}
