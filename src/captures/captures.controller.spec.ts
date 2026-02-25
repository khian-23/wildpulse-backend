import { Test, TestingModule } from '@nestjs/testing';
import { CapturesController } from './captures.controller';
import { CapturesService } from './captures.service';

describe('CapturesController', () => {
  let controller: CapturesController;
  const capturesServiceMock = {
    handleUpload: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CapturesController],
      providers: [
        {
          provide: CapturesService,
          useValue: capturesServiceMock,
        },
      ],
    }).compile();

    controller = module.get<CapturesController>(CapturesController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
