import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

type InstallerArtifactContract = {
  artifactPrefix: string;
  channel: string;
  builder: string;
  installScope: string;
  defaultInstallDirectory: string;
  shortcutTargets: string[];
  payloadSource: string;
  requiredInstallerStagingFiles: string[];
  requiredInstalledPaths: string[];
  unsupportedDistribution: string[];
};

const contractPath = path.join(process.cwd(), "spec", "installer-artifact-contract.json");

function readContract(): InstallerArtifactContract {
  return JSON.parse(fs.readFileSync(contractPath, "utf8")) as InstallerArtifactContract;
}

describe("installer artifact contract", () => {
  it("keeps the Windows installer distribution policy explicit", () => {
    const contract = readContract();

    expect(contract.artifactPrefix).toBe("SGC-Setup");
    expect(contract.channel).toBe("self_extracting_exe");
    expect(contract.builder).toBe("iexpress");
    expect(contract.installScope).toBe("current_user");
    expect(contract.defaultInstallDirectory).toBe("%LOCALAPPDATA%\\Programs\\SGC");
    expect(contract.shortcutTargets).toEqual(["Desktop", "StartMenu"]);
    expect(contract.payloadSource).toBe("portable_artifact");
    expect(contract.unsupportedDistribution).toEqual([
      "msi",
      "auto_updater",
      "code_signing",
      "store_distribution",
    ]);
  });

  it("requires the payload and installed runtime paths needed by the installer", () => {
    const contract = readContract();

    expect(contract.requiredInstallerStagingFiles).toEqual([
      "payload.zip",
      "install.ps1",
      "setup.cmd",
      "installer.sed",
    ]);
    expect(contract.requiredInstalledPaths).toEqual(
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
