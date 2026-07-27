# Android 개발 환경 설치 특이 사례 및 사용량 증가 메모

> 작성일: 2026-07-27
>
> 대상: Unity `6000.5.1f1`, Windows 11, AMD Ryzen 9 7950X3D
>
> 목적: 같은 설치 문제와 불필요한 Codex 사용량 증가를 다시 겪지 않기 위한 사후 기록

## 1. 결론

Android 개발 환경은 최종적으로 정상 설치되었다.

- Unity Android Build Support: 정상
- Android SDK: 정상
- Android NDK: `r27c`
- OpenJDK: `17.0.18`
- Android Emulator: `36.6.11`
- 가속 드라이버: AEHD `2.2`
- 테스트 AVD: API 35 / Google APIs / x86_64
- ARM64 앱 번역: `libndk_translation.so`
- Unity ARM64 IL2CPP APK 빌드: 성공
- 에뮬레이터 설치 및 실행: 성공

설치가 길어진 직접 원인은 **디스크 여유 공간 부족과 Unity Hub의 불충분한 설치 전 공간 검사**였다.
Codex 사용량이 비정상적으로 커진 원인은 이 설치 실패를 여러 번 진단한 것에 더해,
두 번의 불필요하게 큰 도구 출력이 대화 컨텍스트에 들어간 것이었다.

정확한 토큰 수나 과금액은 이 저장소나 작업 환경에서 확인할 수 없으므로 추측하지 않는다.
이 문서는 확인 가능한 명령, 로그, 파일 크기와 재발 방지 절차만 기록한다.

## 2. 최초 증상

Unity Hub CLI로 다음 모듈을 설치하려 했다.

```text
android
android-sdk-ndk-tools
android-open-jdk
```

공식 Android Support 설치기는 다운로드와 무결성 검사를 통과했지만 다음 명령에서 종료 코드 `2`를 반환했다.

```text
UnitySetup-Android-Support-for-Editor-6000.5.1f1.exe /S /D=C:\Program Files\Unity\Hub\Editor\6000.5.1f1
```

Hub 로그의 주요 사실은 다음과 같다.

- 대상 경로 권한 검사: 통과
- `modules.json` 검사: 통과
- 설치 파일 접근성 검사: 통과
- 설치 파일 MD5: 공식 값과 일치
- 설치기 표준 오류 출력: 없음
- 설치기 종료 코드: `2`

다운로드 손상이나 권한 문제처럼 보이지 않았기 때문에 원인이 바로 드러나지 않았다.

## 3. 실제 원인

Unity Hub는 설치 전 여유 공간을 검사할 때 Android Support 설치 EXE의 압축 크기만 사용했다.

| 항목 | 크기 |
|---|---:|
| Hub가 검사한 설치 파일 크기 | 1,272,991,800바이트, 약 1.19GiB |
| `modules.json`의 실제 설치 크기 | 5,569,949,730바이트, 약 5.19GiB |

당시 C: 여유 공간은 압축 파일을 받기에는 충분했지만, 설치 파일 전체를 풀기에는 부족했다.
그 결과 NSIS 설치기가 압축 해제 도중 종료 코드 `2`로 중단됐으며 명확한 오류 문구는 남기지 않았다.

두 실패본의 형태도 디스크 고갈과 일치했다.

| 실패본 | 파일 크기 합 | 상태 |
|---|---:|---|
| 첫 번째 부분 설치 | 1,838,892,942바이트, 약 1.71GiB | Development 런타임 일부까지 존재 |
| 두 번째 부분 설치 | 204,622,675바이트, 약 0.19GiB | 공통 ARM64 라이브러리도 중간에서 잘림 |

두 번째 시도가 더 이른 위치에서 끝난 이유는 첫 번째 실패본과 다운로드 캐시가 공간을 계속 차지했기 때문이다.

사용자가 C: 공간을 확보한 뒤 공식 설치기를 빈 `AndroidPlayer` 경로에 다시 실행하자 다음 결과로 정상 완료됐다.

```text
파일 수: 830
설치 크기: 5,569,949,730바이트
Development ARM64 runtime: 존재
Release ARM64 runtime: 존재
```

## 4. 수행한 복구 절차

복구는 삭제보다 보존과 검증을 우선했다.

1. 불완전한 `AndroidPlayer` 폴더를 별도 이름으로 이동했다.
2. 공식 설치 EXE의 MD5가 `modules.json` 값과 일치하는지 확인했다.
3. C: 여유 공간을 60GiB 이상 확보했다.
4. 활성 `AndroidPlayer` 경로를 비운 상태에서 공식 설치기를 다시 실행했다.
5. 설치 후 파일 수, 총 크기, Development/Release ARM64 런타임을 확인했다.
6. 외부 SDK/NDK/JDK 경로를 Unity EditorPrefs에 연결했다.
7. Unity에서 ARM64 IL2CPP APK를 실제로 빌드했다.
8. APK를 AVD에 설치하고 Unity 액티비티가 포그라운드에서 실행되는지 확인했다.

부분 설치본은 정상 빌드가 확인될 때까지 보존했다가, 사용자의 정리 요청 후 제거했다.

## 5. 디스크 사용량이 커진 이유

정리 전 Android/Unity 관련 경로의 파일 크기 합은 약 `29.23GiB`였다.

| 항목 | 정리 전 크기 | 필요 여부 |
|---|---:|---|
| 정상 Unity AndroidPlayer | 5.187GiB | 필요 |
| AndroidPlayer 실패본 두 개 | 1.904GiB | 불필요 |
| Android SDK 전체 | 8.922GiB | 일부 필요 |
| └ API 35 ARM64 시스템 이미지 | 3.779GiB | Windows에서 부팅 불가 |
| └ API 35 x86_64 시스템 이미지 | 3.497GiB | 에뮬레이터에 필요 |
| └ Emulator 본체 | 0.949GiB | 에뮬레이터에 필요 |
| NDK r27c | 2.199GiB | ARM64 IL2CPP 빌드에 필요 |
| OpenJDK 17 | 0.223GiB | Gradle 빌드에 필요 |
| x86_64 AVD 사용자 데이터 | 5.440GiB | 에뮬레이터에 필요 |
| Unity Hub 다운로드 캐시 | 2.389GiB | 불필요 |
| Unity 프로젝트 `Library` | 2.785GiB | 재생성 가능한 작업 캐시 |
| 빌드 결과 | 0.183GiB | 결과 확인용 |

2026-07-27 정리에서 다음 항목을 제거했다.

- AndroidPlayer 실패본 두 개
- Unity Hub Android 설치 다운로드 캐시
- Windows x86_64 호스트에서 부팅할 수 없는 API 35 ARM64 시스템 이미지
- ARM64 AVD 정의

C: 표시 기준 여유 공간은 약 `51.5GiB`에서 `59.14GiB`로 증가했다.
파일 크기 합과 실제 회수량이 정확히 일치하지 않는 이유는 AVD 디스크 이미지의 희소 파일과 파일 시스템 할당 단위 때문이다.

다음 항목은 유지했다.

- 정상 Unity AndroidPlayer
- Android SDK 기본 도구
- NDK r27c
- OpenJDK 17
- API 35 x86_64 시스템 이미지
- `NeonArcana_API35_X64` AVD
- AEHD 2.2 가속 드라이버
- 작업 중인 Unity `Library` 캐시

## 6. PC 에뮬레이터 구성에서 발견한 제약

Unity 6 Android 빌드는 ARM64를 사용한다.
처음에는 API 35 ARM64 시스템 이미지를 설치했지만 Windows x86_64 호스트에서 다음 오류로 부팅이 차단됐다.

```text
Avd's CPU Architecture 'arm64' is not supported by the QEMU2 emulator on x86_64 host.
System image must match the host architecture.
```

따라서 최종 구성은 다음과 같다.

```text
게스트 OS: API 35 Google APIs x86_64
호스트 가속: AEHD 2.2
앱 ABI: ARM64
앱 번역: libndk_translation.so
GPU: host
```

부팅 후 확인한 값은 다음과 같다.

```text
ro.product.cpu.abilist=x86_64,arm64-v8a
ro.dalvik.vm.native.bridge=libndk_translation.so
sys.boot_completed=1
```

이 구성으로 ARM64 Unity APK의 설치와 실행에는 성공했다.
다만 Unity 공식 지원 관점에서 Android 에뮬레이터는 최종 성능 인증 환경이 아니다.
에뮬레이터는 설치, 부팅, 기본 입력, 렌더링, 즉시 크래시 여부를 확인하는 스모크 테스트에만 사용한다.
성능, 발열, 배터리, 멀티터치, 백그라운드 복귀, 제조사 GPU 문제는 실제 ARM64 기기에서 검증해야 한다.

## 7. Codex 사용량이 커진 이유

### 7.1 필요한 사용량

다음 작업은 설치를 끝내기 위해 필요했다.

- Hub 설치 로그와 `modules.json` 대조
- 부분 설치본 크기 및 핵심 런타임 확인
- SDK/NDK/JDK 버전 검증
- Unity 컴파일, 시뮬레이션, Play Mode 스모크 테스트
- IL2CPP/Gradle APK 빌드
- AVD 부팅, ADB 설치, 로그 확인

대용량 SDK나 시스템 이미지 다운로드 자체는 다운로드 바이트만큼 모델 토큰을 쓰는 작업은 아니다.
모델 사용량은 명령을 계획하고 결과 텍스트를 읽고 다음 조치를 판단할 때 증가한다.

### 7.2 피할 수 있었던 사용량

두 가지 도구 호출은 명백히 피할 수 있었다.

1. Unity 바이너리 DLL을 `rg -a`로 검색했다.
   - 필요한 심볼 몇 개만 확인하면 됐지만 DLL 내부 문자열이 대량 출력됐다.
   - 긴 바이너리 문자열이 대화 컨텍스트에 들어가 사용량을 크게 늘렸다.

2. Unity `Library`를 재귀 검색하는 PowerShell 정규식에 잘못된 끝 백슬래시를 사용했다.
   - 각 파일마다 동일한 정규식 예외가 반복되어 매우 큰 오류 출력이 발생했다.
   - 검색 전에 정규식을 작은 입력으로 검증하거나 `rg --files | rg`를 사용했어야 했다.

그 외 설치 진행률을 자주 확인한 것과 실패한 설치기를 여러 번 재시도한 것도 사용량을 늘렸지만,
위 두 대량 출력에 비하면 영향이 작다.

추론 강도를 일시적으로 Ultra로 올린 구간도 계산 자원 사용을 늘릴 수 있다.
다만 실제 토큰/과금 텔레메트리는 이 작업 환경에서 읽을 수 없으므로 정확한 수치를 문서에 적지 않는다.

## 8. 다음 작업자가 따라야 할 최소 절차

### 설치 전

1. C: 여유 공간을 최소 15GiB, 권장 25GiB 이상 확보한다.
2. Unity와 Hub를 모두 종료한다.
3. Unity Hub의 `Installs → Manage → Add modules`에서 다음을 한 번에 선택한다.
   - Android Build Support
   - Android SDK & NDK Tools
   - OpenJDK
4. 설치 중에는 `AndroidPlayer` 부분 폴더를 수동으로 합치지 않는다.

### 설치 후

다음을 확인한다.

```text
AndroidPlayer 총 크기 약 5.57GB
Development/StaticLibs/arm64-v8a/libunityruntime.a 존재
Release/StaticLibs/arm64-v8a/libunityruntime.a 존재
NDK r27c
OpenJDK 17
adb 실행 가능
```

파일 존재 확인만으로 끝내지 말고 작은 ARM64 개발 APK를 한 번 빌드한다.

### 에뮬레이터

Windows AMD64 PC에서는 ARM64 시스템 이미지를 설치하지 않는다.

1. API 35 Google APIs x86_64 이미지를 사용한다.
2. `emulator -accel-check`가 종료 코드 `0`인지 확인한다.
3. 필요하면 AEHD를 설치한다.
4. `ro.product.cpu.abilist`에 `arm64-v8a`가 있는지 확인한다.
5. `ro.dalvik.vm.native.bridge`가 `libndk_translation.so`인지 확인한다.

## 9. 도구 출력 재발 방지 규칙

- 바이너리 DLL에 `rg -a`를 사용하지 않는다.
- 바이너리 심볼은 Reflection, 제한된 `strings`, 공식 API 문서 순서로 확인한다.
- 모든 진단 출력은 먼저 `-m`, `Select-Object -First`, `-Tail`로 제한한다.
- 정규식은 작은 파일 하나에 먼저 적용한다.
- 재귀 PowerShell 루프에서 예외가 반복될 수 있으면 `$ErrorActionPreference = 'Stop'`을 사용한다.
- 설치 진행률은 20~30초 간격의 짧은 상태 값만 출력한다.
- 같은 실패를 재시도하기 전에 디스크, 권한, 체크섬, 대상 경로 네 항목을 먼저 판정한다.
- 정확한 과금 수치를 볼 수 없으면 추측하지 않는다.

## 10. 최종 상태

Android 환경은 나중에 다시 테스트할 수 있도록 유지했다.

```text
Unity: 6000.5.1f1
SDK: API 34/36 플랫폼 및 Build Tools 36
NDK: r27c
JDK: 17.0.18
Emulator: 36.6.11
Acceleration: AEHD 2.2
AVD: NeonArcana_API35_X64
```

현재 Phase 2 작업에서는 Android 반복 테스트를 중단하고 Windows/Editor 검증과 문서화에 집중한다.
