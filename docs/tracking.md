# DutyFlow Web UI Issue Tracking

이 문서는 DutyFlow 웹 UI 개선/버그/운영 이슈를 범주별로 추적하기 위한 기준 문서다. 같은 구조의 엑셀 템플릿은 `docs/tracking.xlsx`에 함께 둔다.

## 사용 원칙

- 하나의 행은 하나의 추적 가능한 이슈만 다룬다.
- 재현 가능한 문제는 `Steps`, `Expected`, `Actual`을 반드시 적는다.
- UI 변경 요청은 영향을 받는 화면, 모바일/PC 여부, 완료 기준을 같이 적는다.
- 배포된 변경은 `Release Log`에 배포일, 빌드 결과, 확인 항목을 남긴다.

## 공통 필드

| 필드 | 설명 |
| --- | --- |
| ID | `UI-001` 형식의 고유 번호 |
| Category | 이슈 범주 |
| Area | 화면 또는 기능 영역 |
| Title | 한 줄 요약 |
| Description | 상세 설명 |
| Priority | `P0`, `P1`, `P2`, `P3` |
| Severity | `Blocker`, `High`, `Medium`, `Low` |
| Status | `Backlog`, `Ready`, `In Progress`, `Review`, `Done`, `Blocked` |
| Owner | 담당자 |
| Device | `Mobile`, `Desktop`, `Both` |
| Browser | Chrome, Safari 등 |
| Steps | 재현 절차 |
| Expected | 기대 동작 |
| Actual | 실제 동작 |
| Acceptance Criteria | 완료 기준 |
| Related Files | 관련 파일 경로 |
| Created | 생성일 |
| Updated | 수정일 |
| Release | 반영 버전/배포일 |
| Notes | 기타 메모 |

## 범주

| Category | 목적 | 예시 |
| --- | --- | --- |
| Intro/Auth | 인트로, 로그인, 회원가입, OAuth | 로그인 모달 톤 불일치, SNS 버튼 상태 |
| Navigation | 사이드바, 모바일 탭, 섹션 이동 | 모바일 메뉴 우선순위, 활성 탭 표시 |
| Duty Table | 근무표 이름별/날짜별 테이블 | 요일 행, 셀 높이, 근무 코드 색상 |
| Calendar View | 달력보기, 오늘 근무 요약 | 모바일 카드 순서, 날짜별 상세 표시 |
| Upload/Parsing | 엑셀 업로드, 파싱, 로그 | 날짜 행 인식 실패, 업로드 진행률 |
| Permissions | 권한, 등급, 관리자 승인 | 메뉴 노출 조건, Master 승인 흐름 |
| Data Display | 데이터 포맷, 라벨, 축약어 | Ec/Ea 의미, OFF/연차 표시 |
| Responsive UI | 모바일/태블릿/PC 레이아웃 | 가로 스크롤, 카드 간격, 텍스트 줄바꿈 |
| Visual System | 색상표, 타이포, 간격, 커서 | 근무 타입 팔레트, pointer 커서 |
| Performance | 로딩, 렌더링, API 호출 | 느린 달력 렌더링, 중복 요청 |
| Deployment | 빌드, PM2, nginx, 운영 반영 | 배포 실패, 캐시 반영 지연 |
| Security/Privacy | 인증 전 노출, 개인정보, 접근 제어 | 인증 전 근무 데이터 노출 |

## 우선순위

| Priority | 기준 |
| --- | --- |
| P0 | 운영 사용이 막히거나 데이터가 잘못 저장/노출되는 문제 |
| P1 | 주요 업무 흐름에 직접 영향을 주는 문제 |
| P2 | 사용성, 가독성, UI 일관성 개선 |
| P3 | 낮은 영향도의 정리, 문구, 장기 개선 |

## 상태

| Status | 의미 |
| --- | --- |
| Backlog | 아직 착수하지 않음 |
| Ready | 구현 가능한 상태로 정리됨 |
| In Progress | 작업 중 |
| Review | 확인/검수 중 |
| Done | 배포 또는 완료 확인됨 |
| Blocked | 외부 의존성 또는 결정 대기 |

## 초기 트래킹 항목

| ID | Category | Area | Title | Priority | Status | Acceptance Criteria |
| --- | --- | --- | --- | --- | --- | --- |
| UI-001 | Visual System | Intro/Auth | 인트로 페이지 톤 통일 | P2 | Done | 과한 그라데이션 제거, 슬레이트/화이트 기반으로 통일 |
| UI-002 | Visual System | Global UI | 클릭 가능 요소 pointer 처리 | P2 | Done | button, a, role=button에 pointer 적용 |
| UI-003 | Duty Table | 이름별/날짜별 | 근무 타입은 텍스트 색상만 적용 | P2 | Done | 근무 코드 셀은 배경 제거, 토/일/오늘 배경 유지 |
| UI-004 | Calendar View | 모바일 | 오늘 근무 카드 우선순위 상향 | P1 | Done | 모바일에서 Day/Evening/Mid/Night 요약이 보조 메트릭보다 먼저 표시 |
| UI-005 | Calendar View | 하단 카드 | 보조 카드 간격/패딩 통일 | P2 | Done | 메트릭/테스터 카드 간격과 내부 패딩이 일정함 |

## 검수 체크리스트

| Scope | Check |
| --- | --- |
| Mobile | 360px 폭에서 버튼 텍스트가 넘치지 않음 |
| Mobile | 달력보기에서 오늘 근무 요약이 먼저 보임 |
| Desktop | 클릭 가능한 요소에 pointer 커서가 표시됨 |
| Desktop | 이름별/날짜별 테이블에서 근무 코드 텍스트 색상이 색상표와 일치함 |
| Theme | Light/Dark 양쪽에서 근무 타입 색상 대비가 충분함 |
| Deploy | `npm --prefix duty-web run build` 성공 |
| Deploy | `./deploy.sh` 성공 후 PM2 online, nginx reload 완료 |

