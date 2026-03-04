import { AppController } from './app.controller';

describe('AppController', () => {
  let controller: AppController;

  beforeEach(async () => {
    controller = new AppController(
      { readyState: 1 } as any,
      {} as any,
      {} as any,
      {} as any,
    );
  });

  describe('health', () => {
    it('returns ok status', () => {
      const result = controller.health();
      expect(result.status).toBe('ok');
      expect(result.database).toBe('connected');
    });
  });

  describe('conservationList', () => {
    it('returns curated conservation entries', () => {
      const result = controller.conservationList();
      expect(result.count).toBeGreaterThan(0);
      expect(Array.isArray(result.results)).toBe(true);
    });

    it('filters conservation entries by query', () => {
      const result = controller.conservationList('hornbill');
      expect(result.count).toBe(1);
      expect(result.results[0].commonName).toContain('Hornbill');
    });
  });
});
