import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';

@Injectable()
export class DeviceGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {

    const request = context.switchToHttp().getRequest();
    const apiKey = request.headers['x-device-key'];

    if (!apiKey || apiKey !== process.env.DEVICE_MASTER_SECRET) {
      throw new UnauthorizedException('Invalid device key');
    }

    return true;
  }
}