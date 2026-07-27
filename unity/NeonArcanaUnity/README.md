# Neon Arcana: Cyber Rift — Unity 코어 프로토타입

Canvas/JavaScript 웹 버전을 Unity 6 모바일 가로 화면으로 마이그레이션하는 프로젝트다.
전체 3단계 중 **1단계 코어 프로토타입**이 완료된 상태다.

## 열기와 실행

1. Unity Hub에서 이 폴더를 프로젝트로 추가한다.
2. Unity `6000.5.1f1`로 연다.
3. `Assets/Scenes/Main.unity`를 연다.
4. Play 버튼을 누른다.

에디터와 Windows에서는 `WASD`/방향키로 이동하고 마우스로 조준한다. 모바일 입력은 화면 왼쪽 이동 스틱과 오른쪽 조준 스틱을 사용한다.

## 1단계 구현 범위

- 모바일 가로 화면과 트윈스틱 이동·조준
- 가장 가까운 적 자동 조준과 투사체 자동 공격
- 투사체·적·경험치 보석 오브젝트 풀링
- 기본 적 스폰과 시간 기반 난이도 증가
- HP·XP·점수·타이머·적 수 HUD
- 경험치 보석과 가중치 기반 3장 레벨업 카드
- 시작 강화 6종
- 게임 오버와 재시작
- 재사용 가능한 런타임 부트스트랩과 에디터 검증 도구

전체 구현 및 검증 기록은 저장소 루트의 `docs/UNITY_MIGRATION_PHASE1.md`를 참고한다.

## Android 주의사항

개발 PC의 Unity `6000.5.1f1`에는 Android Build Support가 설치되어 있지 않다. APK를 만들기 전에 Unity Hub에서 다음 모듈을 추가해야 한다.

- Android Build Support
- Android SDK & NDK Tools
- OpenJDK
