import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error("缺少环境变量：SUPABASE_URL 或 SUPABASE_ANON_KEY");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function keepAlive() {
  console.log(`[${new Date().toISOString()}] 开始执行 Supabase 保活任务`);

  let successCount = 0;
  const operations: Array = [];

  // 方法 1：调用 Storage API
  try {
    const { data, error } = await supabase.storage.listBuckets();

    if (error) {
      console.warn("Storage API 检查返回错误：", error.message);
      operations.push({
        method: "Storage API check",
        success: false,
        error: error.message,
      });
    } else {
      console.log(`Storage API 检查成功，Buckets 数量：${data?.length ?? 0}`);
      operations.push({
        method: "Storage API check",
        success: true,
      });
      successCount++;
    }
  } catch (error) {
    console.warn("Storage API 异常：", error);
    operations.push({
      method: "Storage API check",
      success: false,
      error: String(error),
    });
  }

  // 方法 2：触发一次数据库 REST 查询
  // 即使表不存在，只要 Supabase 返回了数据库层面的错误，也说明请求已经打到项目。
  try {
    const randomTableName = `_keep_alive_test_${Date.now()}`;

    const { error } = await supabase
      .from(randomTableName)
      .select("*")
      .limit(1);

    if (error) {
      console.log("数据库保活查询已触发，返回预期错误：", {
        code: error.code,
        message: error.message,
      });

      operations.push({
        method: "Database REST query",
        success: true,
      });
      successCount++;
    } else {
      console.log("数据库保活查询成功");
      operations.push({
        method: "Database REST query",
        success: true,
      });
      successCount++;
    }
  } catch (error) {
    console.warn("数据库保活查询异常：", error);
    operations.push({
      method: "Database REST query",
      success: false,
      error: String(error),
    });
  }

  // 方法 3：调用 Auth API
  try {
    const { error } = await supabase.auth.getUser();

    if (error && error.message !== "Auth session missing!") {
      console.warn("Auth API 检查返回错误：", error.message);
      operations.push({
        method: "Auth API check",
        success: false,
        error: error.message,
      });
    } else {
      console.log("Auth API 检查成功");
      operations.push({
        method: "Auth API check",
        success: true,
      });
      successCount++;
    }
  } catch (error) {
    console.warn("Auth API 异常：", error);
    operations.push({
      method: "Auth API check",
      success: false,
      error: String(error),
    });
  }

  console.log("保活任务执行完成");
  console.log(`成功操作数：${successCount}/${operations.length}`);
  console.log(JSON.stringify(operations, null, 2));

  if (successCount === 0) {
    console.error("所有保活操作都失败了");
    process.exit(1);
  }
}

keepAlive()
  .then(() => {
    console.log("Supabase 保活脚本执行成功");
    process.exit(0);
  })
  .catch((error) => {
    console.error("Supabase 保活脚本执行失败：", error);
    process.exit(1);
  });
