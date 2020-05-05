# 使用 TypeScript, MongoDB atlas 开发 ServerLess 后端 API

## 插件

### serverless-offline

使用这个 serverless-offline 插件可以在本地启动一个 HTTP 服务器模拟 API Gateway。

**安装**

```
npm install serverless-offline -D
```

**添加 serverless-offline 到 serverless.yml 文件**

```yml
plugins:
  - serverless-offline
```

### serverless-plugin-typescript 插件

零配置 TypeScript 支持的 ServerLess 插件，Github [serverless-plugin-typescript](https://github.com/prisma-labs/serverless-plugin-typescript)

**安装**

```
npm install -D serverless-plugin-typescript typescript
```

**添加 serverless-plugin-typescript 到 serverless.yml 文件，确保其位于 serverless-offline 之前**

```yml
plugins:
  - serverless-plugin-typescript 
  - serverless-offline
```

## dotenv 多环境管理

实际业务中，都会存在测试、预发、生产等多种环境配置，那么在 ServerLess 中如何做环境切换呢？

**为云函数配置环境变量**

修改 serverless.yml 文件为云函数配置环境变量，例如设置变量 NODE_ENV = dev

```yml
provider:
  environment:
    NODE_ENV: dev
```

**仅上传对应配置文件**

修改 serverless.yml 文件，新增 exclude 和 incldue 配置，实现仅上传对应配置文件

* exclude: 要忽略的配置文件
* include: 指定的配置文件会被上传

```yml
provider:
  exclude:
    - config/.env.dev
    - config/.env.stg
    - config/.env.pro
  include:
    - config/.env.dev
```

**dotenv 模块安装**

```
npm i dotenv -S
npm i @types/dotenv-safe -D
```

**项目中使用**

通过提取云函数中环境变量，拼接路径 path 为 .env 指定文件路径

```ts
import dotenv from 'dotenv';
import path from 'path';
// 具体路径根据自己的项目配置来
const dotenvPath = path.join(__dirname, '../../', `config/.env.${process.env.NODE_ENV}`);
dotenv.config({
  path: dotenvPath,
});
```

**dotenv 环境变量配置参考**

* github.com/motdotla/dotenv
* serverlesscloud.cn/best-practice/2020-03-10-serverless-env

## 单元测试

### 安装插件

这些插件都有什么用途，下面会介绍。

```
npm i @types/lambda-tester @types/chai chai @types/mocha mocha ts-node -D
```

### lambda-tester

https://github.com/vandium-io/lambda-tester

### sinon

例如，我们请求一个接口，接口内部通过读取 DB 获取数据，但是在做单元测试中我们如果不需要获取实际的对象，就需要使用 Stub/Mock 对我们的代码进行模拟操作。

在这个例子中，我会做一个接口测试，通过 sinon 来模拟 mongoose 的各种方法操作。

```ts
const s = sinon
  .mock(BooksModel);

s.expects('findOne')
  .atLeast(1)
  .atMost(3)
  .resolves(booksMock.findOne);
  //.rejects(booksMock.findOneError);

return LambdaTester(find)
  .event({})
  .expectResult(function(result: any, additional: any) {
    ...
    s.verify();
    s.restore();
  });
```
以上对 booksMock 的 findOne 做了数据返回 Mock 操作，使用 s.resolves 方法模拟了 fulfilled 成功态，如需测试 rejected 失败态需指定 s.rejects 函数。

s.atLeast(1) 最少调用一次。

s.atMost(3) 最多调用三次。

s.verify() 用来验证 findOne 这个方法是否满足上面的条件。

s.restore() 使用后复原该函数，适合于对某个函数的属性进行多次 stub 操作。

### 代码覆盖率工具 nyc

https://github.com/istanbuljs/nyc

```json
{
  "all": true, // 检测所有文件
  "report-dir": "./coverage", // 报告文件存放位置
  "extension": [".ts"] // 除了 .js 之外应尝试的扩展列表
}
```

https://dev.to/paulasantamaria/testing-node-js-mongoose-with-an-in-memory-database-32np