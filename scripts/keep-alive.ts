import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { join } from "path";

interface ProjectConfig {
  name: string;
  url: string;
  anonKeyEnvVar: string;
}

interface Config {
  projects: ProjectConfig[];
}

const configPath = join(import.meta.dir, "../supabase-projects.json");
const config: Config = JSON.parse(readFileSync(configPath, "utf-8"));

async function keepAliveForProject(
  project: ProjectConfig
): Promise<{ project: string; success: boolean; details: string }> {
  console.log(
    `\n[${new Date().toISOString()}] 开始保活: ${project.name} (${project.url})`
  );

  const anonKey = process.env[project.anonKeyEnvVar];
  if (!anonKey) {
    console.error(`缺少环境变量: ${project.anonKeyEnvVar}`);
    return {
      project: project.name,
      success: false,
      details: `Missing env var: ${project.anonKeyEnvVar}`,
    };
  }

  const supabase = createClient(project.url, anonKey);
  let successCount = 0;

  // Storage API
  try {
    const { error } = await supabase.storage.listBuckets();
    if (!error) successCount++;
  } catch (error) {
    console.warn("Storage API 失败");
  }

  // Database REST
  try {
    const { error } = await supabase
      .from(`_keep_alive_${Date.now()}`)
      .select("*")
      .limit(1);
    if (error) successCount++;
  } catch (error) {
    console.warn("Database REST 失败");
  }

  // Auth API
  try {
    const { error } = await supabase.auth.getUser();
    if (error?.message !== "Auth session missing!") successCount++;
  } catch (error) {
    console.warn("Auth API 失败");
  }

  const success = successCount >= 2;
  console.log(`${project.name}: ${success ? "✓ 成功" : "✗ 失败"} (${successCount}/3)`);

  return {
    project: project.name,
    success,
    details: `${successCount}/3 checks passed`,
  };
}

async function main() {
  console.log(
    `开始保活 ${config.projects.length} 个 Supabase 项目\n`
  );

  const results = await Promise.all(
    config.projects.map((project) => keepAliveForProject(project))
  );

  console.log("\n========== 保活结果汇总 ==========");
  console.log(JSON.stringify(results, null, 2));

  const allSuccess = results.every((r) => r.success);
  if (!allSuccess) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error("保活脚本执行失败:", error);
  process.exit(1);
});
