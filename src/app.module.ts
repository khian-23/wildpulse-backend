import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';

import { CapturesModule } from './captures/captures.module';
import { DevicesModule } from './devices/devices.module';
import { AuthModule } from './auth/auth.module';
import { RulesModule } from './rules/rules.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),

    // 🔥 THIS IS THE MISSING PIECE
    MongooseModule.forRoot(process.env.MONGO_URI as string),

    CapturesModule,
    DevicesModule,
    AuthModule,
    RulesModule,
  ],
})
export class AppModule {}