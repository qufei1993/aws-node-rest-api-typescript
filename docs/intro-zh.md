# 使用 TypeScript 快速开发 Serverless REST API

这是一个对于 AWS Lambda Functions 的简单 REST API 项目，使用 TypeScript 语言编写，数据存储采用 MongoDB Atlas 云数据库，从编码到 AWS Lambda 下的单元测试，再到部署、日志调试完整的介绍了如何快速编写一个 FaaS 函数。

## 本文你将学习到

* REST API with typescript
* MongoDB Atlas data storage
* Multi-environment management under Serverless
* Mocha unit tests and lambda-tester interface test
* AWS lambda function log view

## 先修知识

在开始之前你需要知道 Serverless 是什么？及最基本的入门应用，在我的这篇文章 [使用 Node.js 快速开启 ServerLess Functions：入门实践指南](https://mp.weixin.qq.com/s/h8RsdDvkqqyI_WuD1vKcEw) 中介绍了 AWS Lambda 的基础应用。

除此之外 19 年的 MongoDB 深圳年终大会上我投稿了文章 [使用 ServerLess, Nodejs, MongoDB Atlas cloud 构建 REST API](https://mp.weixin.qq.com/s/Ox9UcEVrb2Tfdl1B-Eh_Cw) 在这篇文章中你可以学习到，如何快速入门 MongoDB Atlas 云数据库及使用 JavaScript 构建 REST API，本篇文章也是在其基础之上使用 TypeScript 进行改造，同时也介绍了 AWS Lambda 下的 FaaS 应用，如何写单元测试、如何做日志排查。

## REST API 规划

以下是我们将要完成的 REST API 规划，包含四个 CRUD 操作

| CRUD  | API Routes  | Description
|:------|:------------|:-----------
| POST  | /books      | 增加一本书
| GET   | /books      | 获取所有书籍列表
| PUT   | /books/:id  | 根据 id 更新指定编号书籍
| DELETE| /books/:id  | 根据 id 删除指定编号书籍

## 目录结构定义

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

## Serverless 相关插件

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

## 多配置环境管理

实际业务中，都会存在多套环境配置，例如：测试、预发、生产，那么在 Serverless 中如何做环境切换呢？

### 为云函数配置环境变量

修改 serverless.yml 文件为云函数配置环境变量，例如设置变量 NODE_ENV = dev

```yml
provider:
  environment:
    NODE_ENV: dev
```

### 配置文件上传时的 incldue 和 exclude

修改 serverless.yml 文件，新增 exclude 和 incldue 配置，实现仅上传对应配置文件

* exclude: 要忽略的配置文件
* include: 指定的配置文件会被上传

```yml
package:
  exclude:
    - config/.env.stg
    - config/.env.pro
  include:
    - config/.env.dev
```

> 注：因为 TS 最终编译只会编译 .ts 结尾的文件，默认情况下 config 里面指定的配置文件是不会上传的

### Dotenv 模块

默认情况如果我们设置了 .env 文件，dotenv 可以将此文件里设置的环境变量注入到 process.env 对象中，如果你有自己个性化定义的 .env 文件，在 dotenv 加载时指定 path 也可。

**安装**

```
npm i dotenv -S
npm i @types/dotenv-safe -D
```

**项目中使用**

通过提取上面云函数中设置的环境变量 NODE_ENV，拼接路径 path 为 .env 指定文件路径

```ts
import dotenv from 'dotenv';
import path from 'path';

// 具体路径根据自己的项目配置来
const dotenvPath = path.join(__dirname, '../', `config/.env.${process.env.NODE_ENV}`);
dotenv.config({
  path: dotenvPath,
});
```

**dotenv 环境变量配置参考**

* github.com/motdotla/dotenv
* serverlesscloud.cn/best-practice/2020-03-10-serverless-env

## 编码实践核心讲解

### 路由指定

Serverless.yml 文件中通过 handler 指定函数的访问路径，http.path 指定访问的路由，method 指定函数的请求方法。

相当于传统应用开发中，我们这样来定义 ```router.get('books/:id', () => { ... })``` 一个路由

```yml
functions:
  create:
    handler: app/handler.create
    events:
      - http:
          path: books
          method: post
  findOne:
    handler: app/handler.findOne
    events:
      - http:
          path: books/{id}
          method: get
```

### handler 入口函数处理

入口函数，利用函数的执行上下文重用，启动环境执行代码时初始化我们的数据库链接、加载环境变量。

event、context 这些参数由 FaaS 平台提供，从 aws-lambda 中可以找到 Handler、Context 的声明，但是并没有找到关于 event 的。

```ts
// app/handler.ts
import { Handler, Context } from 'aws-lambda';
import dotenv from 'dotenv';
import path from 'path';
const dotenvPath = path.join(__dirname, '../', `config/.env.${process.env.NODE_ENV}`);
dotenv.config({
  path: dotenvPath,
});

import { books } from './model';
import { BooksController } from './contrller/books';
const booksController = new BooksController(books);

export const create: Handler = (event: any, context: Context) => {
  return booksController.create(event, context);
};

export const findOne: Handler = (event: any, context: Context) => {
  return booksController.findOne(event, context);
};
...
```

### Controller 控制器层

通过路由指定和 handler 入口函数的处理，将用户的请求基于 Path 和 Method 分发至相应 Controller 层，解析用户的输入，处理后返回。

这一层不应存在任何形式的 “SQL 查询”，如有需要它应该调用 Service 层处理业务，然后封装结果返回。

```ts
// app/controller/books.ts
...
export class BooksController extends BooksService {
  constructor (books: Model<any>) {
    super(books);
  }

  /**
   * Create book
   * @param {*} event
   */
  async create (event: any, context?: Context) {
    console.log('functionName', context.functionName);
    const params: CreateBookDTO = JSON.parse(event.body);

    try {
      const result = await this.createBook({
        name: params.name,
        id: params.id,
      });

      return MessageUtil.success(result);
    } catch (err) {
      console.error(err);

      return MessageUtil.error(err.code, err.message);
    }
  }
  
  /**
   * Query book by id
   * @param event
   */
  async findOne (event: any, context: Context) {
    // The amount of memory allocated for the function
    console.log('memoryLimitInMB: ', context.memoryLimitInMB);

    const id: number = Number(event.pathParameters.id);

    try {
      const result = await this.findOneBookById(id);

      return MessageUtil.success(result);
    } catch (err) {
      console.error(err);

      return MessageUtil.error(err.code, err.message);
    }
  }
  ...
}
```

### Service 服务层

为了保证 Controller 层逻辑更加简洁，针对复杂的业务逻辑可以抽象出来做一个服务层，做到独立性、可复用性（可以被多个 Controller 层调用），这样也更有利于单元测试的编写。

```ts
// app/service/books.ts
...
export class BooksService {
  private books: Model<any>;
  constructor(books: Model<any>) {
    this.books = books;
  }

  /**
   * Create book
   * @param params
   */
  protected async createBook (params: CreateBookDTO): Promise<object> {
    try {
      const result = await this.books.create({
        name: params.name,
        id: params.id,
      });

      // Do something

      return result;
    } catch (err) {
      console.error(err);

      throw err;
    }
  }

  /**
   * Query book by id
   * @param id
   */
  protected findOneBookById (id: number) {
    return this.books.findOne({ id });
  }
  ...
}
```

### Model 数据层

这一层链接我们的 DB，定义我们需要的 Schema，每个 Schema 都会映射到一个 MongoDB Collection 中。

```ts
// app/model/mongoose-db.ts
import mongoose from 'mongoose';

export default mongoose.connect(process.env.DB_URL, {
  dbName: process.env.DB_NAME,
  useUnifiedTopology: true,
  useNewUrlParser: true,
});
```

```ts
// app/model/books.ts
import mongoose from 'mongoose';

export type BooksDocument = mongoose.Document & {
  name: string,
  id: number,
  description: string,
  createdAt: Date,
};

const booksSchema = new mongoose.Schema({
  name: String,
  id: { type: Number, index: true, unique: true },
  description: String,
  createdAt: { type: Date, default: Date.now },
});

// Note: OverwriteModelError: Cannot overwrite `Books` model once compiled. error
export const books = mongoose.models.books || mongoose.model<BooksDocument>('books', booksSchema, process.env.DB_BOOKS_COLLECTION);

```

## 单元测试

### 安装插件

这些插件都有什么用途，下面会介绍。

```
npm i @types/lambda-tester @types/chai chai @types/mocha mocha ts-node -D
```

### lambda-tester

以前我们可以使用 supertest 做接口测试，但是现在我们使用 AWS Lambda 编写的 FaaS 函数则不可以这样做，例如请求中的 event、context  是与云厂商是有关联的，这里推荐一个 [lambda-tester](https://github.com/vandium-io/lambda-tester
) 可以实现我们需要的接口测试。

**安装**

```
npm i lambda-tester @types/lambda-tester -D
```

**一个简单的应用示例**

在接口的路径（path）上传入参数 id

```ts
lambdaTester(findOne)
  .event({ pathParameters: { id: 25768396 } })
  .expectResult((result: any) => {
    ...
  });
```

### sinon

例如，我们请求一个接口，接口内部依赖于 DB 获取数据，但是在做单元测试中我们如果不需要获取实际的对象，就需要使用 Stub/Mock 对我们的代码进行模拟操作。

**安装**

```
npm i sinon @types/sinon -D
```

**示例**

以下例子中，我会做一个接口测试，通过 sinon 来模拟 mongoose 的各种方法操作。

```ts
const s = sinon
  .mock(BooksModel);

s.expects('findOne')
  .atLeast(1)
  .atMost(3)
  .resolves(booksMock.findOne);
  // .rejects(booksMock.findOneError);

return lambdaTester(findOne)
.event({ pathParameters: { id: 25768396 } })
.expectResult((result: any) => {
  // ...
});
```
以上对 booksMock 的 findOne 做了数据返回 Mock 操作，使用 s.resolves 方法模拟了 fulfilled 成功态，如需测试 rejected 失败态需指定 s.rejects 函数。

**一些常用方法**

* s.atLeast(1) 最少调用一次。
* s.atMost(3) 最多调用三次。
* s.verify() 用来验证 findOne 这个方法是否满足上面的条件。
* s.restore() 使用后复原该函数，适合于对某个函数的属性进行多次 stub 操作。

### 测试覆盖率

单元测试用来验证代码，测试覆盖率则可以验证测试用例，这里我们选择使用 [nyc](https://github.com/istanbuljs/nyc)。

**安装**

```
npm i nyc -D
```

**.nycrc.json 配置文件**

```json
{
  "all": true, // 检测所有文件
  "report-dir": "./coverage", // 报告文件存放位置
  "extension": [".ts"], // 除了 .js 之外应尝试的扩展列表
  "exclude": [ // 排除的一些文件
    "coverage",
    "tests"
  ]
}
```

**测试报告**

下图是对本项目做的一个测试用例覆盖率报告。

![](./img/lcov-report.png)

## Deploy And Usage

### 本地部署测试

* 运行 ```npm install``` 安装需要的依赖
* 运行 ```npm run local``` 实际使用的是 serverless offline 在本地开启测试。 

### 在 AWS 上的部署, 运行:

```
$ npm run deploy
# or
$ serverless deploy
```

期望的结果应该如下所示:

```
Serverless: Compiling with Typescript...
Serverless: Using local tsconfig.json
Serverless: Typescript compiled.
Serverless: Packaging service...
Serverless: Excluding development dependencies...
Serverless: Uploading CloudFormation file to S3...
Serverless: Uploading artifacts...
Serverless: Uploading service aws-node-rest-api-typescript.zip file to S3 (1.86 MB)...
Serverless: Validating template...
Serverless: Updating Stack...
Serverless: Checking Stack update progress...
......................................
Serverless: Stack update finished...
Service Information
service: aws-node-rest-api-typescript
stage: dev
region: us-east-1
stack: aws-node-rest-api-typescript-dev
resources: 32
api keys:
  None
endpoints:
  POST - https://xxxxxxxxxxx.execute-api.us-east-1.amazonaws.com/dev/books
  PUT - https://xxxxxxxxxxx.execute-api.us-east-1.amazonaws.com/dev/books/{id}
  GET - https://xxxxxxxxxxx.execute-api.us-east-1.amazonaws.com/dev/books
  GET - https://xxxxxxxxxxx.execute-api.us-east-1.amazonaws.com/dev/books/{id}
  DELETE - https://xxxxxxxxxxx.execute-api.us-east-1.amazonaws.com/dev/books/{id}
functions:
  create: aws-node-rest-api-typescript-dev-create
  update: aws-node-rest-api-typescript-dev-update
  find: aws-node-rest-api-typescript-dev-find
  findOne: aws-node-rest-api-typescript-dev-findOne
  deleteOne: aws-node-rest-api-typescript-dev-deleteOne
layers:
  None
Serverless: Removing old service artifacts from S3...
Serverless: Run the "serverless" command to setup monitoring, troubleshooting and testing.
```

### Usage

使用 curl 之类的工具直接向端点发送一个 HTTP 请求。

```
curl https://xxxxxxxxx.execute-api.us-east-1.amazonaws.com/dev/books
```

## AWS Lambda 查看 Serverless 函数日志

服务上线之后难免有时会需要通过日志来排查问题，AWS 中我们可以通过管理控制台和 CLI 本地化两种方式查看。

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

## Github 

本示例项目，你可以在 Github 找到 Clone 下来进行学习。

仓库：https://github.com/Q-Angelo/aws-node-rest-api-typescript <-- 戳戳 Star

## 总结

Serverless 下的云函数开发，可以使我们更关注于业务本身，从上面示例中也可以看到我们的业务代码并没有什么区别，更多的是避免了运维、后期的扩所容等一些成本问题，还有一点不同的是入口函数，传统的应用开发我们可以通过 HTTP 的 Request、Response 做处理和响应，例如在 AWS Lambda 下我们则是通过 event、context 来处理请求和一些上下文信息。

FaaS 这一层应尽可能的轻量，更多的是业务逻辑的处理，对于数据库这种是很难做到动态化、自动伸缩，但是如果每次冷启动都去创建链接对于数据库本身也会造成压力，一方面可以选择云平台提供的，另一方面也可以自己数据库 BaaS 化，经过包装进行调用。

本文也是自己的一个学习总结，欢迎一起讨论，可以在公众号「Nodejs技术栈」后台找到我。

---------

**作者简介**：五月君，Nodejs Developer，慕课网认证作者，热爱技术、喜欢分享的 90 后青年，欢迎关注[「Nodejs技术栈」](https://nodejsred.oss-cn-shanghai.aliyuncs.com/node_roadmap_wx.jpg?x-oss-process=style/may)和 Github 开源项目 [https://www.nodejs.red](https://www.nodejs.red)