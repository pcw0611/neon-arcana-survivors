using System;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.UI;

namespace NeonArcana
{
    public sealed class GameHud : MonoBehaviour
    {
        public static GameHud Instance { get; private set; }

        private GameManager manager;
        private PlayerController player;
        private Text statsText;
        private Text timerText;
        private Text hostileText;
        private Image hpFill;
        private Image xpFill;
        private Image damageFlash;
        private GameObject upgradePanel;
        private GameObject gameOverPanel;
        private Text gameOverText;
        private readonly List<Button> upgradeButtons = new();

        public static GameHud Create(GameManager manager, PlayerController player)
        {
            var root = new GameObject("Game HUD", typeof(Canvas), typeof(CanvasScaler), typeof(GraphicRaycaster), typeof(GameHud));
            var canvas = root.GetComponent<Canvas>();
            canvas.renderMode = RenderMode.ScreenSpaceOverlay;
            canvas.sortingOrder = 100;
            var scaler = root.GetComponent<CanvasScaler>();
            scaler.uiScaleMode = CanvasScaler.ScaleMode.ScaleWithScreenSize;
            scaler.referenceResolution = new Vector2(1920f, 1080f);
            scaler.matchWidthOrHeight = 0.5f;

            var hud = root.GetComponent<GameHud>();
            hud.manager = manager;
            hud.player = player;
            hud.Build(root.transform);
            Instance = hud;
            return hud;
        }

        private void Build(Transform root)
        {
            xpFill = CreateBar(root, "XP", new Color(0.1f, 0.85f, 1f), new Vector2(0f, 1f), new Vector2(1f, 1f), new Vector2(0f, -8f), new Vector2(0f, 16f));
            hpFill = CreateBar(root, "HP", new Color(0.2f, 1f, 0.65f), new Vector2(0.02f, 0.91f), new Vector2(0.28f, 0.91f), Vector2.zero, new Vector2(0f, 18f));

            statsText = CreateText(root, "Stats", 32, TextAnchor.MiddleLeft, new Vector2(0.02f, 0.94f), new Vector2(0.46f, 0.99f), new Color(0.85f, 0.95f, 1f));
            timerText = CreateText(root, "Timer", 36, TextAnchor.MiddleCenter, new Vector2(0.43f, 0.92f), new Vector2(0.57f, 0.99f), Color.white);
            hostileText = CreateText(root, "Hostiles", 26, TextAnchor.MiddleRight, new Vector2(0.72f, 0.92f), new Vector2(0.98f, 0.99f), new Color(1f, 0.5f, 0.8f));
            CreateText(root, "Hint", 22, TextAnchor.MiddleCenter, new Vector2(0.3f, 0.02f), new Vector2(0.7f, 0.08f), new Color(0.65f, 0.8f, 0.9f)).text = "왼쪽: 이동  ·  오른쪽: 조준  ·  자동 공격";

            player.MoveJoystick = VirtualJoystick.Create(root, "Move Stick", new Vector2(0.11f, 0.2f), new Color(0.2f, 0.9f, 1f));
            player.AimJoystick = VirtualJoystick.Create(root, "Aim Stick", new Vector2(0.89f, 0.2f), new Color(1f, 0.2f, 0.65f));

            damageFlash = CreateImage(root, "Damage Flash", new Color(1f, 0.05f, 0.2f, 0f), Vector2.zero, Vector2.one);
            damageFlash.raycastTarget = false;
            upgradePanel = CreateModal(root, "LEVEL UP · 균열 강화 선택", out var upgradeBody);
            for (var i = 0; i < 3; i++) upgradeButtons.Add(CreateButton(upgradeBody, $"Upgrade {i + 1}", ""));
            upgradePanel.SetActive(false);

            gameOverPanel = CreateModal(root, "RIFT COLLAPSED", out var gameOverBody);
            gameOverText = CreateText(gameOverBody, "Result", 34, TextAnchor.MiddleCenter, new Vector2(0.08f, 0.35f), new Vector2(0.92f, 0.7f), Color.white);
            var restart = CreateButton(gameOverBody, "Restart", "다시 진입");
            restart.onClick.AddListener(manager.Restart);
            gameOverPanel.SetActive(false);
        }

        private void Update()
        {
            if (damageFlash != null && damageFlash.color.a > 0f)
            {
                var color = damageFlash.color;
                color.a = Mathf.MoveTowards(color.a, 0f, Time.unscaledDeltaTime * 2.8f);
                damageFlash.color = color;
            }
        }

        public void Refresh()
        {
            if (manager == null || player == null) return;
            statsText.text = $"LV.{manager.Level}    ♥ {Mathf.CeilToInt(player.Hp)}/{Mathf.CeilToInt(player.MaxHp)}    ✦ {manager.Score:N0}";
            var minutes = Mathf.FloorToInt(manager.Elapsed / 60f);
            var seconds = Mathf.FloorToInt(manager.Elapsed % 60f);
            timerText.text = $"{minutes:00}:{seconds:00}";
            hostileText.text = $"{EnemyController.ActiveCount} HOSTILES";
            hpFill.fillAmount = player.MaxHp <= 0f ? 0f : player.Hp / player.MaxHp;
            xpFill.fillAmount = manager.XpToNext <= 0 ? 0f : manager.Xp / (float)manager.XpToNext;
        }

        public void FlashDamage()
        {
            damageFlash.color = new Color(1f, 0.05f, 0.2f, 0.28f);
            Refresh();
        }

        public void ShowUpgradeChoices(IReadOnlyList<UpgradeDefinition> choices, Action<UpgradeDefinition> selected)
        {
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
                button.GetComponentInChildren<Text>().text = $"{choice.Name}  {choice.Rank + 1}/{choice.MaxRank}\n<size=24>{choice.Description}</size>";
                button.onClick.AddListener(() => selected(choice));
            }
        }

        public void HideUpgradeChoices() => upgradePanel.SetActive(false);

        public void ShowGameOver()
        {
            gameOverText.text = $"생존 {Mathf.FloorToInt(manager.Elapsed / 60f):00}:{Mathf.FloorToInt(manager.Elapsed % 60f):00}\n처치 {manager.Kills:N0} · 레벨 {manager.Level}\n점수 {manager.Score:N0}";
            gameOverPanel.SetActive(true);
        }

        public void HideGameOver() => gameOverPanel.SetActive(false);

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
            var overlay = new GameObject(title, typeof(RectTransform), typeof(CanvasRenderer), typeof(Image));
            overlay.transform.SetParent(parent, false);
            var overlayRect = overlay.GetComponent<RectTransform>();
            overlayRect.anchorMin = Vector2.zero;
            overlayRect.anchorMax = Vector2.one;
            overlayRect.offsetMin = overlayRect.offsetMax = Vector2.zero;
            overlay.GetComponent<Image>().color = new Color(0.005f, 0.008f, 0.025f, 0.88f);

            var card = CreateImage(overlay.transform, "Card", new Color(0.025f, 0.045f, 0.11f, 0.98f), new Vector2(0.22f, 0.18f), new Vector2(0.78f, 0.82f));
            CreateText(card.transform, "Title", 42, TextAnchor.MiddleCenter, new Vector2(0.05f, 0.82f), new Vector2(0.95f, 0.98f), new Color(0.35f, 0.95f, 1f)).text = title;
            body = card.transform;
            return overlay;
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
            image.color = new Color(0.08f, 0.22f, 0.38f, 0.98f);
            var colors = buttonObject.GetComponent<Button>().colors;
            colors.highlightedColor = new Color(0.18f, 0.48f, 0.68f);
            colors.pressedColor = new Color(0.4f, 0.18f, 0.55f);
            buttonObject.GetComponent<Button>().colors = colors;
            CreateText(buttonObject.transform, "Label", 31, TextAnchor.MiddleCenter, Vector2.zero, Vector2.one, Color.white).text = label;
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

        private static Text CreateText(Transform parent, string name, int fontSize, TextAnchor alignment, Vector2 anchorMin, Vector2 anchorMax, Color color)
        {
            var gameObject = new GameObject(name, typeof(RectTransform), typeof(CanvasRenderer), typeof(Text));
            gameObject.transform.SetParent(parent, false);
            var rect = gameObject.GetComponent<RectTransform>();
            rect.anchorMin = anchorMin;
            rect.anchorMax = anchorMax;
            rect.offsetMin = rect.offsetMax = Vector2.zero;
            var text = gameObject.GetComponent<Text>();
            text.font = Resources.GetBuiltinResource<Font>("LegacyRuntime.ttf");
            text.fontSize = fontSize;
            text.alignment = alignment;
            text.color = color;
            text.supportRichText = true;
            text.resizeTextForBestFit = true;
            text.resizeTextMinSize = 16;
            return text;
        }
    }
}
