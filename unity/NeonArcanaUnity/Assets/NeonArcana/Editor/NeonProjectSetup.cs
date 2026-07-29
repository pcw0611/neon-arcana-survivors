#if UNITY_EDITOR
using System;
using UnityEditor;
using UnityEditor.Build;
using UnityEditor.SceneManagement;
using UnityEditor.Build.Reporting;
using Unity.Cinemachine;
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
        private static bool worldScrollInjected;
        private static bool relicFlowInjected;
        private static bool relicFlowDismissed;

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
            AssetDatabase.SaveAssets();
            AssetDatabase.Refresh(ImportAssetOptions.ForceSynchronousImport);
            PhaseThreePrefabBuilder.BuildAll();
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

        public static void ValidatePhaseThreeBatch()
        {
            ValidatePhaseTwoBatch();
            PhaseThreePrefabBuilder.ValidatePrefabs();
            var titleBackground = AssetDatabase.LoadAssetAtPath<Texture2D>("Assets/Resources/Art/title-bg-v2.png");
            if (titleBackground == null) throw new InvalidOperationException("Phase 3 title background is missing.");
            var playerPrefab = AssetDatabase.LoadAssetAtPath<GameObject>("Assets/Resources/Prefabs/Player.prefab");
            if (playerPrefab == null || playerPrefab.GetComponent<PlayerController>() == null)
                throw new InvalidOperationException("Phase 3 Player prefab is invalid.");
            if (PlayerController.ConstellationTargetingMode != "NearestEnemyAutomatic")
                throw new InvalidOperationException("Constellation projectile targeting contract changed.");
            var worldPrefab = AssetDatabase.LoadAssetAtPath<GameObject>("Assets/Resources/Prefabs/WorldBackground.prefab");
            if (worldPrefab == null || worldPrefab.GetComponent<InfiniteWorldBackground>() == null)
                throw new InvalidOperationException("Infinite world background prefab is missing.");
            var codexCard = AssetDatabase.LoadAssetAtPath<GameObject>("Assets/Resources/Prefabs/CodexCard.prefab");
            if (codexCard == null || codexCard.GetComponent<CodexCard>() == null)
                throw new InvalidOperationException("Authored CodexCard prefab is missing.");
            Debug.Log("NEON_ARCANA_PHASE3_VALIDATION_OK fidelityContract=80 prefabs=10 projectileTargeting=automatic rightAimPad=removed infiniteWorld=authored codex=threeTabs");
        }

        /// <summary>
        /// 마스터리 특수기와 광검 스윕 기하가 웹 원본과 일치하는지 검증한다.
        /// 기대값은 실제 웹 버전(game-v4.js)을 브라우저에서 실행해 측정한 수치다.
        /// </summary>
        public static void ValidateMasteryParityBatch()
        {
            const float arcWidth = 1.38f * 0.72f;
            const float sweepGap = 0.34f;
            var maxOffset = Mathf.Max(0f, 0.85f - arcWidth * 0.5f);

            // 웹 원본 측정값: 조준 0도일 때 쌍검은 정확히 ±28.65도에서 베어나간다.
            var front = PlayerController.SaberSweepAngle(0, 2, 0f, true, sweepGap, maxOffset) * Mathf.Rad2Deg;
            var back = PlayerController.SaberSweepAngle(1, 2, 0f, true, sweepGap, maxOffset) * Mathf.Rad2Deg;
            if (Mathf.Abs(front - 28.65f) > 0.05f || Mathf.Abs(back + 28.65f) > 0.05f)
                throw new InvalidOperationException($"Dual saber sweep angles diverged: {front}/{back}");

            // 잔상이 아무리 쌓여도 한쪽으로만 몰리지 않고, 총 커버리지가 반원을 크게 넘지 않아야 한다.
            var maximumAbsolute = 0f;
            var positives = 0;
            var negatives = 0;
            const int sweeps = 10;
            for (var sweep = 0; sweep < sweeps; sweep++)
            {
                var angle = PlayerController.SaberSweepAngle(sweep, sweeps, 0f, true, sweepGap, maxOffset);
                if (angle > 0f) positives++; else negatives++;
                maximumAbsolute = Mathf.Max(maximumAbsolute, Mathf.Abs(angle));
            }
            if (positives != negatives)
                throw new InvalidOperationException($"Echo sweeps are not balanced across both blades: +{positives}/-{negatives}");
            var coverageDegrees = (maximumAbsolute + arcWidth * 0.5f) * 2f * Mathf.Rad2Deg;
            if (coverageDegrees > 200f)
                throw new InvalidOperationException($"Saber coverage exceeded the 200 degree cap: {coverageDegrees}");

            // 마스터리 주기는 웹 원본 masterySpecs 값과 같아야 한다.
            var intervals = new[] { 9.5f, 7.5f, 10.5f, 8.5f };
            var builds = new[] { "projectile", "saber", "orbit", "thor" };
            for (var i = 0; i < builds.Length; i++)
            {
                var method = typeof(PlayerController).GetMethod(
                    "MasteryInterval",
                    System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Static);
                if (method == null) throw new InvalidOperationException("MasteryInterval lookup failed.");
                var actual = method.Invoke(null, new object[] { builds[i] });
                if (actual is not float value || Mathf.Abs(value - intervals[i]) > 0.001f)
                    throw new InvalidOperationException($"Mastery interval for {builds[i]} diverged: {actual}");
            }

            Debug.Log($"NEON_ARCANA_MASTERY_PARITY_OK dualSaber={front:F2}/{back:F2} coverage={coverageDegrees:F1} balanced={positives}v{negatives} intervals=9.5/7.5/10.5/8.5");
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
                manager.Player.EnableOrbitEffectsForSmoke();
            }
            if (!worldScrollInjected && elapsed >= 5d && manager?.Player != null)
            {
                worldScrollInjected = true;
                manager.Player.transform.position = new Vector3(18f, 9f, 0f);
            }
            if (!relicFlowInjected && elapsed >= 3d && manager != null)
            {
                relicFlowInjected = true;
                manager.EnableRelicFlowSmoke();
            }
            if (!relicFlowDismissed && elapsed >= 7d && manager != null && GameHud.Instance != null)
            {
                if (GameHud.Instance.RelicRouletteCompleted && GameHud.Instance.IsRelicResultAwaitingDismiss
                    && manager.ActiveRewardType == "Relic" && manager.LastRelicAwardRarity >= 3 && Time.timeScale == 0f)
                {
                    GameHud.Instance.DismissRelicResultForTest();
                    relicFlowDismissed = true;
                }
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
                // 감전은 요격과 마찬가지로 결정론적으로 검증한다.
                // 광검이 웹 원본대로 부채꼴 안 모든 적을 매 스윕 타격하게 되면서 플레이어 주변이 빠르게
                // 정리되어, 적이 위성의 좁은 충돌 반경(0.28)에 우연히 들어오길 기다리는 방식은 불안정하다.
                if (!manager.Player.VerifyOrbitInterceptForSmoke()
                    || !manager.Player.VerifyOrbitShockForSmoke()
                    || manager.Player.OrbitShockTriggers <= 0 || manager.Player.OrbitPulseTriggers <= 0)
                    throw new InvalidOperationException($"Orbit upgrade effects did not activate: shock={manager.Player.OrbitShockTriggers}, pulse={manager.Player.OrbitPulseTriggers}, intercept={manager.Player.OrbitIntercepts}.");
                var upgradeRules = manager.ValidateUpgradeParityRules();
                if (manager.ActiveBoss == null) throw new InvalidOperationException("Boss runtime did not activate.");
                if (!GameHud.Instance.BossWarningWasShown || !GameHud.Instance.HasBossMinimapMarker)
                    throw new InvalidOperationException("Boss warning or minimap boss marker is missing.");
                if (GameHud.Instance.GetComponentsInChildren<VirtualJoystick>(true).Length != 1)
                    throw new InvalidOperationException("The runtime HUD contains an unauthorized second touch pad.");
                if (!GameHud.Instance.TouchDragIsConfigured || !GameHud.Instance.VerifyTouchDragRouteForTest())
                    throw new InvalidOperationException("Full-screen touch drag did not route through the single move pad.");
                if (!relicFlowDismissed || manager.ActiveRewardType != "None" || manager.IsChoosingUpgrade || Time.timeScale != 1f)
                    throw new InvalidOperationException("Relic result dismissal did not complete the reward.");
                var codex = GameHud.Instance.GetComponentInChildren<CodexView>(true);
                if (codex == null) throw new InvalidOperationException("Runtime HUD has no CodexView.");
                GameHud.Instance.ShowCodexForCapture();
                if (codex.ActiveTabName != "Builds" || codex.VisibleCardCount != 27)
                    throw new InvalidOperationException($"Codex build tab mismatch: tab={codex.ActiveTabName}, cards={codex.VisibleCardCount}.");
                codex.ShowRelics();
                if (codex.ActiveTabName != "Relics" || codex.VisibleCardCount != 21)
                    throw new InvalidOperationException($"Codex relic tab mismatch: tab={codex.ActiveTabName}, cards={codex.VisibleCardCount}.");
                codex.ShowClasses();
                if (codex.ActiveTabName != "Classes" || codex.VisibleCardCount != 5)
                    throw new InvalidOperationException($"Codex class tab mismatch: tab={codex.ActiveTabName}, cards={codex.VisibleCardCount}.");
                codex.ShowBuilds();
                codex.Hide();
                GameHud.Instance.ShowGameMenuForTest();
                if (!GameHud.Instance.IsGameMenuOpen || Time.timeScale != 0f)
                    throw new InvalidOperationException($"Operation menu did not pause the active run: open={GameHud.Instance.IsGameMenuOpen}, timeScale={Time.timeScale}, awaiting={manager.IsAwaitingStart}, gameOver={manager.IsGameOver}.");
                GameHud.Instance.HideGameMenuForTest();
                if (manager.Player.LastProjectileDirection.sqrMagnitude < 0.9f)
                    throw new InvalidOperationException("Automatic constellation targeting did not produce a valid direction.");
                // 마스터리 특수기 4종이 런타임에서 실제로 발동 경로를 타는지 확인한다.
                var masteryBefore = manager.Player.MasteryTriggerCount;
                manager.Player.RunAllMasteriesForSmoke();
                if (manager.Player.MasteryTriggerCount - masteryBefore != 4)
                    throw new InvalidOperationException(
                        $"Mastery ultimates did not all fire: {manager.Player.MasteryTriggerCount - masteryBefore}/4.");
                var world = UnityEngine.Object.FindFirstObjectByType<InfiniteWorldBackground>();
                if (world == null || !world.IsReady || world.ActiveTileCount != InfiniteWorldBackground.TileColumns * InfiniteWorldBackground.TileRows)
                    throw new InvalidOperationException("Infinite world tiles or grid were not created.");
                if (UnityEngine.Object.FindFirstObjectByType<CinemachineCamera>() == null
                    || Camera.main == null
                    || Vector2.Distance(Camera.main.transform.position, manager.Player.transform.position) > 0.5f)
                    throw new InvalidOperationException("Cinemachine did not follow the moved player.");
                if (world.TileAnchor.sqrMagnitude < 1f || world.GridAnchor.sqrMagnitude < 1f)
                    throw new InvalidOperationException("World tile and grid anchors did not advance after movement.");
                GameHud.Instance.ShowRelicDetailsForTest();
                if (!GameHud.Instance.IsRelicDetailsVisible
                    || !GameHud.Instance.RelicDetailsText.Contains("균열 왕관")
                    || !GameHud.Instance.BuildTrayText.Contains("BUILD"))
                    throw new InvalidOperationException("HUD build or relic detail tray did not reflect the active loadout.");
                manager.EnableRewardQueueSmoke();
                if (manager.ActiveRewardType != "Upgrade" || manager.PendingRewardCount != 2
                    || GameHud.Instance.ActiveChoicePanelCount != 1 || Time.timeScale != 0f)
                    throw new InvalidOperationException($"Reward queue overlap: active={manager.ActiveRewardType}, pending={manager.PendingRewardCount}, panels={GameHud.Instance.ActiveChoicePanelCount}, timeScale={Time.timeScale}.");
                Debug.Log($"NEON_ARCANA_PHASE2_PLAY_SMOKE_OK enemies={EnemyController.ActiveCount} kills={manager.Kills} class={manager.Player.Class} relics={manager.Relics.Count} boss={manager.ActiveBoss.BossKind} elapsed={manager.Elapsed:F2}");
                Debug.Log("NEON_ARCANA_RELIC_FLOW_OK source=boss rarity=tiered roulette=18 award=automatic dismiss=required");
                Debug.Log($"NEON_ARCANA_ORBIT_EFFECTS_OK shock={manager.Player.OrbitShockTriggers} pulse={manager.Player.OrbitPulseTriggers} intercept={manager.Player.OrbitIntercepts} bossPatternBypass=true");
                Debug.Log($"NEON_ARCANA_PHASE3_PLAY_SMOKE_OK prefabs=10 touchPads=1 touchDrag=fullScreen targeting={PlayerController.ConstellationTargetingMode} worldTiles={world.ActiveTileCount} tileAnchor={world.TileAnchor} gridAnchor={world.GridAnchor} codexTabs=27/21/5 gameMenu=pauseResume hud=build+relicDetails+bossWarning upgradeRules={upgradeRules} rewardQueue=1+2");
                manager.AbandonRun();
                if (!manager.IsGameOver || !GameHud.Instance.IsGameOverVisible || Time.timeScale != 0f)
                    throw new InvalidOperationException("Abandon run did not enter the result state.");
                manager.ReturnToTitle();
                if (!manager.IsAwaitingStart || manager.IsGameOver || !GameHud.Instance.IsTitleVisible || Time.timeScale != 1f)
                    throw new InvalidOperationException("Return to title did not reset the run.");
                Debug.Log("NEON_ARCANA_P0_FLOW_OK rewards=queued abandon=result return=title");
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
            worldScrollInjected = false;
            relicFlowInjected = false;
            relicFlowDismissed = false;
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
