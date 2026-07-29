using System;
using System.Collections;
using System.Collections.Generic;
using TMPro;
using UnityEngine;
using UnityEngine.UI;

namespace NeonArcana
{
    public sealed class GameHud : MonoBehaviour
    {
        public static GameHud Instance { get; private set; }

        private GameManager manager;
        private PlayerController player;
        [SerializeField] private TMP_Text statsText;
        [SerializeField] private TMP_Text timerText;
        [SerializeField] private TMP_Text hostileText;
        [SerializeField] private Image hpFill;
        [SerializeField] private Image xpFill;
        [SerializeField] private Image damageFlash;
        [SerializeField] private GameObject titlePanel;
        [SerializeField] private GameObject upgradePanel;
        [SerializeField] private GameObject classPanel;
        [SerializeField] private GameObject relicPanel;
        [SerializeField] private GameObject codexPanel;
        [SerializeField] private GameObject gameMenuPanel;
        [SerializeField] private GameObject gameOverPanel;
        [SerializeField] private TMP_Text gameOverText;
        [SerializeField] private TMP_Text bossText;
        [SerializeField] private Image bossFill;
        [SerializeField] private GameObject bossPanel;
        [SerializeField] private TMP_Text buildTrayText;
        [SerializeField] private TMP_Text relicTrayText;
        [SerializeField] private GameObject relicDetailsPanel;
        [SerializeField] private TMP_Text relicDetailsText;
        [SerializeField] private TMP_Text toastText;
        [SerializeField] private TMP_Text bossWarningText;
        [SerializeField] private CodexView codexView;
        [SerializeField] private Button startButton;
        [SerializeField] private Button codexOpenButton;
        [SerializeField] private Button menuOpenButton;
        [SerializeField] private Button menuResumeButton;
        [SerializeField] private Button menuSoundButton;
        [SerializeField] private Button menuHitboxButton;
        [SerializeField] private Button menuAbandonButton;
        [SerializeField] private Button relicTrayToggleButton;
        [SerializeField] private Button restartButton;
        [SerializeField] private Button mainMenuButton;
        [SerializeField] private VirtualJoystick moveJoystick;
        [SerializeField] private TouchDragMoveInput touchDragInput;
        [SerializeField] private MiniMapGraphic miniMap;
        private float toastClock;
        private float bossWarningClock;
        private bool soundMuted;
        private bool hitboxVisible;
        private bool bossWarningWasShown;
        private bool relicRouletteCompleted;
        private Action relicResultDismiss;
        private Coroutine relicRouletteRoutine;
        [SerializeField] private List<Button> upgradeButtons = new();
        [SerializeField] private List<Button> classButtons = new();
        [SerializeField] private List<Button> relicButtons = new();

        public static GameHud Create(GameManager manager, PlayerController player)
        {
            var prefab = Resources.Load<GameObject>("Prefabs/GameHud");
            var root = prefab != null ? Instantiate(prefab) : CreateTemplate();
            root.name = "Game HUD";
            var hud = root.GetComponent<GameHud>();
            hud.Bind(manager, player);
            Instance = hud;
            return hud;
        }

        public static GameObject CreateTemplate()
        {
            var root = new GameObject("GameHud", typeof(Canvas), typeof(CanvasScaler), typeof(GraphicRaycaster), typeof(GameHud));
            var canvas = root.GetComponent<Canvas>();
            canvas.renderMode = RenderMode.ScreenSpaceOverlay;
            canvas.sortingOrder = 100;
            var scaler = root.GetComponent<CanvasScaler>();
            scaler.uiScaleMode = CanvasScaler.ScaleMode.ScaleWithScreenSize;
            scaler.referenceResolution = new Vector2(1920f, 1080f);
            scaler.matchWidthOrHeight = 0.5f;

            var hud = root.GetComponent<GameHud>();
            hud.Build(root.transform);
            return root;
        }

        private void Bind(GameManager gameManager, PlayerController playerController)
        {
            manager = gameManager;
            player = playerController;
            if (titlePanel != null)
            {
                var titleImage = titlePanel.GetComponent<Image>();
                if (titleImage != null) titleImage.sprite = NeonAssets.FullSprite("Art/title-bg-v2", 100f);
                SetTitleStageSprite("Stage Orbit", NeonAssets.RingSprite(192));
                SetTitleStageSprite("Stage Boss", NeonAssets.SpriteFrame("Art/bosses", 0, 0, 2, 2, 360f));
                SetTitleStageSprite("Stage Hero", NeonAssets.SpriteFrame("Art/astra-sd", 0, 0));
                SetTitleStageSprite("Stage Shade A", NeonAssets.SpriteFrame("Art/shade-sd", 0, 0));
                SetTitleStageSprite("Stage Shade B", NeonAssets.SpriteFrame("Art/shade-sd", 1, 0));
                SetTitleStageSprite("Stage Saber", NeonAssets.FullSprite("Art/saber-blade", 100f));
            }
            if (player != null)
            {
                player.MoveJoystick = moveJoystick;
                if (moveJoystick != null)
                {
                    var forceTouch = Array.Exists(Environment.GetCommandLineArgs(), item => item == "--show-touch");
                    moveJoystick.gameObject.SetActive(Application.isMobilePlatform || forceTouch);
                    if (touchDragInput != null)
                    {
                        touchDragInput.Bind(moveJoystick);
                        touchDragInput.gameObject.SetActive(Application.isMobilePlatform || forceTouch);
                    }
                }
            }

            startButton?.onClick.RemoveAllListeners();
            startButton?.onClick.AddListener(manager.StartRun);
            codexOpenButton?.onClick.RemoveAllListeners();
            codexOpenButton?.onClick.AddListener(OpenCodex);
            menuOpenButton?.onClick.RemoveAllListeners();
            menuOpenButton?.onClick.AddListener(OpenGameMenu);
            menuResumeButton?.onClick.RemoveAllListeners();
            menuResumeButton?.onClick.AddListener(CloseGameMenu);
            menuSoundButton?.onClick.RemoveAllListeners();
            menuSoundButton?.onClick.AddListener(ToggleSound);
            menuHitboxButton?.onClick.RemoveAllListeners();
            menuHitboxButton?.onClick.AddListener(ToggleHitbox);
            menuAbandonButton?.onClick.RemoveAllListeners();
            menuAbandonButton?.onClick.AddListener(AbandonRun);
            relicTrayToggleButton?.onClick.RemoveAllListeners();
            relicTrayToggleButton?.onClick.AddListener(ToggleRelicDetails);
            soundMuted = PlayerPrefs.GetInt("NeonArcana.SoundMuted", 0) != 0;
            hitboxVisible = PlayerPrefs.GetInt("NeonArcana.ShowHitbox", 0) != 0;
            ApplySound();
            player?.SetHitboxVisible(hitboxVisible);
            RefreshMenuLabels();
            if (codexView != null)
            {
                codexView.Bind(manager);
                codexView.Closed -= ResumeAfterCodex;
                codexView.Closed += ResumeAfterCodex;
            }
            restartButton?.onClick.RemoveAllListeners();
            restartButton?.onClick.AddListener(manager.Restart);
            mainMenuButton?.onClick.RemoveAllListeners();
            mainMenuButton?.onClick.AddListener(manager.ReturnToTitle);
        }

        private void SetTitleStageSprite(string objectName, Sprite sprite)
        {
            if (titlePanel == null) return;
            var child = titlePanel.transform.Find(objectName);
            var image = child != null ? child.GetComponent<Image>() : null;
            if (image != null) image.sprite = sprite;
        }

        private void OpenCodex()
        {
            HideRelicDetails();
            codexView.Show(manager);
            Time.timeScale = 0f;
        }

        private void ResumeAfterCodex()
        {
            if (!manager.IsGameOver && !manager.IsChoosingUpgrade) Time.timeScale = 1f;
        }

        private void Build(Transform root)
        {
            var touchSurface = CreateImage(root, "Touch Drag Surface", Color.clear, Vector2.zero, Vector2.one);
            touchDragInput = touchSurface.gameObject.AddComponent<TouchDragMoveInput>();
            touchSurface.transform.SetAsFirstSibling();

            xpFill = CreateBar(root, "XP", new Color(0.12f, 0.86f, 1f), new Vector2(0.045f, 0.985f), new Vector2(0.955f, 0.985f), Vector2.zero, new Vector2(0f, 6f));
            hpFill = CreateBar(root, "HP", new Color(0.25f, 1f, 0.65f), new Vector2(0.047f, 0.906f), new Vector2(0.22f, 0.906f), Vector2.zero, new Vector2(0f, 10f));

            statsText = CreateText(root, "Stats", 20, TextAnchor.MiddleLeft, new Vector2(0.046f, 0.92f), new Vector2(0.46f, 0.976f), new Color(0.93f, 0.96f, 1f));
            timerText = CreateText(root, "Timer", 20, TextAnchor.MiddleRight, new Vector2(0.77f, 0.92f), new Vector2(0.9f, 0.976f), Color.white);
            hostileText = CreateText(root, "Hostiles", 14, TextAnchor.UpperCenter, new Vector2(0.86f, 0.69f), new Vector2(0.97f, 0.74f), new Color(0.65f, 0.72f, 0.86f));
            buildTrayText = CreateText(root, "Build Tray", 17, TextAnchor.MiddleLeft, new Vector2(0.02f, 0.02f), new Vector2(0.62f, 0.1f), new Color(0.55f, 0.92f, 1f));
            relicTrayToggleButton = CreateFixedButton(root, "Relic Tray Toggle", "RELIC LOADOUT", new Vector2(0.72f, 0.02f), new Vector2(0.97f, 0.1f));
            relicTrayText = relicTrayToggleButton.GetComponentInChildren<TMP_Text>();
            relicTrayText.fontSize = 17;
            relicTrayText.alignment = TextAlignmentOptions.Right;
            var relicDetails = CreateImage(root, "Relic Details", new Color(0.015f, 0.04f, 0.095f, 0.96f), new Vector2(0.64f, 0.11f), new Vector2(0.97f, 0.43f));
            var relicOutline = relicDetails.gameObject.AddComponent<Outline>();
            relicOutline.effectColor = new Color(1f, 0.64f, 0.2f, 0.48f);
            relicOutline.effectDistance = new Vector2(1.5f, -1.5f);
            relicDetailsPanel = relicDetails.gameObject;
            relicDetailsText = CreateText(relicDetails.transform, "Details", 17, TextAnchor.UpperLeft, new Vector2(0.055f, 0.06f), new Vector2(0.945f, 0.94f), new Color(0.86f, 0.89f, 0.97f));
            relicDetailsPanel.SetActive(false);

            moveJoystick = VirtualJoystick.Create(root, "Move Stick", new Vector2(0.12f, 0.18f), new Color(0.2f, 0.9f, 1f));
            moveJoystick.gameObject.SetActive(false);
            touchDragInput.Bind(moveJoystick);
            touchDragInput.gameObject.SetActive(false);

            var minimapFrame = CreateImage(root, "Minimap Frame", new Color(0.01f, 0.04f, 0.09f, 0.72f), new Vector2(0.86f, 0.75f), new Vector2(0.97f, 0.93f));
            minimapFrame.raycastTarget = false;
            var minimapObject = new GameObject("Minimap", typeof(RectTransform), typeof(CanvasRenderer), typeof(MiniMapGraphic));
            minimapObject.transform.SetParent(minimapFrame.transform, false);
            var minimapRect = minimapObject.GetComponent<RectTransform>();
            minimapRect.anchorMin = Vector2.zero;
            minimapRect.anchorMax = Vector2.one;
            minimapRect.offsetMin = minimapRect.offsetMax = Vector2.zero;
            miniMap = minimapObject.GetComponent<MiniMapGraphic>();

            BuildTitle(root);

            damageFlash = CreateImage(root, "Damage Flash", new Color(1f, 0.05f, 0.2f, 0f), Vector2.zero, Vector2.one);
            damageFlash.raycastTarget = false;
            upgradePanel = CreateModal(root, "술식 공명 선택", out var upgradeBody);
            CreateText(upgradeBody, "Upgrade Eyebrow", 17, TextAnchor.MiddleCenter, new Vector2(0.25f, 0.89f), new Vector2(0.75f, 0.96f), new Color(0.38f, 0.92f, 1f)).text = "아르카나 각성";
            CreateText(upgradeBody, "Upgrade Subtitle", 15, TextAnchor.MiddleCenter, new Vector2(0.2f, 0.73f), new Vector2(0.8f, 0.8f), new Color(0.48f, 0.55f, 0.7f)).text = "이번 작전의 빌드를 결정하세요";
            for (var i = 0; i < 3; i++) upgradeButtons.Add(CreateUpgradeButton(upgradeBody, $"Upgrade {i + 1}", i));
            upgradePanel.SetActive(false);

            classPanel = CreateModal(root, "LEVEL 30 · 전직 선택", out var classBody);
            for (var i = 0; i < 5; i++) classButtons.Add(CreateChoiceButton(classBody, $"Class {i + 1}", i, 5));
            classPanel.SetActive(false);

            relicPanel = CreateModal(root, "RELIC CACHE · 유물 공명", out var relicBody);
            for (var i = 0; i < 3; i++) relicButtons.Add(CreateButton(relicBody, $"Relic {i + 1}", ""));
            relicPanel.SetActive(false);

            codexView = CodexView.Create(root);
            codexPanel = codexView.gameObject;
            codexOpenButton = CreateFixedButton(root, "Codex", "▤ 도감", new Vector2(0.02f, 0.925f), new Vector2(0.105f, 0.978f));
            menuOpenButton = CreateFixedButton(root, "Game Menu", "☰", new Vector2(0.92f, 0.925f), new Vector2(0.97f, 0.978f));
            BuildGameMenu(root);

            bossPanel = new GameObject("Boss HUD", typeof(RectTransform));
            bossPanel.transform.SetParent(root, false);
            var bossRect = bossPanel.GetComponent<RectTransform>();
            bossRect.anchorMin = new Vector2(0.28f, 0.82f);
            bossRect.anchorMax = new Vector2(0.72f, 0.9f);
            bossRect.offsetMin = bossRect.offsetMax = Vector2.zero;
            bossFill = CreateBar(bossPanel.transform, "Boss HP", new Color(1f, 0.2f, 0.48f), new Vector2(0f, 0f), new Vector2(1f, 0f), Vector2.zero, new Vector2(0f, 16f));
            bossText = CreateText(bossPanel.transform, "Boss Name", 25, TextAnchor.MiddleCenter, new Vector2(0f, 0.2f), new Vector2(1f, 1f), Color.white);
            bossPanel.SetActive(false);

            toastText = CreateText(root, "Toast", 32, TextAnchor.MiddleCenter, new Vector2(0.25f, 0.72f), new Vector2(0.75f, 0.8f), new Color(1f, 0.82f, 0.3f));
            toastText.gameObject.SetActive(false);
            bossWarningText = CreateText(root, "Boss Warning", 54, TextAnchor.MiddleCenter, new Vector2(0.2f, 0.5f), new Vector2(0.8f, 0.68f), new Color(1f, 0.18f, 0.38f));
            bossWarningText.gameObject.AddComponent<CanvasGroup>();
            bossWarningText.gameObject.AddComponent<UiMotion>();
            bossWarningText.gameObject.SetActive(false);

            gameOverPanel = CreateModal(root, "RIFT COLLAPSED", out var gameOverBody);
            gameOverText = CreateText(gameOverBody, "Result", 29, TextAnchor.MiddleCenter, new Vector2(0.06f, 0.28f), new Vector2(0.94f, 0.73f), Color.white);
            restartButton = CreateFixedButton(gameOverBody, "Restart", "다시 출격", new Vector2(0.22f, 0.12f), new Vector2(0.48f, 0.24f));
            mainMenuButton = CreateFixedButton(gameOverBody, "Main Menu", "메인 화면", new Vector2(0.52f, 0.12f), new Vector2(0.78f, 0.24f));
            gameOverPanel.SetActive(false);
        }

        private void BuildTitle(Transform root)
        {
            titlePanel = new GameObject("Title Screen", typeof(RectTransform), typeof(CanvasRenderer), typeof(Image), typeof(CanvasGroup), typeof(UiMotion));
            titlePanel.transform.SetParent(root, false);
            var rect = titlePanel.GetComponent<RectTransform>();
            rect.anchorMin = Vector2.zero;
            rect.anchorMax = Vector2.one;
            rect.offsetMin = rect.offsetMax = Vector2.zero;
            var background = titlePanel.GetComponent<Image>();
            background.sprite = NeonAssets.FullSprite("Art/title-bg-v2", 100f);
            background.color = Color.white;
            background.preserveAspect = false;

            var veil = CreateImage(titlePanel.transform, "Midnight Veil", new Color(0.005f, 0.006f, 0.035f, 0.68f), Vector2.zero, Vector2.one);
            veil.raycastTarget = false;
            var leftShade = CreateImage(titlePanel.transform, "Left Shade", new Color(0.005f, 0.008f, 0.04f, 0.18f), Vector2.zero, new Vector2(0.62f, 1f));
            leftShade.raycastTarget = false;

            var stageOrbit = CreateSpriteImage(titlePanel.transform, "Stage Orbit", NeonAssets.RingSprite(192), new Vector2(0.56f, 0.34f), new Vector2(0.88f, 0.91f), new Color(0.25f, 0.9f, 1f, 0.48f));
            stageOrbit.gameObject.AddComponent<NeonPulse>();
            CreateSpriteImage(titlePanel.transform, "Stage Boss", NeonAssets.SpriteFrame("Art/bosses", 0, 0, 2, 2, 360f), new Vector2(0.59f, 0.48f), new Vector2(0.82f, 0.88f), new Color(1f, 1f, 1f, 0.82f));
            CreateSpriteImage(titlePanel.transform, "Stage Hero", NeonAssets.SpriteFrame("Art/astra-sd", 0, 0), new Vector2(0.70f, 0.13f), new Vector2(0.95f, 0.59f), Color.white).gameObject.AddComponent<NeonPulse>();
            CreateSpriteImage(titlePanel.transform, "Stage Shade A", NeonAssets.SpriteFrame("Art/shade-sd", 0, 0), new Vector2(0.47f, 0.03f), new Vector2(0.67f, 0.38f), new Color(1f, 1f, 1f, 0.76f));
            CreateSpriteImage(titlePanel.transform, "Stage Shade B", NeonAssets.SpriteFrame("Art/shade-sd", 1, 0), new Vector2(0.87f, 0.15f), new Vector2(1.04f, 0.46f), new Color(1f, 1f, 1f, 0.72f));
            var stageBlade = CreateSpriteImage(titlePanel.transform, "Stage Saber", NeonAssets.FullSprite("Art/saber-blade", 100f), new Vector2(0.52f, 0.2f), new Vector2(0.75f, 0.27f), new Color(0.55f, 0.98f, 1f, 0.9f));
            stageBlade.rectTransform.localRotation = Quaternion.Euler(0f, 0f, 20f);

            var eyebrow = CreateText(titlePanel.transform, "Eyebrow", 16, TextAnchor.MiddleLeft, new Vector2(0.06f, 0.73f), new Vector2(0.46f, 0.78f), new Color(0.38f, 0.92f, 1f));
            eyebrow.text = "도시 괴이 / 끝없는 균열";

            var neon = CreateText(titlePanel.transform, "Neon", 124, TextAnchor.MiddleLeft, new Vector2(0.06f, 0.52f), new Vector2(0.46f, 0.73f), Color.white);
            neon.text = "NEON";
            neon.fontSizeMin = 78f;
            neon.fontStyle = FontStyles.Bold;
            neon.characterSpacing = 12f;
            neon.gameObject.AddComponent<NeonTextGlow>().Configure(new Color(0.35f, 0.92f, 1f), 0.5f, 0.75f);

            var arcana = CreateText(titlePanel.transform, "Arcana", 112, TextAnchor.MiddleLeft, new Vector2(0.075f, 0.38f), new Vector2(0.49f, 0.58f), new Color(0.09f, 0.01f, 0.13f, 0.34f));
            arcana.text = "ARCANA";
            arcana.fontSizeMin = 70f;
            arcana.fontStyle = FontStyles.Bold;
            arcana.characterSpacing = 10f;
            // 웹 원본의 ARCANA는 속이 비고 마젠타 테두리만 있는 글자다. TMP는 이걸 셰이더로 바로 낸다.
            arcana.gameObject.AddComponent<NeonTextGlow>().Configure(
                new Color(1f, 0.3f, 0.9f), 0.45f, 0.7f, 0.22f, new Color32(255, 77, 230, 255));

            var description = CreateText(titlePanel.transform, "Description", 22, TextAnchor.MiddleLeft, new Vector2(0.06f, 0.29f), new Vector2(0.5f, 0.38f), new Color(0.74f, 0.79f, 0.92f));
            description.text = "끝없이 증폭되는 도시 균열. 빌드와 유물을 완성하고 쓰러지는 순간까지 살아남아라.";

            startButton = CreateFixedButton(titlePanel.transform, "Start Run", "무한 균열 진입  ›", new Vector2(0.06f, 0.18f), new Vector2(0.34f, 0.265f));
            startButton.gameObject.AddComponent<NeonPulse>();
            startButton.GetComponent<Image>().color = new Color(0.11f, 0.45f, 0.68f, 0.98f);
            var startOutline = startButton.gameObject.AddComponent<Outline>();
            startOutline.effectColor = new Color(0.35f, 0.95f, 1f, 0.7f);
            startOutline.effectDistance = new Vector2(2f, -2f);

            var controls = CreateText(titlePanel.transform, "Controls", 15, TextAnchor.MiddleLeft, new Vector2(0.06f, 0.12f), new Vector2(0.5f, 0.17f), new Color(0.47f, 0.54f, 0.7f));
            controls.text = "WASD / 방향키 / 화면 드래그 · 마우스 광검 조준 · 성좌탄 자동 공격 · M 음소거";

            var ranking = CreateImage(titlePanel.transform, "Ranking", new Color(0.015f, 0.04f, 0.095f, 0.88f), new Vector2(0.59f, 0.09f), new Vector2(0.95f, 0.49f));
            var rankingOutline = ranking.gameObject.AddComponent<Outline>();
            rankingOutline.effectColor = new Color(0.2f, 0.75f, 1f, 0.48f);
            rankingOutline.effectDistance = new Vector2(1.5f, -1.5f);
            var rankingTitle = CreateText(ranking.transform, "Ranking Title", 19, TextAnchor.MiddleLeft, new Vector2(0.05f, 0.84f), new Vector2(0.95f, 0.97f), new Color(0.38f, 0.92f, 1f));
            rankingTitle.text = "글로벌 균열 랭킹 · TOP 100";
            var scoreGuide = CreateText(ranking.transform, "Score Guide", 13, TextAnchor.MiddleLeft, new Vector2(0.05f, 0.72f), new Vector2(0.95f, 0.84f), new Color(0.68f, 0.73f, 0.86f));
            scoreGuide.text = "SCORE   처치×10 + 레벨×120 + 생존×4 + 보스×1,000";
            for (var i = 0; i < 5; i++)
            {
                var row = CreateImage(ranking.transform, $"Rank {i + 1}", new Color(0.02f, 0.07f, 0.14f, i % 2 == 0 ? 0.78f : 0.48f), new Vector2(0.05f, 0.56f - i * 0.115f), new Vector2(0.95f, 0.66f - i * 0.115f));
                var rowText = CreateText(row.transform, "Label", 14, TextAnchor.MiddleLeft, new Vector2(0.03f, 0f), new Vector2(0.97f, 1f), Color.white);
                var score = i == 0 ? Mathf.Max(434182, SaveProgress.HighScore) : new[] { 0, 245662, 239390, 204800, 155342 }[i];
                rowText.text = $"{i + 1}     ASTRA                                      {score:N0}";
            }
        }

        private void Update()
        {
            if (Input.GetKeyDown(KeyCode.Escape))
            {
                if (codexPanel != null && codexPanel.activeSelf) codexView.Hide();
                else if (gameMenuPanel != null && gameMenuPanel.activeSelf) CloseGameMenu();
                else OpenGameMenu();
            }
            if (Input.GetKeyDown(KeyCode.M)) ToggleSound();
            if (manager != null && manager.IsChoosingUpgrade)
            {
                if (Input.GetKeyDown(KeyCode.Alpha1) || Input.GetKeyDown(KeyCode.Keypad1)) TriggerChoice(0);
                else if (Input.GetKeyDown(KeyCode.Alpha2) || Input.GetKeyDown(KeyCode.Keypad2)) TriggerChoice(1);
                else if (Input.GetKeyDown(KeyCode.Alpha3) || Input.GetKeyDown(KeyCode.Keypad3)) TriggerChoice(2);
                else if (Input.GetKeyDown(KeyCode.Alpha4) || Input.GetKeyDown(KeyCode.Keypad4)) TriggerChoice(3);
                else if (Input.GetKeyDown(KeyCode.Alpha5) || Input.GetKeyDown(KeyCode.Keypad5)) TriggerChoice(4);
            }
            if (damageFlash != null && damageFlash.color.a > 0f)
            {
                var color = damageFlash.color;
                color.a = Mathf.MoveTowards(color.a, 0f, Time.unscaledDeltaTime * 2.8f);
                damageFlash.color = color;
            }
            if (toastClock > 0f)
            {
                toastClock -= Time.unscaledDeltaTime;
                if (toastClock <= 0f) toastText.gameObject.SetActive(false);
            }
            if (bossWarningClock > 0f)
            {
                bossWarningClock -= Time.unscaledDeltaTime;
                if (bossWarningClock <= 0f) bossWarningText.gameObject.SetActive(false);
            }
            if (relicResultDismiss != null && Input.anyKeyDown)
            {
                var dismiss = relicResultDismiss;
                relicResultDismiss = null;
                dismiss();
            }
        }

        public void Refresh()
        {
            if (manager == null || player == null) return;
            var className = player.Class == ArcanaClass.None ? "" : $" · {player.Class}";
            statsText.text = $"LV.{manager.Level}{className}    ♥ {Mathf.CeilToInt(player.Hp)}/{Mathf.CeilToInt(player.MaxHp)}    ✦ {manager.Score:N0}";
            var minutes = Mathf.FloorToInt(manager.Elapsed / 60f);
            var seconds = Mathf.FloorToInt(manager.Elapsed % 60f);
            timerText.text = $"{minutes:00}:{seconds:00}";
            hostileText.text = $"{EnemyController.ActiveCount} HOSTILES";
            hpFill.fillAmount = player.MaxHp <= 0f ? 0f : player.Hp / player.MaxHp;
            xpFill.fillAmount = manager.XpToNext <= 0 ? 0f : manager.Xp / (float)manager.XpToNext;
            buildTrayText.text = HudBuildSummary();
            relicTrayText.text = manager.Relics.Count == 0
                ? $"RELIC LOADOUT  0/{player.RelicSlots}  ▾"
                : $"{string.Join("  ", RelicLabels())}  [{manager.Relics.Count}/{player.RelicSlots}]  ▾";
            if (relicDetailsPanel != null && relicDetailsPanel.activeSelf)
                relicDetailsText.text = RelicDetailsSummary();
            if (manager.ActiveBoss != null)
            {
                bossFill.fillAmount = manager.ActiveBoss.MaxHp <= 0f ? 0f : manager.ActiveBoss.Hp / manager.ActiveBoss.MaxHp;
                bossText.text = $"{manager.ActiveBoss.BossKind} · {manager.ActiveBoss.BossTimeRemaining:0}s";
            }
        }

        public void ShowTitle()
        {
            if (titlePanel != null) titlePanel.SetActive(true);
            if (codexOpenButton != null) codexOpenButton.gameObject.SetActive(false);
            if (menuOpenButton != null) menuOpenButton.gameObject.SetActive(false);
        }

        public void HideTitle()
        {
            if (titlePanel != null) titlePanel.SetActive(false);
            if (codexOpenButton != null) codexOpenButton.gameObject.SetActive(true);
            if (menuOpenButton != null) menuOpenButton.gameObject.SetActive(true);
        }

        private IEnumerable<string> RelicLabels()
        {
            foreach (var relic in manager.Relics) yield return $"{relic.Definition.icon}{relic.Level}";
        }

        private string HudBuildSummary()
        {
            var labels = new List<string>();
            foreach (var definition in ContentDatabase.Catalog.upgrades)
            {
                var rank = manager.UpgradeRanks.GetValueOrDefault(definition.id);
                if (rank > 0) labels.Add($"{definition.icon}{rank}");
            }
            return labels.Count == 0 ? "BUILD  —" : $"BUILD  {string.Join("  ", labels)}";
        }

        private string RelicDetailsSummary()
        {
            if (manager.Relics.Count == 0)
                return "장착 유물 없음\n\n보스와 보물 상자를 사냥해 유물을 획득하세요.";
            var rows = new List<string>();
            foreach (var relic in manager.Relics)
            {
                var rarity = ContentDatabase.RarityName(relic.Definition.rarity);
                rows.Add($"{relic.Definition.icon} {rarity} · {relic.Definition.name}  LV.{relic.Level}\n{relic.Definition.description}");
            }
            return string.Join("\n\n", rows);
        }

        private void ToggleRelicDetails()
        {
            if (relicDetailsPanel == null) return;
            var show = !relicDetailsPanel.activeSelf;
            relicDetailsPanel.SetActive(show);
            if (!show) return;
            relicDetailsPanel.transform.SetAsLastSibling();
            relicDetailsText.text = RelicDetailsSummary();
        }

        private void HideRelicDetails()
        {
            if (relicDetailsPanel != null) relicDetailsPanel.SetActive(false);
        }

        private void TriggerChoice(int index)
        {
            List<Button> source = null;
            if (upgradePanel != null && upgradePanel.activeSelf) source = upgradeButtons;
            else if (relicPanel != null && relicPanel.activeSelf) source = relicButtons;
            else if (classPanel != null && classPanel.activeSelf) source = classButtons;
            if (source == null || index < 0 || index >= source.Count) return;
            var button = source[index];
            if (button != null && button.gameObject.activeInHierarchy && button.interactable)
                button.onClick.Invoke();
        }

        public void FlashDamage()
        {
            damageFlash.color = new Color(1f, 0.05f, 0.2f, 0.08f);
            Refresh();
        }

        public void ShowUpgradeChoices(IReadOnlyList<UpgradeDefinition> choices, Action<UpgradeDefinition> selected)
        {
            HideRelicDetails();
            upgradePanel.SetActive(true);
            for (var i = 0; i < upgradeButtons.Count; i++)
            {
                var button = upgradeButtons[i];
                button.onClick.RemoveAllListeners();
                if (i >= choices.Count)
                {
                    button.gameObject.SetActive(false);
                    continue;
                }
                button.gameObject.SetActive(true);
                var choice = choices[i];
                button.transform.Find("Icon").GetComponent<TMP_Text>().text = choice.Icon;
                button.transform.Find("Name").GetComponent<TMP_Text>().text = choice.Name;
                button.transform.Find("Description").GetComponent<TMP_Text>().text =
                    GameManager.Instance != null ? GameManager.Instance.UpgradeChoiceDescription(choice) : choice.Description;
                button.transform.Find("Rank").GetComponent<TMP_Text>().text =
                    GameManager.Instance != null
                        ? GameManager.Instance.UpgradeChoiceRank(choice, i + 1)
                        : $"RANK {choice.Rank} → {choice.Rank + 1} · [{i + 1}]";
                button.onClick.AddListener(() => selected(choice));
            }
        }

        public void HideUpgradeChoices() => upgradePanel.SetActive(false);

        public void ShowClassChoices(IReadOnlyList<ClassContent> choices, Action<ClassContent> selected)
        {
            HideRelicDetails();
            classPanel.SetActive(true);
            for (var i = 0; i < classButtons.Count; i++)
            {
                var button = classButtons[i];
                button.onClick.RemoveAllListeners();
                if (i >= choices.Count)
                {
                    button.gameObject.SetActive(false);
                    continue;
                }
                button.gameObject.SetActive(true);
                var choice = choices[i];
                button.GetComponentInChildren<TMP_Text>().text = $"{choice.icon}\n{choice.koreanName}\n<size=18>{new string('★', choice.difficulty)}{new string('☆', 5 - choice.difficulty)}\n{choice.description}</size>";
                button.onClick.AddListener(() => selected(choice));
            }
        }

        public void ShowRelicChoices(IReadOnlyList<RelicContent> choices, Action<RelicContent> selected)
        {
            HideRelicDetails();
            relicPanel.SetActive(true);
            for (var i = 0; i < relicButtons.Count; i++)
            {
                var button = relicButtons[i];
                button.onClick.RemoveAllListeners();
                var choice = choices[i];
                button.gameObject.SetActive(true);
                button.GetComponent<Image>().color = Color.Lerp(new Color(0.04f, 0.1f, 0.2f), ContentDatabase.RarityColor(choice.rarity), 0.35f);
                button.GetComponentInChildren<TMP_Text>().text = $"{choice.icon} {choice.name}\n<size=21>{ContentDatabase.RarityName(choice.rarity)} · {choice.description}</size>";
                button.onClick.AddListener(() => selected(choice));
            }
        }

        public void ShowRelicRoulette(RelicContent result, Action award)
        {
            HideRelicDetails();
            relicPanel.transform.SetAsLastSibling();
            relicPanel.SetActive(true);
            relicResultDismiss = null;
            relicRouletteCompleted = false;
            if (relicRouletteRoutine != null) StopCoroutine(relicRouletteRoutine);
            relicRouletteRoutine = StartCoroutine(RunRelicRoulette(result, award));
        }

        private IEnumerator RunRelicRoulette(RelicContent result, Action award)
        {
            var title = relicPanel.transform.Find("Card/Title")?.GetComponent<TMP_Text>();
            if (title != null) title.text = "보스 유물 슬롯";
            for (var i = 0; i < relicButtons.Count; i++)
            {
                relicButtons[i].onClick.RemoveAllListeners();
                relicButtons[i].gameObject.SetActive(i == 1);
            }
            var card = relicButtons[1];
            var catalog = ContentDatabase.Catalog.relics;
            for (var tick = 0; tick <= 18; tick++)
            {
                var preview = tick == 18 ? result : catalog[UnityEngine.Random.Range(0, catalog.Count)];
                card.GetComponent<Image>().color = Color.Lerp(new Color(0.04f, 0.1f, 0.2f), ContentDatabase.RarityColor(preview.rarity), 0.35f);
                card.GetComponentInChildren<TMP_Text>().text = tick == 18
                    ? $"{preview.icon}\n{preview.name}\n<size=21>{ContentDatabase.RarityName(preview.rarity)} RELIC\n{preview.description}\nNEW / LEVEL UP</size>"
                    : $"{preview.icon}\nSEARCHING RELIC\n<size=21>공명 주파수 탐색 중…\n◈ ◇ ◈</size>";
                yield return new WaitForSecondsRealtime(0.045f + tick * 0.005f);
            }
            yield return new WaitForSecondsRealtime(0.52f);
            relicRouletteRoutine = null;
            relicRouletteCompleted = true;
            award();
        }

        public void ShowRelicResult(RelicInstance relic, string message, Action dismiss)
        {
            relicPanel.SetActive(true);
            var title = relicPanel.transform.Find("Card/Title")?.GetComponent<TMP_Text>();
            if (title != null) title.text = message;
            for (var i = 0; i < relicButtons.Count; i++)
            {
                relicButtons[i].onClick.RemoveAllListeners();
                relicButtons[i].gameObject.SetActive(i == 1);
            }
            var card = relicButtons[1];
            card.GetComponent<Image>().color = Color.Lerp(new Color(0.04f, 0.1f, 0.2f), ContentDatabase.RarityColor(relic.Definition.rarity), 0.42f);
            card.GetComponentInChildren<TMP_Text>().text =
                $"{relic.Definition.icon}\n{relic.Definition.name} · LV.{relic.Level}\n<size=21>{ContentDatabase.RarityName(relic.Definition.rarity)} RELIC\n{relic.Definition.description}\nTAP / PRESS KEY</size>";
            relicResultDismiss = () =>
            {
                relicResultDismiss = null;
                dismiss();
            };
            card.onClick.AddListener(() =>
            {
                var action = relicResultDismiss;
                relicResultDismiss = null;
                action?.Invoke();
            });
        }

        public void ShowRelicDecision(RelicContent candidate, RelicInstance weakest, Action replace, Action salvage)
        {
            for (var i = 0; i < relicButtons.Count; i++)
            {
                relicButtons[i].onClick.RemoveAllListeners();
                relicButtons[i].gameObject.SetActive(i < 2);
            }
            relicButtons[0].GetComponentInChildren<TMP_Text>().text = $"교체\n<size=21>{weakest.Definition.name} → {candidate.name}</size>";
            relicButtons[0].onClick.AddListener(() => replace());
            relicButtons[1].GetComponentInChildren<TMP_Text>().text = $"분해\n<size=21>XP {ContentDatabase.RelicSalvageRatio(candidate.rarity) * 100f:0}% + 체력 회복</size>";
            relicButtons[1].onClick.AddListener(() => salvage());
        }

        public void HideAllChoices()
        {
            relicResultDismiss = null;
            if (relicRouletteRoutine != null)
            {
                StopCoroutine(relicRouletteRoutine);
                relicRouletteRoutine = null;
            }
            upgradePanel.SetActive(false);
            classPanel.SetActive(false);
            relicPanel.SetActive(false);
        }

        public void ShowBoss(EnemyController boss)
        {
            bossPanel.SetActive(true);
            bossWarningText.text = $"⚠  ANOMALY DETECTED  ⚠\n{boss.BossKind} · LIMIT {boss.BossTimeRemaining:0}s";
            bossWarningText.gameObject.SetActive(true);
            bossWarningText.transform.SetAsLastSibling();
            bossWarningClock = 2.2f;
            bossWarningWasShown = true;
            ShowToast($"ANOMALY BOSS · {boss.BossKind}");
        }

        public void HideBoss() => bossPanel.SetActive(false);

        public void ShowToast(string message)
        {
            toastText.text = message;
            toastText.gameObject.SetActive(true);
            toastClock = 2.8f;
        }

        public void ShowGameOver()
        {
            gameOverPanel.transform.SetAsLastSibling();
            gameOverText.text =
                $"{(manager.WasAbandoned ? "작전 포기" : "작전 종료")}\n"
                + $"생존 {Mathf.FloorToInt(manager.Elapsed / 60f):00}:{Mathf.FloorToInt(manager.Elapsed % 60f):00}   ·   처치 {manager.Kills:N0}   ·   보스 {manager.BossKills}   ·   LV.{manager.Level}\n"
                + $"전직 {(player.Class == ArcanaClass.None ? "미전직" : player.Class.ToString())}   ·   점수 {manager.Score:N0}\n\n"
                + $"술식  {BuildSummary()}\n"
                + $"유물  {RelicSummary()}";
            gameOverPanel.SetActive(true);
        }

        public void HideGameOver() => gameOverPanel.SetActive(false);

        public bool IsGameMenuOpen => gameMenuPanel != null && gameMenuPanel.activeSelf;
        public bool IsHitboxVisible => hitboxVisible;
        public string CodexDiagnostics => codexView != null ? codexView.Diagnostics : "missing";
        public bool IsTitleVisible => titlePanel != null && titlePanel.activeSelf;
        public bool IsGameOverVisible => gameOverPanel != null && gameOverPanel.activeSelf;
        public bool IsBossWarningVisible => bossWarningText != null && bossWarningText.gameObject.activeSelf;
        public bool BossWarningWasShown => bossWarningWasShown;
        public bool HasBossMinimapMarker => miniMap != null && miniMap.HasBossMarker;
        public bool TouchDragIsConfigured => touchDragInput != null && touchDragInput.IsConfigured;
        public bool VerifyTouchDragRouteForTest() => touchDragInput != null && touchDragInput.VerifyRouteForTest();
        public bool IsRelicResultAwaitingDismiss => relicResultDismiss != null;
        public bool RelicRouletteCompleted => relicRouletteCompleted;
        public void DismissRelicResultForTest()
        {
            var dismiss = relicResultDismiss;
            relicResultDismiss = null;
            dismiss?.Invoke();
        }
        public bool IsRelicDetailsVisible => relicDetailsPanel != null && relicDetailsPanel.activeSelf;
        public string RelicDetailsText => relicDetailsText != null ? relicDetailsText.text : "";
        public string BuildTrayText => buildTrayText != null ? buildTrayText.text : "";
        public int ActiveChoicePanelCount =>
            (upgradePanel != null && upgradePanel.activeSelf ? 1 : 0)
            + (classPanel != null && classPanel.activeSelf ? 1 : 0)
            + (relicPanel != null && relicPanel.activeSelf ? 1 : 0);

        public void ShowGameMenuForTest()
        {
            if (manager == null || manager.IsAwaitingStart || manager.IsGameOver) return;
            gameMenuPanel.transform.SetAsLastSibling();
            gameMenuPanel.SetActive(true);
            RefreshMenuLabels();
            Time.timeScale = 0f;
        }
        public void HideGameMenuForTest() => CloseGameMenu();
        public void ShowRelicDetailsForTest()
        {
            if (relicDetailsPanel != null && !relicDetailsPanel.activeSelf) ToggleRelicDetails();
        }

        private void BuildGameMenu(Transform root)
        {
            gameMenuPanel = CreateModal(root, "NEON ARCANA · 작전 메뉴", out var menuBody);
            CreateText(menuBody, "Menu Note", 17, TextAnchor.MiddleCenter, new Vector2(0.2f, 0.7f), new Vector2(0.8f, 0.78f), new Color(0.62f, 0.7f, 0.84f)).text =
                "현재 기록으로 작전을 종료하거나 설정을 변경할 수 있습니다.";
            menuResumeButton = CreateMenuButton(menuBody, "Resume", "계속하기", 0);
            menuSoundButton = CreateMenuButton(menuBody, "Sound", "사운드  ON", 1);
            menuHitboxButton = CreateMenuButton(menuBody, "Hitbox", "플레이어 히트박스  OFF", 2);
            menuAbandonButton = CreateMenuButton(menuBody, "Abandon", "작전 포기  ×", 3, true);
            gameMenuPanel.SetActive(false);
        }

        private void OpenGameMenu()
        {
            if (manager == null || manager.IsAwaitingStart || manager.IsGameOver || manager.IsChoosingUpgrade) return;
            if (codexPanel != null && codexPanel.activeSelf) return;
            HideRelicDetails();
            gameMenuPanel.transform.SetAsLastSibling();
            gameMenuPanel.SetActive(true);
            RefreshMenuLabels();
            Time.timeScale = 0f;
        }

        private void CloseGameMenu()
        {
            if (gameMenuPanel == null || !gameMenuPanel.activeSelf) return;
            gameMenuPanel.SetActive(false);
            if (!manager.IsGameOver && !manager.IsChoosingUpgrade) Time.timeScale = 1f;
        }

        private void ToggleSound()
        {
            soundMuted = !soundMuted;
            PlayerPrefs.SetInt("NeonArcana.SoundMuted", soundMuted ? 1 : 0);
            PlayerPrefs.Save();
            ApplySound();
            RefreshMenuLabels();
        }

        private void ApplySound()
        {
            AudioListener.volume = soundMuted ? 0f : 1f;
        }

        private void ToggleHitbox()
        {
            hitboxVisible = !hitboxVisible;
            PlayerPrefs.SetInt("NeonArcana.ShowHitbox", hitboxVisible ? 1 : 0);
            PlayerPrefs.Save();
            player?.SetHitboxVisible(hitboxVisible);
            RefreshMenuLabels();
        }

        private void RefreshMenuLabels()
        {
            SetButtonLabel(menuSoundButton, $"사운드  {(soundMuted ? "OFF" : "ON")}");
            SetButtonLabel(menuHitboxButton, $"플레이어 히트박스  {(hitboxVisible ? "ON" : "OFF")}");
        }

        private void AbandonRun()
        {
            CloseGameMenu();
            manager.AbandonRun();
        }

        private string BuildSummary()
        {
            var labels = new List<string>();
            foreach (var definition in ContentDatabase.Catalog.upgrades)
            {
                var rank = manager.UpgradeRanks.GetValueOrDefault(definition.id);
                if (rank <= 0) continue;
                labels.Add($"{definition.icon}{definition.name} {rank}");
                if (labels.Count >= 6) break;
            }
            return labels.Count == 0 ? "획득 술식 없음" : string.Join("  ·  ", labels);
        }

        private string RelicSummary()
        {
            var labels = new List<string>();
            foreach (var relic in manager.Relics)
                labels.Add($"{relic.Definition.icon}{relic.Definition.name} LV.{relic.Level}");
            return labels.Count == 0 ? "획득 유물 없음" : string.Join("  ·  ", labels);
        }

        private static void SetButtonLabel(Button button, string label)
        {
            if (button != null) button.GetComponentInChildren<TMP_Text>().text = label;
        }

        public void ShowCodexForCapture()
        {
            OpenCodex();
        }

        private static Image CreateBar(Transform parent, string name, Color fillColor, Vector2 anchorMin, Vector2 anchorMax, Vector2 position, Vector2 size)
        {
            var background = CreateImage(parent, name, new Color(0.02f, 0.04f, 0.1f, 0.88f), anchorMin, anchorMax);
            background.rectTransform.anchoredPosition = position;
            background.rectTransform.sizeDelta = size;
            var fill = CreateImage(background.transform, "Fill", fillColor, Vector2.zero, Vector2.one);
            fill.type = Image.Type.Filled;
            fill.fillMethod = Image.FillMethod.Horizontal;
            fill.fillOrigin = 0;
            fill.fillAmount = 1f;
            return fill;
        }

        private static GameObject CreateModal(Transform parent, string title, out Transform body)
        {
            var overlay = new GameObject(title, typeof(RectTransform), typeof(CanvasRenderer), typeof(Image), typeof(CanvasGroup), typeof(UiMotion));
            overlay.transform.SetParent(parent, false);
            var overlayRect = overlay.GetComponent<RectTransform>();
            overlayRect.anchorMin = Vector2.zero;
            overlayRect.anchorMax = Vector2.one;
            overlayRect.offsetMin = overlayRect.offsetMax = Vector2.zero;
            overlay.GetComponent<Image>().color = new Color(0.005f, 0.008f, 0.035f, 0.9f);

            var card = CreateImage(overlay.transform, "Card", Color.white, new Vector2(0.07f, 0.15f), new Vector2(0.93f, 0.84f));
            card.gameObject.AddComponent<NeonGradientImage>().Configure(
                new Color(0.075f, 0.055f, 0.176f, 0.86f),
                new Color(0.012f, 0.02f, 0.063f, 0.9f));
            var outline = card.gameObject.AddComponent<Outline>();
            outline.effectColor = new Color(0.25f, 0.65f, 1f, 0.32f);
            outline.effectDistance = new Vector2(1.5f, -1.5f);
            // 웹 원본 제목은 자간이 넓게 벌어져 있다. TMP는 characterSpacing으로 그대로 낼 수 있어
            // 예전의 얇은 공백 삽입 꼼수(LetterSpaced)를 쓰지 않는다.
            var titleText = CreateText(card.transform, "Title", 60, TextAnchor.MiddleCenter, new Vector2(0.05f, 0.76f), new Vector2(0.95f, 0.93f), new Color(0.95f, 0.98f, 1f));
            titleText.fontStyle = FontStyles.Bold;
            titleText.enableAutoSizing = false;
            titleText.characterSpacing = 8f;
            titleText.text = title;
            titleText.gameObject.AddComponent<NeonTextGlow>().Configure(new Color(0.35f, 0.7f, 1f), 0.4f, 0.6f);
            body = card.transform;
            return overlay;
        }

        private static Button CreateUpgradeButton(Transform parent, string name, int index)
        {
            var buttonObject = new GameObject(name, typeof(RectTransform), typeof(CanvasRenderer), typeof(Image), typeof(Button), typeof(CanvasGroup), typeof(UiMotion));
            buttonObject.transform.SetParent(parent, false);
            var rect = buttonObject.GetComponent<RectTransform>();
            const float width = 0.28f;
            var center = 0.19f + index * 0.31f;
            rect.anchorMin = new Vector2(center - width * 0.5f, 0.12f);
            rect.anchorMax = new Vector2(center + width * 0.5f, 0.68f);
            rect.offsetMin = new Vector2(8f, 8f);
            rect.offsetMax = new Vector2(-8f, -8f);
            // 웹 원본의 술식 카드도 위가 밝은 보라, 아래가 남색인 그라디언트다.
            buttonObject.AddComponent<NeonGradientImage>().Configure(
                new Color(0.169f, 0.129f, 0.353f, 0.96f),
                new Color(0.043f, 0.047f, 0.145f, 0.96f));
            var outline = buttonObject.AddComponent<Outline>();
            outline.effectColor = new Color(0.35f, 0.72f, 1f, 0.58f);
            outline.effectDistance = new Vector2(1.6f, -1.6f);
            var button = buttonObject.GetComponent<Button>();
            var colors = button.colors;
            colors.normalColor = Color.white;
            colors.highlightedColor = new Color(1.14f, 1.14f, 1.28f);
            colors.pressedColor = new Color(0.82f, 0.75f, 1f);
            button.colors = colors;

            CreateText(buttonObject.transform, "Icon", 36, TextAnchor.MiddleLeft, new Vector2(0.08f, 0.67f), new Vector2(0.92f, 0.88f), new Color(0.35f, 0.95f, 1f));
            CreateText(buttonObject.transform, "Name", 28, TextAnchor.MiddleLeft, new Vector2(0.08f, 0.42f), new Vector2(0.92f, 0.67f), Color.white);
            CreateText(buttonObject.transform, "Description", 18, TextAnchor.UpperLeft, new Vector2(0.08f, 0.2f), new Vector2(0.92f, 0.46f), new Color(0.63f, 0.68f, 0.82f));
            CreateText(buttonObject.transform, "Rank", 14, TextAnchor.LowerRight, new Vector2(0.08f, 0.06f), new Vector2(0.92f, 0.2f), new Color(1f, 0.45f, 0.93f));
            return button;
        }

        private static Button CreateButton(Transform parent, string name, string label)
        {
            var existing = parent.GetComponentsInChildren<Button>(true).Length;
            var buttonObject = new GameObject(name, typeof(RectTransform), typeof(CanvasRenderer), typeof(Image), typeof(Button));
            buttonObject.transform.SetParent(parent, false);
            var rect = buttonObject.GetComponent<RectTransform>();
            var width = existing == 0 && name == "Restart" ? 0.4f : 0.28f;
            var xCenter = existing == 0 && name == "Restart" ? 0.5f : 0.19f + existing * 0.31f;
            rect.anchorMin = new Vector2(xCenter - width * 0.5f, 0.12f);
            rect.anchorMax = new Vector2(xCenter + width * 0.5f, 0.72f);
            rect.offsetMin = new Vector2(8f, 8f);
            rect.offsetMax = new Vector2(-8f, -8f);
            var image = buttonObject.GetComponent<Image>();
            image.color = new Color(0.075f, 0.08f, 0.25f, 0.96f);
            var outline = buttonObject.AddComponent<Outline>();
            outline.effectColor = new Color(0.2f, 0.68f, 1f, 0.52f);
            outline.effectDistance = new Vector2(1.5f, -1.5f);
            var colors = buttonObject.GetComponent<Button>().colors;
            colors.highlightedColor = new Color(0.2f, 0.35f, 0.68f);
            colors.pressedColor = new Color(0.48f, 0.15f, 0.62f);
            buttonObject.GetComponent<Button>().colors = colors;
            CreateText(buttonObject.transform, "Label", 31, TextAnchor.MiddleCenter, Vector2.zero, Vector2.one, Color.white).text = label;
            return buttonObject.GetComponent<Button>();
        }

        private static Button CreateChoiceButton(Transform parent, string name, int index, int count)
        {
            var buttonObject = new GameObject(name, typeof(RectTransform), typeof(CanvasRenderer), typeof(Image), typeof(Button));
            buttonObject.transform.SetParent(parent, false);
            var rect = buttonObject.GetComponent<RectTransform>();
            var width = 0.17f;
            var spacing = 0.18f;
            var center = 0.5f + (index - (count - 1) * 0.5f) * spacing;
            rect.anchorMin = new Vector2(center - width * 0.5f, 0.12f);
            rect.anchorMax = new Vector2(center + width * 0.5f, 0.74f);
            rect.offsetMin = new Vector2(5f, 5f);
            rect.offsetMax = new Vector2(-5f, -5f);
            // 웹 원본의 선택 카드는 위에서 아래로 어두워지는 보라-남색 그라디언트에
            // 옅게 빛나는 테두리를 두른 형태다. 단색 사각형으로는 그 질감이 나오지 않는다.
            buttonObject.AddComponent<NeonGradientImage>().Configure(
                new Color(0.239f, 0.176f, 0.451f, 0.96f),
                new Color(0.055f, 0.055f, 0.157f, 0.96f));

            var outline = buttonObject.AddComponent<Outline>();
            outline.effectColor = new Color(0.45f, 0.55f, 1f, 0.5f);
            outline.effectDistance = new Vector2(1.6f, -1.6f);

            var button = buttonObject.GetComponent<Button>();
            var colors = button.colors;
            colors.normalColor = Color.white;
            colors.highlightedColor = new Color(1.12f, 1.12f, 1.25f);
            colors.pressedColor = new Color(0.82f, 0.75f, 1f);
            button.colors = colors;

            CreateText(buttonObject.transform, "Label", 26, TextAnchor.MiddleCenter, Vector2.zero, Vector2.one, Color.white).text = "";
            return button;
        }

        private static Button CreateMenuButton(Transform parent, string name, string label, int index, bool danger = false)
        {
            var buttonObject = new GameObject(name, typeof(RectTransform), typeof(CanvasRenderer), typeof(Image), typeof(Button), typeof(CanvasGroup), typeof(UiMotion));
            buttonObject.transform.SetParent(parent, false);
            var rect = buttonObject.GetComponent<RectTransform>();
            var top = 0.66f - index * 0.135f;
            rect.anchorMin = new Vector2(0.28f, top - 0.1f);
            rect.anchorMax = new Vector2(0.72f, top);
            rect.offsetMin = new Vector2(5f, 5f);
            rect.offsetMax = new Vector2(-5f, -5f);
            var image = buttonObject.GetComponent<Image>();
            image.color = danger ? new Color(0.32f, 0.055f, 0.12f, 0.98f) : new Color(0.045f, 0.14f, 0.25f, 0.98f);
            var outline = buttonObject.AddComponent<Outline>();
            outline.effectColor = danger ? new Color(1f, 0.25f, 0.42f, 0.75f) : new Color(0.25f, 0.82f, 1f, 0.58f);
            outline.effectDistance = new Vector2(1.5f, -1.5f);
            var button = buttonObject.GetComponent<Button>();
            var colors = button.colors;
            colors.highlightedColor = danger ? new Color(0.62f, 0.1f, 0.2f) : new Color(0.12f, 0.38f, 0.58f);
            colors.pressedColor = new Color(0.48f, 0.15f, 0.62f);
            button.colors = colors;
            CreateText(buttonObject.transform, "Label", 26, TextAnchor.MiddleCenter, Vector2.zero, Vector2.one, Color.white).text = label;
            return button;
        }

        private static Button CreateFixedButton(Transform parent, string name, string label, Vector2 anchorMin, Vector2 anchorMax)
        {
            var buttonObject = new GameObject(name, typeof(RectTransform), typeof(CanvasRenderer), typeof(Image), typeof(Button));
            buttonObject.transform.SetParent(parent, false);
            var rect = buttonObject.GetComponent<RectTransform>();
            rect.anchorMin = anchorMin;
            rect.anchorMax = anchorMax;
            rect.offsetMin = new Vector2(4f, 4f);
            rect.offsetMax = new Vector2(-4f, -4f);
            buttonObject.GetComponent<Image>().color = new Color(0.08f, 0.18f, 0.32f, 0.92f);
            CreateText(buttonObject.transform, "Label", 24, TextAnchor.MiddleCenter, Vector2.zero, Vector2.one, Color.white).text = label;
            return buttonObject.GetComponent<Button>();
        }

        private static Image CreateImage(Transform parent, string name, Color color, Vector2 anchorMin, Vector2 anchorMax)
        {
            var gameObject = new GameObject(name, typeof(RectTransform), typeof(CanvasRenderer), typeof(Image));
            gameObject.transform.SetParent(parent, false);
            var rect = gameObject.GetComponent<RectTransform>();
            rect.anchorMin = anchorMin;
            rect.anchorMax = anchorMax;
            rect.offsetMin = rect.offsetMax = Vector2.zero;
            var image = gameObject.GetComponent<Image>();
            image.sprite = NeonAssets.SolidSprite(Color.white);
            image.color = color;
            return image;
        }

        private static Image CreateSpriteImage(Transform parent, string name, Sprite sprite, Vector2 anchorMin, Vector2 anchorMax, Color color)
        {
            var image = CreateImage(parent, name, color, anchorMin, anchorMax);
            image.sprite = sprite;
            image.preserveAspect = true;
            image.raycastTarget = false;
            return image;
        }


        private static TextMeshProUGUI CreateText(Transform parent, string name, int fontSize, TextAnchor alignment, Vector2 anchorMin, Vector2 anchorMax, Color color)
        {
            var gameObject = new GameObject(name, typeof(RectTransform), typeof(CanvasRenderer), typeof(TextMeshProUGUI));
            gameObject.transform.SetParent(parent, false);
            var rect = gameObject.GetComponent<RectTransform>();
            rect.anchorMin = anchorMin;
            rect.anchorMax = anchorMax;
            rect.offsetMin = rect.offsetMax = Vector2.zero;
            var text = gameObject.GetComponent<TextMeshProUGUI>();
            text.font = NeonFonts.Primary();
            text.fontSize = fontSize;
            text.alignment = NeonUiText.MapAlignment(alignment);
            text.color = color;
            text.richText = true;
            text.enableAutoSizing = true;
            text.fontSizeMin = 16f;
            text.fontSizeMax = fontSize;
            return text;
        }


    }
}
