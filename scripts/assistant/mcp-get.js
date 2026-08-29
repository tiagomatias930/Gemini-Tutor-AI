import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const server = new McpServer({ name: "ngola-tutor", version: "1.0.0" });

const repoRoot = join(__dirname, "../..");
const packageJsonPath = join(repoRoot, "package.json");
const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf-8"));

server.registerTool(
  "get_project_info",
  {
    description: "Returns project metadata from package.json",
    inputSchema: z.object({}),
  },
  async () => ({
    content: [
      {
        type: "text",
        text: JSON.stringify(
          {
            name: packageJson.name,
            version: packageJson.version,
            description: packageJson.description,
            dependencies: Object.keys(packageJson.dependencies || {}),
          },
          null,
          2
        ),
      },
    ],
  })
);

export default server;
