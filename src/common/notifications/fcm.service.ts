import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as admin from 'firebase-admin';
import { logger } from '../logger/wildpulse.logger';

export interface FcmCapturePayload {
  captureId: string;
  deviceId: string;
  species: string;
  confidence: number;
  imageUrl: string;
  capturedAt: string;
  shouldAlert: boolean;
  priority: string;
}

@Injectable()
export class FcmService {
  private messaging?: admin.messaging.Messaging;
  private initialized = false;

  constructor(private readonly configService: ConfigService) {
    this.initialize();
  }

  isEnabled() {
    return Boolean(this.messaging);
  }

  async sendCaptureNotification(tokens: string[], payload: FcmCapturePayload) {
    if (!this.messaging || tokens.length === 0) {
      return;
    }

    const title = payload.shouldAlert ? 'WildPulse Alert' : 'New Capture';
    const body = `${payload.species} • ${Math.round(payload.confidence * 100)}%`;

    try {
      const response = await this.messaging.sendEachForMulticast({
        tokens,
        notification: {
          title,
          body,
        },
        data: {
          captureId: payload.captureId,
          deviceId: payload.deviceId,
          species: payload.species,
          confidence: payload.confidence.toString(),
          imageUrl: payload.imageUrl,
          capturedAt: payload.capturedAt,
          shouldAlert: payload.shouldAlert ? 'true' : 'false',
          priority: payload.priority,
        },
      });

      if (response.failureCount > 0) {
        logger.warn('FCM send failures', {
          failureCount: response.failureCount,
        });
      }
    } catch (error) {
      logger.error('FCM send failed', { error });
    }
  }

  private initialize() {
    if (this.initialized) return;
    this.initialized = true;

    const jsonRaw = this.configService.get<string>(
      'FIREBASE_SERVICE_ACCOUNT_JSON',
    );
    const base64Raw = this.configService.get<string>(
      'FIREBASE_SERVICE_ACCOUNT_BASE64',
    );

    if (!jsonRaw && !base64Raw) {
      logger.warn('FCM disabled: missing service account');
      return;
    }

    try {
      const jsonString = jsonRaw
        ? jsonRaw
        : Buffer.from(base64Raw as string, 'base64').toString('utf8');
      const serviceAccount = JSON.parse(jsonString);

      if (admin.apps.length === 0) {
        admin.initializeApp({
          credential: admin.credential.cert(
            serviceAccount as admin.ServiceAccount,
          ),
        });
      }

      this.messaging = admin.messaging();
      logger.info('FCM initialized');
    } catch (error) {
      logger.error('FCM init failed', { error });
    }
  }
}
