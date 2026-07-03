let imageColumnsReady = false;

export async function ensureImageColumnsCapacity(client) {
  if (imageColumnsReady) return;

  const statements = [
    "ALTER TABLE `businesses` MODIFY COLUMN `logoUrl` LONGTEXT NULL",
    "ALTER TABLE `businesses` MODIFY COLUMN `booking_hero_image_url` LONGTEXT NULL",
    "ALTER TABLE `services` MODIFY COLUMN `image_url` LONGTEXT NULL",
  ];

  for (const statement of statements) {
    await client.$executeRawUnsafe(statement);
  }

  imageColumnsReady = true;
}
