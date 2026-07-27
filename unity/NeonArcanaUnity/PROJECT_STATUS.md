# Unity 마이그레이션 현황

> 2026-07-27 — 3단계 중 2단계 완료

## 완료

- Unity `6000.5.1f1` 프로젝트와 `Assets/Scenes/Main.unity`
- 모바일 가로 화면과 듀얼 스틱
- 키보드 이동과 마우스 조준
- 자동 공격과 투사체·적·경험치 풀링
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

## 최종 검증 표식

```text
NEON_ARCANA_VALIDATION_OK
NEON_ARCANA_PHASE2_SIMULATION_OK
NEON_ARCANA_PHASE2_PLAY_SMOKE_OK
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

- Android 반복 테스트와 실기기 프로파일링
- 사이버 리바이어던과 내부 던전
- 조련의 코어와 길들인 보스 동료
- 오디오
- 전용 프리팹·애니메이션 폴리싱
- 세이브 버전 관리
- 온라인 랭킹
- Release/AAB 서명과 배포

## 참고 문서

- `docs/UNITY_MIGRATION_PHASE1.md`
- `docs/UNITY_MIGRATION_PHASE2.md`
- `docs/ANDROID_SETUP_INCIDENT_2026-07-27.md`
