import { Module } from '@nestjs/common';
import { DownloadsController } from './downloads.controller';
import { DownloadsService } from './downloads.service';
import { ScansController } from './scans.controller';
import { ScansService } from './scans.service';

@Module({
  controllers: [DownloadsController, ScansController],
  providers: [DownloadsService, ScansService],
  exports: [ScansService],
})
export class DownloadsModule {}
