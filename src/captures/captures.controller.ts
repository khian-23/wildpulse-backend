import {
  Controller,
  Post,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  Body
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { DeviceGuard } from '../common/guards/device.guard';
import { CapturesService } from './captures.service';

@Controller('captures')
export class CapturesController {

  constructor(private readonly capturesService: CapturesService) {}

  @Post('upload')
  @UseGuards(DeviceGuard)
  @UseInterceptors(FileInterceptor('image'))
  async upload(
    @UploadedFile() file: Express.Multer.File,
    @Body() body: any,
  ) {
    return this.capturesService.handleUpload(file, body);
  }
}