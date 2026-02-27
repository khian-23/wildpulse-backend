import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  SpeciesRule,
  SpeciesRuleSchema
} from './rules.schema';
import { RulesService } from './rules.service';
import { RulesRepository } from './rules.repository';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: SpeciesRule.name, schema: SpeciesRuleSchema },
    ]),
  ],
  providers: [RulesService, RulesRepository],
  exports: [RulesService],
})
export class RulesModule {}