import { IsString, IsNumber, IsNotEmpty, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export class UploadDto {

  @IsString()
  @IsNotEmpty()
  species!: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(1)
  confidence!: number;
}