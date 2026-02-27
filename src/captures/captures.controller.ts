import {
  Controller,
  Post,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  Body,
  UsePipes,
  ValidationPipe,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import { memoryStorage } from 'multer';

import { DeviceGuard } from '../common/guards/device.guard';
import { CapturesService } from './captures.service';
import { UploadDto } from './dto/upload.dto';

@Controller('captures')
export class CapturesController {

  constructor(
    private readonly capturesService: CapturesService,
  ) {}

  @Post('upload')
  @UseGuards(DeviceGuard)
  @UsePipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  )
  @UseInterceptors(
    FileInterceptor('image', {
      storage: memoryStorage(),
      limits: {
        fileSize: 5 * 1024 * 1024, // 5MB
      },
      fileFilter: (req, file, callback) => {
        if (file.mimetype !== 'image/jpeg') {
          return callback(
            new BadRequestException('Only JPEG images allowed'),
            false,
          );
        }
        callback(null, true);
      },
    }),
  )
  @Throttle({ default: { limit: 30, ttl: 60 } })
  async upload(
    @UploadedFile() file: Express.Multer.File,
    @Body() body: UploadDto,
  ) {
    if (!file) {
      throw new BadRequestException('Image file is required');
    }

    return this.capturesService.handleUpload(file, body);
  }
}