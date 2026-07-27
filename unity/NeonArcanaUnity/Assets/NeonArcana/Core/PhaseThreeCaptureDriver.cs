using System;
using System.IO;
using UnityEngine;

namespace NeonArcana
{
    /// <summary>
    /// Deterministic capture harness used by the migration documentation.
    /// It is inert unless an explicit --capture-phase3-* command-line argument is supplied.
    /// </summary>
    public sealed class PhaseThreeCaptureDriver : MonoBehaviour
    {
        private enum CaptureMode
        {
            None,
            Title,
            Gameplay,
            WorldScroll,
            Upgrade,
            Codex,
            Menu,
            Result,
            Hud
        }

        private CaptureMode mode;
        private string capturePath;
        private float clock;
        private float preparedClock;
        private bool scenePrepared;
        private bool captureRequested;
        private float captureRequestClock;

        private void Awake()
        {
            foreach (var argument in Environment.GetCommandLineArgs())
            {
                ReadArgument(argument, "--capture-phase3-title=", CaptureMode.Title);
                ReadArgument(argument, "--capture-phase3-gameplay=", CaptureMode.Gameplay);
                ReadArgument(argument, "--capture-phase3-world=", CaptureMode.WorldScroll);
                ReadArgument(argument, "--capture-phase3-upgrade=", CaptureMode.Upgrade);
                ReadArgument(argument, "--capture-phase3-codex=", CaptureMode.Codex);
                ReadArgument(argument, "--capture-phase3-menu=", CaptureMode.Menu);
                ReadArgument(argument, "--capture-phase3-result=", CaptureMode.Result);
                ReadArgument(argument, "--capture-phase3-hud=", CaptureMode.Hud);
            }

            if (mode == CaptureMode.None || string.IsNullOrWhiteSpace(capturePath))
                Destroy(this);
        }

        private void ReadArgument(string argument, string prefix, CaptureMode candidate)
        {
            if (!argument.StartsWith(prefix, StringComparison.Ordinal)) return;
            mode = candidate;
            capturePath = argument.Substring(prefix.Length).Trim('"');
        }

        private void Update()
        {
            clock += Time.unscaledDeltaTime;
            if (captureRequested)
            {
                captureRequestClock += Time.unscaledDeltaTime;
                if (captureRequestClock >= 1.1f) Application.Quit();
                return;
            }

            if (!scenePrepared && clock >= 0.45f)
            {
                PrepareScene();
                scenePrepared = true;
                preparedClock = 0f;
                return;
            }
            if (!scenePrepared) return;
            preparedClock += Time.unscaledDeltaTime;

            var captureAt = mode == CaptureMode.Title ? 0.8f
                : mode == CaptureMode.Gameplay ? 2.2f
                : mode == CaptureMode.WorldScroll ? 1.8f
                : mode == CaptureMode.Codex ? 1.2f
                : mode == CaptureMode.Menu ? 1.2f
                : mode == CaptureMode.Result ? 1.2f
                : mode == CaptureMode.Hud ? 1.8f
                : 1.4f;
            if (preparedClock < captureAt) return;

            var directory = Path.GetDirectoryName(capturePath);
            if (!string.IsNullOrWhiteSpace(directory)) Directory.CreateDirectory(directory);
            ScreenCapture.CaptureScreenshot(capturePath);
            captureRequested = true;
            var codexDiagnostic = mode == CaptureMode.Codex ? $" codex=[{GameHud.Instance?.CodexDiagnostics}]" : "";
            Debug.Log($"NEON_ARCANA_PHASE3_CAPTURE_OK mode={mode} elapsed={GameManager.Instance?.Elapsed:F2} hostiles={EnemyController.ActiveCount}{codexDiagnostic} path={capturePath}");
        }

        private void PrepareScene()
        {
            var manager = GameManager.Instance;
            if (manager == null) return;

            switch (mode)
            {
                case CaptureMode.Gameplay:
                    manager.StartRun();
                    break;
                case CaptureMode.WorldScroll:
                    manager.StartRun();
                    manager.Player.transform.position = new Vector3(18f, 9f, 0f);
                    break;
                case CaptureMode.Upgrade:
                    manager.StartRun();
                    manager.AddExperience(manager.XpToNext);
                    break;
                case CaptureMode.Codex:
                    manager.EnablePhaseThreeShowcase();
                    GameHud.Instance?.ShowCodexForCapture();
                    break;
                case CaptureMode.Menu:
                    manager.EnablePhaseThreeShowcase();
                    GameHud.Instance?.ShowGameMenuForTest();
                    break;
                case CaptureMode.Result:
                    manager.EnablePhaseThreeShowcase();
                    manager.AbandonRun();
                    break;
                case CaptureMode.Hud:
                    manager.EnablePhaseThreeShowcase();
                    GameHud.Instance?.ShowRelicDetailsForTest();
                    break;
            }
        }

    }
}
