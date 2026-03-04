import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';

import { AppController } from './app.controller';  // ✅ IMPORTANT
import { CapturesModule } from './captures/captures.module';
import { DevicesModule } from './devices/devices.module';
import { AuthModule } from './auth/auth.module';
import { RulesModule } from './rules/rules.module';
import { Capture, CaptureSchema } from './schemas/capture.schema';
import { AiUsage, AiUsageSchema } from './usage/usage.schema';
import { PiCommand, PiCommandSchema } from './schemas/pi-command.schema';
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),

    MongooseModule.forRoot(process.env.MONGO_URI as string),

    ThrottlerModule.forRoot({
      throttlers: [
        {
          ttl: 60,
          limit: 60,
        },
      ],
    }),

    CapturesModule,
    DevicesModule,
    AuthModule,
    RulesModule,
    MongooseModule.forFeature([
      { name: Capture.name, schema: CaptureSchema },
      { name: AiUsage.name, schema: AiUsageSchema },
      { name: PiCommand.name, schema: PiCommandSchema },
    ]),
  ],
  controllers: [AppController],  // ✅ THIS
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
