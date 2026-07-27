#if UNITY_EDITOR
using System;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEditor.Build.Reporting;
using UnityEngine;
using UnityEngine.SceneManagement;

namespace NeonArcana.Editor
{
    public static class NeonProjectSetup
    {
        private const string SmokeSessionKey = "NeonArcana.PlaySmoke";
        private static double smokeStart = -1d;

        [MenuItem("Neon Arcana/Configure Prototype Project")]
        public static void Configure()
        {
            const string sceneDirectory = "Assets/Scenes";
            const string scenePath = sceneDirectory + "/Main.unity";
            if (!AssetDatabase.IsValidFolder(sceneDirectory)) AssetDatabase.CreateFolder("Assets", "Scenes");

            var scene = EditorSceneManager.NewScene(NewSceneSetup.EmptyScene, NewSceneMode.Single);
            scene.name = "Main";
            EditorSceneManager.SaveScene(scene, scenePath);
            EditorBuildSettings.scenes = new[] { new EditorBuildSettingsScene(scenePath, true) };

            PlayerSettings.companyName = "pcw0611";
            PlayerSettings.productName = "Neon Arcana Cyber Rift";
            PlayerSettings.defaultScreenWidth = 1920;
            PlayerSettings.defaultScreenHeight = 1080;
            PlayerSettings.fullScreenMode = FullScreenMode.Windowed;
            PlayerSettings.defaultIsNativeResolution = false;
            PlayerSettings.allowedAutorotateToPortrait = false;
            PlayerSettings.allowedAutorotateToPortraitUpsideDown = false;
            PlayerSettings.allowedAutorotateToLandscapeLeft = true;
            PlayerSettings.allowedAutorotateToLandscapeRight = true;
            PlayerSettings.SetApplicationIdentifier(BuildTargetGroup.Android, "com.pcw0611.neonarcana");

            GameBalance.Validate();
            AssetDatabase.SaveAssets();
            Debug.Log("NEON_ARCANA_SETUP_OK");
        }

        public static void ValidateBatch()
        {
            GameBalance.Validate();
            var scene = AssetDatabase.LoadAssetAtPath<SceneAsset>("Assets/Scenes/Main.unity");
            if (scene == null) throw new InvalidOperationException("Main scene is missing.");
            if (EditorBuildSettings.scenes.Length != 1 || !EditorBuildSettings.scenes[0].enabled)
                throw new InvalidOperationException("Main scene is not configured for build.");
            Debug.Log("NEON_ARCANA_VALIDATION_OK");
        }

        public static void PlaySmokeBatch()
        {
            EditorSceneManager.OpenScene("Assets/Scenes/Main.unity", OpenSceneMode.Single);
            SessionState.SetBool(SmokeSessionKey, true);
            EditorApplication.EnterPlaymode();
        }

        [InitializeOnLoadMethod]
        private static void ResumeSmokeTest()
        {
            if (!SessionState.GetBool(SmokeSessionKey, false)) return;
            EditorApplication.update -= SmokeTick;
            EditorApplication.update += SmokeTick;
        }

        private static void SmokeTick()
        {
            if (!EditorApplication.isPlaying) return;
            if (smokeStart < 0d) smokeStart = EditorApplication.timeSinceStartup;
            if (EditorApplication.timeSinceStartup - smokeStart < 5d) return;

            try
            {
                var manager = UnityEngine.Object.FindFirstObjectByType<GameManager>();
                if (manager == null) throw new InvalidOperationException("Runtime bootstrap did not create GameManager.");
                if (manager.Player == null) throw new InvalidOperationException("Runtime bootstrap did not create Player.");
                if (EnemyController.ActiveCount <= 0) throw new InvalidOperationException("Enemy spawner did not create enemies.");
                if (manager.Kills <= 0) throw new InvalidOperationException("Automatic projectile combat did not defeat an enemy.");
                if (GameHud.Instance == null) throw new InvalidOperationException("Runtime bootstrap did not create HUD.");
                Debug.Log($"NEON_ARCANA_PLAY_SMOKE_OK enemies={EnemyController.ActiveCount} kills={manager.Kills} elapsed={manager.Elapsed:F2}");
                FinishSmoke(0);
            }
            catch (Exception exception)
            {
                Debug.LogException(exception);
                FinishSmoke(1);
            }
        }

        private static void FinishSmoke(int exitCode)
        {
            SessionState.SetBool(SmokeSessionKey, false);
            EditorApplication.update -= SmokeTick;
            smokeStart = -1d;
            EditorApplication.Exit(exitCode);
        }

        public static void BuildWindowsBatch()
        {
            var options = new BuildPlayerOptions
            {
                scenes = new[] { "Assets/Scenes/Main.unity" },
                locationPathName = "Builds/Windows/NeonArcanaPrototype.exe",
                target = BuildTarget.StandaloneWindows64,
                options = BuildOptions.Development
            };
            var report = BuildPipeline.BuildPlayer(options);
            if (report.summary.result != BuildResult.Succeeded)
                throw new InvalidOperationException($"Windows build failed: {report.summary.result}");
            Debug.Log($"NEON_ARCANA_WINDOWS_BUILD_OK size={report.summary.totalSize}");
        }
    }
}
#endif
