import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type CaptureDocument = Capture & Document;

@Schema({ timestamps: true })
export class Capture {

  @Prop({ required: true })
  device_id!: string;

  @Prop({ required: true })
  species!: string;

  @Prop({ required: true })
  confidence!: number;

  @Prop({ required: true })
  image_url!: string;

  @Prop({ required: true })
  status!: string;

  @Prop()
  rule_reason?: string;

  @Prop()
  ai_summary?: string;
}

export const CaptureSchema =
  SchemaFactory.createForClass(Capture);