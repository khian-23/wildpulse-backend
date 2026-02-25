import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ timestamps: true })
export class Capture extends Document {

  @Prop({ required: true })
  device_id: string;

  @Prop({ required: true })
  species: string;

  @Prop({ required: true })
  confidence: number;

  @Prop({ required: true })
  image_url: string;

  @Prop({ default: 'pending' })
  status: string; // approved | needs_review | discarded
}

export const CaptureSchema = SchemaFactory.createForClass(Capture);