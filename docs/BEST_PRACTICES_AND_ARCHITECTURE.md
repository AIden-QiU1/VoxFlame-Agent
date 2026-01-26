# VoxFlame 代码架构与最佳实践指南

> **目标**: 构建可维护、类型安全、AI 友好的高质量代码库。
> **参考标准**: [Taxonomy](https://github.com/shadcn-ui/taxonomy), [T3 Stack](https://create.t3.gg/), [Vercel AI SDK](https://sdk.vercel.ai/docs)

---

## 一、 核心原则 (Core Principles)

### 1. 类型安全优先 (Type Safety First)
*   **规则**: 严禁使用 `any`。所有数据交互（API 请求/响应、组件 Props）必须定义明确的 TypeScript Interface 或 Zod Schema。
*   **理由**: 类型是 AI 理解代码逻辑的最强线索。类型定义越清晰，AI 生成代码的准确率越高，Bug 越少。

### 2. 关注点分离 (Separation of Concerns)
*   **UI 组件**: 只负责展示和简单的交互逻辑。
*   **Hooks**: 封装复杂的业务逻辑和副作用 (Effect)。
*   **Services/Controllers**: 后端逻辑分层，Service 处理业务，Controller 处理路由和 HTTP。

### 3. 数据源单一事实 (Single Source of Truth)
*   组件状态尽量下沉，全局状态使用 Context 或 Zustand。
*   避免 props drilling（层层传递），优先使用组合模式 (Composition)。

---

## 二、 目录结构规范 (Directory Structure)

参考 **Taxonomy** 的结构，VoxFlame 推荐以下规范：

### Frontend (`/frontend`)
```
src/
├── app/                 # Next.js App Router (路由即文件)
│   ├── (auth)/          # 路由组（不影响 URL）
│   ├── api/             # Route Handlers
│   └── page.tsx
├── components/          # 共享组件
│   ├── ui/              # 基础 UI 组件 (shadcn/ui)
│   ├── business/        # 业务组件 (如 VoiceRecorder)
│   └── layout/          # 布局组件
├── hooks/               # 自定义 React Hooks (逻辑复用)
├── lib/                 # 工具函数、第三方库配置
│   ├── utils.ts         # 通用工具
│   └── supabase.ts      # 数据库客户端
├── types/               # 全局类型定义 (.d.ts)
└── config/              # 静态配置 (siteConfig, navConfig)
```

### Backend (`/backend`)
```
src/
├── controllers/         # 请求处理 (Req/Res)
├── services/            # 业务逻辑 (核心代码)
├── middlewares/         # 中间件 (Auth, Logging)
├── utils/               # 工具函数
├── types/               # 类型定义
└── index.ts             # 入口
```

---

## 三、 编码规范 (Coding Standards)

### 1. 组件编写 (React)
*   **函数式组件**: 使用 `function ComponentName() {}` 声明。
*   **Props 定义**: 必须定义 Interface。
    ```tsx
    // Good
    interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
      variant?: 'primary' | 'secondary';
    }
    export function Button({ variant = 'primary', ...props }: ButtonProps) { ... }
    ```
*   **服务端组件 (RSC)**: 默认使用 Server Components，需要交互时在文件顶部添加 `"use client"`。

### 2. API 交互
*   **后端**: Controller 层必须验证输入并在 Service 层处理异常。
*   **前端**: 封装 API 调用为 Service 函数或自定义 Hook (`useVoiceUpload`)，不要在组件内直接写 `fetch`。

### 3. 错误处理
*   **防御性编程**: 总是假设 API 可能失败、网络可能中断。
*   **用户反馈**: 使用 Toast 或 Alert 明确告知用户操作结果（成功/失败）。

---

## 四、 AI 辅助开发指南 (AI-Assisted Development)

为了让 Copilot/Cursor 更好地协助开发，请遵循以下习惯：

1.  **写好注释**: 在复杂函数或 Interface 上方添加 JSDoc 注释。
    ```typescript
    /**
     * 生成 OSS 上传签名 URL
     * @param filename 目标存储路径 (key)
     * @param contentType 文件 MIME 类型
     */
    async generateUploadUrl(...)
    ```
2.  **上下文明确**: 当让 AI 生成代码时，先提供相关的 Type 定义。
3.  **增量开发**: 不要一次让 AI 生成整个文件，而是分步骤：定义接口 -> 实现逻辑 -> 编写 UI。

---

## 五、 推荐技术栈与库

*   **UI 框架**: Tailwind CSS + shadcn/ui (Radix UI)
*   **图标库**: Lucide React
*   **数据校验**: Zod
*   **状态管理**: Zustand (轻量), React Query (服务器状态)
*   **AI SDK**: Vercel AI SDK (流式对话)

---

## 六、 核心代码模式 (Core Code Patterns)

为了提高开发效率和代码一致性，请复制以下模式进行开发。

### 1. AI Route Handler (Streaming + Tool Calling)
*适用场景: `/app/api/chat/route.ts`*

```typescript
import { streamText, tool } from 'ai';
import { openai } from '@ai-sdk/openai';
import { z } from 'zod';

export const maxDuration = 30;

export async function POST(req: Request) {
  const { messages } = await req.json();

  const result = streamText({
    model: openai('gpt-4o'),
    messages,
    system: 'You are a helpful assistant.',
    tools: {
      getWeather: tool({
        description: 'Get the weather',
        parameters: z.object({
          city: z.string().describe('The city name'),
        }),
        execute: async ({ city }) => {
          // Call external API here
          return { temperature: 24, condition: 'Sunny' };
        },
      }),
    },
  });

  return result.toDataStreamResponse();
}
```

### 2. Server Action with Zod Validation
*适用场景: 表单提交、突变操作*

```typescript
'use server'

import { z } from 'zod';
import { actionClient } from '@/lib/safe-action'; // Optional: if using next-safe-action

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(8)
});

export type FormState = {
  errors?: { [key: string]: string[] };
  message?: string;
};

export async function registerUser(prevState: FormState, formData: FormData) {
  const validatedFields = schema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  });

  if (!validatedFields.success) {
    return {
      errors: validatedFields.error.flatten().fieldErrors,
      message: 'Validation Error'
    };
  }

  // Mutate Database
  try {
    // await db.user.create(...)
    return { message: 'Success' };
  } catch (e) {
    return { message: 'Database Error' };
  }
}
```

### 3. Zod Schema 定义规范
*适用场景: `types/schema.ts` 或 `lib/validations/auth.ts`*

```typescript
import { z } from 'zod';

export const userProfileSchema = z.object({
  username: z
    .string()
    .min(2, "Username must be at least 2 characters")
    .max(30)
    .regex(/^[a-zA-Z0-9_]+$/, "Special characters not allowed"),
  email: z.string().email(),
  role: z.enum(["user", "admin", "contributor"]).default("user"),
});

export type UserProfile = z.infer<typeof userProfileSchema>;
```
