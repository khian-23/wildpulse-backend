import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { UsageService } from './usage.service';
import { AiUsage, AiUsageSchema } from './usage.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: AiUsage.name, schema: AiUsageSchema },
    ]),
  ],
  providers: [UsageService],
  exports: [UsageService],
})
export class UsageModule {}