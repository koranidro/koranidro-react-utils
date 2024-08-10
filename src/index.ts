import React, { useEffect, useRef, useState } from "react";

function useWhileComponentLifecycle<S>(): [ S | undefined, (newValue: S | ((prev: S | undefined) => S)) => void ];
function useWhileComponentLifecycle<S>(initialValue: S | (() => S)): [ S, (newValue: S | ((prev: S) => S)) => void ];

function useWhileComponentLifecycle<S>(initialValue?: S | (() => S)): [ S | undefined, (newValue: S | ((prev: S | undefined) => S)) => void ] {
	const ref = useRef<S>();
	const didInitRef = useRef(false);
	if(!didInitRef.current) {
		ref.current = initialValue instanceof Function ? initialValue() : initialValue;
		didInitRef.current = true;
	}
	return [ ref.current, (newValue) => { ref.current = newValue instanceof Function ? newValue(ref.current) : newValue; } ];
}

interface MountingSideEffectManager {
	get remainingCount(): number;
	get lastId(): number;
	register(effect: React.EffectCallback): number;
	next(id: number): React.EffectCallback | null;
}

class MultipleMountingSideEffectManager implements MountingSideEffectManager {
	private doingMount = false;
	private effectMap = new Map<number, React.EffectCallback>();
	private minId = 1;
	private autoIncrement = 1;
	private org = 0;
	private toNext = 0;

	get remainingCount(): number { return this.effectMap.size; }

	get lastId(): number { return this.autoIncrement - 1; }

	register(effect: React.EffectCallback): number {
		if(this.doingMount) {
			throw new Error(
				"현재 마운트 진행 중입니다." +
				"마운트 작업 도중에는 새로운 부수 효과를 등록할 수 없습니다" +
				"마운트 작업이 완전히 종료된 후 다시 시도하십시오."
			);
		}

		const id = this.autoIncrement++;
		this.effectMap.set(id, effect);
		return id;
	}

	next(id: number): React.EffectCallback | null {
		if(id < this.minId || id > this.lastId) { return null; }

		if(!this.doingMount) {
			this.doingMount = true;
			this.toNext = this.org = -id + this.minId;
		}

		const targetId = this.org + id;
		if(this.toNext === -id + this.minId) { this.toNext--; }

		const effect = this.effectMap.get(targetId)!;
		this.effectMap.delete(targetId);
		if(id === this.lastId) {
			this.org += this.org - this.toNext;
			this.toNext = this.org;
		}
		if(this.effectMap.size < 1) {
			this.doingMount = false;
			this.minId = this.autoIncrement;
		}
		return effect;
	}
}

class DoubleMountingSideEffectManager implements MountingSideEffectManager {
	private manager = new MultipleMountingSideEffectManager();
	private doingSecondMount = false;
	private footprints: number[] = [];

	get remainingCount(): number { return this.manager.remainingCount; }

	get lastId(): number { return this.manager.lastId; }

	register(effect: React.EffectCallback): number { return this.manager.register(effect); }

	next(id: number): React.EffectCallback | null {
		if(!this.doingSecondMount) {
			const effect = this.manager.next(id);
			if(effect === null) { return null; }

			this.footprints.push(id);
			if(id === this.lastId) {
				this.doingSecondMount = this.remainingCount > 0;
				if(!this.doingSecondMount) { this.footprints = []; }
			}
			return effect;
		}

		while(this.remainingCount > this.footprints.length) {
			const disposers = this.footprints.map(id => this.manager.next(id)!());
			disposers.forEach(disposer => disposer?.());
		}

		const effect = this.manager.next(id);
		if(id === this.lastId) {
			this.doingSecondMount = false;
			this.footprints = [];
		}
		return effect;
	}
}

function withoutMountOverwriting(useSideEffect: typeof useEffect): typeof useEffect {
	const manager = new DoubleMountingSideEffectManager();

	return function (...[effect, deps]: Parameters<typeof useEffect>): ReturnType<typeof useEffect> {
		const [ id ] = useWhileComponentLifecycle(() => manager.register(effect));
		return useSideEffect(() => (manager.next(id) ?? effect)(), deps);
	}
}

const useEffectWithoutMountOverwriting = withoutMountOverwriting(useEffect);

function useThenCleanUp<S extends Disposable>(state: S): S;
function useThenCleanUp<S extends Disposable>(state?: S): S | undefined;

function useThenCleanUp<S extends Disposable>(state?: S): S | undefined {
	useEffectWithoutMountOverwriting(() => {
		return () => { state?.[Symbol.dispose](); };
	}, [ state ]);
	return state;
}

function useCache<T>(comparer: (oldValue: T | undefined, newValue: T) => boolean, value: T): boolean {
	const cacheRef = useRef<T>();
	const hit = comparer(cacheRef.current, value);
	cacheRef.current = value;

	return hit;
}

function useThroughDerivation<S, D extends [any, ...any[]]>(factory: (...deps: D) => S, deps: D): S {
	let [ value, setValue ] = useWhileComponentLifecycle(() => factory(...deps));
	const hit = useCache((oldDeps, newDeps) => {
		if(oldDeps ===  undefined) { return false; }
		return !oldDeps.some((dep, i) => !Object.is(dep, newDeps[i]));
	}, deps);
	let [ didInit, setDidInit ] = useWhileComponentLifecycle(false);

	if(hit) { return value; }
	if(!didInit) {
		setDidInit(true);
		return value;
	}
	setValue(value = factory(...deps));

	return value;
}

function extendToDisposable<T>(target: T, disposer: () => void): T & Disposable {
	const extended = target as T & Disposable;
	extended[Symbol.dispose] = disposer;
	return extended;
}

function useEventSource(...args: ConstructorParameters<typeof EventSource>): EventSource {
	return useThenCleanUp(
		useThroughDerivation((...args) => {
			const eventSource = new EventSource(...args);
			return extendToDisposable(eventSource, () => eventSource.close());
		}, args)
	);
}

async function sleep(ms: number) {
	return new Promise<void>(resolve => { setTimeout(() => { resolve(); }, ms); });
}

async function yieldToNext() {
	return sleep(0);
}

async function safelyCloseReadableStream(stream: ReadableStream, reason?: any) {
	for(; stream.locked;) {
		try { await stream.cancel(reason); } catch(e) { await yieldToNext(); }
	}
}

function eventSourceMessageStream<T>(src: EventSource, topic: string): ReadableStream<T> {
	let disposer!: () => void;
	return new ReadableStream<T>({
		start(controller) {
			function handle(this: EventSource, e: Event | MessageEvent<T>) {
				switch(e.type) {
					case topic:
						controller.enqueue((e as MessageEvent<T>).data);
						break;
					case "error":
						if(this.readyState === EventSource.CLOSED) {
							controller.close();
							disposer();
						}
				}
			}

			src.addEventListener(topic, handle);
			src.addEventListener("error", handle);

			disposer = () => {
				src.removeEventListener(topic, handle);
				src.removeEventListener("error", handle);
			};
		},
		cancel() { disposer(); }
	});
}

function useEventSourceMessageStream<T>(src: EventSource, topic: string): ReadableStream<T> {
	return useThenCleanUp(
		useThroughDerivation((src, topic) => {
			const stream = eventSourceMessageStream<T>(src, topic);
			return extendToDisposable(stream, () => safelyCloseReadableStream(stream));
		}, [ src, topic ])
	);
}

function useStreamReader<T>(stream: ReadableStream<T>): ReadableStreamDefaultReader<T> {
	return useThenCleanUp(
		useThroughDerivation((stream) => {
			const reader = stream.getReader();
			return extendToDisposable(reader, () => {
				reader.releaseLock();
			});
		}, [ stream ])
	);
}

async function* read<T>(reader: ReadableStreamDefaultReader<T>) {
	for(;;) {
		let result;
		try { result = await reader.read(); } catch(_) { break; }
		if(result.done) { break; }
		yield result.value;
	}
}

function useStateThroughSequence<T>(sequence: AsyncIterable<T>): T | undefined;
function useStateThroughSequence<T>(sequence: AsyncIterable<T>, initialValue: T | (() => T)): T;

function useStateThroughSequence<T>(sequence: AsyncIterable<T>, initialValue?: T | (() => T)): T | undefined {
	let [ state, setState ] = useState(initialValue);
	useEffectWithoutMountOverwriting(() => {
		const seq = sequence instanceof Function ? sequence() : sequence;

		let wantExit = false;
		(async () => {
			for await(let it of seq) {
				if(wantExit) { break; }
				setState(state = it);
			}
		})();
		return () => { wantExit = true; };
	}, [ sequence ]);
	return state;
}

export { useWhileComponentLifecycle, withoutMountOverwriting, useThenCleanUp, useThroughDerivation, useEventSource, useEventSourceMessageStream, useStreamReader, read, useStateThroughSequence };