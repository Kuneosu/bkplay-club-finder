import { mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { buildStaticData } from "../lib/bkplay/prebuild";

const dataDir = join(process.cwd(), "public", "data");
const tournamentDir = join(dataDir, "tournaments");

async function writeJson(path: string, value: unknown) {
  await writeFile(path, `${JSON.stringify(value)}\n`, "utf8");
}

async function main() {
  const result = await buildStaticData();

  await rm(dataDir, { recursive: true, force: true });
  await mkdir(tournamentDir, { recursive: true });

  await writeJson(join(dataDir, "manifest.json"), result.manifest);
  await writeJson(join(dataDir, "club-index.json"), result.clubIndex);

  for (const tournament of result.tournaments) {
    await writeJson(join(tournamentDir, `${tournament.id}.json`), tournament);
  }

  console.log(
    [
      `generatedAt=${result.manifest.generatedAt}`,
      `tournaments=${result.manifest.stats.tournamentCount}`,
      `draws=${result.manifest.stats.drawCount}`,
      `clubs=${result.manifest.stats.clubCount}`,
      `errors=${result.manifest.errors.length}`
    ].join(" ")
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
