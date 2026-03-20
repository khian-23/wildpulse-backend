import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Capture } from '../schemas/capture.schema';
import { Model } from 'mongoose';
import { v2 as cloudinary } from 'cloudinary';
import { ConfigService } from '@nestjs/config';
import { RulesService } from '../rules/rules.service';
import { AiService } from '../ai/ai.service';
import { UsageService } from '../usage/usage.service';
import { logger } from '../common/logger/wildpulse.logger';
import { IntelligenceService } from './intelligence.service';
import { Device } from '../schemas/device.schema';
import { FcmService } from '../common/notifications/fcm.service';

@Injectable()
export class CapturesService {

  constructor(
    @InjectModel(Capture.name) private captureModel: Model<Capture>,
    @InjectModel(Device.name) private deviceModel: Model<Device>,
    private configService: ConfigService,
    private readonly aiService: AiService,
    private readonly usageService: UsageService,
    private readonly rulesService: RulesService,
    private readonly intelligenceService: IntelligenceService,
    private readonly fcmService: FcmService,
  ) {

    const cloudName = this.configService.get<string>('CLOUDINARY_CLOUD_NAME');
    const apiKey = this.configService.get<string>('CLOUDINARY_API_KEY');
    const apiSecret = this.configService.get<string>('CLOUDINARY_API_SECRET');

    if (!cloudName || !apiKey || !apiSecret) {
      throw new Error('Missing Cloudinary configuration');
    }

    cloudinary.config({
      cloud_name: cloudName,
      api_key: apiKey,
      api_secret: apiSecret,
    });
  }

  private async notifyCapture(capture: Capture) {
    if (!this.fcmService.isEnabled()) {
      return;
    }

    const deviceId = capture.device_id;
    if (!deviceId) {
      return;
    }

    const device = await this.deviceModel.findOne(
      { device_id: deviceId },
      { fcm_tokens: 1 },
    ).lean();
    const tokens =
      device?.fcm_tokens?.map((entry) => entry.token).filter(Boolean) ?? [];
    if (tokens.length === 0) {
      return;
    }

    await this.fcmService.sendCaptureNotification(tokens, {
      captureId: String(capture._id),
      deviceId,
      species: capture.species,
      confidence: capture.confidence,
      imageUrl: capture.image_url,
      capturedAt: (capture.captured_at ?? capture.createdAt ?? new Date())
        .toISOString(),
      shouldAlert: Boolean(capture.should_alert),
      priority: capture.priority ?? 'low',
    });
  }

  /*
  ─────────────────────────────
  BACKGROUND AI PROCESSING
  ─────────────────────────────
  */

  private async processAIAsync(captureId: string) {
    try {
      const consumed = await this.usageService.tryConsume();

      if (!consumed) {
        logger.warn('AI usage limit reached', { captureId });
        return;
      }

      const capture = await this.captureModel.findById(captureId);
      if (!capture) return;

      const summary = await this.aiService.generateSummary(
        capture.species,
        capture.confidence,
      );

      capture.ai_summary = summary;
      await capture.save();

      logger.info('AI summary generated', {
        capture_id: capture._id,
      });

    } catch (error) {
      logger.error('AI processing failed', { error, captureId });
    }
  }

  /*
  ─────────────────────────────
  IMAGE UPLOAD HANDLER
  ─────────────────────────────
  */

  async handleUpload(file: Express.Multer.File, body: any) {

    const { device_id } = body;
    const confidence = Number(body.confidence);

    const species = body.species
      .toLowerCase()
      .replace(/_/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    const zoneId = body.zone_id?.trim();
    const capturedAt = body.captured_at
      ? new Date(body.captured_at)
      : new Date();

    // STEP 1 — Rule evaluation
    const decision = await this.rulesService.evaluate(
      species,
      confidence,
    );

    const resolvedStatus = 'needs_review';
    const resolvedReason = `review_required:${decision.reason}`;

    // STEP 2 — Upload to Cloudinary
    const uploadResult: any = await new Promise((resolve, reject) => {

      const stream = cloudinary.uploader.upload_stream(
        { folder: 'wildpulse' },
        (error, result) => {

          if (error) return reject(error);
          if (!result) return reject(new Error('Upload failed'));

          resolve(result);
        },
      );

      stream.end(file.buffer);
    });

    // STEP 3 — Save capture
    const capture = new this.captureModel({
      device_id,
      species,
      confidence,
      image_url: uploadResult.secure_url,
      status: resolvedStatus,
      rule_reason: resolvedReason,
      captured_at: capturedAt,
      zone_id: zoneId,

      ...this.intelligenceService.score({
        species,
        confidence,
        capturedAt,
        zoneId,
      }),
    });

    await capture.save();

    logger.info('Capture saved', {
      capture_id: capture._id,
      device_id,
      status: capture.status,
      rule_reason: capture.rule_reason,
      risk_score: capture.risk_score,
      should_alert: capture.should_alert,
      priority: capture.priority,
    });

    this.notifyCapture(capture).catch((error) => {
      logger.error('FCM notify failed', {
        error,
        capture_id: capture._id,
        device_id,
      });
    });

    if (capture.should_alert) {
      logger.warn('Smart alert triggered', {
        capture_id: capture._id,
        device_id,
        species,
        risk_score: capture.risk_score,
        risk_reasons: capture.risk_reasons,
        zone_id: capture.zone_id,
      });
    }

    // STEP 4 — Background AI processing
    this.processAIAsync(capture._id.toString()).catch((err) => {
      logger.error('AI background error', { err });
    });

    return {
      message: 'Upload received',
      capture,
    };
  }

  /*
  ─────────────────────────────
  DAILY REPORT
  ─────────────────────────────
  */

  async getDailyReport(date?: string) {

    const targetDate = date ? new Date(date) : new Date();

    const start = new Date(targetDate);
    start.setHours(0, 0, 0, 0);

    const end = new Date(targetDate);
    end.setHours(23, 59, 59, 999);

    const captures = await this.captureModel.find({
      captured_at: {
        $gte: start,
        $lte: end,
      },
    });

    const alerts = captures.filter(c => c.should_alert).length;

    const unusual = captures.filter(c => c.priority === 'high').length;

    return {
      date: start.toISOString().slice(0, 10),

      totals: {
        captures: captures.length,
        alerts,
        unusual,
      },

      summary: `${captures.length} wildlife captures detected on this date.`,
    };
  }
}
