import { defineConfig } from "vitest/config";

// 内部包解析走各包 package.json 的开发期 exports（指向 src，发布时由
// publishConfig 替换为 dist），无需先构建即可 lint/typecheck/test。
export default defineConfig({
  test: {
    // fuzz 自身行为锁（scripts/fuzz.test.ts）与包测试同套跑——scripts 内联测试不受包 tsconfig 管
    include: ["packages/*/src/**/*.test.ts", "examples/src/*.test.ts", "scripts/*.test.ts"],
  },
});
