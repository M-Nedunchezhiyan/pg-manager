import {
  BadRequestException,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';

import { CurrentUser, type RequestUser } from '../../common/decorators/current-user';
import { UploadCategory, UploadService } from './upload.service';

interface MulterFile {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

@Controller({ path: '', version: '1' })
export class UploadController {
  constructor(private readonly uploads: UploadService) {}

  // POST /api/v1/uploads/:category   (multipart/form-data, field name "file")
  @Post('uploads/:category')
  @HttpCode(201)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 10 * 1024 * 1024 } }))
  async upload(
    @Param('category') category: string,
    @UploadedFile() file: MulterFile | undefined,
    @CurrentUser() u: RequestUser,
  ) {
    if (!file) throw new BadRequestException('file is required');
    return this.uploads.store({
      userId: u.sub,
      category: category as UploadCategory,
      originalName: file.originalname,
      mimetype: file.mimetype,
      buffer: file.buffer,
    });
  }

  // GET /api/v1/files/:key — authenticated download (no public static path).
  @Get('files/:key')
  async download(@Param('key') key: string, @Res() res: Response): Promise<void> {
    const { stream, mimetype, size } = await this.uploads.open(decodeURIComponent(key));
    res.setHeader('Content-Type', mimetype);
    res.setHeader('Content-Length', String(size));
    res.setHeader('Cache-Control', 'private, max-age=0, no-store');
    res.setHeader('Content-Disposition', 'inline');
    stream.pipe(res);
  }
}
