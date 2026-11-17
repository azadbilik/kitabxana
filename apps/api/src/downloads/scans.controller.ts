import { BadRequestException, Controller, Get, Param, Query, Res } from '@nestjs/common';
import { ApiQuery, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { Public } from '../common/decorators/public.decorator';
import { ScansService } from './scans.service';

/**
 * Scanned source books (PDF), for reading in the browser or downloading — whole, or just the
 * pages of one work or collection. Not throttled: a browser's PDF viewer fetches large files in
 * many Range requests.
 */
@ApiTags('Downloads')
@Controller('scans')
export class ScansController {
  constructor(private scans: ScansService) {}

  @Public()
  @Get(':file')
  @ApiQuery({ name: 'download', required: false, description: '1 = save as a file instead of opening it' })
  @ApiQuery({ name: 'pages', required: false, description: 'A work’s or collection’s pages, e.g. 120-131' })
  async file(
    @Param('file') file: string,
    @Query('download') download: string | undefined,
    @Query('pages') pages: string | undefined,
    @Res() res: Response,
  ) {
    const key = file.replace(/\.pdf$/i, '');
    let path: string;
    let name = `kitabxana-${key}.pdf`;
    if (pages) {
      const m = pages.match(/^(\d{1,4})-(\d{1,4})$/);
      if (!m) throw new BadRequestException('pages must look like 120-131');
      path = await this.scans.slice(key, Number(m[1]), Number(m[2]));
      name = `kitabxana-${key}-s${m[1]}-${m[2]}.pdf`;
    } else {
      path = this.scans.require(key);
    }
    res.sendFile(path, {
      // The files never change in place: a corrected scan gets a new key
      maxAge: pages ? '1d' : '30d',
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `${download ? 'attachment' : 'inline'}; filename="${name}"`,
        // Scans carry no useful text layer (legacy fonts, images): keep crawlers on the transcriptions
        'X-Robots-Tag': 'noindex',
      },
    });
  }
}
