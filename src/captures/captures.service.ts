import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Capture } from '../schemas/capture.schema';
import { Model } from 'mongoose';
import { v2 as cloudinary } from 'cloudinary';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class CapturesService {

  constructor(
    @InjectModel(Capture.name) private captureModel: Model<Capture>,
    private configService: ConfigService,
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

    const { device_id, species, confidence } = body;

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

    const capture = new this.captureModel({
      device_id,
      species,
      confidence,
      image_url: uploadResult.secure_url,
      status: 'pending',
    });

    await capture.save();

    return { message: 'Upload received', capture };
  }
}
