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

@Injectable()
export class CapturesService {

  constructor(
    @InjectModel(Capture.name) private captureModel: Model<Capture>,
    private configService: ConfigService,
    private readonly aiService: AiService,
    private readonly usageService: UsageService,
    private readonly rulesService: RulesService,
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

  async handleUpload(file: Express.Multer.File, body: any) {

    const { device_id } = body;
    const confidence = Number(body.confidence);
    const species = body.species.toLowerCase().trim();

    // STEP 1 — Rule evaluation
    const decision = await this.rulesService.evaluate(
      species,
      confidence,
    );

    if (decision.status === 'discard') {

      logger.info('Capture discarded', {
        species,
        confidence,
        reason: decision.reason,
      });

      return {
        message: 'Capture discarded by rule engine',
        reason: decision.reason,
      };
    }

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
      status: decision.status,
      rule_reason: decision.reason,
    });

    await capture.save();

    logger.info('Capture saved', {
      capture_id: capture._id,
      device_id,
      status: capture.status,
    });

    // STEP 4 — Background AI processing
    this.processAIAsync(capture._id.toString()).catch((err) => {
      logger.error('AI background error', { err });
    });

    return {
      message: 'Upload received',
      capture,
    };
  }
}