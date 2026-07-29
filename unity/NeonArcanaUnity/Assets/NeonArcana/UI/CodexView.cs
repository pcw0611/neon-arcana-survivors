using System;
using System.Collections.Generic;
using TMPro;
using UnityEngine;
using UnityEngine.UI;

namespace NeonArcana
{
    public sealed class CodexView : MonoBehaviour
    {
        private enum CodexTab
        {
            Builds,
            Relics,
            Classes
        }

        [SerializeField] private TMP_Text summaryText;
        [SerializeField] private RectTransform contentRoot;
        [SerializeField] private ScrollRect scrollRect;
        [SerializeField] private Button buildsTab;
        [SerializeField] private Button relicsTab;
        [SerializeField] private Button classesTab;
        [SerializeField] private Button closeButton;

        private readonly List<CodexCard> cards = new();
        private GameManager manager;
        private CodexTab activeTab;
        private float shownAt = -1f;

        public event Action Closed;
        public int VisibleCardCount => cards.Count;
        public string ActiveTabName => activeTab.ToString();
        public string Diagnostics
        {
            get
            {
                var group = GetComponent<CanvasGroup>();
                var firstCard = cards.Count > 0 && cards[0] != null ? cards[0].GetComponent<CanvasRenderer>() : null;
                return $"active={gameObject.activeInHierarchy} alpha={group?.alpha:F2} scale={transform.localScale.x:F2} cards={cards.Count} firstCardActive={(cards.Count > 0 && cards[0].gameObject.activeInHierarchy)} firstCardDepth={firstCard?.absoluteDepth}";
            }
        }

        public static CodexView Create(Transform parent)
        {
            var overlay = new GameObject("Codex", typeof(RectTransform), typeof(CanvasGroup), typeof(UiMotion), typeof(CodexView));
            overlay.transform.SetParent(parent, false);
            var overlayRect = overlay.GetComponent<RectTransform>();
            overlayRect.anchorMin = Vector2.zero;
            overlayRect.anchorMax = Vector2.one;
            overlayRect.offsetMin = overlayRect.offsetMax = Vector2.zero;

            var view = overlay.GetComponent<CodexView>();
            view.Build();
            overlay.SetActive(false);
            return view;
        }

        public void Bind(GameManager gameManager)
        {
            manager = gameManager;
            buildsTab.onClick.RemoveAllListeners();
            relicsTab.onClick.RemoveAllListeners();
            classesTab.onClick.RemoveAllListeners();
            closeButton.onClick.RemoveAllListeners();
            buildsTab.onClick.AddListener(() => Render(CodexTab.Builds));
            relicsTab.onClick.AddListener(() => Render(CodexTab.Relics));
            classesTab.onClick.AddListener(() => Render(CodexTab.Classes));
            closeButton.onClick.AddListener(Hide);
        }

        public void Show(GameManager gameManager)
        {
            if (manager != gameManager) Bind(gameManager);
            gameObject.SetActive(true);
            transform.SetAsLastSibling();
            shownAt = Time.unscaledTime;
            Render(CodexTab.Builds);
        }

        public void Hide()
        {
            if (!gameObject.activeSelf) return;
            gameObject.SetActive(false);
            shownAt = -1f;
            Closed?.Invoke();
        }

        public void ShowRelics() => Render(CodexTab.Relics);
        public void ShowClasses() => Render(CodexTab.Classes);
        public void ShowBuilds() => Render(CodexTab.Builds);

        private void LateUpdate()
        {
            if (shownAt < 0f || Time.unscaledTime - shownAt < 0.45f) return;
            var motion = GetComponent<UiMotion>();
            if (motion != null) motion.CompleteImmediately();
            shownAt = -1f;
        }

        private void Build()
        {
            var backdrop = CreateImage(transform, "Backdrop", new Color(0.004f, 0.007f, 0.025f, 1f), Vector2.zero, Vector2.one);
            backdrop.raycastTarget = true;
            var panel = CreateImage(transform, "Codex Frame", new Color(0.018f, 0.03f, 0.085f, 0.96f), new Vector2(0.035f, 0.055f), new Vector2(0.965f, 0.945f));
            var frameOutline = panel.gameObject.AddComponent<Outline>();
            frameOutline.effectColor = new Color(0.25f, 0.88f, 1f, 0.65f);
            frameOutline.effectDistance = new Vector2(2f, -2f);

            var title = CreateText(panel.transform, "Title", 46, TextAnchor.MiddleLeft, new Vector2(0.035f, 0.875f), new Vector2(0.55f, 0.97f), new Color(0.48f, 0.95f, 1f));
            title.text = "NEON ARCANA CODEX";
            summaryText = CreateText(panel.transform, "Summary", 17, TextAnchor.MiddleRight, new Vector2(0.48f, 0.89f), new Vector2(0.83f, 0.955f), new Color(0.67f, 0.75f, 0.88f));

            closeButton = CreateButton(panel.transform, "Close", "닫기  ×", new Vector2(0.845f, 0.885f), new Vector2(0.965f, 0.96f));
            buildsTab = CreateButton(panel.transform, "Builds Tab", "술식", new Vector2(0.035f, 0.79f), new Vector2(0.16f, 0.865f));
            relicsTab = CreateButton(panel.transform, "Relics Tab", "유물", new Vector2(0.17f, 0.79f), new Vector2(0.295f, 0.865f));
            classesTab = CreateButton(panel.transform, "Classes Tab", "전직", new Vector2(0.305f, 0.79f), new Vector2(0.43f, 0.865f));

            var scrollObject = new GameObject("Card Scroll", typeof(RectTransform), typeof(ScrollRect));
            scrollObject.transform.SetParent(panel.transform, false);
            var scrollTransform = scrollObject.GetComponent<RectTransform>();
            scrollTransform.anchorMin = new Vector2(0.03f, 0.035f);
            scrollTransform.anchorMax = new Vector2(0.97f, 0.765f);
            scrollTransform.offsetMin = scrollTransform.offsetMax = Vector2.zero;
            scrollRect = scrollObject.GetComponent<ScrollRect>();
            scrollRect.horizontal = false;
            scrollRect.vertical = true;
            scrollRect.movementType = ScrollRect.MovementType.Clamped;
            scrollRect.scrollSensitivity = 42f;

            var viewport = CreateImage(scrollObject.transform, "Viewport", new Color(0f, 0f, 0f, 0.08f), Vector2.zero, Vector2.one);
            viewport.gameObject.AddComponent<RectMask2D>();
            scrollRect.viewport = viewport.rectTransform;

            var contentObject = new GameObject("Content", typeof(RectTransform), typeof(GridLayoutGroup), typeof(ContentSizeFitter));
            contentObject.transform.SetParent(viewport.transform, false);
            contentRoot = contentObject.GetComponent<RectTransform>();
            contentRoot.anchorMin = new Vector2(0f, 1f);
            contentRoot.anchorMax = new Vector2(1f, 1f);
            contentRoot.pivot = new Vector2(0.5f, 1f);
            contentRoot.anchoredPosition = Vector2.zero;
            var grid = contentObject.GetComponent<GridLayoutGroup>();
            grid.cellSize = new Vector2(520f, 168f);
            grid.spacing = new Vector2(16f, 16f);
            grid.padding = new RectOffset(12, 12, 12, 12);
            grid.constraint = GridLayoutGroup.Constraint.FixedColumnCount;
            grid.constraintCount = 3;
            grid.childAlignment = TextAnchor.UpperCenter;
            var fitter = contentObject.GetComponent<ContentSizeFitter>();
            fitter.verticalFit = ContentSizeFitter.FitMode.PreferredSize;
            scrollRect.content = contentRoot;
        }

        private void Render(CodexTab tab)
        {
            if (manager == null) return;
            activeTab = tab;
            ClearCards();
            UpdateTabVisuals();
            summaryText.text = $"{manager.CodexSummary()}  ·  최근 런: {SaveProgress.LastRun}";

            switch (tab)
            {
                case CodexTab.Builds:
                    RenderBuilds();
                    break;
                case CodexTab.Relics:
                    RenderRelics();
                    break;
                case CodexTab.Classes:
                    RenderClasses();
                    break;
            }

            Canvas.ForceUpdateCanvases();
            scrollRect.verticalNormalizedPosition = 1f;
        }

        private void RenderBuilds()
        {
            foreach (var definition in ContentDatabase.Catalog.upgrades)
            {
                if (definition.id.StartsWith("limit_", StringComparison.Ordinal)) continue;
                var rank = manager.UpgradeRanks.GetValueOrDefault(definition.id);
                var mastered = rank >= definition.maxRank;
                var status = mastered ? "MASTER" : rank > 0 ? $"RANK {rank}/{definition.maxRank}" : $"0/{definition.maxRank}";
                var prerequisite = string.IsNullOrWhiteSpace(definition.prerequisite) ? "" : $"\n선행 술식: {UpgradeName(definition.prerequisite)}";
                AddCard(definition.icon, definition.name, status, definition.description + prerequisite,
                    mastered ? new Color(1f, 0.78f, 0.24f) : new Color(0.34f, 0.9f, 1f), rank == 0, mastered);
            }
        }

        private void RenderRelics()
        {
            foreach (var definition in ContentDatabase.Catalog.relics)
            {
                RelicInstance owned = null;
                foreach (var relic in manager.Relics)
                    if (relic.Definition.id == definition.id) owned = relic;
                var discovered = manager.IsRelicDiscovered(definition.id);
                var status = owned != null ? $"LV.{owned.Level}" : discovered ? ContentDatabase.RarityName(definition.rarity) : "미발견";
                AddCard(definition.icon, definition.name, status, definition.description,
                    ContentDatabase.RarityColor(definition.rarity), !discovered && owned == null, owned != null && owned.Level >= 5);
            }
        }

        private void RenderClasses()
        {
            foreach (var definition in ContentDatabase.Catalog.classes)
            {
                var active = manager.Player != null && manager.Player.Class == definition.classId;
                var completed = SaveProgress.HasClass(definition.classId);
                var status = active ? "ACTIVE" : completed ? "기록됨" : "미선택";
                var difficulty = new string('★', definition.difficulty) + new string('☆', 5 - definition.difficulty);
                AddCard(definition.icon, definition.koreanName, status, $"난이도 {difficulty}\n{definition.description}",
                    active ? new Color(1f, 0.78f, 0.24f) : new Color(0.48f, 0.82f, 1f), !completed && !active, active);
            }
        }

        private void AddCard(string icon, string title, string status, string description, Color accent, bool locked, bool mastered)
        {
            var prefab = Resources.Load<CodexCard>("Prefabs/CodexCard");
            CodexCard card;
            if (prefab != null)
            {
                card = Instantiate(prefab, contentRoot);
            }
            else
            {
                var template = CodexCard.CreateTemplate();
                template.transform.SetParent(contentRoot, false);
                card = template.GetComponent<CodexCard>();
            }
            card.name = $"Codex Card · {title}";
            card.gameObject.SetActive(true);
            card.Configure(icon, title, status, description, accent, locked, mastered);
            cards.Add(card);
        }

        private void ClearCards()
        {
            foreach (var card in cards)
                if (card != null) Destroy(card.gameObject);
            cards.Clear();
        }

        private void UpdateTabVisuals()
        {
            SetTab(buildsTab, activeTab == CodexTab.Builds);
            SetTab(relicsTab, activeTab == CodexTab.Relics);
            SetTab(classesTab, activeTab == CodexTab.Classes);
        }

        private static void SetTab(Button button, bool active)
        {
            button.GetComponent<Image>().color = active ? new Color(0.08f, 0.35f, 0.52f, 0.98f) : new Color(0.035f, 0.09f, 0.18f, 0.96f);
            button.GetComponentInChildren<TMP_Text>().color = active ? Color.white : new Color(0.65f, 0.72f, 0.84f);
        }

        private static string UpgradeName(string id)
        {
            var found = ContentDatabase.Catalog.upgrades.Find(item => item.id == id);
            return found != null ? found.name : id;
        }

        private static Image CreateImage(Transform parent, string name, Color color, Vector2 anchorMin, Vector2 anchorMax)
        {
            var child = new GameObject(name, typeof(RectTransform), typeof(CanvasRenderer), typeof(Image));
            child.transform.SetParent(parent, false);
            var rect = child.GetComponent<RectTransform>();
            rect.anchorMin = anchorMin;
            rect.anchorMax = anchorMax;
            rect.offsetMin = rect.offsetMax = Vector2.zero;
            var image = child.GetComponent<Image>();
            image.sprite = NeonAssets.SolidSprite(Color.white);
            image.color = color;
            return image;
        }

        private static TextMeshProUGUI CreateText(Transform parent, string name, int fontSize, TextAnchor alignment, Vector2 anchorMin, Vector2 anchorMax, Color color)
        {
            var child = new GameObject(name, typeof(RectTransform), typeof(CanvasRenderer), typeof(TextMeshProUGUI));
            child.transform.SetParent(parent, false);
            var rect = child.GetComponent<RectTransform>();
            rect.anchorMin = anchorMin;
            rect.anchorMax = anchorMax;
            rect.offsetMin = rect.offsetMax = Vector2.zero;
            var text = child.GetComponent<TextMeshProUGUI>();
            text.font = NeonFonts.Primary();
            text.fontSize = fontSize;
            text.alignment = NeonUiText.MapAlignment(alignment);
            text.color = color;
            text.enableAutoSizing = true;
            text.fontSizeMin = 12f;
            text.fontSizeMax = fontSize;
            text.raycastTarget = false;
            return text;
        }

        private static Button CreateButton(Transform parent, string name, string label, Vector2 anchorMin, Vector2 anchorMax)
        {
            var image = CreateImage(parent, name, new Color(0.035f, 0.09f, 0.18f, 0.96f), anchorMin, anchorMax);
            var outline = image.gameObject.AddComponent<Outline>();
            outline.effectColor = new Color(0.25f, 0.72f, 1f, 0.48f);
            outline.effectDistance = new Vector2(1.5f, -1.5f);
            var button = image.gameObject.AddComponent<Button>();
            var colors = button.colors;
            colors.highlightedColor = new Color(0.14f, 0.44f, 0.62f);
            colors.pressedColor = new Color(0.44f, 0.16f, 0.56f);
            button.colors = colors;
            CreateText(image.transform, "Label", 23, TextAnchor.MiddleCenter, Vector2.zero, Vector2.one, Color.white).text = label;
            return button;
        }


    }
}
