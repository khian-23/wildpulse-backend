import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CapturesController } from './captures.controller';
import { CapturesService } from './captures.service';
import { Capture, CaptureSchema } from '../schemas/capture.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Capture.name, schema: CaptureSchema }
    ])
  ],
  controllers: [CapturesController],
  providers: [CapturesService],
})
export class CapturesModule {}