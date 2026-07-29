using System;
using Unity.Cinemachine;
using UnityEngine;
using UnityEngine.EventSystems;
using UnityEngine.Rendering;
using UnityEngine.Rendering.Universal;

namespace NeonArcana
{
    public static class NeonGameBootstrap
    {
        /// <summary>스모크/캡처에서 블룸이 실제로 구성됐는지 확인하기 위한 표식.</summary>
        public static bool NeonBloomConfigured { get; private set; }

        /// <summary>
        /// 웹 원본은 거의 모든 draw에 <c>ctx.shadowBlur</c>를 걸어 네온 발광을 만든다.
        /// Unity에서는 그에 대응하는 것이 HDR + 블룸이라, 이게 없으면 아무리 스프라이트가 정확해도
        /// 화면 전체가 납작하고 어둡게 보인다. 카메라와 글로벌 볼륨을 코드로 구성해 항상 켜지도록 한다.
        /// </summary>
        private static void ConfigureNeonPostProcessing(Camera camera)
        {
            var cameraData = camera.GetUniversalAdditionalCameraData();
            cameraData.renderPostProcessing = true;
            cameraData.antialiasing = AntialiasingMode.SubpixelMorphologicalAntiAliasing;

            var profile = ScriptableObject.CreateInstance<VolumeProfile>();

            var bloom = profile.Add<Bloom>();
            bloom.active = true;
            // 임계값을 낮게 둬야 네온 색이 대부분 번진다. 원본의 shadowBlur가 밝기와 무관하게
            // 항상 걸리는 것에 가깝게 맞춘 값이다.
            bloom.threshold.Override(0.62f);
            bloom.intensity.Override(1.55f);
            bloom.scatter.Override(0.72f);
            bloom.tint.Override(new Color(0.78f, 0.9f, 1f));
            bloom.highQualityFiltering.Override(true);

            // 어두운 배경 위에서 네온이 뜨도록 살짝 대비를 준다.
            var colorAdjustments = profile.Add<ColorAdjustments>();
            colorAdjustments.active = true;
            colorAdjustments.postExposure.Override(0.18f);
            colorAdjustments.contrast.Override(12f);
            colorAdjustments.saturation.Override(14f);

            var vignette = profile.Add<Vignette>();
            vignette.active = true;
            vignette.intensity.Override(0.32f);
            vignette.smoothness.Override(0.55f);
            vignette.color.Override(new Color(0.01f, 0.01f, 0.05f));

            var volumeObject = new GameObject("Neon Post Processing");
            UnityEngine.Object.DontDestroyOnLoad(volumeObject);
            var volume = volumeObject.AddComponent<Volume>();
            volume.isGlobal = true;
            volume.priority = 10f;
            volume.profile = profile;

            NeonBloomConfigured = true;
        }

        [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.AfterSceneLoad)]
        private static void Bootstrap()
        {
            if (UnityEngine.Object.FindFirstObjectByType<GameManager>() != null) return;

            Application.targetFrameRate = 60;
            Screen.orientation = ScreenOrientation.LandscapeLeft;

            var root = new GameObject("Neon Arcana Runtime");
            UnityEngine.Object.DontDestroyOnLoad(root);

            var cameraObject = new GameObject("Main Camera", typeof(Camera), typeof(AudioListener), typeof(CinemachineBrain));
            cameraObject.tag = "MainCamera";
            var camera = cameraObject.GetComponent<Camera>();
            camera.orthographic = true;
            camera.orthographicSize = 5.6f;
            camera.backgroundColor = new Color(0.008f, 0.012f, 0.035f);
            camera.clearFlags = CameraClearFlags.SolidColor;
            camera.allowHDR = true;
            ConfigureNeonPostProcessing(camera);

            var manager = root.AddComponent<GameManager>();
            var player = PlayerController.Create();
            CreateGameplayCamera(player.transform);
            CreateBackground(camera);
            manager.Initialize(player);

            new GameObject("Enemy Spawner", typeof(EnemySpawner));

            EnsureEventSystem();
            var hud = GameHud.Create(manager, player);
            manager.AttachHud(hud);

            var arguments = Environment.GetCommandLineArgs();
            foreach (var argument in arguments)
            {
                if (argument == "--skip-title") manager.StartRun();
                if (argument == "--phase2-showcase") root.AddComponent<PhaseTwoShowcase>();
            }
            if (Array.Exists(arguments, argument => argument.StartsWith("--capture-phase3-", StringComparison.Ordinal)))
                root.AddComponent<PhaseThreeCaptureDriver>();
        }

        private static void CreateGameplayCamera(Transform player)
        {
            var cameraObject = new GameObject(
                "Gameplay Camera",
                typeof(CinemachineCamera),
                typeof(CinemachinePositionComposer));
            cameraObject.transform.position = new Vector3(player.position.x, player.position.y, -10f);
            var gameplayCamera = cameraObject.GetComponent<CinemachineCamera>();
            gameplayCamera.Follow = player;
            var lens = gameplayCamera.Lens;
            lens.ModeOverride = LensSettings.OverrideModes.Orthographic;
            lens.OrthographicSize = 5.6f;
            lens.NearClipPlane = 0.01f;
            lens.FarClipPlane = 100f;
            gameplayCamera.Lens = lens;

            var composer = cameraObject.GetComponent<CinemachinePositionComposer>();
            composer.CameraDistance = 10f;
            composer.Damping = new Vector3(0.12f, 0.12f, 0f);
            composer.CenterOnActivate = true;
        }

        private static void CreateBackground(Camera camera)
        {
            var prefab = Resources.Load<GameObject>("Prefabs/WorldBackground");
            if (prefab != null)
            {
                var instance = UnityEngine.Object.Instantiate(prefab);
                instance.name = "Cyber City Background";
                var world = instance.GetComponent<InfiniteWorldBackground>();
                if (world == null) world = instance.AddComponent<InfiniteWorldBackground>();
                world.Initialize(camera);
                return;
            }
            var background = CreateBackgroundTemplate();
            background.name = "Cyber City Background";
            background.GetComponent<InfiniteWorldBackground>().Initialize(camera);
        }

        public static GameObject CreateBackgroundTemplate()
        {
            return new GameObject("Cyber City Background", typeof(InfiniteWorldBackground));
        }

        private static void EnsureEventSystem()
        {
            if (UnityEngine.Object.FindFirstObjectByType<EventSystem>() != null) return;
            new GameObject("EventSystem", typeof(EventSystem), typeof(StandaloneInputModule));
        }
    }

    public sealed class PhaseTwoShowcase : MonoBehaviour
    {
        private float delay = 1.2f;
        private float captureDelay = 2.5f;
        private string capturePath;
        private bool showcaseApplied;
        private bool captureComplete;

        private void Awake()
        {
            const string capturePrefix = "--capture-path=";
            foreach (var argument in Environment.GetCommandLineArgs())
                if (argument.StartsWith(capturePrefix, StringComparison.Ordinal))
                    capturePath = argument.Substring(capturePrefix.Length);
        }

        private void Update()
        {
            if (!showcaseApplied)
            {
                delay -= Time.deltaTime;
                if (delay > 0f) return;
                GameManager.Instance?.EnablePhaseTwoShowcase();
                showcaseApplied = true;
                if (string.IsNullOrWhiteSpace(capturePath)) Destroy(this);
                return;
            }

            if (captureComplete) return;
            captureDelay -= Time.deltaTime;
            if (captureDelay > 0f) return;
            var directory = System.IO.Path.GetDirectoryName(capturePath);
            if (!string.IsNullOrWhiteSpace(directory)) System.IO.Directory.CreateDirectory(directory);
            ScreenCapture.CaptureScreenshot(capturePath);
            Debug.Log($"NEON_ARCANA_PHASE2_CAPTURE_OK path={capturePath}");
            capturePath = null;
            captureComplete = true;
            Invoke(nameof(QuitAfterCapture), 1f);
        }

        private void QuitAfterCapture()
        {
            Application.Quit();
        }
    }

}
