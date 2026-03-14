import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type DeviceDocument = Device & Document;

@Schema({ timestamps: true, collection: 'devices' })
export class Device {
  @Prop({ required: true, unique: true, index: true })
  device_id!: string;

  @Prop()
  name?: string;

  @Prop()
  last_seen?: Date;

  @Prop({ type: Object, default: {} })
  metadata?: Record<string, any>;

  createdAt?: Date;
  updatedAt?: Date;
}

export const DeviceSchema = SchemaFactory.createForClass(Device);
