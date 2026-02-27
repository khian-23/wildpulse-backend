import { Injectable } from '@nestjs/common';
import { logger } from '../common/logger/wildpulse.logger';
@Injectable()
export class AiService {

  async generateSummary(
    species: string,
    confidence: number,
  ): Promise<string | undefined> {

    try {
      const result = await Promise.race([
        this.mockCall(species, confidence),
        this.timeout(3000),
      ]);

      return result as string;

    } catch (error) {
        logger.error('AI generation failed', { error });

      return undefined; // 🔥 Never throw
    }
  }

  private async mockCall(
    species: string,
    confidence: number,
  ): Promise<string> {

    return `A ${species} was detected with ${(confidence * 100).toFixed(1)}% confidence.`;
  }

  private timeout(ms: number): Promise<never> {
    return new Promise((_, reject) =>
      setTimeout(() => reject(new Error('AI timeout')), ms),
    );
  }
}