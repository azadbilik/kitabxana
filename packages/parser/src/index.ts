import { Command } from 'commander';
import { scrapeAuthorsCommand } from './commands/scrape-authors';
import { scrapeWorksCommand } from './commands/scrape-works';
import { auditCommand } from './commands/audit';
import { importMdCommand } from './commands/import-md';
import { scrapeAllCommand } from './commands/scrape-all';
import { reslugCommand } from './commands/reslug';
import { retitleCommand } from './commands/retitle';
import { scrapeImagesCommand } from './commands/scrape-images';
import { scrapeTranslationsCommand } from './commands/scrape-translations';
import { scrapePortraitsCommand } from './commands/scrape-portraits';
import { scrapeLifespansCommand } from './commands/scrape-lifespans';
import { scrapeReprintCommand } from './commands/scrape-reprint';
import { scrapeTranscribedCommand } from './commands/scrape-transcribed';
import { scrapeTranslatedCommand } from './commands/scrape-translated';
import { ocrBookCommand } from './commands/ocr-book';
import { scanStartsCommand } from './commands/scan-starts';
import { tagWorksCommand } from './commands/tag-works';
import { scrapeBookCommand } from './commands/scrape-book';
import { scrapePunhanCommand } from './commands/scrape-punhan';
import { scrapeBurhaneddinCommand } from './commands/scrape-burhaneddin';
import { scrapeFolkCommand } from './commands/scrape-folk';
import { linkWikidataCommand } from './commands/link-wikidata';
import { glossaryCommand } from './commands/glossary';

const program = new Command()
  .name('irs-parser')
  .description('Kitabxana.az data parser — scrape, validate, and import literary data')
  .version('1.0.0');

program.addCommand(scrapeAuthorsCommand);
program.addCommand(scrapeWorksCommand);
program.addCommand(scrapeAllCommand);
program.addCommand(auditCommand);
program.addCommand(importMdCommand);
program.addCommand(reslugCommand);
program.addCommand(retitleCommand);
program.addCommand(scrapeImagesCommand);
program.addCommand(scrapeTranslationsCommand);
program.addCommand(scrapePortraitsCommand);
program.addCommand(scrapeLifespansCommand);
program.addCommand(scrapeReprintCommand);
program.addCommand(scrapeTranscribedCommand);
program.addCommand(scrapeTranslatedCommand);
program.addCommand(ocrBookCommand);
program.addCommand(scanStartsCommand);
program.addCommand(tagWorksCommand);
program.addCommand(scrapeBookCommand);
program.addCommand(scrapePunhanCommand);
program.addCommand(scrapeBurhaneddinCommand);
program.addCommand(scrapeFolkCommand);
program.addCommand(linkWikidataCommand);
program.addCommand(glossaryCommand);

program.parse();
