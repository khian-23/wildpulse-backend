import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type AiUsageDocument = AiUsage & Document;

@Schema({ collection: 'ai_usage' })
export class AiUsage {

  @Prop({ required: true, unique: true })
  date!: string;

  @Prop({ default: 0 })
  count!: number;

  @Prop({ default: 100 })
  limit!: number;
}

export const AiUsageSchema =
  SchemaFactory.createForClass(AiUsage);