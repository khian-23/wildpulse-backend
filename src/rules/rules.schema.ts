import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type SpeciesRuleDocument = SpeciesRule & Document;

@Schema({ timestamps: true, collection: 'species_rules' })
export class SpeciesRule {

  @Prop({ required: true, unique: true })
  species: string;

  @Prop({ required: true })
  min_confidence: number;

  @Prop({ required: true })
  notify_threshold: number;

  @Prop({ default: true })
  is_active: boolean;

  @Prop({ default: 1 })
  priority: number;
}

export const SpeciesRuleSchema =
  SchemaFactory.createForClass(SpeciesRule);

  SpeciesRuleSchema.index(
  { species: 1, is_active: 1 },
  { background: true }
);