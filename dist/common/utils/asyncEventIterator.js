"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.asyncEventIterator = asyncEventIterator;
exports.createAsyncEventQueue = createAsyncEventQueue;
/**
 * Convert event emitter subscription to async iterator.
 *
 * Handles the common pattern of:
 * 1. Subscribe to events
 * 2. Yield events as async iterator
 * 3. Unsubscribe on cleanup
 *
 * Usage:
 * ```ts
 * yield* asyncEventIterator<MyEvent>(
 *   (handler) => emitter.on('event', handler),
 *   (handler) => emitter.off('event', handler)
 * );
 * ```
 *
 * Or with initialValue for immediate first yield:
 * ```ts
 * yield* asyncEventIterator<MyState>(
 *   (handler) => service.onChange(handler),
 *   (handler) => service.offChange(handler),
 *   { initialValue: await service.getState() }
 * );
 * ```
 */
async function* asyncEventIterator(subscribe, unsubscribe, options) {
    const queue = [];
    let resolveNext = null;
    let ended = false;
    const handler = (value) => {
        if (ended)
            return;
        if (resolveNext) {
            const resolve = resolveNext;
            resolveNext = null;
            resolve(value);
        }
        else {
            queue.push(value);
        }
    };
    subscribe(handler);
    try {
        // Yield initial value if provided
        if (options?.initialValue !== undefined) {
            yield options.initialValue;
        }
        while (!ended) {
            if (queue.length > 0) {
                yield queue.shift();
            }
            else {
                yield await new Promise((resolve) => {
                    resolveNext = resolve;
                });
            }
        }
    }
    finally {
        ended = true;
        unsubscribe(handler);
    }
}
/**
 * Create an async event queue that can be pushed to from event handlers.
 *
 * This is useful when events don't directly yield values but trigger
 * async state fetches.
 *
 * Usage:
 * ```ts
 * const queue = createAsyncEventQueue<State>();
 *
 * const onChange = async () => {
 *   queue.push(await fetchState());
 * };
 *
 * emitter.on('change', onChange);
 * try {
 *   yield* queue.iterate();
 * } finally {
 *   emitter.off('change', onChange);
 * }
 * ```
 */
function createAsyncEventQueue() {
    const queue = [];
    let resolveNext = null;
    let ended = false;
    const push = (value) => {
        if (ended)
            return;
        if (resolveNext) {
            const resolve = resolveNext;
            resolveNext = null;
            resolve(value);
        }
        else {
            queue.push(value);
        }
    };
    async function* iterate() {
        while (!ended) {
            if (queue.length > 0) {
                yield queue.shift();
            }
            else {
                yield await new Promise((resolve) => {
                    resolveNext = resolve;
                });
            }
        }
    }
    const end = () => {
        ended = true;
        // Wake up the iterator if it's waiting
        if (resolveNext) {
            // This will never be yielded since ended=true stops the loop
            resolveNext(undefined);
        }
    };
    return { push, iterate, end };
}
//# sourceMappingURL=asyncEventIterator.js.map