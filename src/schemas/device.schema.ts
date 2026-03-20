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

  @Prop()
  lat?: number;

  @Prop()
  lng?: number;

  @Prop({
    type: [
      {
        token: { type: String, required: true },
        platform: { type: String },
        last_seen: { type: Date },
      },
    ],
    default: [],
  })
  fcm_tokens?: { token: string; platform?: string; last_seen?: Date }[];

  @Prop({ type: Object, default: {} })
  metadata?: Record<string, any>;

  createdAt?: Date;
  updatedAt?: Date;
}

export const DeviceSchema = SchemaFactory.createForClass(Device);
