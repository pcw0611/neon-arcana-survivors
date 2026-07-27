# Neon Arcana: Cyber Rift — Unity Phase 2

Canvas/JavaScript 웹 버전을 Unity 6 모바일 가로 화면으로 마이그레이션하는 프로젝트다.
전체 3단계 중 **2단계 콘텐츠 시스템 확장**까지 완료했다.

## 열기와 실행

1. Unity Hub에서 이 폴더를 프로젝트로 추가한다.
2. Unity `6000.5.1f1`로 연다.
3. `Assets/Scenes/Main.unity`를 연다.
4. Play 버튼을 누른다.

Windows에서는 `WASD`/방향키로 이동하고 마우스로 조준한다.
모바일 입력은 화면 왼쪽 이동 스틱과 오른쪽 조준 스틱을 사용한다.
공격은 자동이다.

## 구현 범위

- 1단계 코어 전투 루프 전체
- 강화 34종
- 유물 카탈로그 21종과 획득 가능한 효과 20종
- 유물 장착, 중첩, 교체, 분해, 도감
- 적 아키타입 6종
- 보스 4종과 옵션 9종
- 보스 제한 시간, 성공/실패, 유물 보상
- 레벨 30 전직 5종
- 성좌탄 관통·폭발·연쇄
- 아스트랄 광검과 수호 위성
- 로컬 최고 점수·전직·마지막 런 저장
- 15분 결정론 시뮬레이션
- Play Mode 스모크 테스트
- Windows 개발 빌드
- Android ARM64 IL2CPP APK 빌드

## 상세 문서

- 1단계: `docs/UNITY_MIGRATION_PHASE1.md`
- 2단계: `docs/UNITY_MIGRATION_PHASE2.md`
- Android 설치 특이 사례: `docs/ANDROID_SETUP_INCIDENT_2026-07-27.md`

문서는 저장소 루트를 기준으로 한다.

## Android 상태

개발 PC에는 다음 환경이 설치되어 있다.

- Unity Android Build Support
- Android SDK
- Android NDK r27c
- OpenJDK 17
- API 35 x86_64 AVD
- AEHD 2.2

ARM64 IL2CPP APK 빌드와 에뮬레이터 설치·실행 스모크는 성공했다.
Android 반복 테스트와 실제 기기 검증은 이후 단계에서 진행한다.

## 남은 3단계

- 실제 Android 기기 성능·발열·멀티터치 검증
- 사이버 리바이어던과 내부 던전
- 길들인 보스 동료
- 오디오
- 전용 프리팹과 애니메이션 폴리싱
- 세이브 버전 관리
- 온라인 랭킹
- Release/AAB 서명과 배포
