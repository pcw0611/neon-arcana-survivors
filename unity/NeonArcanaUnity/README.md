# Neon Arcana: Cyber Rift — Unity Phase 3 재작업

Canvas/JavaScript 웹 버전을 Unity 6 모바일 가로 화면으로 마이그레이션하는 프로젝트다.
**사용자 검수 후 3단계 완료 판정을 철회했다.**
도감 전체 UI와 월드 스크롤을 포함한 인게임 동등성을 전수 재감사하고 있다.

## 열기와 실행

1. Unity Hub에서 이 폴더를 프로젝트로 추가한다.
2. Unity `6000.5.1f1`로 연다.
3. `Assets/Scenes/Main.unity`를 연다.
4. Play 버튼을 누른다.

현재 빌드는 Windows에서 `WASD`/방향키로 이동한다.
성좌탄은 가장 가까운 적을 자동 공격하고, 마우스는 광검 방향만 조준한다.
모바일 입력은 화면 왼쪽의 이동 패드 하나만 사용한다.

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
- 원작 타이틀·HUD·미니맵·강화 선택 복구
- 성좌탄 자동 표적과 광검 방향 조준 분리
- 실제 프리팹 9종
- DOTween UI 모션
- Windows 화면 자동 캡처 기반의 제한적 기술 검증

위 목록은 존재하거나 기술 테스트를 통과한 항목을 뜻한다.
원작과 같은 품질·동작으로 승인됐다는 뜻은 아니다.

## 상세 문서

- 1단계: `docs/UNITY_MIGRATION_PHASE1.md`
- 2단계: `docs/UNITY_MIGRATION_PHASE2.md`
- 3단계: `docs/UNITY_MIGRATION_PHASE3.md`
- 인게임 동등성 재감사: `docs/UNITY_MIGRATION_INGAME_PARITY_AUDIT_2026-07-27.md`
- 유사도 이탈 회고: `docs/UNITY_MIGRATION_FIDELITY_RETROSPECTIVE_2026-07-27.md`
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

## 현재 우선순위

당분간 인게임만 수정한다.

- 무한 월드 타일·그리드·카메라 스크롤
- 술식·유물·전직 3개 탭을 가진 전체 도감
- HUD·게임 메뉴·보상 큐
- 강화·유물·전직·보스의 원작 동등성
- 사이버 리바이어던과 내부 던전
- 길들인 보스 동료
- 인게임 오디오·셰이더·파티클·애니메이션·카메라 피드백

다음 항목은 인게임 승인 뒤로 미룬다.

- 실제 Android 기기 반복 배포와 제품화 검증
- 온라인 랭킹
- 서버 저장과 클라우드 동기화
- Release/AAB 서명과 배포
