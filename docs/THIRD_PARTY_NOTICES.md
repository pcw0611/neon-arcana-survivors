# 제3자 라이브러리 기록

> 기준일: 2026-07-27

## DOTween Free

- 제품: DOTween Free
- 버전: `1.3.030`
- 저작권: Copyright © 2014–2026 Daniele Giardini / Demigiant
- 공식 사이트: <https://dotween.demigiant.com/>
- 공식 저장소: <https://github.com/Demigiant/dotween>
- 라이선스: <https://dotween.demigiant.com/license.php>
- 프로젝트 위치: `unity/NeonArcanaUnity/Assets/Plugins/Demigiant/DOTween`

공식 배포 ZIP의 UnityPackage를 프로젝트에 가져왔다.
현재 타이틀, 모달, 선택 카드의 진입 모션과 반복 펄스에만 사용한다.

라이선스 원문은 위 공식 라이선스 페이지를 기준으로 확인한다.
배포본에 포함된 `readme.txt`에도 저작권과 공식 라이선스 링크가 기록돼 있다.

## Cinemachine

- 패키지: `com.unity.cinemachine`
- 버전: `3.1.7`
- 공급자: Unity Technologies
- 출처: Unity Package Registry
- 문서: <https://docs.unity3d.com/Packages/com.unity.cinemachine@3.1/manual/index.html>
- 용도: 2D 플레이어 추적 감쇠, 피격·보스 카메라 피드백, 이후 줌·블렌드
- 적용 위치: `unity/NeonArcanaUnity/Packages/manifest.json`

Cinemachine은 Unity 공식 패키지이며 사용 조건은 Unity 패키지와 에디터의 적용 약관을 따른다.
도시 무한 타일과 월드 그리드는 Cinemachine에 맡기지 않고 별도 인게임 컴포넌트로 구현한다.

## TextMesh Pro

- 패키지: `com.unity.ugui`
- 현재 버전: `2.5.0`
- 공급자: Unity Technologies
- 출처: Unity Package Registry
- 용도: 도감·HUD·선택 카드의 한글 SDF 텍스트, 외곽선, 글로우, 자동 크기 조절

Unity 6 프로젝트에서는 TextMesh Pro 코드가 UGUI 패키지에 포함돼 있어 별도 패키지를
추가하지 않는다. 실제 전환 시 TMP 필수 리소스와 라이선스가 명확한 한글 폰트 에셋을
프로젝트에 포함하고, 해당 폰트의 출처와 라이선스를 이 문서에 추가한다.
