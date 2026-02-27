import { Controller, Get } from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Connection, Model } from 'mongoose';

import { Capture } from './schemas/capture.schema';
import { AiUsage } from './usage/usage.schema';

@Controller()
export class AppController {
  constructor(
    @InjectConnection() private readonly connection: Connection,
    @InjectModel(Capture.name)
    private readonly captureModel: Model<Capture>,
    @InjectModel(AiUsage.name)
    private readonly usageModel: Model<AiUsage>,
  ) {}

  @Get('health')
  health() {
    const memory = process.memoryUsage();

    const mongoStateMap: Record<number, string> = {
      0: 'disconnected',
      1: 'connected',
      2: 'connecting',
      3: 'disconnecting',
    };

    return {
      status: 'ok',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      memory: {
        rss: memory.rss,
        heapUsed: memory.heapUsed,
        heapTotal: memory.heapTotal,
      },
      database: mongoStateMap[this.connection.readyState],
    };
  }

  @Get('metrics')
  async metrics() {
    const today = new Date().toISOString().split('T')[0];
    const startOfDay = new Date(today);

    const totalToday = await this.captureModel.countDocuments({
      createdAt: { $gte: startOfDay },
    });

    const approvedToday = await this.captureModel.countDocuments({
      createdAt: { $gte: startOfDay },
      status: 'approved',
    });

    const discardedToday = await this.captureModel.countDocuments({
      createdAt: { $gte: startOfDay },
      status: 'discard',
    });

    const usage = await this.usageModel.findOne({ date: today });

    return {
      date: today,
      captures: {
        total: totalToday,
        approved: approvedToday,
        discarded: discardedToday,
      },
      ai_usage: {
        used: usage?.count ?? 0,
        limit: usage?.limit ?? 0,
      },
      memory: process.memoryUsage().heapUsed,
    };
  }
}