import { Injectable } from '@nestjs/common';
import { RulesRepository } from './rules.repository';

export type RuleDecision =
  | 'discard'
  | 'needs_review'
  | 'approved';

@Injectable()
export class RulesService {
  constructor(
    private readonly rulesRepo: RulesRepository,
  ) {}

  async evaluate(
    species: string,
    confidence: number,
  ): Promise<{ status: RuleDecision; reason: string }> {

    const rule = await this.rulesRepo.findActiveBySpecies(species);

    if (!rule) {
      return { status: 'discard', reason: 'no_active_rule' };
    }

    if (confidence < rule.min_confidence) {
      return { status: 'discard', reason: 'below_min_confidence' };
    }

    if (confidence < rule.notify_threshold) {
      return { status: 'needs_review', reason: 'below_notify_threshold' };
    }

    return { status: 'approved', reason: 'threshold_met' };
  }
}