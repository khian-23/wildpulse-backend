import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CapturesController } from './captures.controller';
import { CapturesService } from './captures.service';
import { Capture, CaptureSchema } from '../schemas/capture.schema';
import { Device, DeviceSchema } from '../schemas/device.schema';
import { RulesModule } from '../rules/rules.module';
import { AiModule } from '../ai/ai.module';
import { UsageModule } from '../usage/usage.module';
import { IntelligenceService } from './intelligence.service';
import { FcmService } from '../common/notifications/fcm.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Capture.name, schema: CaptureSchema },
      { name: Device.name, schema: DeviceSchema },
    ]),
    RulesModule,
    AiModule,
    UsageModule,
  ],
  controllers: [CapturesController],
  providers: [CapturesService, IntelligenceService, FcmService],
})
export class CapturesModule {}
