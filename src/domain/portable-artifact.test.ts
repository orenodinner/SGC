import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

type PortableArtifactContract = {
  artifactPrefix: string;
  channel: string;
  updateMode: string;
  rollbackMode: string;
  unsupportedDistribution: string[];
  runtimeDependencies: string[];
  requiredPaths: string[];
};

const contractPath = path.join(process.cwd(), "spec", "portable-artifact-contract.json");

function readContract(): PortableArtifactContract {
  return JSON.parse(fs.readFileSync(contractPath, "utf8")) as PortableArtifactContract;
}

describe("portable artifact contract", () => {
  it("keeps Windows portable distribution policy explicit", () => {
    const contract = readContract();

    expect(contract.artifactPrefix).toBe("sgc-portable-win-x64");
    expect(contract.channel).toBe("portable_zip");
    expect(contract.updateMode).toBe("manual_replace");
    expect(contract.rollbackMode).toBe("keep_previous_unzipped_folder");
    expect(contract.unsupportedDistribution).toEqual([
      "msi",
      "auto_updater",
      "code_signing",
      "store_distribution",
    ]);
  });

  it("requires the runtime paths needed by the launcher", () => {
    const contract = readContract();

    expect(contract.runtimeDependencies).toEqual(["date-fns", "sql.js", "zod"]);
    expect(contract.requiredPaths).toEqual(
      expect.arrayContaining([
        "dist",
        "dist-electron",
        "node_modules/sql.js/dist/sql-wasm.wasm",
        "runtime/electron.exe",
        "Launch SGC.cmd",
        "build-manifest.json",
        "DISTRIBUTION.txt",
      ])
    );
  });
});
