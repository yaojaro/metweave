import { defineConfig } from "vitest/config";

// 内部包解析走各包 package.json 的开发期 exports（指向 src，发布时由
// publishConfig 替换为 dist），无需先构建即可 lint/typecheck/test。
export default defineConfig({
  test: {
    include: ["packages/*/src/**/*.test.ts"],
  },
});
