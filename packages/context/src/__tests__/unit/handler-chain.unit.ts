// Copyright IBM Corp. 2019. All Rights Reserved.
// Node module: @loopback/context
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

import {expect} from '@loopback/testlab';
import {
  compareBindingsByTag,
  Context,
  filterByTag,
  InvocationHandlerChain,
  InvocationResult,
  Next,
} from '../..';

describe('InvocationHandlerChain', () => {
  let ctx: Context;
  let handlerChain: InvocationHandlerChain;
  let events: string[];

  beforeEach(givenContext);

  it('invokes handler functions', async () => {
    givenInvocationHandlerChain();
    const result = await handlerChain.invokeHandlers();
    expect(events).to.eql([
      'before-handler1',
      'before-handler2',
      'after-handler2',
      'after-handler1',
    ]);
    expect(result).to.be.undefined();
  });

  it('honors return value', async () => {
    givenInvocationHandlerChain({handler1: {}, handler2: {returnValue: 'ABC'}});
    const result = await handlerChain.invokeHandlers();
    expect(result).to.eql('ABC');
  });

  it('skips downstream handlers if next is not invoked', async () => {
    givenInvocationHandlerChain({handler1: {skipNext: true}, handler2: {}});
    await handlerChain.invokeHandlers();
    expect(events).to.eql(['before-handler1', 'after-handler1']);
  });

  it('passes bindings via context', async () => {
    givenInvocationHandlerChain({
      handler1: {bindMetadata: true},
      handler2: {bindMetadata: true},
    });
    await handlerChain.invokeHandlers();
    const reqMetadata = await ctx.get<string[]>('req.metadata');
    expect(reqMetadata).to.eql([
      'req-metadata-handler1',
      'req-metadata-handler2',
    ]);

    const resMetadata = await ctx.get<string[]>('res.metadata');
    expect(resMetadata).to.eql([
      'res-metadata-handler2',
      'res-metadata-handler1',
    ]);
  });

  it('catches error from second handler', async () => {
    givenInvocationHandlerChain({
      handler1: {throwError: false},
      handler2: {throwError: true},
    });
    const resultPromise = handlerChain.invokeHandlers();
    await expect(resultPromise).to.be.rejectedWith('error in handler2');
    expect(events).to.eql(['before-handler1', 'before-handler2']);
  });

  it('catches error from first handler', async () => {
    givenInvocationHandlerChain({
      handler1: {throwError: true},
      handler2: {throwError: false},
    });
    const resultPromise = handlerChain.invokeHandlers();
    await expect(resultPromise).to.be.rejectedWith('error in handler1');
    expect(events).to.eql([
      'before-handler1',
      'before-handler2',
      'after-handler2',
    ]);
  });

  it('allows discovery of handlers in context', async () => {
    const handler1 = givenHandler('handler1');
    const handler2 = givenHandler('handler2');
    ctx
      .bind('handler2')
      .to(handler2)
      .tag('handler');
    ctx
      .bind('handler1')
      .to(handler1)
      .tag('handler');
    handlerChain = new InvocationHandlerChain(ctx, filterByTag('handler'));
    await handlerChain.invokeHandlers();
    expect(events).to.eql([
      'before-handler2',
      'before-handler1',
      'after-handler1',
      'after-handler2',
    ]);
  });

  it('allows discovery and sorting of handlers in context', async () => {
    const handler1 = givenHandler('handler1');
    const handler2 = givenHandler('handler2');
    ctx
      .bind('handler2')
      .to(handler2)
      .tag('handler')
      .tag({phase: 'p2'});
    ctx
      .bind('handler1')
      .to(handler1)
      .tag('handler')
      .tag({phase: 'p1'});
    handlerChain = new InvocationHandlerChain(
      ctx,
      filterByTag('handler'),
      compareBindingsByTag('phase', ['p1', 'p2']),
    );
    await handlerChain.invokeHandlers();
    expect(events).to.eql([
      'before-handler1',
      'before-handler2',
      'after-handler2',
      'after-handler1',
    ]);
  });

  function givenContext() {
    events = [];
    ctx = new Context();
  }

  type HandlerOptions = {
    // The handler won't call `next()`
    skipNext?: boolean;
    // Set a value for the handler to return
    returnValue?: InvocationResult;
    // The handler will bind metadata to context
    bindMetadata?: boolean;
    // The handler will throw an error
    throwError?: boolean;
  };

  function givenInvocationHandlerChain(
    options: {
      handler1: HandlerOptions;
      handler2: HandlerOptions;
    } = {handler1: {}, handler2: {}},
  ) {
    const handler1 = givenHandler('handler1', options.handler1);
    const handler2 = givenHandler('handler2', options.handler2);
    ctx.bind('handler2').to(handler2);
    const handlers = [handler1, 'handler2'];
    handlerChain = new InvocationHandlerChain(ctx, handlers);
  }

  function givenHandler(name: string, options: HandlerOptions = {}) {
    async function handler(context: Context, next: Next) {
      events.push(`before-${name}`);
      await bindMetadata('req');
      const result = options.skipNext ? undefined : await next();
      await bindMetadata('res');
      if (options.throwError) {
        throw new Error(`error in ${name}`);
      }
      events.push(`after-${name}`);
      return options.returnValue ? options.returnValue : result;

      async function bindMetadata(type: string) {
        if (options.bindMetadata) {
          const key = `${type}.metadata`;
          const metadata =
            (await context.get<string[]>(key, {optional: true})) || [];
          metadata.push(`${type}-metadata-${name}`);
          context.bind(key).to(metadata);
        }
      }
    }
    return handler;
  }
});
