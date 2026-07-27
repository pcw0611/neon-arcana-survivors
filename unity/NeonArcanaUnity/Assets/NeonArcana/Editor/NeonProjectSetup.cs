#if UNITY_EDITOR
using System;
using UnityEditor;
using UnityEditor.Build;
using UnityEditor.SceneManagement;
using UnityEditor.Build.Reporting;
using UnityEngine;
using UnityEngine.SceneManagement;

namespace NeonArcana.Editor
{
    public static class NeonProjectSetup
    {
        private const string SmokeSessionKey = "NeonArcana.PlaySmoke";
        private const string AndroidSdkPath = @"C:\Users\pcw06\AppData\Local\Android\Sdk";
        private const string AndroidNdkPath = @"C:\Users\pcw06\AppData\Local\UnityAndroid\NDK";
        private const string AndroidJdkPath = @"C:\Users\pcw06\AppData\Local\UnityAndroid\OpenJDK";
        private static double smokeStart = -1d;
        private static bool phaseTwoInjected;

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

            EnsureContentAsset();
            GameBalance.Validate();
            AssetDatabase.SaveAssets();
            Debug.Log("NEON_ARCANA_SETUP_OK");
        }

        public static void ValidateBatch()
        {
            GameBalance.Validate();
            PhaseTwoSimulation.ValidateCatalog();
            var scene = AssetDatabase.LoadAssetAtPath<SceneAsset>("Assets/Scenes/Main.unity");
            if (scene == null) throw new InvalidOperationException("Main scene is missing.");
            if (EditorBuildSettings.scenes.Length != 1 || !EditorBuildSettings.scenes[0].enabled)
                throw new InvalidOperationException("Main scene is not configured for build.");
            Debug.Log("NEON_ARCANA_VALIDATION_OK");
        }

        public static void ValidatePhaseTwoBatch()
        {
            ValidateBatch();
            var report = PhaseTwoSimulation.RunFifteenMinutes();
            Debug.Log($"NEON_ARCANA_PHASE2_SIMULATION_OK bosses={report.BossCount} enemyPeak={report.EnemyPeak} archetypes={string.Join(",", report.Archetypes)} bossRarities={string.Join(",", report.BossOptionRarities)}");
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
            var elapsed = EditorApplication.timeSinceStartup - smokeStart;
            var manager = UnityEngine.Object.FindFirstObjectByType<GameManager>();
            if (!phaseTwoInjected && elapsed >= 2d && manager != null)
            {
                phaseTwoInjected = true;
                manager.EnablePhaseTwoShowcase();
            }
            if (elapsed < 8d) return;

            try
            {
                if (manager == null) throw new InvalidOperationException("Runtime bootstrap did not create GameManager.");
                if (manager.Player == null) throw new InvalidOperationException("Runtime bootstrap did not create Player.");
                if (EnemyController.ActiveCount <= 0) throw new InvalidOperationException("Enemy spawner did not create enemies.");
                if (manager.Kills <= 0) throw new InvalidOperationException("Automatic projectile combat did not defeat an enemy.");
                if (GameHud.Instance == null) throw new InvalidOperationException("Runtime bootstrap did not create HUD.");
                if (manager.Player.Class != ArcanaClass.Thor) throw new InvalidOperationException("Class change did not apply.");
                if (!manager.HasRelic("rift_crown")) throw new InvalidOperationException("Relic effect did not apply.");
                if (manager.Player.Orbitals <= 0 || manager.Player.SaberLevel <= 0) throw new InvalidOperationException("Orbit or saber build did not activate.");
                if (manager.ActiveBoss == null) throw new InvalidOperationException("Boss runtime did not activate.");
                Debug.Log($"NEON_ARCANA_PHASE2_PLAY_SMOKE_OK enemies={EnemyController.ActiveCount} kills={manager.Kills} class={manager.Player.Class} relics={manager.Relics.Count} boss={manager.ActiveBoss.BossKind} elapsed={manager.Elapsed:F2}");
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
            phaseTwoInjected = false;
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

        public static void ConfigureAndroidExternalToolsBatch()
        {
            EditorPrefs.SetBool("SdkUseEmbedded", false);
            EditorPrefs.SetString("AndroidSdkRoot", AndroidSdkPath);
            EditorPrefs.SetBool("NdkUseEmbedded", false);
            EditorPrefs.SetString("AndroidNdkRoot", AndroidNdkPath);
            EditorPrefs.SetString("AndroidNdkRootR16b", AndroidNdkPath);
            EditorPrefs.SetBool("JdkUseEmbedded", false);
            EditorPrefs.SetString("JdkPath", AndroidJdkPath);
            Debug.Log($"NEON_ARCANA_ANDROID_TOOLS_OK sdk={AndroidSdkPath} ndk={AndroidNdkPath} jdk={AndroidJdkPath}");
        }

        public static void BuildAndroidBatch()
        {
            ConfigureAndroidExternalToolsBatch();
            if (!EditorUserBuildSettings.SwitchActiveBuildTarget(BuildTargetGroup.Android, BuildTarget.Android))
                throw new InvalidOperationException("Could not switch the active build target to Android.");

            PlayerSettings.SetScriptingBackend(NamedBuildTarget.Android, ScriptingImplementation.IL2CPP);
            PlayerSettings.Android.targetArchitectures = AndroidArchitecture.ARM64;
            PlayerSettings.Android.minSdkVersion = AndroidSdkVersions.AndroidApiLevel26;
            PlayerSettings.Android.targetSdkVersion = AndroidSdkVersions.AndroidApiLevelAuto;
            EditorUserBuildSettings.buildAppBundle = false;

            var options = new BuildPlayerOptions
            {
                scenes = new[] { "Assets/Scenes/Main.unity" },
                locationPathName = "Builds/Android/NeonArcanaPhase2-ARM64.apk",
                target = BuildTarget.Android,
                options = BuildOptions.Development
            };
            var report = BuildPipeline.BuildPlayer(options);
            if (report.summary.result != BuildResult.Succeeded)
                throw new InvalidOperationException($"Android build failed: {report.summary.result}");
            Debug.Log($"NEON_ARCANA_ANDROID_BUILD_OK size={report.summary.totalSize}");
        }

        private static void EnsureContentAsset()
        {
            if (!AssetDatabase.IsValidFolder("Assets/Resources")) AssetDatabase.CreateFolder("Assets", "Resources");
            if (!AssetDatabase.IsValidFolder("Assets/Resources/Data")) AssetDatabase.CreateFolder("Assets/Resources", "Data");
            const string path = "Assets/Resources/Data/NeonArcanaContent.asset";
            if (AssetDatabase.LoadAssetAtPath<GameContentCatalog>(path) != null) return;
            var catalog = ContentDatabase.CreateDefault();
            AssetDatabase.CreateAsset(catalog, path);
            AssetDatabase.SaveAssets();
        }
    }
}
#endif
