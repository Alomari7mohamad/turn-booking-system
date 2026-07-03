let imageColumnsReady = false;
let customerProfileColumnsReady = false;
let businessFeatureColumnsReady = false;

async function executeIgnoringDuplicateColumn(client, statement) {
  try {
    await client.$executeRawUnsafe(statement);
  } catch (err) {
    const message = `${err?.message || ""} ${err?.meta?.message || ""}`;
    if (!message.includes("Duplicate column") && !message.includes("1060")) {
      throw err;
    }
  }
}

export async function ensureImageColumnsCapacity(client) {
  if (imageColumnsReady) return;

  await ensureBusinessFeatureColumns(client);

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

export async function ensureBusinessFeatureColumns(client) {
  if (businessFeatureColumnsReady) return;

  const statements = [
    "ALTER TABLE `businesses` ADD COLUMN `map_url` VARCHAR(191) NULL",
    "ALTER TABLE `businesses` ADD COLUMN `booking_hero_image_url` LONGTEXT NULL",
    "ALTER TABLE `businesses` ADD COLUMN `brand_color` VARCHAR(191) NULL DEFAULT '#064e3b'",
    "ALTER TABLE `businesses` ADD COLUMN `requires_appointment_approval` BOOLEAN NOT NULL DEFAULT TRUE",
    "ALTER TABLE `businesses` ADD COLUMN `print_screen_enabled` BOOLEAN NOT NULL DEFAULT FALSE",
    "ALTER TABLE `businesses` ADD COLUMN `customer_hub_enabled` BOOLEAN NOT NULL DEFAULT TRUE",
    "ALTER TABLE `businesses` ADD COLUMN `customer_points_percent` DOUBLE NOT NULL DEFAULT 0",
    "ALTER TABLE `businesses` ADD COLUMN `reviews_enabled` BOOLEAN NOT NULL DEFAULT FALSE",
    "ALTER TABLE `businesses` ADD COLUMN `online_payment_enabled` BOOLEAN NOT NULL DEFAULT FALSE",
    "ALTER TABLE `businesses` ADD COLUMN `pay_at_store_enabled` BOOLEAN NOT NULL DEFAULT TRUE",
  ];

  for (const statement of statements) {
    await executeIgnoringDuplicateColumn(client, statement);
  }

  businessFeatureColumnsReady = true;
}

export async function ensureCustomerProfileColumns(client) {
  if (customerProfileColumnsReady) return;

  await executeIgnoringDuplicateColumn(client, "ALTER TABLE `customers` ADD COLUMN `date_of_birth` DATETIME NULL");

  customerProfileColumnsReady = true;
}
