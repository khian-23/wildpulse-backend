import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Capture } from '../schemas/capture.schema';
import { Model } from 'mongoose';
import { v2 as cloudinary } from 'cloudinary';
import { ConfigService } from '@nestjs/config';
import { RulesService } from '../rules/rules.service';

@Injectable()
export class CapturesService {

  constructor(
    @InjectModel(Capture.name) private captureModel: Model<Capture>,
    private configService: ConfigService,
    private readonly rulesService: RulesService,   // ✅ ADD THIS
  ) {
    const cloudName = this.configService.get<string>('CLOUDINARY_CLOUD_NAME');
    const apiKey = this.configService.get<string>('CLOUDINARY_API_KEY');
    const apiSecret = this.configService.get<string>('CLOUDINARY_API_SECRET');

    if (!cloudName || !apiKey || !apiSecret) {
      throw new Error('Missing Cloudinary configuration in environment variables');
    }

    cloudinary.config({
      cloud_name: cloudName,
      api_key: apiKey,
      api_secret: apiSecret,
    });
  }

  async handleUpload(file: Express.Multer.File, body: any) {

    const { device_id } = body;
    const confidence = Number(body.confidence);
    const species = body.species.toLowerCase().trim();
    // 🔥 STEP 1 — Evaluate Rule FIRST
    const decision = await this.rulesService.evaluate(
      species,
      confidence,
    );
    // 🔴 If discard → stop here
    if (decision.status === 'discard') {

      console.log({
        event: 'capture_discarded',
        species,
        confidence,
      });

      return {
        message: 'Capture discarded by rule engine',
        reason: decision.reason,
      };
    }

    // 🔥 STEP 2 — Upload only if not discarded
    const uploadResult: any = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { folder: 'wildpulse' },
        (error, result) => {
          if (error) return reject(error);
          if (!result) return reject(new Error('Upload failed'));
          resolve(result);
        }
      );

      stream.end(file.buffer);
    });

    // 🔥 STEP 3 — Save with rule status
    const capture = new this.captureModel({
      device_id,
      species,
      confidence,
      image_url: uploadResult.secure_url,
      status: decision.status,
      rule_reason: decision.reason,
    });

    await capture.save();

    console.log({
      event: 'capture_saved',
      capture_id: capture._id,
      status: capture.status,
    });

    return {
      message: 'Upload received',
      capture,
    };
  }
}