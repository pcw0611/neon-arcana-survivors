# Unity 마이그레이션 현황

> 2026-07-27 — 3단계 완료 판정 철회, 인게임 동등성 재작업 중

일부 조작, 화면, 프리팹 구조를 복구했지만 사용자 검수에서 도감 전면 누락과
월드 스크롤 구조 오류가 확인됐다. 기술 검증 표식은 원작 유사도를 증명하지 않는다.
현재 범위와 우선순위는 `docs/UNITY_MIGRATION_INGAME_PARITY_AUDIT_2026-07-27.md`를 참고한다.

## 구현 또는 기술 검증된 항목

- Unity `6000.5.1f1` 프로젝트와 `Assets/Scenes/Main.unity`
- 모바일 가로 화면과 단일 이동 패드
- 키보드 이동과 광검 마우스 조준
- 가장 가까운 적 자동 표적 성좌탄
- 투사체·적·경험치 풀링
- 강화 34종
- 유물 카탈로그 21종, 활성 획득 20종
- 유물 장착·중첩·교체·분해·도감
- 적 아키타입 6종
- 보스 4종, 보스 옵션 9종
- 보스 제한 시간과 성공/실패 처리
- 레벨 30 전직 5종
- 성좌탄·광검·위성 빌드
- 로컬 최고 점수·전직·마지막 런 저장
- 공간 해시 기반 적 탐색
- 15분 결정론 시뮬레이션
- Phase 2 Play Mode 스모크
- Windows 개발 빌드
- Android ARM64 IL2CPP APK
- Android 에뮬레이터 설치·실행 스모크
- 원작 타이틀·HUD·미니맵·강화 선택
- 핵심 오브젝트 프리팹 10종
- DOTween UI 모션
- Phase 3 자동 화면 캡처
- 도감 술식·유물·전직 3탭과 카드 27/21/5개
- 작전 메뉴의 정지·재개·음소거·히트박스·포기
- 레벨업·전직·유물 FIFO 보상 큐
- 빌드·유물 결과 요약과 재출격·메인 복귀
- HUD 빌드 랭크와 접이식 유물 상세 트레이
- 강화·유물·전직 숫자키 1~5 선택

## 최종 검증 표식

```text
NEON_ARCANA_VALIDATION_OK
NEON_ARCANA_PHASE2_SIMULATION_OK
NEON_ARCANA_PHASE2_PLAY_SMOKE_OK
NEON_ARCANA_PHASE3_VALIDATION_OK
NEON_ARCANA_PHASE3_PLAY_SMOKE_OK
NEON_ARCANA_WINDOWS_BUILD_OK
NEON_ARCANA_ANDROID_BUILD_OK
```

15분 시뮬레이션 기준:

```text
bosses=13
enemyPeak=190
archetypes=68729,15453,13663,8376,8422,6384
bossRarities=2,7,11,4,16
```

## 보류

- Android 반복 배포와 실기기 제품화 검증
- 온라인 랭킹
- 서버 저장·클라우드 동기화
- Release/AAB 서명과 배포

## 인게임 재작업

- 무한 월드 타일, 좌표 기반 그리드, Cinemachine 카메라 스크롤 — 구현·기술 검증 통과, 사용자 승인 대기
- 술식·유물·전직 전체 도감 — 구현·기술 검증 통과, 사용자 승인 대기
- 작전 메뉴 — 구현·기술 검증 통과, 사용자 승인 대기
- HUD 빌드·유물 트레이 — 구현·기술 검증 통과, 사용자 승인 대기
- HUD 보스 경고·미니맵 특수 표적
- 통합 보상 큐와 게임 종료 흐름 — 구현·기술 검증 통과, 사용자 승인 대기
- 강화·유물·전직·적·보스 행동 동등성
- 사이버 리바이어던과 내부 던전
- 조련의 코어와 길들인 보스 동료
- 오디오와 전용 셰이더·파티클·애니메이션
- 전체 플레이 흐름 기반의 원작 비교 검증

## 참고 문서

- `docs/UNITY_MIGRATION_PHASE1.md`
- `docs/UNITY_MIGRATION_PHASE2.md`
- `docs/UNITY_MIGRATION_PHASE3.md`
- `docs/UNITY_MIGRATION_INGAME_PARITY_AUDIT_2026-07-27.md`
- `docs/UNITY_MIGRATION_P0_PROGRESS_2026-07-27.md`
- `docs/UNITY_MIGRATION_FIDELITY_RETROSPECTIVE_2026-07-27.md`
- `docs/ANDROID_SETUP_INCIDENT_2026-07-27.md`
