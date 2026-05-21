import { Module } from '@nestjs/common';

import { SharingTypeController } from './sharing-type.controller';
import { SharingTypeService } from './sharing-type.service';

@Module({ controllers: [SharingTypeController], providers: [SharingTypeService], exports: [SharingTypeService] })
export class SharingTypeModule {}
