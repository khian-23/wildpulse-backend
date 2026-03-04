import {
  IsString,
  IsNumber,
  IsNotEmpty,
  Min,
  Max,
  IsOptional,
  IsISO8601,
} from 'class-validator';
import { Type } from 'class-transformer';

export class UploadDto {

  @IsString()
  @IsNotEmpty()
  device_id!: string;

  @IsString()
  @IsNotEmpty()
  species!: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(1)
  confidence!: number;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  zone_id?: string;

  @IsOptional()
  @IsISO8601()
  captured_at?: string;
}
