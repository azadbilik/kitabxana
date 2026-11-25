/**
 * Authors merged into another after the site listed both as different people: the old page
 * gets a 308 to the one kept (middleware). Their works keep their own slugs and URLs.
 */
export const MERGED_AUTHORS: Record<string, string> = {
  // Vardanlı Mücrim Kərim («El şairləri», 1927–28) is Mücrüm Kərim: the same poems in another edition
  'mucrim-kerim': 'mucrum-kerim',
};
