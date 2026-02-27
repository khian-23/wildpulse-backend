import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { SpeciesRule, SpeciesRuleDocument } from './rules.schema';

@Injectable()
export class RulesRepository {
  constructor(
    @InjectModel(SpeciesRule.name)
    private readonly ruleModel: Model<SpeciesRuleDocument>,
  ) {}

  async findActiveBySpecies(species: string) {
    return this.ruleModel.findOne({
      species,
      is_active: true,
    });
  }
}