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

  @Prop()
  captured_at?: Date;

  @Prop()
  zone_id?: string;

  @Prop({ default: false })
  is_night?: boolean;

  @Prop({ default: 0 })
  risk_score?: number;

  @Prop({ type: [String], default: [] })
  risk_reasons?: string[];

  @Prop({ default: false })
  is_unusual?: boolean;

  @Prop({ default: false })
  should_alert?: boolean;

  @Prop({ default: 'low' })
  priority?: string;

  createdAt?: Date;
  updatedAt?: Date;
}

export const CaptureSchema =
  SchemaFactory.createForClass(Capture);
