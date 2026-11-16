import { Controller, Get, Param, Query, Res } from '@nestjs/common';
import { ApiQuery, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { Public } from '../common/decorators/public.decorator';
import { ScansService } from './scans.service';

/**
 * Scanned source books (PDF), for reading in the browser or downloading. Not throttled: a
 * browser's PDF viewer fetches large files in many Range requests.
 */
@ApiTags('Downloads')
@Controller('scans')
export class ScansController {
  constructor(private scans: ScansService) {}

  @Public()
  @Get(':file')
  @ApiQuery({ name: 'download', required: false, description: '1 = save as a file instead of opening it' })
  file(@Param('file') file: string, @Query('download') download: string | undefined, @Res() res: Response) {
    const key = file.replace(/\.pdf$/i, '');
    const path = this.scans.require(key);
    const name = `kitabxana-${key}.pdf`;
    res.sendFile(path, {
      // The files never change in place: a corrected scan gets a new key
      maxAge: '30d',
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `${download ? 'attachment' : 'inline'}; filename="${name}"`,
        // Scans carry no useful text layer (legacy fonts, images): keep crawlers on the transcriptions
        'X-Robots-Tag': 'noindex',
      },
    });
  }
}
