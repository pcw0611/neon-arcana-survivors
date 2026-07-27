using System;
using UnityEngine;
using UnityEngine.EventSystems;
using UnityEngine.UI;

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

            var cameraObject = new GameObject("Main Camera", typeof(Camera), typeof(AudioListener), typeof(CameraFollow));
            cameraObject.tag = "MainCamera";
            var camera = cameraObject.GetComponent<Camera>();
            camera.orthographic = true;
            camera.orthographicSize = 5.6f;
            camera.backgroundColor = new Color(0.008f, 0.012f, 0.035f);
            camera.clearFlags = CameraClearFlags.SolidColor;

            CreateBackground();

            var manager = root.AddComponent<GameManager>();
            var player = PlayerController.Create();
            cameraObject.GetComponent<CameraFollow>().Target = player.transform;
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

        private static void CreateBackground()
        {
            var prefab = Resources.Load<GameObject>("Prefabs/WorldBackground");
            if (prefab != null)
            {
                var instance = UnityEngine.Object.Instantiate(prefab);
                instance.name = "Cyber City Background";
                var renderer = instance.GetComponent<SpriteRenderer>();
                if (renderer != null) renderer.sprite = NeonAssets.FullSprite("Art/cyber-city", 100f);
                var glow = instance.transform.Find("Rift Haze");
                var glowRenderer = glow != null ? glow.GetComponent<SpriteRenderer>() : null;
                if (glowRenderer != null) glowRenderer.sprite = NeonAssets.GlowSprite();
                return;
            }
            CreateBackgroundTemplate().name = "Cyber City Background";
        }

        public static GameObject CreateBackgroundTemplate()
        {
            var background = new GameObject("Cyber City Background");
            var renderer = background.AddComponent<SpriteRenderer>();
            renderer.sprite = NeonAssets.FullSprite("Art/cyber-city", 100f);
            renderer.color = new Color(0.44f, 0.52f, 0.72f, 0.62f);
            renderer.sortingOrder = -100;
            background.transform.localScale = Vector3.one * 2.05f;

            var glow = new GameObject("Rift Haze", typeof(SpriteRenderer));
            glow.transform.SetParent(background.transform, false);
            glow.transform.localScale = new Vector3(8f, 5f, 1f);
            var glowRenderer = glow.GetComponent<SpriteRenderer>();
            glowRenderer.sprite = NeonAssets.GlowSprite();
            glowRenderer.color = new Color(0.18f, 0.04f, 0.48f, 0.2f);
            glowRenderer.sortingOrder = -99;
            return background;
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

    public sealed class CameraFollow : MonoBehaviour
    {
        public Transform Target { get; set; }

        private void LateUpdate()
        {
            if (Target == null) return;
            transform.position = new Vector3(Target.position.x, Target.position.y, -10f);
            var background = GameObject.Find("Cyber City Background");
            if (background != null) background.transform.position = new Vector3(Target.position.x, Target.position.y, 2f);
        }
    }
}
