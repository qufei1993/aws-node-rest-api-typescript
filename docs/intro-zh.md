# 使用 TypeScript, MongoDB atlas 开发 ServerLess 后端 API

这是一个对于 AWS Lambda Functions 的简单 REST API 项目，使用 TypeScript 语言编写，数据存储采用 MongoDB Atlas 云数据库，从编码到 AWS Lambda 下的单元测试，再到部署、日志调试完整的介绍了如何快速编写一个 FaaS 函数。

## 本文你讲学习到

* REST API with typescript
* MongoDB Atlas data storage
* Mocha unit tests
* TSLint code inspection


## 目录结构

```
├── app                               
│   ├── contrller          # 控制层，解析用户输入数据，处理结果返回
│   ├── model              # 数据库模型
│   ├── service            # 业务逻辑层
│   └── utils              # 工具类
├── config                 # 环境变量和配置相关
├── docs                   # 文档
├── tests                  # 单元测试
├── tsconfig.json          # 指定 TypeScript 编译的参数信息
└── tslint.json            # 指定 TypeScript 代码规范
├── .editorconfig          # 约定编辑器的代码风格
├── .gitignore             # git 提交忽略指定文件
├── .nycrc.json             
├── package.json           # package.json
├── serverless.yml         # Serverless 配置文件
├── README.md
```

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

## AWS Lambda 查看 Serverless 函数日志

### AWS 管理控制台查看

* 打开 [CloudWatch 控制台的日志页面](https://console.aws.amazon.com/cloudwatch/home)。
* 选择您的函数 (/aws/lambda/function-name) 的日志组。
* 选择列表中的日志流。

### AWS CLI 方式查看

* 安装

https://docs.aws.amazon.com/cli/latest/userguide/cli-chap-install.html

* 确认是否安装成功

which aws 或 aws --version 命令检测是否安装成功，类似以下结果，安装成功

```
$ which aws
/usr/local/bin/aws
$ aws --version
aws-cli/2.0.12 Python/3.7.4 Darwin/19.3.0 botocore/2.0.0dev16
```

* 认证

安装成功，需先执行 aws configure 命令配置 aws-cli 和凭据

```
$ aws configure
AWS Access Key ID [None]: AKIAIOSFODNN7EXAMPLE
AWS Secret Access Key [None]: wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
Default region name [None]: us-west-1
Default output format [None]: 
```

区域名称 region 一定要配置，如果不知道的，当时 serverless deploy 的时候也有显示，可以留意下。

* 终端查看

```
# 默认展示 base64 编码之后的数据
$ aws lambda invoke --function-name aws-node-rest-api-typescript-dev-find out-logger.json --log-type Tail

# base64 解码日志
$ aws lambda invoke --function-name aws-node-rest-api-typescript-dev-find out-logger.json --log-type Tail --query 'LogResult' --output text |  base64 -d
```