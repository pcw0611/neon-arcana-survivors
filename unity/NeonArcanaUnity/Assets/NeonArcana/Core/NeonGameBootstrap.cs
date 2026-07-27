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

            foreach (var argument in Environment.GetCommandLineArgs())
                if (argument == "--phase2-showcase") root.AddComponent<PhaseTwoShowcase>();
        }

        private static void CreateBackground()
        {
            var background = new GameObject("Cyber City Background");
            var renderer = background.AddComponent<SpriteRenderer>();
            renderer.sprite = NeonAssets.FullSprite("Art/cyber-city", 100f);
            renderer.color = new Color(0.25f, 0.35f, 0.55f, 0.42f);
            renderer.sortingOrder = -100;
            background.transform.localScale = Vector3.one * 1.45f;
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
