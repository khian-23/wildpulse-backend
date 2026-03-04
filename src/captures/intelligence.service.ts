import { Injectable } from '@nestjs/common';

type IntelligenceInput = {
  species: string;
  confidence: number;
  capturedAt?: Date;
  zoneId?: string;
};

type IntelligenceOutput = {
  risk_score: number;
  risk_reasons: string[];
  is_night: boolean;
  is_unusual: boolean;
  should_alert: boolean;
  priority: 'low' | 'medium' | 'high' | 'critical';
};

@Injectable()
export class IntelligenceService {
  private readonly rareSpecies = new Set([
    'visayan spotted deer',
    'philippine eagle',
    'tamaraw',
    'pangolin',
  ]);

  score(input: IntelligenceInput): IntelligenceOutput {
    const { species, confidence, capturedAt, zoneId } = input;
    const normalizedSpecies = species.toLowerCase().trim();
    const at = capturedAt ?? new Date();

    const hour = at.getHours();
    const isNight = hour >= 22 || hour < 5;
    const protectedZone = this.isProtectedZone(zoneId);

    let score = 0;
    const reasons: string[] = [];

    if (confidence >= 0.9) {
      score += 15;
      reasons.push('high_confidence_detection');
    } else if (confidence >= 0.75) {
      score += 8;
      reasons.push('medium_confidence_detection');
    }

    if (this.rareSpecies.has(normalizedSpecies)) {
      score += 45;
      reasons.push('rare_species_detected');
    }

    if (normalizedSpecies === 'person') {
      score += 30;
      reasons.push('human_presence_detected');
      if (isNight) {
        score += 30;
        reasons.push('human_detected_at_night');
      }
      if (protectedZone) {
        score += 25;
        reasons.push('human_in_protected_zone');
      }
    }

    if (normalizedSpecies === 'dog' && protectedZone) {
      score += 15;
      reasons.push('domestic_animal_in_protected_zone');
    }

    score = Math.max(0, Math.min(100, score));

    const isUnusual =
      reasons.includes('rare_species_detected') ||
      reasons.includes('human_detected_at_night') ||
      reasons.includes('human_in_protected_zone');

    const shouldAlert = score >= 70 || isUnusual;

    return {
      risk_score: score,
      risk_reasons: reasons,
      is_night: isNight,
      is_unusual: isUnusual,
      should_alert: shouldAlert,
      priority: this.toPriority(score),
    };
  }

  private isProtectedZone(zoneId?: string) {
    if (!zoneId) return false;
    return zoneId.toLowerCase().startsWith('protected');
  }

  private toPriority(score: number): 'low' | 'medium' | 'high' | 'critical' {
    if (score >= 85) return 'critical';
    if (score >= 70) return 'high';
    if (score >= 45) return 'medium';
    return 'low';
  }
}
