import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AiUsage, AiUsageDocument } from './usage.schema';

@Injectable()
export class UsageService {

  constructor(
    @InjectModel(AiUsage.name)
    private usageModel: Model<AiUsageDocument>,
  ) {}

  private getToday(): string {
    return new Date().toISOString().split('T')[0];
  }

    async tryConsume(): Promise<boolean> {
    const today = this.getToday();

    const usage = await this.usageModel.findOne({ date: today });

    // If no document → create fresh one
    if (!usage) {
        await this.usageModel.create({
        date: today,
        count: 1,
        limit: 100, // set your daily limit
        });
        return true;
    }

    // If limit reached → block
    if (usage.count >= usage.limit) {
        return false;
    }

    // Otherwise increment safely
    await this.usageModel.updateOne(
        { date: today },
        { $inc: { count: 1 } }
    );

    return true;
    }
}