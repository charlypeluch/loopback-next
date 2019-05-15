---
lang: en
title: 'Global interceptor generator'
keywords: LoopBack 4.0, LoopBack 4
sidebar: lb4_sidebar
permalink: /doc/en/lb4/Global-interceptor-generator.html
---

{% include content/generator-create-app.html lang=page.lang %}

### Synopsis

Adds a new [global interceptor](Interceptors.md#global-interceptors) class to a
LoopBack application.

```sh
lb4 interceptor [--group <group>] [<name>]
```

### Arguments and options

`<name>` - Required name of the interceptor to create as an argument to the
command. If provided, the tool will use that as the default when it prompts for
the name.

`--group <group>` - Optional name of the interceptor group to sort the execution
of interceptors by group.

### Interactive Prompts

The tool will prompt you for:

- **Name of the interceptor.** _(interceptorName)_ If the name had been supplied
  from the command line, the prompt is skipped.

- **Group of the interceptor.** _(groupName)_ If the group had been supplied
  from the command line, the prompt is skipped.

### Output

Once all the prompts have been answered, the CLI will do the following:

- Create a global interceptor class as follows:
  `/src/interceptors/${interceptorName}.interceptor.ts`
- Update `/src/interceptors/index.ts` to export the newly created global
  interceptor class.

The generated class looks like:

```ts
import {
  /* inject, */
  asGlobalInterceptor,
  bind,
  Interceptor,
  Provider,
} from '@loopback/context';

/**
 * This class will be bound to the application as a global `Interceptor` during
 * `boot`
 */
@bind(asGlobalInterceptor('auth'))
export class TestInterceptor implements Provider<Interceptor> {
  /*
  constructor() {}
  */

  value() {
    const interceptor: Interceptor = async (invocationCtx, next) => {
      // Add pre-invocation logic here
      const result = await next();
      // Add post-invocation logic here
      return result;
    };
    return interceptor;
  }
}
```
