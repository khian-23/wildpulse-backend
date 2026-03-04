import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type PiCommandDocument = PiCommand & Document;

@Schema({ timestamps: true, collection: 'pi_commands' })
export class PiCommand {
  @Prop({ required: true, index: true })
  device_id!: string;

  @Prop({ required: true })
  command!: string;

  @Prop({ type: Object, default: {} })
  payload?: Record<string, any>;

  @Prop({ required: true, default: 'queued' })
  status!: 'queued' | 'sent' | 'executed' | 'failed' | 'expired';

  @Prop({ required: true, index: true })
  expires_at!: Date;

  @Prop()
  sent_at?: Date;

  @Prop()
  acknowledged_at?: Date;

  @Prop()
  message?: string;

  createdAt?: Date;
  updatedAt?: Date;
}

export const PiCommandSchema = SchemaFactory.createForClass(PiCommand);
