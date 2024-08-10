# @koranidro/react-utils

## 1. 설치

```bash
npm install @koranidro/react-utils
```

## 2. 용도 및 사용법

### 2-1. useWhileComponentLifecycle

오너 컴포넌트와 동일한 생명주기를 가지는 공간을 할당 및 초기화합니다. 상태와 다르게 리렌더링을 유발하지 않습니다.

사용법은 아래와 같으며, 기본적으로 'useState' 의 사용법과 동일합니다.

```javascript
import { useWhileComponentLifecycle } from "@koranidro/react-utils";

function Component() {
	const [ value, setValue ] = useWhileComponentLifecycle(() => "Hello, World!");
}
```

또는

```javascript
const { useWhileComponentLifecycle } = require("@koranidro/react-utils");

function Component() {
	const [ value, setValue ] = useWhileComponentLifecycle(() => "Hello, World!");
}
```

### 2-2. withoutMountOverwriting

마운트가 연속적으로 발생할 경우, 'useEffect' 에 가장 최근에 등록된 콜백만 여러 번 호출되는 현상을 해결합니다. 모든 콜백을 공정하게 호출하여 동작이 예상 가능하도록 만듭니다.

> 이 현상은 18 버전에 추가된 'StrictMode' 의 '더블 렌더링 시뮬레이션' 기능에서 확인됩니다. 그러나 해당 기능이 단순히 시뮬레이션인 이상, 이 외의 환경에서도 동일한 현상이 발생할 수 있음을 의미합니다.

사용법은 아래와 같습니다.

```javascript
import { withoutMountOverwriting } from "@koranidro/react-utils";

const useEffectWithoutMountOverwriting = withoutMountOverwriting(useEffect);

function Component() {
	useEffectWithoutMountOverwriting(() => {
		// launch
		return () => {
			// clean up
		};
	}, []);
}
```

또는

```javascript
const { withoutMountOverwriting } = require("@koranidro/react-utils");

const useEffectWithoutMountOverwriting = withoutMountOverwriting(useEffect);

function Component() {
	useEffectWithoutMountOverwriting(() => {
		// launch
		return () => {
			// clean up
		};
	}, []);
}
```

### 2-3. useThenCleanUp

생명주기가 종료되거나 값이 변경되면 이전 값을 안전하게 정리합니다. 'Disposable' 유형인 경우에만 사용할 수 있습니다.

사용법은 아래와 같습니다.

```javascript
import { useThenCleanUp } from "@koranidro/react-utils";

function Component() {
	const [ state, setState ] = useState();
	const safeState = useThenCleanUp(state);
}
```

또는

```javascript
const { useThenCleanUp } = require("@koranidro/react-utils");

function Component() {
	const [ state, setState ] = useState();
	const safeState = useThenCleanUp(state);
}
```

### 2-4. useThroughDerivation

파생 상태를 사용합니다.

사용법은 아래와 같습니다.

```javascript
import { useThroughDerivation } from "@koranidro/react-utils";

function Component() {
	const [ state, setState ] = useState();
	const derivedState = useThroughDerivation((...deps) => {
		// init
	}, deps);
}
```

또는

```javascript
const { useThroughDerivation } = require("@koranidro/react-utils");

function Component() {
	const [ state, setState ] = useState();
	const derivedState = useThroughDerivation((...deps) => {
		// init
	}, deps);
}
```

### 3-5. useEventSource

오너 컴포넌트와 동일한 생명주기를 가지는 'EventSource' 를 생성합니다. 생명주기의 종료 또는 의존성 변경 시 객체를 안전하게 정리합니다.

사용법은 아래와 같습니다.

```javascript
import { useEventSource } from "@koranidro/react-utils";

function Component() {
	const eventSource = useEventSource(url, config);
}
```

또는

```javascript
const { useEventSource } = require("@koranidro/react-utils");

function Component() {
	const eventSource = useEventSource(url, config);
}
```

### 3-6. useEventSourceMessageStream

오너 컴포넌트와 동일한 생명주기를 가지는 'ReadableStream' 을 'EventSource' 를 통해 생성합니다. 생명주기의 종료 또는 의존성 변경 시 객체를 안전하게 정리합니다.

사용법은 아래와 같습니다.

```javascript
import { useEventSourceMessageStream } from "@koranidro/react-utils";

function Component() {
	const stream = useEventSourceMessageStream<string>(eventSource, "message");
}
```

또는

```javascript
const { useEventSourceMessageStream } = require("@koranidro/react-utils");

function Component() {
	const stream = useEventSourceMessageStream<string>(eventSource, "message");
}
```

### 3-7. useStreamReader

오너 컴포넌트와 동일한 생명주기를 가지는 'ReadableStreamDefaultReader' 를 생성합니다. 생명주기의 종료 또는 의존성 변경 시 객체를 안전하게 정리합니다.

사용법은 아래와 같습니다.

```javascript
import { useStreamReader } from "@koranidro/react-utils";

function Component() {
	const reader = useStreamReader(stream);
}
```

또는

```javascript
const { useStreamReader } = require("@koranidro/react-utils");

function Component() {
	const reader = useStreamReader(stream);
}
```

### 3-8. read

'ReadableStreamDefaultReader' 를 반복적으로 읽을 수 있는 'AsyncGenerator' 를 생성합니다.

사용법은 아래와 같습니다.

```javascript
import { read } from "@koranidro/react-utils";

const descriptor = read(reader);
```

또는

```javascript
const { read } = require("@koranidro/react-utils");

const descriptor = read(reader);
```

### 3-9. useStateThroughSequence

'AsyncIterable' 로부터 값을 자동 갱신하는 상태를 생성합니다.

사용법은 아래와 같습니다.

```javascript
import { useStreamReader } from "@koranidro/react-utils";

function Component() {
	const sequence = useStateThroughSequence(iterable);
}
```

또는

```javascript
const { useStreamReader } = require("@koranidro/react-utils");

function Component() {
	const sequence = useStateThroughSequence(iterable);
}
```