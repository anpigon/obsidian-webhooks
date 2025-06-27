```markdown
# Obsidian Webhooks 프로젝트 분석

## 1. 프로젝트 개요

Obsidian Webhooks는 Obsidian 노트 편집기를 웹훅을 통해 외부 서비스와 연동하여, 다양한 자동화 기능을 제공하는 것을 목표로 하는 프로젝트입니다. 사용자는 IFTTT와 같은 자동화 서비스를 이용하여 외부 앱(예: Spotify, Google Assistant, Slack)에서의 특정 이벤트를 감지하고, 해당 이벤트 정보를 Obsidian 노트에 자동으로 추가할 수 있습니다.

프로젝트는 다음과 같은 주요 부분으로 구성됩니다:

- **Firebase Cloud Functions (`functions`):** 웹훅 요청을 수신하고 처리하며, 사용자 인증 및 데이터 관리를 담당합니다.
- **Obsidian Plugin (`plugin`):** Obsidian 편집기 내에서 실행되며, Firebase와 통신하여 웹훅으로 수신된 데이터를 노트에 적용합니다.
- **Web Application (`web`):** 사용자가 서비스에 가입하고, Obsidian 플러그인에서 사용할 로그인 토큰을 생성하며, 웹훅 URL을 확인할 수 있는 웹 인터페이스를 제공합니다.
- **Shared Library (`shared`):** `plugin`과 `web` 프로젝트 간에 공유되는 Firebase 초기화 및 설정 코드를 포함합니다.

## 2. 디렉터리 구조 및 주요 파일 분석

### 2.1. `functions`

Firebase Cloud Functions를 위한 코드가 위치합니다.

- **`src/index.ts`**:
    - Express를 사용하여 웹훅 엔드포인트 (`/webhook/:key`)를 구현합니다. 이 엔드포인트는 POST 요청을 통해 데이터를 수신하고, 인증된 사용자의 Firebase Realtime Database 내 `buffer` 경로에 데이터를 저장합니다.
    - 새로운 Firebase 사용자가 생성될 때, 해당 사용자를 위한 고유 API 키를 생성하고 데이터베이스에 저장하는 트리거 함수 (`newUser`)를 포함합니다.
    - 사용자가 Obsidian 플러그인에서 데이터를 성공적으로 처리한 후, 해당 데이터를 `buffer`에서 삭제하는 호출 가능 함수 (`wipe`)를 제공합니다.
    - Obsidian 플러그인에서 Firebase 인증을 위한 커스텀 토큰을 생성하는 호출 가능 함수 (`generateObsidianToken`)를 제공합니다.
- **`package.json`**: `firebase-admin`, `firebase-functions`, `express` 등의 의존성을 가집니다. Node.js 14 환경에서 실행됩니다.
- **`database.rules.json`**: Realtime Database의 보안 규칙을 정의합니다. `users`와 `buffer` 데이터는 해당 UID의 인증된 사용자만 읽기/쓰기 가능하도록 제한합니다.
- **`firebase.json`**: Firebase 프로젝트 설정 파일입니다. 데이터베이스 규칙 파일 위치, 함수 배포 전 빌드 명령어, 호스팅 설정 (웹 앱 배포), 에뮬레이터 설정 등을 정의합니다.

### 2.2. `plugin`

Obsidian 편집기용 플러그인 코드가 위치합니다.

- **`main.ts`**:
    - Obsidian 플러그인의 생명주기(로드, 언로드)를 관리합니다.
    - 사용자가 웹 앱에서 발급받은 토큰을 사용하여 Firebase에 로그인하는 기능을 제공합니다.
    - 로그인 후, Firebase Realtime Database의 `buffer/{user.uid}` 경로를 실시간으로 감지(`onValue`)합니다.
    - 새로운 데이터가 감지되면, 해당 데이터를 Obsidian 노트에 추가합니다. 사용자는 설정에서 줄 바꿈 스타일(Windows/Unix/없음)을 선택할 수 있습니다.
    - 데이터 처리 후, `wipe` Cloud Function을 호출하여 Firebase의 `buffer`에서 해당 데이터를 삭제합니다.
    - 플러그인 설정 UI (로그인, 로그아웃, 줄 바꿈 설정 등)를 제공합니다.
- **`manifest.json`**: 플러그인 ID, 이름, 버전, 최소 Obsidian 버전, 설명 등 플러그인 메타데이터를 정의합니다.
- **`package.json`**: `firebase` (클라이언트 SDK), `shared` (공유 Firebase 설정) 등의 의존성을 가집니다. 빌드 도구로 `vite`를 사용합니다.

### 2.3. `shared`

여러 프로젝트에서 공유되는 코드가 위치합니다.

- **`firebase.ts`**:
    - Firebase 앱을 초기화하고 설정하는 공통 모듈입니다.
    - Vite 환경 변수 (`import.meta.env.VITE_FIREBASE_API_KEY`)를 사용하여 Firebase API 키를 주입받습니다.
    - `plugin`과 `web` 프로젝트에서 이 모듈을 가져와 동일한 Firebase 인스턴스를 사용합니다.
- **`package.json`**: `vite`를 개발 의존성으로, `firebase`를 피어 의존성으로 가집니다.

### 2.4. `web`

사용자용 웹 애플리케이션 코드가 위치합니다. SolidJS 프레임워크를 사용합니다.

- **`src/App.tsx`**:
    - 웹 애플리케이션의 메인 UI 컴포넌트입니다.
    - Google 계정을 통한 Firebase 인증 기능을 제공합니다.
    - 인증된 사용자는 "Generate Obsidian Signin Token" 버튼을 클릭하여 `generateObsidianToken` Cloud Function을 호출하고, Obsidian 플러그인에서 사용할 수 있는 커스텀 토큰을 발급받을 수 있습니다.
    - 사용자 고유의 웹훅 URL (Cloud Function 엔드포인트 + API 키)을 표시합니다.
    - "Clear Buffer" 버튼을 통해 `wipe` Cloud Function을 호출하여 Firebase `buffer`에 쌓인 데이터를 초기화할 수 있습니다.
- **`src/main.tsx`**: 웹 애플리케이션의 진입점으로, `App` 컴포넌트를 DOM에 렌더링합니다.
- **`src/store.ts`**: SolidJS의 `createStore`를 사용하여 애플리케이션 전역 상태(Firebase 앱 인스턴스, 현재 사용자, Obsidian 토큰, API 키, 로딩 상태 등)를 관리합니다.
- **`package.json`**: `firebase`, `solid-js`, `tailwindcss` 등의 의존성을 가집니다. 빌드 도구로 `vite`를 사용합니다.

### 2.5. 루트 디렉터리

- **`README.md`**: 프로젝트 소개, 사용 예시, 설정 방법 등을 안내합니다.
- **`.eslintrc.js`**: ESLint 설정을 통해 코드 스타일과 정적 분석 규칙을 정의합니다.
- **`package.json`**: Yarn 워크스페이스를 사용하여 `functions`, `plugin`, `web`, `shared` 모노레포 프로젝트를 관리합니다.
- **각 하위 디렉터리 `tsconfig.json`**: 각 워크스페이스별 TypeScript 컴파일러 옵션을 설정합니다.

## 3. 기술 스택

- **프론트엔드 (Web App)**: SolidJS, TypeScript, TailwindCSS, Vite
- **Obsidian Plugin**: TypeScript, Firebase Client SDK, Vite
- **백엔드 (Cloud Functions)**: Node.js, TypeScript, Firebase Admin SDK, Express
- **데이터베이스**: Firebase Realtime Database
- **인증**: Firebase Authentication (Google Sign-In, Custom Tokens)
- **빌드/개발 도구**: Yarn Workspaces, ESLint, Prettier, TypeScript

## 4. 데이터 흐름 (웹훅 이벤트 발생 시)

1. **외부 서비스 (예: IFTTT)**: 특정 이벤트 발생 (예: Spotify에서 노래 '좋아요' 누름).
2. **IFTTT**: 웹훅 요청을 사용자가 설정한 `obsidian-buffer.cloudfunctions.net/webhook/{apiKey}?path=노트경로.md` URL로 POST 전송. 요청 본문에는 노트에 추가될 마크다운 내용이 포함됨.
3. **Firebase Cloud Functions (`functions/src/index.ts` - `webhook` 함수)**:
    - 요청 URL의 `:key` 파라미터를 사용하여 사용자 인증.
    - 유효한 키일 경우, 요청 본문 데이터와 `path` 쿼리 파라미터를 Firebase Realtime Database의 `buffer/{user.uid}` 경로에 새로운 항목으로 저장. 데이터에는 만료 시간(7일 후)도 포함됨.
4. **Obsidian Plugin (`plugin/main.ts`)**:
    - 사용자가 Obsidian에 로그인되어 있고 플러그인이 활성화된 상태.
    - `buffer/{user.uid}` 경로의 변경 사항을 실시간으로 감지.
    - 새로운 데이터가 감지되면, `path`에 지정된 파일 경로에 해당 마크다운 데이터를 추가 (또는 새 파일 생성).
    - 데이터 처리 후, `wipe` Cloud Function을 호출하여 처리된 데이터를 Firebase `buffer`에서 삭제.
5. **사용자**: Obsidian 노트에서 업데이트된 내용을 확인.

## 5. 주요 기능 및 특징

- **웹훅 기반 노트 자동 추가**: 외부 서비스의 이벤트를 Obsidian 노트에 자동으로 기록.
- **유연한 경로 지정**: 웹훅 URL의 `path` 쿼리 파라미터를 통해 노트가 저장될 경로 및 파일명 지정 가능.
- **Firebase 연동**: 인증, 데이터 저장, 서버리스 함수 실행에 Firebase 플랫폼 활용.
- **Obsidian 플러그인**: Obsidian 편집기 내에서 직접적인 통합 제공.
- **웹 기반 관리**: 사용자 가입, 토큰 발급, 웹훅 URL 확인을 위한 웹 인터페이스 제공.
- **보안**: API 키 및 Firebase 보안 규칙을 통해 사용자 데이터 보호.
- **모노레포 구조**: Yarn 워크스페이스를 사용하여 관련된 여러 프로젝트를 효율적으로 관리.

## 6. 개선 및 고려 사항 (추가 분석 시)

- **오류 처리 및 로깅**: 각 컴포넌트(Cloud Functions, Plugin, Web App)에서의 오류 처리 및 로깅 전략 상세 분석.
- **보안 심층 분석**: API 키 관리, 데이터베이스 규칙의 견고성, 잠재적 취약점 등.
- **확장성**: 현재 구조에서 사용자 증가 및 기능 확장에 대한 고려 사항.
- **테스트 코드**: 단위 테스트 또는 통합 테스트의 존재 여부 및 커버리지. (현재 분석에서는 테스트 코드 파일이 명시적으로 확인되지 않음)
- **배포 프로세스**: 각 컴포넌트의 빌드 및 배포 자동화 수준.
```
