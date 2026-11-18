import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { Glossary, type GlossaryEntry, type GlossaryMatch } from './lookup';

/**
 * «Klassik Azərbaycan ədəbiyyatında işlənən ərəb və fars sözləri lüğəti» (2 vols, Bakı, «Şərq-Qərb»,
 * 2005), read into `efsl.json` by `pnpm parse glossary`. Some 19,500 articles: held in memory, no table.
 */
@Injectable()
export class GlossaryService implements OnModuleInit {
  private readonly logger = new Logger(GlossaryService.name);
  private glossary = new Glossary([]);

  onModuleInit() {
    const file = path.join(__dirname, 'efsl.json');
    try {
      this.glossary = new Glossary(JSON.parse(fs.readFileSync(file, 'utf8')) as GlossaryEntry[]);
      this.logger.log(`${this.glossary.size} headwords`);
    } catch (err) {
      // The site reads without it: a tapped word simply finds nothing
      this.logger.error(`No glossary at ${file}: ${(err as Error).message}`);
    }
  }

  lookup(word: string): GlossaryMatch[] {
    return this.glossary.lookup(word);
  }
}
