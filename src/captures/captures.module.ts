import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CapturesController } from './captures.controller';
import { CapturesService } from './captures.service';
import { Capture, CaptureSchema } from '../schemas/capture.schema';
import { RulesModule } from '../rules/rules.module';
import { AiModule } from '../ai/ai.module';
import { UsageModule } from '../usage/usage.module';
import { IntelligenceService } from './intelligence.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Capture.name, schema: CaptureSchema },
    ]),
    RulesModule,
    AiModule,
    UsageModule,
  ],
  controllers: [CapturesController],
  providers: [CapturesService, IntelligenceService],
})
export class CapturesModule {}
