import { BadRequestException } from '@nestjs/common';
import type { ZodSchema } from 'zod';

/**
 * Tiny helper to use Zod schemas as Nest DTOs.
 * Validates with `.parse()` and converts errors into 400s.
 */
export function createZodDto<T extends ZodSchema>(schema: T) {
  abstract class ZodDto {
    static schema = schema;
    static parse(input: unknown): unknown {
      const result = schema.safeParse(input);
      if (!result.success) {
        throw new BadRequestException({
          message: 'Validation failed',
          errors: result.error.flatten().fieldErrors,
        });
      }
      return result.data;
    }
  }
  return ZodDto;
}
