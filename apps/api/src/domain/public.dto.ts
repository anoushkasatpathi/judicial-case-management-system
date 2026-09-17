import { IsDateString, IsOptional, IsUUID, Matches } from 'class-validator';

export class CauseListQueryDto {
  @IsOptional()
  @IsUUID()
  court?: string;

  @IsOptional()
  @IsDateString()
  date?: string;
}

export class CaseStatusQueryDto {
  @Matches(/^[\p{L}0-9][\p{L}0-9 ./-]{2,80}$/u)
  caseNumber!: string;
}