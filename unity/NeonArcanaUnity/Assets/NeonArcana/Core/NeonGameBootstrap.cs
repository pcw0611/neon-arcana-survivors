using System;
using Unity.Cinemachine;
using UnityEngine;
using UnityEngine.EventSystems;

namespace NeonArcana
{
    public static class NeonGameBootstrap
    {
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
