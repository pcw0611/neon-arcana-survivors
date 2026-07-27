using UnityEngine;
using UnityEngine.UI;

namespace NeonArcana
{
    public sealed class CodexCard : MonoBehaviour
    {
        [SerializeField] private Image background;
        [SerializeField] private Text iconText;
        [SerializeField] private Text nameText;
        [SerializeField] private Text statusText;
        [SerializeField] private Text descriptionText;
        [SerializeField] private Outline outline;

        public static GameObject CreateTemplate()
        {
            var root = new GameObject("CodexCard", typeof(RectTransform), typeof(CanvasRenderer), typeof(Image), typeof(Outline), typeof(CodexCard));
            var rect = root.GetComponent<RectTransform>();
            rect.sizeDelta = new Vector2(520f, 168f);

            var card = root.GetComponent<CodexCard>();
            card.background = root.GetComponent<Image>();
            card.background.sprite = NeonAssets.SolidSprite(Color.white);
            card.outline = root.GetComponent<Outline>();
            card.outline.effectDistance = new Vector2(2f, -2f);
            card.iconText = CreateText(root.transform, "Icon", 34, TextAnchor.MiddleCenter, new Vector2(0.025f, 0.5f), new Vector2(0.15f, 0.93f), Color.white);
            card.nameText = CreateText(root.transform, "Name", 25, TextAnchor.MiddleLeft, new Vector2(0.17f, 0.62f), new Vector2(0.72f, 0.91f), Color.white);
            card.statusText = CreateText(root.transform, "Status", 17, TextAnchor.MiddleRight, new Vector2(0.68f, 0.64f), new Vector2(0.96f, 0.9f), Color.white);
            card.descriptionText = CreateText(root.transform, "Description", 17, TextAnchor.UpperLeft, new Vector2(0.05f, 0.08f), new Vector2(0.95f, 0.58f), new Color(0.72f, 0.78f, 0.9f));
            return root;
        }

        public void Configure(string icon, string title, string status, string description, Color accent, bool locked, bool mastered)
        {
            iconText.text = icon;
            nameText.text = title;
            statusText.text = status;
            descriptionText.text = description;

            var baseColor = mastered
                ? new Color(0.18f, 0.12f, 0.04f, 0.98f)
                : locked ? new Color(0.025f, 0.045f, 0.085f, 0.82f) : new Color(0.035f, 0.085f, 0.16f, 0.96f);
            background.color = Color.Lerp(baseColor, accent, mastered ? 0.2f : 0.1f);
            outline.effectColor = mastered ? new Color(1f, 0.78f, 0.22f, 0.95f) : new Color(accent.r, accent.g, accent.b, locked ? 0.32f : 0.82f);
            iconText.color = locked ? new Color(0.5f, 0.56f, 0.68f) : accent;
            nameText.color = locked ? new Color(0.58f, 0.63f, 0.73f) : Color.white;
            statusText.color = mastered ? new Color(1f, 0.82f, 0.35f) : accent;
            descriptionText.color = locked ? new Color(0.46f, 0.51f, 0.61f) : new Color(0.74f, 0.8f, 0.92f);
        }

        private static Text CreateText(Transform parent, string name, int fontSize, TextAnchor alignment, Vector2 anchorMin, Vector2 anchorMax, Color color)
        {
            var child = new GameObject(name, typeof(RectTransform), typeof(CanvasRenderer), typeof(Text));
            child.transform.SetParent(parent, false);
            var rect = child.GetComponent<RectTransform>();
            rect.anchorMin = anchorMin;
            rect.anchorMax = anchorMax;
            rect.offsetMin = rect.offsetMax = Vector2.zero;
            var text = child.GetComponent<Text>();
            text.font = Resources.GetBuiltinResource<Font>("LegacyRuntime.ttf");
            text.fontSize = fontSize;
            text.alignment = alignment;
            text.color = color;
            text.supportRichText = true;
            text.resizeTextForBestFit = true;
            text.resizeTextMinSize = 12;
            text.raycastTarget = false;
            return text;
        }
    }
}
