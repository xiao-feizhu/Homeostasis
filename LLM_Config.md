# Kimi Coding API 配置指南

> 本文档介绍如何正确配置和使用 Kimi Coding API (kimi.com/coding)
>
> 注意：Kimi Coding 与标准 Moonshot API 是两个不同的服务，使用不同的端点和认证方式。

## 1. 关键区别

| 特性 | Moonshot 标准 API | Kimi Coding API |
|------|------------------|-----------------|
| Base URL | `https://api.moonshot.cn/v1` | `https://api.kimi.com/coding` |
| API 格式 | OpenAI | Anthropic Messages |
| 认证头 | `Authorization: Bearer` | `x-api-key` |
| 模型 ID | `kimi-k2.5` | `k2p5` |
| 环境变量 | `MOONSHOT_API_KEY` | `KIMI_API_KEY` |

## 2. 环境配置

### 获取 API Key

访问 [kimi.com](https://kimi.com) 登录后获取 Coding API Key。

### 设置环境变量

```bash
# ~/.bashrc 或 ~/.zshrc
export KIMI_API_KEY="your-kimi-api-key"
```

## 3. 使用 Anthropic SDK (推荐)

### 安装依赖

```bash
pip install anthropic
```

### 基础使用

```python
import os
from anthropic import Anthropic

# 初始化客户端
client = Anthropic(
    api_key=os.environ.get("KIMI_API_KEY"),
    base_url="https://api.kimi.com/coding"
)

# 发送消息
response = client.messages.create(
    model="k2p5",
    max_tokens=1024,
    messages=[
        {"role": "user", "content": "你好，请介绍一下自己"}
    ]
)

print(response.content[0].text)
```

### 流式输出

```python
import os
from anthropic import Anthropic

client = Anthropic(
    api_key=os.environ.get("KIMI_API_KEY"),
    base_url="https://api.kimi.com/coding"
)

# 流式响应
with client.messages.stream(
    model="k2p5",
    max_tokens=1024,
    messages=[{"role": "user", "content": "写一个快速排序算法"}]
) as stream:
    for text in stream.text_stream:
        print(text, end="", flush=True)
```

### 多轮对话

```python
import os
from anthropic import Anthropic

client = Anthropic(
    api_key=os.environ.get("KIMI_API_KEY"),
    base_url="https://api.kimi.com/coding"
)

# 维护对话历史
messages = [
    {"role": "user", "content": "你好"}
]

# 第一轮
response = client.messages.create(
    model="k2p5",
    max_tokens=1024,
    messages=messages
)

assistant_reply = response.content[0].text
print(f"Assistant: {assistant_reply}")

# 添加到历史
messages.append({"role": "assistant", "content": assistant_reply})
messages.append({"role": "user", "content": "能详细介绍一下吗？"})

# 第二轮
response = client.messages.create(
    model="k2p5",
    max_tokens=1024,
    messages=messages
)

print(f"Assistant: {response.content[0].text}")
```

### 带系统提示词

```python
import os
from anthropic import Anthropic

client = Anthropic(
    api_key=os.environ.get("KIMI_API_KEY"),
    base_url="https://api.kimi.com/coding"
)

response = client.messages.create(
    model="k2p5",
    max_tokens=1024,
    system="你是一个专业的 Python 程序员，擅长编写简洁高效的代码。",
    messages=[
        {"role": "user", "content": "写一个斐波那契数列函数"}
    ]
)

print(response.content[0].text)
```

## 4. 使用直接 HTTP 请求

### 基础请求

```python
import requests
import os

API_KEY = os.environ.get("KIMI_API_KEY")

def chat_completion(message: str, max_tokens: int = 1024) -> str:
    """使用 Kimi Coding API 进行对话"""
    response = requests.post(
        "https://api.kimi.com/coding/v1/messages",
        headers={
            "x-api-key": API_KEY,
            "Content-Type": "application/json",
        },
        json={
            "model": "k2p5",
            "messages": [{"role": "user", "content": message}],
            "max_tokens": max_tokens
        }
    )

    if response.status_code == 200:
        data = response.json()
        return data["content"][0]["text"]
    else:
        raise Exception(f"API Error: {response.status_code} - {response.text}")

# 使用
result = chat_completion("你好")
print(result)
```

### 流式请求

```python
import requests
import os
import json

API_KEY = os.environ.get("KIMI_API_KEY")

def chat_completion_stream(message: str, max_tokens: int = 1024):
    """流式输出"""
    response = requests.post(
        "https://api.kimi.com/coding/v1/messages",
        headers={
            "x-api-key": API_KEY,
            "Content-Type": "application/json",
        },
        json={
            "model": "k2p5",
            "messages": [{"role": "user", "content": message}],
            "max_tokens": max_tokens,
            "stream": True
        },
        stream=True
    )

    if response.status_code != 200:
        raise Exception(f"API Error: {response.status_code}")

    for line in response.iter_lines():
        if line:
            line = line.decode('utf-8')
            if line.startswith('data: '):
                data = line[6:]
                if data == '[DONE]':
                    break
                try:
                    chunk = json.loads(data)
                    if chunk.get('type') == 'content_block_delta':
                        yield chunk['delta']['text']
                except:
                    pass

# 使用
for text in chat_completion_stream("讲个故事"):
    print(text, end="", flush=True)
```

## 5. 完整封装类

```python
import os
from typing import List, Dict, Optional, Generator
from anthropic import Anthropic


class KimiCodingClient:
    """Kimi Coding API 客户端封装"""

    def __init__(self, api_key: Optional[str] = None):
        """
        初始化客户端

        Args:
            api_key: API Key，如果不提供则从环境变量 KIMI_API_KEY 读取
        """
        self.api_key = api_key or os.environ.get("KIMI_API_KEY")
        if not self.api_key:
            raise ValueError("API key is required. Set KIMI_API_KEY environment variable or pass api_key parameter.")

        self.client = Anthropic(
            api_key=self.api_key,
            base_url="https://api.kimi.com/coding"
        )
        self.model = "k2p5"

    def chat(
        self,
        message: str,
        system: Optional[str] = None,
        max_tokens: int = 1024,
        temperature: float = 0.7
    ) -> str:
        """
        单轮对话

        Args:
            message: 用户消息
            system: 系统提示词
            max_tokens: 最大生成 token 数
            temperature: 温度参数

        Returns:
            助手回复内容
        """
        kwargs = {
            "model": self.model,
            "max_tokens": max_tokens,
            "messages": [{"role": "user", "content": message}],
        }

        if system:
            kwargs["system"] = system

        response = self.client.messages.create(**kwargs)
        return response.content[0].text

    def chat_stream(
        self,
        message: str,
        system: Optional[str] = None,
        max_tokens: int = 1024
    ) -> Generator[str, None, None]:
        """
        流式对话

        Args:
            message: 用户消息
            system: 系统提示词
            max_tokens: 最大生成 token 数

        Yields:
            生成的文本片段
        """
        kwargs = {
            "model": self.model,
            "max_tokens": max_tokens,
            "messages": [{"role": "user", "content": message}],
        }

        if system:
            kwargs["system"] = system

        with self.client.messages.stream(**kwargs) as stream:
            for text in stream.text_stream:
                yield text

    def chat_with_history(
        self,
        messages: List[Dict[str, str]],
        system: Optional[str] = None,
        max_tokens: int = 1024
    ) -> str:
        """
        带历史记录的多轮对话

        Args:
            messages: 消息历史列表，格式为 [{"role": "user"/"assistant", "content": "..."}]
            system: 系统提示词
            max_tokens: 最大生成 token 数

        Returns:
            助手回复内容
        """
        kwargs = {
            "model": self.model,
            "max_tokens": max_tokens,
            "messages": messages,
        }

        if system:
            kwargs["system"] = system

        response = self.client.messages.create(**kwargs)
        return response.content[0].text


# 使用示例
if __name__ == "__main__":
    # 初始化客户端
    kimi = KimiCodingClient()

    # 单轮对话
    print("=== 单轮对话 ===")
    reply = kimi.chat("你好，请介绍一下自己")
    print(f"回复: {reply}\n")

    # 带系统提示词
    print("=== 带系统提示词 ===")
    reply = kimi.chat(
        "写一个 Python 函数计算阶乘",
        system="你是一个 Python 专家，请提供简洁的代码和注释"
    )
    print(f"回复: {reply}\n")

    # 流式输出
    print("=== 流式输出 ===")
    for chunk in kimi.chat_stream("讲一个关于 AI 的短故事"):
        print(chunk, end="", flush=True)
    print("\n")

    # 多轮对话
    print("=== 多轮对话 ===")
    history = [
        {"role": "user", "content": "什么是机器学习？"}
    ]
    reply = kimi.chat_with_history(history)
    print(f"Assistant: {reply}")

    history.append({"role": "assistant", "content": reply})
    history.append({"role": "user", "content": "能举个例子吗？"})

    reply = kimi.chat_with_history(history)
    print(f"Assistant: {reply}")
```

## 6. 错误处理

### 常见错误

```python
from anthropic import AuthenticationError, RateLimitError, APIError

client = Anthropic(
    api_key=os.environ.get("KIMI_API_KEY"),
    base_url="https://api.kimi.com/coding"
)

try:
    response = client.messages.create(
        model="k2p5",
        max_tokens=1024,
        messages=[{"role": "user", "content": "你好"}]
    )
except AuthenticationError as e:
    print(f"认证失败: {e}")
    # 检查 API Key 是否正确
except RateLimitError as e:
    print(f"请求过于频繁: {e}")
    # 等待后重试
except APIError as e:
    print(f"API 错误: {e}")
    # 其他 API 错误
except Exception as e:
    print(f"未知错误: {e}")
```

### 错误代码表

| 状态码 | 含义 | 解决方案 |
|--------|------|----------|
| 401 | 认证失败 | 检查 API Key 是否正确 |
| 403 | 无权限访问 | 确认 API Key 有 Coding API 权限 |
| 404 | 端点不存在 | 检查 URL 是否正确 (`/v1/messages`) |
| 429 | 请求过多 | 降低请求频率 |
| 500 | 服务器错误 | 稍后重试 |

## 7. 模型信息

### 可用模型

| 模型 ID | 上下文长度 | 支持功能 |
|---------|-----------|----------|
| `k2p5` | 262,144 tokens | 文本、图片输入、推理 |

### 模型能力

- **输入**: 文本、图片
- **输出**: 文本
- **推理**: 支持
- **最大输出 tokens**: 32,768

## 8. 注意事项

1. **区分 API 类型**: Kimi Coding 使用 Anthropic Messages API，不是 OpenAI API
2. **认证头**: 使用 `x-api-key`，不是 `Authorization: Bearer`
3. **模型名**: 使用 `k2p5`，不是 `kimi-k2.5` 或 `kimi-for-coding`
4. **Base URL**: SDK 使用 `https://api.kimi.com/coding` (无 `/v1`)，HTTP 请求需要加 `/v1`
5. **速率限制**: 注意控制请求频率，避免触发限制

## 9. 参考链接

- [Moonshot 开放平台](https://platform.moonshot.cn/)
- [Anthropic Python SDK](https://github.com/anthropics/anthropic-sdk-python)
- [Anthropic Messages API 文档](https://docs.anthropic.com/en/api/messages)
