// Copyright IBM Corp. 2019. All Rights Reserved.
// Node module: @loopback/context
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

import * as debugFactory from 'debug';
import {BindingFilter} from './binding-filter';
import {BindingAddress} from './binding-key';
import {BindingComparator} from './binding-sorter';
import {Context} from './context';
import {transformValueOrPromise, ValueOrPromise} from './value-promise';

const debug = debugFactory('loopback:context:handler-chain');

/**
 * Return value for a method invocation
 */
// tslint:disable-next-line:no-any
export type InvocationResult = any;

/**
 * Array of arguments for a method invocation
 */
// tslint:disable-next-line:no-any
export type InvocationArgs = any[];

/**
 * `next` function
 */
export type Next = () => ValueOrPromise<InvocationResult>;

/**
 * A handler function to be invoked in a chain for the given context
 */
export interface Handler<C extends Context = Context> {
  /**
   * @param context Context object
   * @param next A function to proceed with downstream handlers or the target
   *
   * @returns The invocation result as a value or promise
   */
  (context: C, next: Next): ValueOrPromise<InvocationResult>;
}

/**
 * Handler function or a binding key that resolves a handler function
 */
export type HandlerOrKey<C extends Context = Context> =
  | BindingAddress<Handler<C>>
  | Handler<C>;

/**
 * Invocation state of a handler chain
 */
class HandlerChainState<C extends Context = Context> {
  private _index: number = 0;
  /**
   * Create a state for the handler chain
   * @param handlers Handler functions or binding keys
   */
  constructor(private handlers: HandlerOrKey<C>[]) {}

  get index() {
    return this._index;
  }

  /**
   * Check if the chain is done - all handlers are invoked
   */
  done() {
    return this._index === this.handlers.length;
  }

  /**
   * Get the next handler to be invoked
   */
  next() {
    if (this.done()) {
      throw new Error('No more handler is in the chain');
    }
    return this.handlers[this._index++];
  }
}

/**
 * A chain of handlers to be invoked for the given context
 */
export class InvocationHandlerChain<C extends Context = Context> {
  /**
   * A getter for an array of handler functions or binding keys
   */
  private getHandlers: () => HandlerOrKey<C>[];

  /**
   * Create an invocation handler chain with a list of handler functions or
   * binding keys
   * @param context Context object
   * @param handlers An array of handler functions or binding keys
   */
  constructor(context: C, handlers: HandlerOrKey<C>[]);

  /**
   * Create an invocation handler chain with a binding filter and comparator.
   * The handlers are discovered from the context using the binding filter and
   * sorted by the comparator (if provided).
   *
   * @param context Context object
   * @param filter A binding filter function to select handlers
   * @param comparator An optional comparator to sort matched handler bindings
   */
  constructor(
    context: C,
    filter: BindingFilter,
    comparator?: BindingComparator,
  );

  // Implementation
  constructor(
    private context: C,
    handlers: HandlerOrKey<C>[] | BindingFilter,
    comparator?: BindingComparator,
  ) {
    if (typeof handlers === 'function') {
      const handlersView = context.createView(handlers, comparator);
      this.getHandlers = () => {
        const bindings = handlersView.bindings;
        if (comparator) {
          bindings.sort(comparator);
        }
        return bindings.map(b => b.key);
      };
    } else if (Array.isArray(handlers)) {
      this.getHandlers = () => handlers;
    }
  }

  /**
   * Invoke the handler chain
   */
  invokeHandlers(): ValueOrPromise<InvocationResult> {
    // Create a state for each invocation to provide isolation
    const state = new HandlerChainState<C>(this.getHandlers());
    return this.next(state);
  }

  /**
   * Invoke downstream handlers or the target method
   */
  private next(state: HandlerChainState<C>): ValueOrPromise<InvocationResult> {
    // No more handlers
    if (state.done()) {
      return this.invokeTarget();
    }
    // Invoke the next handler in the chain
    return this.invokeNextHandler(state);
  }

  /**
   * Invoke target. It be overridden by subclasses to provide logic to invoke
   * the target.
   */
  invokeTarget() {
    return undefined;
  }

  /**
   * Invoke downstream handlers
   */
  private invokeNextHandler(
    state: HandlerChainState<C>,
  ): ValueOrPromise<InvocationResult> {
    const index = state.index;
    const handler = state.next();
    const handlerFn = this.loadHandler(handler);
    return transformValueOrPromise(handlerFn, fn => {
      /* istanbul ignore if */
      if (debug.enabled) {
        debug('Invoking handler %d (%s) on %s', index, fn.name);
      }
      return fn(this.context, () => this.next(state));
    });
  }

  /**
   * Return the handler function or resolve the handler function as a binding
   * from the context
   *
   * @param handler Handler function or binding key
   */
  private loadHandler(handler: HandlerOrKey<C>) {
    if (typeof handler === 'function') return handler;
    debug('Resolving handler binding %s', handler);
    return this.context.getValueOrPromise(handler) as ValueOrPromise<
      Handler<C>
    >;
  }
}

/**
 * Invoke a chain of handlers with the context
 * @param context Context object
 * @param handlers An array of handler functions or binding keys
 */
export function invokeHandlers<C extends Context = Context>(
  context: C,
  handlers: HandlerOrKey<C>[],
): ValueOrPromise<InvocationResult> {
  const chain = new InvocationHandlerChain(context, handlers);
  return chain.invokeHandlers();
}
