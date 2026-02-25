import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { CapturesService } from './captures.service';
import { Capture } from '../schemas/capture.schema';
import { ConfigService } from '@nestjs/config';

describe('CapturesService', () => {
  let service: CapturesService;
  const captureModelMock = jest.fn();
  const configServiceMock = {
    get: jest.fn((key: string) => {
      const map: Record<string, string> = {
        CLOUDINARY_CLOUD_NAME: 'test_cloud',
        CLOUDINARY_API_KEY: 'test_key',
        CLOUDINARY_API_SECRET: 'test_secret',
      };
      return map[key];
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CapturesService,
        {
          provide: getModelToken(Capture.name),
          useValue: captureModelMock,
        },
        {
          provide: ConfigService,
          useValue: configServiceMock,
        },
      ],
    }).compile();

    service = module.get<CapturesService>(CapturesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
