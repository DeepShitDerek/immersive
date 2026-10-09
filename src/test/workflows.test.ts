import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/*
  The deploy workflow has to pass in any repository the code is pushed to,
  including one that has not turned GitHub Pages on yet.
*/

const deploy = readFileSync(
  path.resolve(__dirname, "../../.github/workflows/next-deploy.yml"),
  "utf8",
).replace(/\r\n/g, "\n");
const code = deploy
  .split("\n")
  .filter((line) => !line.trim().startsWith("#"))
  .join("\n");

describe("the deploy workflow", () => {
  it("works at the repository root, where the app is", () => {
    expect(code).not.toContain("working-directory");
    expect(code).not.toMatch(/^defaults:/m);
    expect(code).toContain("cache-dependency-path: package-lock.json");
    expect(code).toContain("generator_config_file: next.config.js");
    expect(code).toMatch(
      /upload-pages-artifact@v\d+\n\s+with:\n\s+path: out\n/,
    );
  });

  it("asks for the Pages settings only where Pages is turned on", () => {
    // A new fork has Pages off; asking there failed the whole run.
    const setup = code.slice(
      code.indexOf("- name: Setup Pages"),
      code.indexOf("- name: Restore cache"),
    );
    expect(setup).toContain("uses: actions/configure-pages@");
    expect(setup).toContain("if: steps.site.outputs.publish == 'true'");
    const upload = code.slice(code.indexOf("- name: Upload artifact"));
    expect(upload).toContain("if: steps.site.outputs.publish == 'true'");
    expect(code).toContain("if: needs.build.outputs.publish == 'true'");
  });

  it("publishes only from main, and never from a pull request", () => {
    expect(code).toContain(
      "DEPLOYS: ${{ github.event_name != 'pull_request' && github.ref == 'refs/heads/main' }}",
    );
  });
});
