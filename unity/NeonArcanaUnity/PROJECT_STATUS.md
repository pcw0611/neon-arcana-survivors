# 코어 프로토타입 현황

## 완료

- Unity `6000.5.1f1` 프로젝트와 `Assets/Scenes/Main.unity`
- 모바일 가로 화면
- 왼쪽 이동 스틱과 오른쪽 조준 스틱
- 에디터·Windows용 키보드 이동과 마우스 조준
- 가장 가까운 적 보조 조준과 투사체 자동 공격
- 투사체·적·경험치 보석 오브젝트 풀링
- 원본 Astra·Shade·사이버 도시 에셋
- 시간 기반 적 스폰과 난이도 공식
- HP·XP·레벨·타이머·점수·적 수 HUD
- 가중치 기반 레벨업 강화 6종
- 피격 표시·게임 오버·재시작
- 결정론적 밸런스 공식 검증
- 부트스트랩·HUD·스폰·발사·킬을 검사하는 Play Mode 스모크 테스트
- Windows 개발 빌드

## 검증 결과

- 정적 검증: `NEON_ARCANA_VALIDATION_OK`
- Play Mode 스모크: `NEON_ARCANA_PLAY_SMOKE_OK enemies=5 kills=3 elapsed=4.95`
- Windows 빌드: 성공
- Windows 헤드리스 실행: 7초 동안 게임 예외 없음

## 1단계에 포함하지 않은 범위

- 강화 약 30종과 유물 전체
- 적 아키타입과 보스
- 레벨 30 전직 5종
- 리바이어던 내부 던전과 동료
- 오디오
- 저장·도감·온라인 랭킹
- Android APK

## Android 선행조건

Unity `6000.5.1f1` 에디터는 설치되어 있으나 Android Build Support, SDK/NDK Tools, OpenJDK 모듈이 없다. APK 빌드 전에 Unity Hub에서 이 모듈들을 추가해야 한다.
