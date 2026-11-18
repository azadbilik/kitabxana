import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Public } from '../common/decorators/public.decorator';
import { PublicCache } from '../common/interceptors/public-cache.interceptor';
import { GlossaryService } from './glossary.service';

@ApiTags('Glossary')
@Controller('glossary')
export class GlossaryController {
  constructor(private glossary: GlossaryService) {}

  /** What the dictionary has for a word of a text; an empty list when it has nothing */
  @Public()
  @PublicCache(3600, 604800)
  @Get()
  lookup(@Query('w') w?: string) {
    const word = typeof w === 'string' ? w.slice(0, 80) : '';
    return { word, matches: this.glossary.lookup(word) };
  }
}
