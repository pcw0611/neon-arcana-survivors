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
            if (Object.FindFirstObjectByType<GameManager>() != null) return;

            Application.targetFrameRate = 60;
            Screen.orientation = ScreenOrientation.LandscapeLeft;

            var root = new GameObject("Neon Arcana Runtime");
            Object.DontDestroyOnLoad(root);

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
            if (Object.FindFirstObjectByType<EventSystem>() != null) return;
            new GameObject("EventSystem", typeof(EventSystem), typeof(StandaloneInputModule));
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
