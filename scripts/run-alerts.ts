/** Ejecuta la generación de alertas manualmente (útil en servidores propios con cron del sistema). */
import "dotenv/config";
import { generateAlerts } from "../src/lib/services/alerts";
import { prisma } from "../src/lib/db";

generateAlerts()
  .then((c) => console.log("Alertas generadas:", c))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
